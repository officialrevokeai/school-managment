import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { getActor } from './auth.js';
import { id,text,identifier,allow,audit,requireThat,classAccess,branchAccess } from './core.js';
export async function revisionRoutes(app:FastifyInstance,db:DB){
 app.patch('/api/v1/homework/:id',async req=>{
  const a=getActor(req);allow(a,['owner','teacher']);const hid=identifier.parse((req.params as any).id),b=z.object({title:text,instructions:z.string().trim().min(3).max(10000),dueAt:z.iso.datetime()}).strict().parse(req.body);
  await db.transaction(async tx=>{const[h]=await tx.query('SELECT * FROM homework WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,hid]);requireThat(h);await classAccess(tx,a,h.class_id,h.subject_id);requireThat(a.role==='owner'||h.created_by===a.id);requireThat(h.status==='draft','LOCKED_RECORD','Only draft homework can be edited.',409);requireThat(new Date(b.dueAt)>new Date(),'INVALID_DEADLINE','Choose a future deadline.',400);await tx.query('UPDATE homework SET title=$1,instructions=$2,due_at=$3,revision=revision+1 WHERE id=$4',[b.title,b.instructions,b.dueAt,hid]);await audit(tx,a,'revise','homework',hid,{before:{title:h.title,instructions:h.instructions,dueAt:h.due_at},after:b,revision:h.revision+1},h.branch_id);});return {ok:true};
 });
 app.post('/api/v1/homework/:id/cancel-schedule',async req=>{
  const a=getActor(req);allow(a,['owner','teacher']);const hid=identifier.parse((req.params as any).id);await db.transaction(async tx=>{const[h]=await tx.query('SELECT * FROM homework WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,hid]);requireThat(h);await classAccess(tx,a,h.class_id,h.subject_id);requireThat(a.role==='owner'||h.created_by===a.id);requireThat(h.status==='scheduled','INVALID_TRANSITION','Homework is not scheduled.',409);const[job]=await tx.query("SELECT * FROM outbox WHERE org_id=$1 AND event_key=$2 FOR UPDATE",[a.org_id,'publish_homework:'+hid+':'+h.revision]);requireThat(job?.status==='queued','DISPATCH_STARTED','The publisher has started; refresh to see its result.',409);await tx.query("UPDATE outbox SET status='done' WHERE id=$1",[job.id]);await tx.query("UPDATE homework SET status='draft',scheduled_at=NULL,revision=revision+1 WHERE id=$1",[hid]);await audit(tx,a,'cancel_schedule','homework',hid,{},h.branch_id);});return {ok:true};
 });
 app.post('/api/v1/assessments/:id/correction',async req=>{
  const a=getActor(req);allow(a,['owner','principal']);const aid=identifier.parse((req.params as any).id),b=z.object({reason:z.string().trim().min(10).max(2000)}).strict().parse(req.body);
  await db.transaction(async tx=>{const[r]=await tx.query('SELECT * FROM assessments WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,aid]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(['approved','published'].includes(r.status),'INVALID_TRANSITION','Only approved/published results require withdrawal and reapproval.',409);const marks=await tx.query('SELECT student_id,kind,score FROM mark_entries WHERE org_id=$1 AND assessment_id=$2',[a.org_id,aid]);await tx.query('INSERT INTO assessment_revisions(id,org_id,assessment_id,revision,snapshot,reason,recorded_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[id(),a.org_id,aid,r.revision,{assessment:r,marks},b.reason,a.id]);await tx.query("UPDATE assessments SET status='changes_requested',published_at=NULL WHERE id=$1",[aid]);await audit(tx,a,'withdraw_for_correction','assessment',aid,{previous:r.status,next:'changes_requested',revision:r.revision},r.branch_id,b.reason);});return {ok:true};
 });
}
