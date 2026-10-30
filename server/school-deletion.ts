import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { getActor,verifyPassword } from './auth.js';
import { digest,identifier,requireThat,type Actor } from './core.js';
import { platformAudit } from './platform.js';
import { accountKey,ipKey,guardLocked,failedLogin } from './security.js';

async function deletable(db:DB,org:string,a:Actor){
 const [school]=await db.query('SELECT id,slug,name FROM organizations WHERE id=$1 FOR UPDATE',[org]);requireThat(school,'NOT_FOUND','School not found.',404);
 requireThat(org!==a.org_id&&!(await db.query('SELECT 1 FROM platform_admins p JOIN users u ON u.id=p.user_id WHERE u.org_id=$1',[org])).length,'PROTECTED_MASTER','An organization containing a master administrator cannot be deleted.',409);return school;
}
export async function deletionRoutes(app:FastifyInstance,db:DB){
 app.post('/api/v1/platform/organizations/:id/deletion/prepare',{config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async req=>{
  const a=getActor(req),org=identifier.parse((req.params as any).id),b=z.object({organizationCode:z.string().max(60),reason:z.string().trim().min(5).max(1000),confirmed:z.literal(true)}).strict().parse(req.body),token=randomBytes(32).toString('base64url');
  return db.transaction(async tx=>{
   const school=await deletable(tx,org,a);requireThat(b.organizationCode===school.slug,'CODE_MISMATCH','Type the exact school login code.',400);
   await tx.query('DELETE FROM school_deletion_challenges WHERE actor_id=$1 AND (org_id=$2 OR expires_at<=now())',[a.id,org]);
   await tx.query("INSERT INTO school_deletion_challenges(token_hash,org_id,actor_id,session_hash,reason,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '5 minutes')",[digest(token),org,a.id,digest(req.cookies.school_session||''),b.reason]);
   return {token,school:{name:school.name,organizationCode:school.slug},expiresInSeconds:300,secondConfirmation:`DELETE ${school.slug}`};
  });
 });
 app.post('/api/v1/platform/organizations/:id/deletion/confirm',{config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async req=>{
  const a=getActor(req),org=identifier.parse((req.params as any).id),b=z.object({token:z.string().min(32).max(128),confirmation:z.string().max(80),password:z.string().min(1).max(128),confirmed:z.literal(true)}).strict().parse(req.body);
  const result=await db.transaction(async tx=>{
   const school=await deletable(tx,org,a),[proof]=await tx.query('SELECT * FROM school_deletion_challenges WHERE token_hash=$1 AND org_id=$2 AND actor_id=$3 AND session_hash=$4 AND expires_at>now() FOR UPDATE',[digest(b.token),org,a.id,digest(req.cookies.school_session||'')]);
   requireThat(proof,'CONFIRMATION_REQUIRED','Complete the first confirmation again; this request is missing, expired or belongs to another session.',409);
   requireThat(b.confirmation===`DELETE ${school.slug}`,'CONFIRMATION_MISMATCH','Type DELETE followed by the exact school login code.',400);
   const [admin]=await tx.query('SELECT u.password_hash,o.slug FROM users u JOIN organizations o ON o.id=u.org_id WHERE u.id=$1 AND u.active',[a.id]),key=accountKey(admin.slug,a.email);
   requireThat(!await guardLocked(tx,key),'LOGIN_LOCKED','Your login is temporarily locked. Try again later.',429);
   if(!await verifyPassword(b.password,admin.password_hash)){await failedLogin(tx,key,'account',req.ip);await failedLogin(tx,ipKey(req.ip),'ip',req.ip);return {invalid:true};}
   const users=await tx.query('SELECT email FROM users WHERE org_id=$1',[org]);
   for(const user of users)await tx.query('DELETE FROM login_guards WHERE key=$1',[accountKey(school.slug,user.email)]);
   await tx.exec('SET CONSTRAINTS ALL DEFERRED');
   await tx.query('DELETE FROM organizations WHERE id=$1',[org]);
   // Keep only a minimal master-owned security receipt, not a tenant-data copy.
   await platformAudit(tx,a,'delete_school',a.org_id,{targetHash:digest(org)},proof.reason);
   await tx.exec('SET CONSTRAINTS ALL IMMEDIATE');return {deleted:true};
  });
  requireThat(!result.invalid,'INVALID_PASSWORD','The master password is incorrect. Nothing was deleted.',401);return {deleted:true};
 });
}
