import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB, Row } from './db.js';
import { getActor, hashPassword, emailConfigured } from './auth.js';
import { id, text, identifier, roles, day, digest, allow, audit, requireThat, branchAccess, classAccess, studentAccess, visibleStudents, fileAccess, enqueue, type Actor } from './core.js';
import { randomBytes } from 'node:crypto';
import { isPlatformAdmin } from './platform.js';

const paramId=(req:any)=>identifier.parse(req.params.id);
export async function foundationRoutes(app:FastifyInstance, db:DB) {
  app.get('/api/v1/context',async req=>{
    const a=getActor(req),students=await visibleStudents(db,a);
    const [org]=await db.query('SELECT id,name,slug,timezone,settings FROM organizations WHERE id=$1',[a.org_id]);
    const branches=await db.query(`SELECT b.* FROM branches b WHERE b.org_id=$1 AND b.active AND ($2='owner' OR EXISTS(SELECT 1 FROM branch_assignments x WHERE x.org_id=b.org_id AND x.branch_id=b.id AND x.user_id=$3) OR b.id=ANY($4::text[])) ORDER BY b.name`,[a.org_id,a.role,a.id,students.map(s=>s.branch_id)]);
    const classes=await db.query(`SELECT c.* FROM classes c WHERE c.org_id=$1 AND (
      $2='owner' OR ($2 IN ('principal','office') AND c.branch_id=ANY($3::text[])) OR
      ($2='teacher' AND c.branch_id=ANY($3::text[]) AND EXISTS(SELECT 1 FROM teacher_assignments t WHERE t.org_id=c.org_id AND t.class_id=c.id AND t.user_id=$4)) OR c.id=ANY($5::text[])) ORDER BY c.name`,[a.org_id,a.role,branches.map(b=>b.id),a.id,students.map(s=>s.class_id).filter(Boolean)]);
    const years=await db.query('SELECT * FROM academic_years WHERE org_id=$1 ORDER BY starts DESC',[a.org_id]);
    const subjects=await db.query('SELECT * FROM subjects WHERE org_id=$1 ORDER BY name',[a.org_id]);
    return {buildVersion:app.buildVersion,organization:org,branches,classes,years,subjects,students,environment:process.env.QA_PREVIEW==='true'?'DISPOSABLE QA — synthetic data':process.env.NODE_ENV==='production'?'production':'development',user:{id:a.id,name:a.name,role:a.role,email:a.email,workspace:a.workspace,platformAdmin:a.workspace==='platform'&&await isPlatformAdmin(db,a)}};
  });
  app.get('/api/v1/students',async req=>({items:await visibleStudents(db,getActor(req))}));
  app.get('/api/v1/students/:id',async req=>studentAccess(db,getActor(req),paramId(req)));
  app.get('/api/v1/students/:id/teachers',async req=>{const a=getActor(req),s=await studentAccess(db,a,paramId(req));return {items:await db.query("SELECT DISTINCT u.id,u.name FROM teacher_assignments t JOIN users u ON u.org_id=t.org_id AND u.id=t.user_id JOIN branch_assignments b ON b.org_id=u.org_id AND b.user_id=u.id AND b.branch_id=$3 WHERE t.org_id=$1 AND t.class_id=$2 AND u.active AND u.role='teacher'",[a.org_id,s.class_id,s.branch_id])};});
  app.get('/api/v1/schools',async req=>{
    const a=getActor(req);allow(a,['owner']);return {items:await db.query('SELECT * FROM schools WHERE org_id=$1 ORDER BY name',[a.org_id])};
  });
  app.post('/api/v1/schools',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({name:text}).strict().parse(req.body),schoolId=id();
    await db.transaction(async tx=>{await tx.query('INSERT INTO schools(id,org_id,name) VALUES($1,$2,$3)',[schoolId,a.org_id,b.name]);await audit(tx,a,'create','school',schoolId,b);});return {id:schoolId,...b};
  });
  app.post('/api/v1/branches',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({schoolId:identifier,name:text}).strict().parse(req.body),branchId=id();
    requireThat((await db.query('SELECT 1 FROM schools WHERE org_id=$1 AND id=$2 AND active',[a.org_id,b.schoolId])).length);
    await db.transaction(async tx=>{await tx.query('INSERT INTO branches(id,org_id,school_id,name) VALUES($1,$2,$3,$4)',[branchId,a.org_id,b.schoolId,b.name]);await audit(tx,a,'create','branch',branchId,b,branchId);});return {id:branchId,...b};
  });
  app.patch('/api/v1/branches/:id',async req=>{
    const a=getActor(req);allow(a,['owner']);const bid=paramId(req),b=z.object({name:text.optional(),active:z.boolean().optional()}).strict().parse(req.body);
    await db.transaction(async tx=>{await branchAccess(tx,a,bid);await tx.query('UPDATE branches SET name=COALESCE($1,name),active=COALESCE($2,active) WHERE org_id=$3 AND id=$4',[b.name??null,b.active??null,a.org_id,bid]);await audit(tx,a,'update','branch',bid,b,bid);});return {ok:true};
  });
  app.get('/api/v1/users',async req=>{
    const a=getActor(req);allow(a,['owner']);return {items:await db.query('SELECT id,name,email,role,active FROM users WHERE org_id=$1 ORDER BY name',[a.org_id])};
  });
  app.get('/api/v1/directory',async req=>{
    const a=getActor(req);allow(a,['owner','principal','office','teacher']);return {items:await db.query(`SELECT DISTINCT u.id,u.name,u.role FROM users u WHERE u.org_id=$1 AND u.active AND ($2='owner' OR EXISTS(SELECT 1 FROM branch_assignments b JOIN branch_assignments mine ON mine.org_id=b.org_id AND mine.branch_id=b.branch_id WHERE b.org_id=u.org_id AND b.user_id=u.id AND mine.user_id=$3)) ORDER BY u.name`,[a.org_id,a.role,a.id])};
  });
  app.post('/api/v1/users',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({name:text,email:z.email(),role:roles,password:z.string().min(12).max(128).optional(),invite:z.boolean().default(false)}).strict().parse(req.body);
    requireThat(b.invite?emailConfigured():!!b.password,'CONFIGURATION_REQUIRED',b.invite?'Invitations require configured SMTP.':'A unique initial password is required.',503);
    const uid=id(),token=randomBytes(32).toString('base64url'),hash=await hashPassword(b.password||randomBytes(32).toString('base64url'));
    await db.transaction(async tx=>{
      await tx.query('INSERT INTO users(id,org_id,name,email,role,password_hash) VALUES($1,$2,$3,$4,$5,$6)',[uid,a.org_id,b.name,b.email.toLowerCase(),b.role,hash]);
      if(b.invite){await tx.query("INSERT INTO recovery_tokens(token_hash,org_id,user_id,purpose,expires_at) VALUES($1,$2,$3,'invite',now()+interval '24 hours')",[digest(token),a.org_id,uid]);await enqueue(tx,a.org_id,'invite:'+uid,'email',{userId:uid,subject:'Your school account invitation',text:`Set your password within 24 hours: ${process.env.PUBLIC_ORIGIN}/#/reset?token=${token}`});}
      await audit(tx,a,'create','user',uid,{name:b.name,email:b.email,role:b.role,invited:b.invite});
    });return {id:uid,name:b.name,email:b.email,role:b.role};
  });
  app.patch('/api/v1/users/:id',async req=>{
    const a=getActor(req);allow(a,['owner']);const uid=paramId(req),b=z.object({active:z.boolean().optional(),role:roles.optional()}).strict().parse(req.body);
    requireThat(uid!==a.id,'SELF_LOCKOUT','Use a second authorized owner for this account change.',409);
    await db.transaction(async tx=>{
      await tx.query('SELECT id FROM organizations WHERE id=$1 FOR UPDATE',[a.org_id]);
      const [u]=await tx.query('SELECT * FROM users WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,uid]);requireThat(u);
      requireThat(!(await tx.query('SELECT 1 FROM platform_admins WHERE user_id=$1',[uid])).length,'PROTECTED_MASTER','Master administrator access is managed by the platform operator.',409);
      if(u.role==='owner'&&u.active&&(b.active===false||(b.role&&b.role!=='owner')))requireThat((await tx.query("SELECT 1 FROM users WHERE org_id=$1 AND role='owner' AND active AND id<>$2",[a.org_id,uid])).length,'LAST_OWNER','Keep at least one active owner.',409);
      await tx.query('UPDATE users SET active=COALESCE($1,active),role=COALESCE($2,role) WHERE org_id=$3 AND id=$4',[b.active??null,b.role??null,a.org_id,uid]);
      await tx.query('DELETE FROM sessions WHERE org_id=$1 AND user_id=$2',[a.org_id,uid]);await audit(tx,a,'update','user',uid,b);
    });return {ok:true};
  });
  app.post('/api/v1/assignments',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({userId:identifier,branchId:identifier,remove:z.boolean().default(false)}).strict().parse(req.body);
    await db.transaction(async tx=>{
      await branchAccess(tx,a,b.branchId);requireThat((await tx.query('SELECT 1 FROM users WHERE org_id=$1 AND id=$2 AND active',[a.org_id,b.userId])).length);
      if(b.remove) await tx.query('DELETE FROM branch_assignments WHERE org_id=$1 AND branch_id=$2 AND user_id=$3',[a.org_id,b.branchId,b.userId]);
      else await tx.query('INSERT INTO branch_assignments(org_id,branch_id,user_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[a.org_id,b.branchId,b.userId]);
      await audit(tx,a,b.remove?'revoke_assignment':'assign','user',b.userId,b,b.branchId);
    });return {ok:true};
  });
  app.post('/api/v1/academic-years',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({name:text,starts:day,ends:day}).strict().refine(x=>x.ends>=x.starts).parse(req.body),year=id();
    await db.transaction(async tx=>{await tx.query('INSERT INTO academic_years(id,org_id,name,starts,ends) VALUES($1,$2,$3,$4,$5)',[year,a.org_id,b.name,b.starts,b.ends]);await audit(tx,a,'create','academic_year',year,b);});return {id:year,...b};
  });
  app.post('/api/v1/classes',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({name:text,branchId:identifier,yearId:identifier}).strict().parse(req.body),cid=id();
    await db.transaction(async tx=>{await branchAccess(tx,a,b.branchId);requireThat((await tx.query('SELECT 1 FROM academic_years WHERE org_id=$1 AND id=$2',[a.org_id,b.yearId])).length);await tx.query('INSERT INTO classes(id,org_id,branch_id,year_id,name) VALUES($1,$2,$3,$4,$5)',[cid,a.org_id,b.branchId,b.yearId,b.name]);await audit(tx,a,'create','class',cid,b,b.branchId);});return {id:cid,...b};
  });
  app.post('/api/v1/subjects',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({name:text}).strict().parse(req.body),sid=id();
    await db.transaction(async tx=>{await tx.query('INSERT INTO subjects(id,org_id,name) VALUES($1,$2,$3)',[sid,a.org_id,b.name]);await audit(tx,a,'create','subject',sid,b);});return {id:sid,...b};
  });
  app.post('/api/v1/teacher-assignments',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({userId:identifier,classId:identifier,subjectId:identifier,remove:z.boolean().default(false)}).strict().parse(req.body);
    await db.transaction(async tx=>{
      const c=await classAccess(tx,a,b.classId);
      requireThat((await tx.query("SELECT 1 FROM users u JOIN branch_assignments b ON b.org_id=u.org_id AND b.user_id=u.id WHERE u.org_id=$1 AND u.id=$2 AND u.role='teacher' AND u.active AND b.branch_id=$3",[a.org_id,b.userId,c.branch_id])).length);
      requireThat((await tx.query('SELECT 1 FROM subjects WHERE org_id=$1 AND id=$2',[a.org_id,b.subjectId])).length);
      if(b.remove)await tx.query('DELETE FROM teacher_assignments WHERE org_id=$1 AND user_id=$2 AND class_id=$3 AND subject_id=$4',[a.org_id,b.userId,b.classId,b.subjectId]);
      else await tx.query('INSERT INTO teacher_assignments(org_id,user_id,class_id,subject_id) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[a.org_id,b.userId,b.classId,b.subjectId]);
      await audit(tx,a,b.remove?'revoke_teacher':'assign_teacher','user',b.userId,b,c.branch_id);
    });return {ok:true};
  });
  app.post('/api/v1/guardian-links',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({userId:identifier,studentId:identifier,remove:z.boolean().default(false)}).strict().parse(req.body);
    await db.transaction(async tx=>{const s=await studentAccess(tx,a,b.studentId);requireThat((await tx.query("SELECT 1 FROM users WHERE org_id=$1 AND id=$2 AND role='parent' AND active",[a.org_id,b.userId])).length);if(b.remove)await tx.query('DELETE FROM guardian_links WHERE org_id=$1 AND user_id=$2 AND student_id=$3',[a.org_id,b.userId,b.studentId]);else await tx.query('INSERT INTO guardian_links(org_id,user_id,student_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[a.org_id,b.userId,b.studentId]);await audit(tx,a,b.remove?'unlink':'verify_guardian','student',b.studentId,b,s.branch_id);});return {ok:true};
  });
  app.post('/api/v1/students/:id/login',async req=>{
    const a=getActor(req);allow(a,['owner']);const sid=paramId(req),b=z.object({userId:identifier}).strict().parse(req.body);
    await db.transaction(async tx=>{const s=await studentAccess(tx,a,sid);requireThat((await tx.query("SELECT 1 FROM users WHERE org_id=$1 AND id=$2 AND active AND role='student'",[a.org_id,b.userId])).length);await tx.query('UPDATE students SET user_id=$1 WHERE org_id=$2 AND id=$3',[b.userId,a.org_id,sid]);await audit(tx,a,'link_login','student',sid,{userId:b.userId},s.branch_id);});return {ok:true};
  });
  app.get('/api/v1/notifications',async req=>{const a=getActor(req);return {items:await db.query('SELECT * FROM notifications WHERE org_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 100',[a.org_id,a.id])};});
  app.post('/api/v1/notifications/:id/read',async req=>{const a=getActor(req);await db.query('UPDATE notifications SET read_at=now() WHERE org_id=$1 AND user_id=$2 AND id=$3',[a.org_id,a.id,paramId(req)]);return {ok:true};});
  app.get('/api/v1/audit',async req=>{const a=getActor(req);allow(a,['owner']);const q=z.object({offset:z.coerce.number().int().min(0).default(0)}).parse(req.query);return {items:await db.query('SELECT * FROM audit_events WHERE org_id=$1 ORDER BY created_at DESC,id LIMIT 100 OFFSET $2',[a.org_id,q.offset])};});
  app.post('/api/v1/files',async req=>{
    const a=getActor(req);const b=z.object({branchId:identifier,studentId:identifier.optional(),classId:identifier.optional(),name:z.string().min(1).max(150).regex(/^[\p{L}\p{N} ._()-]+$/u),mime:z.enum(['application/pdf','image/png','image/jpeg','text/plain']),base64:z.string().max(6990510).regex(/^[A-Za-z0-9+/]*={0,2}$/)}).strict().parse(req.body);
    requireThat(!['parent','student'].includes(a.role)||b.studentId,'STUDENT_FILE_REQUIRED','Family uploads must belong to a verified child.',400);
    requireThat(!b.studentId||!b.classId,'INVALID_SCOPE','Choose a student or a class scope, not both.',400);
    const bytes=Buffer.from(b.base64,'base64');requireThat(bytes.length>0&&bytes.length<=5242880,'INVALID_FILE','File size must be between 1 byte and 5 MiB.',400);
    const valid=b.mime==='application/pdf'?bytes.subarray(0,5).toString()==='%PDF-':b.mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):b.mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:!bytes.includes(0);
    requireThat(valid,'INVALID_FILE','File content does not match its declared type.',400);
    const f={org_id:a.org_id,branch_id:b.branchId,student_id:b.studentId,class_id:b.classId,owner_id:a.id};
    await fileAccess(db,a,f);if(b.studentId)requireThat((await studentAccess(db,a,b.studentId)).branch_id===b.branchId);if(b.classId)requireThat((await classAccess(db,a,b.classId)).branch_id===b.branchId);
    const fid=id();await db.transaction(async tx=>{await tx.query('INSERT INTO file_assets(id,org_id,branch_id,student_id,class_id,owner_id,name,mime,bytes,sha256,size) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[fid,a.org_id,b.branchId,b.studentId||null,b.classId||null,a.id,b.name,b.mime,bytes,digest(bytes),bytes.length]);await audit(tx,a,'upload','file',fid,{name:b.name,size:bytes.length},b.branchId);});return {id:fid,name:b.name,size:bytes.length};
  });
  app.get('/api/v1/files/:id',async(req,reply)=>{
    const a=getActor(req),[f]=await db.query('SELECT * FROM file_assets WHERE org_id=$1 AND id=$2',[a.org_id,paramId(req)]);requireThat(f);await fileAccess(db,a,f);requireThat(!f.archived_at,'FILE_UNAVAILABLE','This document is archived.',404);
    reply.header('Content-Disposition',`attachment; filename*=UTF-8''${encodeURIComponent(f.name)}`).header('Cache-Control','no-store').header('X-Content-Type-Options','nosniff').type(f.mime);return Buffer.from(f.bytes);
  });
}
