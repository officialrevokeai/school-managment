import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB,Row } from './db.js';
import { getActor } from './auth.js';
import { id,text,identifier,allow,audit,requireThat,branchAccess,classAccess,studentAccess,notify,type Actor } from './core.js';
export async function recordDecision(db:DB,a:Actor,r:Row,entity:string,decision:string,comment:string) {
 await db.query('INSERT INTO review_decisions(id,org_id,branch_id,entity,entity_id,revision,actor_id,decision,comment) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id(),a.org_id,r.branch_id,entity,r.id,r.revision||1,a.id,decision,comment]);
 await audit(db,a,decision,entity,r.id,{previous:r.status,next:decision,revision:r.revision||1},r.branch_id,comment);
 await notify(db,a.org_id,r.created_by,`${entity}:${r.id}:${r.revision||1}:${decision}`,`${entity} ${decision}: ${comment}`,entity==='assessment'?'marks':entity==='admission'?'admissions':entity==='transfer'?'operations':'leave');
}
export async function peopleRoutes(app:FastifyInstance,db:DB){
 app.get('/api/v1/admissions',async req=>{
   const a=getActor(req);allow(a,['owner','principal','office']);const all=await db.query('SELECT * FROM admissions WHERE org_id=$1 ORDER BY created_at DESC LIMIT 500',[a.org_id]),items=[];
   for(const r of all){try{await branchAccess(db,a,r.branch_id);items.push({...r,files:await db.query('SELECT f.id,f.name,f.size FROM admission_files a JOIN file_assets f ON f.org_id=a.org_id AND f.id=a.file_id WHERE a.org_id=$1 AND a.admission_id=$2 AND f.archived_at IS NULL',[a.org_id,r.id]),history:await db.query("SELECT d.*,u.name AS actor_name FROM review_decisions d JOIN users u ON u.org_id=d.org_id AND u.id=d.actor_id WHERE d.org_id=$1 AND d.entity='admission' AND d.entity_id=$2 ORDER BY d.created_at",[a.org_id,r.id])});}catch{}}return {items};
 });
 const admission=z.object({branchId:identifier,classId:identifier,name:text,guardianName:text,guardianEmail:z.email(),notes:z.string().max(5000).default('')}).strict();
 app.post('/api/v1/admissions',async req=>{
   const a=getActor(req);allow(a,['owner','office']);const b=admission.parse(req.body),aid=id();
   await db.transaction(async tx=>{await branchAccess(tx,a,b.branchId);const cls=await classAccess(tx,a,b.classId);requireThat(cls.branch_id===b.branchId);await tx.query('INSERT INTO admissions(id,org_id,branch_id,class_id,created_by,name,guardian_name,guardian_email,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[aid,a.org_id,b.branchId,b.classId,a.id,b.name,b.guardianName,b.guardianEmail.toLowerCase(),b.notes]);await audit(tx,a,'create','admission',aid,{name:b.name,classId:b.classId},b.branchId);});return {id:aid,status:'draft'};
 });
 app.patch('/api/v1/admissions/:id',async req=>{
   const a=getActor(req);allow(a,['owner','office']);const b=admission.omit({branchId:true}).parse(req.body),aid=identifier.parse((req.params as any).id);
   await db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM admissions WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,aid]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(['draft','changes_requested'].includes(r.status),'LOCKED_RECORD','Only draft or changes-requested admissions can be revised.',409);const cls=await classAccess(tx,a,b.classId);requireThat(cls.branch_id===r.branch_id);await tx.query("UPDATE admissions SET name=$1,class_id=$2,guardian_name=$3,guardian_email=$4,notes=$5,status='draft',revision=revision+1 WHERE org_id=$6 AND id=$7",[b.name,b.classId,b.guardianName,b.guardianEmail.toLowerCase(),b.notes,a.org_id,aid]);await audit(tx,a,'revise','admission',aid,{revision:r.revision+1},r.branch_id);});return {ok:true};
 });
 app.post('/api/v1/admissions/:id/submit',async req=>{
   const a=getActor(req);allow(a,['owner','office']);const aid=identifier.parse((req.params as any).id);
   await db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM admissions WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,aid]);requireThat(r);await branchAccess(tx,a,r.branch_id);if(r.status==='submitted')return;requireThat(r.status==='draft','INVALID_TRANSITION','Only a draft can be submitted.',409);await tx.query("UPDATE admissions SET status='submitted',submitted_at=now() WHERE org_id=$1 AND id=$2",[a.org_id,aid]);await audit(tx,a,'submit','admission',aid,{},r.branch_id);});return {ok:true};
 });
 app.post('/api/v1/admissions/:id/decision',async req=>{
   const a=getActor(req);allow(a,['owner','principal']);const aid=identifier.parse((req.params as any).id),b=z.object({decision:z.enum(['approved','rejected','changes_requested']),comment:z.string().trim().min(3).max(2000)}).strict().parse(req.body);
   return db.transaction(async tx=>{
     const [r]=await tx.query('SELECT * FROM admissions WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,aid]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(r.created_by!==a.id,'SELF_APPROVAL','A different authorized reviewer must decide this application.',409);
     if(r.status==='approved'&&b.decision==='approved')return {id:aid,status:r.status,studentId:r.student_id};requireThat(r.status==='submitted','INVALID_TRANSITION','This application is not awaiting review.',409);
     let studentId:string|null=null;
     if(b.decision==='approved'){const cls=await classAccess(tx,a,r.class_id);requireThat(cls.branch_id===r.branch_id);studentId=id();await tx.query('INSERT INTO students(id,org_id,branch_id,name) VALUES($1,$2,$3,$4)',[studentId,a.org_id,r.branch_id,r.name]);await tx.query('INSERT INTO enrollments(id,org_id,student_id,class_id) VALUES($1,$2,$3,$4)',[id(),a.org_id,studentId,r.class_id]);}
     await tx.query('UPDATE admissions SET status=$1,student_id=$2 WHERE org_id=$3 AND id=$4',[b.decision,studentId,a.org_id,aid]);await recordDecision(tx,a,r,'admission',b.decision,b.comment);return {id:aid,status:b.decision,studentId};
   });
 });
 app.get('/api/v1/transfers',async req=>{const a=getActor(req);allow(a,['owner','principal','office']);const all=await db.query('SELECT * FROM transfers WHERE org_id=$1 ORDER BY created_at DESC LIMIT 200',[a.org_id]),items=[];for(const r of all){try{await branchAccess(db,a,r.branch_id);items.push(r);}catch{}}return {items};});
 app.post('/api/v1/transfers',async req=>{
   const a=getActor(req);allow(a,['owner','office']);const b=z.object({studentId:identifier,destinationClassId:identifier.optional(),externalDestination:text.optional(),notes:z.string().trim().min(3).max(2000)}).strict().refine(b=>!!b.destinationClassId!==!!b.externalDestination).parse(req.body),tid=id();
   await db.transaction(async tx=>{const s=await studentAccess(tx,a,b.studentId);if(b.destinationClassId){const c=await classAccess(tx,a,b.destinationClassId);requireThat(c.id!==s.class_id,'INVALID_TRANSFER','Choose a different destination class.',400);}await tx.query('INSERT INTO transfers(id,org_id,branch_id,student_id,created_by,destination_class_id,external_destination,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[tid,a.org_id,s.branch_id,s.id,a.id,b.destinationClassId||null,b.externalDestination||null,b.notes]);await audit(tx,a,'submit','transfer',tid,{studentId:s.id},s.branch_id);});return {id:tid,status:'submitted'};
 });
 app.post('/api/v1/transfers/:id/decision',async req=>{
   const a=getActor(req);allow(a,['owner','principal']);const tid=identifier.parse((req.params as any).id),b=z.object({decision:z.enum(['approved','rejected','changes_requested']),comment:z.string().trim().min(3).max(2000)}).strict().parse(req.body);
   await db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM transfers WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,tid]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(a.id!==r.created_by,'SELF_APPROVAL','A different reviewer is required.',409);if(r.status==='approved'&&b.decision==='approved')return;requireThat(r.status==='submitted','INVALID_TRANSITION','Transfer is not awaiting review.',409);
     if(b.decision==='approved'){const s=await studentAccess(tx,a,r.student_id);await tx.query('SELECT id FROM students WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,s.id]);await tx.query('UPDATE enrollments SET active=false WHERE org_id=$1 AND student_id=$2 AND active',[a.org_id,s.id]);if(r.destination_class_id){const c=await classAccess(tx,a,r.destination_class_id);await tx.query('UPDATE students SET branch_id=$1 WHERE org_id=$2 AND id=$3',[c.branch_id,a.org_id,s.id]);await tx.query('INSERT INTO enrollments(id,org_id,student_id,class_id) VALUES($1,$2,$3,$4) ON CONFLICT(org_id,student_id,class_id) DO UPDATE SET active=true',[id(),a.org_id,s.id,c.id]);}}
     await tx.query('UPDATE transfers SET status=$1 WHERE org_id=$2 AND id=$3',[b.decision,a.org_id,r.id]);await recordDecision(tx,a,r,'transfer',b.decision,b.comment);
   });return {ok:true};
 });
}
