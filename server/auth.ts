import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { id, digest, Fault, requireThat, audit, enqueue, type Actor } from './core.js';
import { accountKey,ipKey,normalizeIp,ipBlocked,guardLocked,failedLogin } from './security.js';

const derive = promisify(scrypt);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = await new Promise<Buffer>((res,rej) => scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:67108864},(e,k) => e?rej(e):res(k)));
  return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string) {
  const [type,salt,key] = hash.split('$');
  if(type!=='scrypt'||!salt||!key) return false;
  const result = await new Promise<Buffer>((res,rej) => scrypt(password,salt,64,{N:32768,r:8,p:1,maxmem:67108864},(e,k) => e?rej(e):res(k)));
  const expected=Buffer.from(key,'hex'); return result.length===expected.length&&timingSafeEqual(result,expected);
}
export type Authed = FastifyRequest & { actor: Actor };
export function getActor(req: FastifyRequest): Actor { const a=(req as Authed).actor; requireThat(a,'UNAUTHENTICATED','Sign in to continue.',401); return a; }
const password = z.string().min(12).max(128);
export function emailConfigured() { return !!(process.env.SMTP_HOST&&process.env.SMTP_FROM&&process.env.PUBLIC_ORIGIN); }
// One fresh database round trip; authorization is never cached across requests.
export async function sessionAuthorization(db:DB,tokenHash:string,ip:string,ignoreIp=false){
 const [result]=await db.query(`SELECT
 CASE WHEN $4::boolean THEN false ELSE EXISTS(SELECT 1 FROM blocked_ips WHERE ip=$2 AND expires_at>now()) OR EXISTS(SELECT 1 FROM login_guards WHERE key=$3 AND locked_until>now()) END AS blocked,
 (SELECT row_to_json(identity) FROM (SELECT u.id,u.org_id,u.name,u.role,u.email,s.csrf,s.workspace FROM sessions s JOIN users u ON u.id=s.user_id AND u.org_id=s.org_id JOIN organizations o ON o.id=u.org_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND o.status='active') identity) AS actor`,[tokenHash,normalizeIp(ip),ipKey(ip),ignoreIp]);
 return result as {blocked:boolean;actor:Actor|null};
}
export async function authRoutes(app: FastifyInstance, db: DB) {
  const dummy = await hashPassword(randomBytes(32).toString('hex'));
  app.addHook('preHandler',async req => {
    if (!req.url.startsWith('/api/')) return;
    const token=req.cookies.school_session;
    if (token) {
      const s=await sessionAuthorization(db,digest(token),req.ip,req.url==='/api/v1/auth/logout');
      requireThat(!s.blocked,'IP_BLOCKED','Access from this IP is temporarily blocked.',403);
      if(s.actor)(req as Authed).actor=s.actor;
    }else if(req.url!=='/api/v1/auth/logout')requireThat(!await ipBlocked(db,req.ip),'IP_BLOCKED','Access from this IP is temporarily blocked.',403);
    if (req.method!=='GET'&&req.method!=='HEAD') {
      const expected=process.env.PUBLIC_ORIGIN||'http://localhost:3000';
      requireThat(req.headers.origin===expected,'ORIGIN_REJECTED','Reload this application from its configured origin.',403);
      if (req.url!=='/api/v1/auth/login'&&req.url!=='/api/v1/auth/forgot'&&req.url!=='/api/v1/auth/reset'&&req.url!=='/api/v1/setup/owner') {
        const a=getActor(req);
        requireThat(typeof req.headers['x-csrf-token']==='string'&&req.headers['x-csrf-token']===a.csrf,'CSRF_REJECTED','Refresh your session and try again.');
      }
    }
  });
  app.post('/api/v1/auth/login',{config:{rateLimit:{max:60,timeWindow:'1 minute'}}},async(req,reply) => {
    const b=z.object({organization:z.string().trim().min(1).max(80),email:z.email().max(254),password:z.string().min(1).max(128),workspace:z.enum(['school','platform']).default('school')}).strict().parse(req.body);
    const token=randomBytes(32).toString('base64url'),csrf=randomBytes(32).toString('base64url');
    const key=accountKey(b.organization,b.email),ip=normalizeIp(req.ip);
    const result=await db.transaction(async tx=>{
      await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))',[key]);
      if(await guardLocked(tx,key)||await ipBlocked(tx,ip))return {blocked:true};
      const [u]=await tx.query('SELECT u.*,o.status AS organization_status FROM users u JOIN organizations o ON o.id=u.org_id WHERE o.slug=$1 AND u.email=$2',[b.organization,b.email.toLowerCase()]);
      const valid=await verifyPassword(b.password,u?.password_hash||dummy);
      const master=b.workspace!=='platform'||!!u&&(await tx.query('SELECT 1 FROM platform_admins WHERE user_id=$1',[u.id])).length>0;
      if(!valid||!u?.active||u.organization_status!=='active'||!master){
        await failedLogin(tx,key,'account',ip);await failedLogin(tx,ipKey(ip),'ip',ip);return {invalid:true};
      }
      await tx.query('DELETE FROM login_guards WHERE key=$1',[key]);
      await tx.query("INSERT INTO sessions(token_hash,org_id,user_id,csrf,expires_at,ip,workspace) VALUES($1,$2,$3,$4,now()+interval '12 hours',$5,$6)",[digest(token),u.org_id,u.id,csrf,ip,b.workspace]);
      await tx.query('DELETE FROM sessions WHERE org_id=$1 AND user_id=$2 AND token_hash IN (SELECT token_hash FROM sessions WHERE org_id=$1 AND user_id=$2 ORDER BY created_at DESC,token_hash DESC OFFSET 5)',[u.org_id,u.id]);
      await audit(tx,u as Actor,'login','user',u.id);return {user:u};
    });
    requireThat(!result.blocked,'LOGIN_LOCKED','Too many failed attempts. Wait 15 minutes or contact your platform administrator.',429);
    const u=result.user;requireThat(u,'INVALID_LOGIN','The organization, email or password is incorrect.',401);
    reply.setCookie('school_session',token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:43200});
    return {user:{id:u.id,name:u.name,role:u.role,email:u.email,org_id:u.org_id,workspace:b.workspace},csrf};
  });
  app.get('/api/v1/auth/me',async req=>({user:getActor(req),csrf:getActor(req).csrf}));
  app.get('/api/v1/auth/sessions',async req=>{const a=getActor(req);return {items:(await db.query('SELECT token_hash,created_at,expires_at,ip FROM sessions WHERE org_id=$1 AND user_id=$2 AND expires_at>now() ORDER BY created_at DESC',[a.org_id,a.id])).map(s=>({id:digest(s.token_hash),createdAt:s.created_at,expiresAt:s.expires_at,ip:s.ip,current:s.token_hash===digest(req.cookies.school_session||'')}))};});
  app.post('/api/v1/auth/sessions/revoke-others',async req=>{const a=getActor(req);await db.transaction(async tx=>{await tx.query('DELETE FROM sessions WHERE org_id=$1 AND user_id=$2 AND token_hash<>$3',[a.org_id,a.id,digest(req.cookies.school_session||'')]);await audit(tx,a,'revoke_other_sessions','user',a.id);});return {ok:true};});
  app.post('/api/v1/auth/logout',async(req,reply)=>{
    await db.query('DELETE FROM sessions WHERE token_hash=$1',[digest(req.cookies.school_session||'')]);
    reply.clearCookie('school_session',{path:'/'});return {ok:true};
  });
  app.post('/api/v1/auth/forgot',{config:{rateLimit:{max:5,timeWindow:'1 hour'}}},async req=>{
    const b=z.object({organization:z.string().min(1).max(80),email:z.email().max(254)}).strict().parse(req.body);
    requireThat(emailConfigured(),'EMAIL_NOT_CONFIGURED','Password recovery is unavailable. Contact your school administrator.',503);
    const [u]=await db.query('SELECT u.* FROM users u JOIN organizations o ON o.id=u.org_id WHERE o.slug=$1 AND u.email=$2 AND u.active',[b.organization,b.email.toLowerCase()]);
    if(u) await db.transaction(async tx=>{
      const token=randomBytes(32).toString('base64url');
      await tx.query("INSERT INTO recovery_tokens(token_hash,org_id,user_id,purpose,expires_at) VALUES($1,$2,$3,'reset',now()+interval '30 minutes')",[digest(token),u.org_id,u.id]);
      await enqueue(tx,u.org_id,'reset:'+digest(token),'email',{userId:u.id,subject:'Reset your school password',text:`Use this one-time link within 30 minutes: ${process.env.PUBLIC_ORIGIN}/#/reset?token=${token}`});
    });
    return {accepted:true};
  });
  app.post('/api/v1/auth/reset',async req=>{
    const b=z.object({token:z.string().min(32).max(128),password}).strict().parse(req.body);
    const newHash=await hashPassword(b.password);
    await db.transaction(async tx=>{
      const [t]=await tx.query('SELECT * FROM recovery_tokens WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE',[digest(b.token)]);
      requireThat(t,'INVALID_TOKEN','This recovery link is invalid or expired.',400);
      await tx.query('UPDATE users SET password_hash=$1 WHERE org_id=$2 AND id=$3 AND active',[newHash,t.org_id,t.user_id]);
      await tx.query('DELETE FROM sessions WHERE org_id=$1 AND user_id=$2',[t.org_id,t.user_id]);
      await tx.query('UPDATE recovery_tokens SET used_at=now() WHERE org_id=$1 AND user_id=$2 AND used_at IS NULL',[t.org_id,t.user_id]);
      await audit(tx,{id:t.user_id,org_id:t.org_id} as Actor,'password_reset','user',t.user_id);
    });return {ok:true};
  });
}
export async function provision(db: DB, input: unknown) {
  const b=z.object({organization:z.string().regex(/^[a-z0-9-]{3,60}$/),name:z.string().min(1).max(200),ownerName:z.string().min(1).max(200),email:z.email(),password}).strict().parse(input);
  const hash=await hashPassword(b.password);
  return db.transaction(async tx=>{
    await tx.query('SELECT pg_advisory_xact_lock(48290218)');
    const [exists]=await tx.query('SELECT 1 FROM organizations LIMIT 1');
    requireThat(!exists,'ALREADY_PROVISIONED','Initial provisioning is disabled after the first organization exists.',409);
    const org=id(),user=id();
    await tx.query('INSERT INTO organizations(id,slug,name) VALUES($1,$2,$3)',[org,b.organization,b.name]);
    await tx.query("INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,'owner')",[user,org,b.ownerName,b.email.toLowerCase(),hash]);
    await audit(tx,{id:user,org_id:org} as Actor,'provision','organization',org);
    return {organization:b.organization,ownerId:user};
  });
}
