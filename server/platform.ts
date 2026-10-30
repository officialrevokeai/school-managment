import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { getActor,hashPassword } from './auth.js';
import { id,text,identifier,roles,requireThat,type Actor } from './core.js';
import { normalizeIp } from './security.js';
import { deletionRoutes } from './school-deletion.js';

const reason=z.string().trim().min(5).max(1000);
export async function isPlatformAdmin(db:DB,a:Actor){return !!(await db.query('SELECT 1 FROM platform_admins WHERE user_id=$1',[a.id])).length;}
export async function platformAudit(db:DB,a:Actor,operation:string,org:string|null,details:unknown,why:string){await db.query('INSERT INTO platform_events(id,actor_id,org_id,operation,details,reason) VALUES($1,$2,$3,$4,$5,$6)',[id(),a.id,org,operation,details,why]);}
export async function platformOverview(db:DB){
 const items=await db.query(`SELECT o.id,o.slug,o.name,o.status,o.created_at,o.updated_at,
 (SELECT count(*)::int FROM schools s WHERE s.org_id=o.id AND s.active) AS schools,
 (SELECT count(*)::int FROM branches b WHERE b.org_id=o.id AND b.active) AS branches,
 (SELECT count(*)::int FROM students s WHERE s.org_id=o.id AND s.active) AS students,
 (SELECT count(*)::int FROM users u WHERE u.org_id=o.id AND u.active AND u.role IN ('owner','principal','teacher','office')) AS staff
 FROM organizations o ORDER BY o.created_at,o.id`);
 return {items,totals:{organizations:items.length,runningSchools:items.filter(o=>o.status==='active').reduce((n,o)=>n+o.schools,0),activeOrganizations:items.filter(o=>o.status==='active').length,students:items.filter(o=>o.status==='active').reduce((n,o)=>n+o.students,0),staff:items.filter(o=>o.status==='active').reduce((n,o)=>n+o.staff,0)}};
}
export async function platformRoutes(app:FastifyInstance,db:DB){
 app.addHook('preHandler',async req=>{if(req.url.startsWith('/api/v1/platform/')){const a=getActor(req);requireThat(await isPlatformAdmin(db,a),'PLATFORM_ONLY','Only a platform administrator can manage schools.');requireThat(a.workspace==='platform','MASTER_LOGIN_REQUIRED','Sign in through master access before opening this panel.');}});
 await deletionRoutes(app,db);
 app.get('/api/v1/platform/overview',async()=>({...await platformOverview(db),database:{mode:process.env.DATABASE_URL?'PostgreSQL':'Local database',supabaseProject:process.env.SUPABASE_PROJECT_REF||null,connected:!!process.env.DATABASE_URL},release:'Live provider verification and deployment gates are tracked separately.'}));
 app.post('/api/v1/platform/organizations',async req=>{
  const a=getActor(req),b=z.object({name:text,organization:z.string().regex(/^[a-z0-9-]{3,60}$/),ownerName:text,email:z.email().max(254),password:z.string().min(12).max(128),branchName:text,reason,confirmed:z.literal(true)}).strict().parse(req.body),org=id(),uid=id(),school=id(),branch=id(),hash=await hashPassword(b.password);
  await db.transaction(async tx=>{
   await tx.query('INSERT INTO organizations(id,slug,name) VALUES($1,$2,$3)',[org,b.organization,b.name]);
   await tx.query("INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,'owner')",[uid,org,b.ownerName,b.email.toLowerCase(),hash]);
   await tx.query('INSERT INTO schools(id,org_id,name) VALUES($1,$2,$3)',[school,org,b.name]);
   await tx.query('INSERT INTO branches(id,org_id,school_id,name) VALUES($1,$2,$3,$4)',[branch,org,school,b.branchName]);
   await platformAudit(tx,a,'create_school',org,{organization:b.organization,schoolId:school,branchId:branch,ownerId:uid},b.reason);
  });return {id:org,ownerId:uid,schoolId:school,branchId:branch,organization:b.organization};
 });
 app.patch('/api/v1/platform/organizations/:id',async req=>{
  const a=getActor(req),org=identifier.parse((req.params as any).id),b=z.object({status:z.enum(['active','suspended','archived']),reason,confirmed:z.literal(true)}).strict().parse(req.body);
  requireThat(org!==a.org_id,'SELF_LOCKOUT','Your own master account’s organization must remain active.',409);
  await db.transaction(async tx=>{
   const [o]=await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);requireThat(o,'NOT_FOUND','School organization not found.',404);
   requireThat(!(await tx.query('SELECT 1 FROM platform_admins p JOIN users u ON u.id=p.user_id WHERE u.org_id=$1 AND u.active',[org])).length||b.status==='active','MASTER_ORGANIZATION','An organization holding a master administrator must remain active.',409);
   await tx.query('UPDATE organizations SET status=$1,updated_at=now() WHERE id=$2',[b.status,org]);
   if(b.status!=='active')await tx.query('DELETE FROM sessions WHERE org_id=$1',[org]);
   await platformAudit(tx,a,'school_'+b.status,org,{},b.reason);
  });return {ok:true};
 });
 app.get('/api/v1/platform/organizations/:id/users',async req=>{
  const org=identifier.parse((req.params as any).id);requireThat((await db.query('SELECT 1 FROM organizations WHERE id=$1',[org])).length,'NOT_FOUND','School organization not found.',404);
  return {items:await db.query('SELECT id,name,email,role,active FROM users WHERE org_id=$1 ORDER BY name',[org]),branches:await db.query('SELECT id,name FROM branches WHERE org_id=$1 AND active ORDER BY name',[org])};
 });
 app.patch('/api/v1/platform/organizations/:id/users/:userId',async req=>{
  const a=getActor(req),org=identifier.parse((req.params as any).id),uid=identifier.parse((req.params as any).userId),b=z.object({role:roles,active:z.boolean(),branchId:identifier.optional(),reason,confirmed:z.literal(true)}).strict().parse(req.body);
  requireThat(uid!==a.id,'SELF_LOCKOUT','Use a second authorized administrator for your own account changes.',409);
  await db.transaction(async tx=>{
   await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[org]);
   const [u]=await tx.query('SELECT * FROM users WHERE org_id=$1 AND id=$2 FOR UPDATE',[org,uid]);requireThat(u,'NOT_FOUND','School account not found.',404);
   requireThat(!(await tx.query('SELECT 1 FROM platform_admins WHERE user_id=$1',[uid])).length,'PROTECTED_MASTER','Master administrators cannot be changed through school role controls.',409);
   if(u.role==='owner'&&u.active&&(!b.active||b.role!=='owner'))requireThat((await tx.query("SELECT id FROM users WHERE org_id=$1 AND role='owner' AND active AND id<>$2",[org,uid])).length,'LAST_OWNER','Keep at least one active owner for each school.',409);
   if(u.role!==b.role){
    requireThat(!['student','parent'].includes(u.role)&&!['student','parent'].includes(b.role),'LINKED_ROLE','Use the school’s enrollment/guardian workflow to change linked student or parent identities.',409);
    if(b.role!=='owner'){requireThat(b.branchId,'BRANCH_REQUIRED','Choose a school branch.',400);requireThat((await tx.query('SELECT 1 FROM branches WHERE org_id=$1 AND id=$2 AND active',[org,b.branchId])).length,'INVALID_BRANCH','Choose a branch in this school.',400);}
    await tx.query('DELETE FROM teacher_assignments WHERE org_id=$1 AND user_id=$2',[org,uid]);await tx.query('DELETE FROM branch_assignments WHERE org_id=$1 AND user_id=$2',[org,uid]);
    if(b.role!=='owner')await tx.query('INSERT INTO branch_assignments(org_id,branch_id,user_id) VALUES($1,$2,$3)',[org,b.branchId,uid]);
    await tx.query('UPDATE users SET custom_role_id=NULL WHERE org_id=$1 AND id=$2',[org,uid]);
   }
   await tx.query('UPDATE users SET role=$1,active=$2 WHERE org_id=$3 AND id=$4',[b.role,b.active,org,uid]);await tx.query('DELETE FROM sessions WHERE org_id=$1 AND user_id=$2',[org,uid]);
   await platformAudit(tx,a,'change_school_role',org,{userId:uid,role:b.role,active:b.active},b.reason);
  });return {ok:true};
 });
 app.get('/api/v1/platform/security',async req=>({currentIp:normalizeIp(req.ip),blocks:await db.query('SELECT ip,reason,expires_at,created_at FROM blocked_ips WHERE expires_at>now() ORDER BY created_at DESC LIMIT 200'),locks:await db.query('SELECT key,scope,ip,failures,locked_until FROM login_guards WHERE locked_until>now() ORDER BY updated_at DESC LIMIT 200'),events:await db.query('SELECT e.*,u.name AS actor_name FROM platform_events e JOIN users u ON u.id=e.actor_id ORDER BY e.created_at DESC,e.id LIMIT 100')}));
 app.post('/api/v1/platform/security/blocks',async req=>{
  const a=getActor(req),b=z.object({ip:z.string().max(60),hours:z.number().int().min(1).max(720),reason,confirmed:z.literal(true)}).strict().parse(req.body),ip=normalizeIp(b.ip);requireThat(ip!==normalizeIp(req.ip),'SELF_LOCKOUT','You cannot block your current IP address.',409);
  await db.transaction(async tx=>{await tx.query("INSERT INTO blocked_ips(ip,reason,expires_at,created_by) VALUES($1,$2,now()+($3::int*interval '1 hour'),$4) ON CONFLICT(ip) DO UPDATE SET reason=excluded.reason,expires_at=excluded.expires_at,created_by=excluded.created_by",[ip,b.reason,b.hours,a.id]);await platformAudit(tx,a,'block_ip',null,{ip,hours:b.hours},b.reason);});return {ok:true};
 });
 app.post('/api/v1/platform/security/unblock',async req=>{const a=getActor(req),b=z.object({ip:z.string().max(60),reason,confirmed:z.literal(true)}).strict().parse(req.body),ip=normalizeIp(b.ip);await db.transaction(async tx=>{await tx.query('DELETE FROM blocked_ips WHERE ip=$1',[ip]);await platformAudit(tx,a,'unblock_ip',null,{ip},b.reason);});return {ok:true};});
 app.post('/api/v1/platform/security/unlock',async req=>{const a=getActor(req),b=z.object({key:z.string().regex(/^[a-f0-9]{64}$/),reason,confirmed:z.literal(true)}).strict().parse(req.body);await db.transaction(async tx=>{await tx.query('DELETE FROM login_guards WHERE key=$1',[b.key]);await platformAudit(tx,a,'unlock_login',null,{key:b.key},b.reason);});return {ok:true};});
}
