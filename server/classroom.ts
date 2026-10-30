import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB,Row } from './db.js';
import { getActor } from './auth.js';
import { id,text,day,identifier,allow,audit,requireThat,branchAccess,classAccess,studentAccess,visibleStudents,portal,enqueue,notify,fileAccess,type Actor } from './core.js';
import { recordDecision } from './people.js';
const pid=(req:any)=>identifier.parse(req.params.id);
const attendanceEntry=z.object({studentId:identifier,status:z.enum(['present','absent','late','excused'])}).strict();
async function parentNotifications(db:DB,org:string,student:string,key:string,title:string,route:string){
 const recipients=await db.query('SELECT user_id FROM guardian_links WHERE org_id=$1 AND student_id=$2 UNION SELECT user_id FROM students WHERE org_id=$1 AND id=$2 AND user_id IS NOT NULL',[org,student]);
 for(const r of recipients)await notify(db,org,r.user_id,key,title,route);
}
export async function classroomRoutes(app:FastifyInstance,db:DB){
 app.get('/api/v1/attendance',async req=>{
   const a=getActor(req),students=await visibleStudents(db,a),ids=students.map(s=>s.id);
   const all=await db.query(`SELECT s.*,COALESCE(jsonb_agg(jsonb_build_object('studentId',e.student_id,'status',e.status)) FILTER(WHERE e.student_id IS NOT NULL),'[]') AS entries FROM attendance_sessions s LEFT JOIN attendance_entries e ON e.org_id=s.org_id AND e.session_id=s.id AND e.student_id=ANY($2::text[]) WHERE s.org_id=$1 GROUP BY s.id ORDER BY s.day DESC LIMIT 500`,[a.org_id,ids]);const items=[];
   for(const r of all){try{await classAccess(db,a,r.class_id);if(portal(a)&&r.status!=='submitted')continue;items.push(r);}catch{}}return {items};
 });
 app.post('/api/v1/attendance',async req=>{
   const a=getActor(req);allow(a,['owner','principal','teacher']);const b=z.object({classId:identifier,date:day,sessionKey:z.string().regex(/^[a-z0-9_-]{1,40}$/).default('daily'),entries:z.array(attendanceEntry).max(300),submit:z.boolean(),reason:z.string().trim().min(5).max(1000).optional()}).strict().parse(req.body);
   const [school]=await db.query('SELECT timezone FROM organizations WHERE id=$1',[a.org_id]);
   requireThat(b.date<=new Intl.DateTimeFormat('en-CA',{timeZone:school.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),'FUTURE_ATTENDANCE','Attendance cannot be recorded for a future school date.',400);
   return db.transaction(async tx=>{
     const cls=await classAccess(tx,a,b.classId);const roster=(await visibleStudents(tx,a)).filter(s=>s.class_id===cls.id);const rosterIds=roster.map(s=>s.id);requireThat(new Set(b.entries.map(e=>e.studentId)).size===b.entries.length,'DUPLICATE_STUDENT','Each student may appear once.',400);requireThat(b.entries.every(e=>rosterIds.includes(e.studentId)));if(b.submit)requireThat(b.entries.length===roster.length&&roster.length>0,'INCOMPLETE_REGISTER','A final register must include every currently enrolled student.',400);
     await tx.query('INSERT INTO attendance_sessions(id,org_id,branch_id,class_id,day,session_key,created_by) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(org_id,class_id,day,session_key) DO NOTHING',[id(),a.org_id,cls.branch_id,cls.id,b.date,b.sessionKey,a.id]);
     const [r]=await tx.query('SELECT * FROM attendance_sessions WHERE org_id=$1 AND class_id=$2 AND day=$3 AND session_key=$4 FOR UPDATE',[a.org_id,cls.id,b.date,b.sessionKey]);requireThat(a.role!=='teacher'||r.created_by===a.id);
     const before=await tx.query('SELECT student_id AS "studentId",status FROM attendance_entries WHERE org_id=$1 AND session_id=$2 ORDER BY student_id',[a.org_id,r.id]);const after=[...b.entries].sort((x,y)=>x.studentId.localeCompare(y.studentId));const same=JSON.stringify(before)===JSON.stringify(after);
     if(r.status==='submitted'&&same&&b.submit)return {id:r.id,status:r.status,revision:r.revision};
     if(r.status==='submitted')requireThat(b.submit&&b.reason,'CORRECTION_REASON','Submitted registers require a reasoned correction; they cannot become drafts.',409);
     const revision=r.status==='submitted'?r.revision+1:r.revision;
     await tx.query('DELETE FROM attendance_entries WHERE org_id=$1 AND session_id=$2',[a.org_id,r.id]);for(const e of after)await tx.query('INSERT INTO attendance_entries(org_id,session_id,student_id,status) VALUES($1,$2,$3,$4)',[a.org_id,r.id,e.studentId,e.status]);
     await tx.query("UPDATE attendance_sessions SET status=$1,revision=$2,submitted_at=CASE WHEN $1='submitted' THEN now() ELSE NULL END WHERE org_id=$3 AND id=$4",[b.submit?'submitted':'draft',revision,a.org_id,r.id]);
     if(r.status==='submitted')await tx.query('INSERT INTO attendance_revisions(id,org_id,session_id,actor_id,revision,reason,before_entries,after_entries) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id(),a.org_id,r.id,a.id,revision,b.reason,JSON.stringify(before),JSON.stringify(after)]);
     if(b.submit)for(const e of after){const prior=before.find(p=>p.studentId===e.studentId);await parentNotifications(tx,a.org_id,e.studentId,`attendance:${r.id}:${revision}:${e.studentId}`,`Attendance ${b.date}: ${e.status}`,'attendance');if(e.status==='absent'&&(r.status!=='submitted'||prior?.status!=='absent')||r.status==='submitted'&&prior?.status==='absent'&&e.status!=='absent')await enqueue(tx,a.org_id,`attendance:${cls.branch_id}:${r.id}:${revision}:${e.studentId}`,'school_event',{actorId:a.id,branchId:cls.branch_id,studentId:e.studentId,category:'attendance',purpose:`Attendance ${b.date}: ${e.status}`,businessKey:`attendance:${r.id}:${revision}:${e.studentId}`});}
     await audit(tx,a,b.submit?'submit':'save_draft','attendance',r.id,{revision,count:after.length},cls.branch_id,b.reason||null);return {id:r.id,status:b.submit?'submitted':'draft',revision};
   });
 });
 app.get('/api/v1/homework',async req=>{
   const a=getActor(req),all=await db.query('SELECT * FROM homework WHERE org_id=$1 ORDER BY due_at LIMIT 500',[a.org_id]),items=[];
   for(const h of all){try{await classAccess(db,a,h.class_id,h.subject_id);if(portal(a)&&h.status!=='published')continue;if(a.role==='office')continue;
     const children=portal(a)?(await visibleStudents(db,a)).map(s=>s.id):null;
     const submissions=await db.query('SELECT * FROM submissions WHERE org_id=$1 AND homework_id=$2 AND ($3::text[] IS NULL OR student_id=ANY($3::text[]))',[a.org_id,h.id,children]);const files=await db.query('SELECT f.id,f.name,f.size FROM homework_files h JOIN file_assets f ON f.org_id=h.org_id AND f.id=h.file_id WHERE h.org_id=$1 AND h.homework_id=$2',[a.org_id,h.id]);items.push({...h,submissions,files});
   }catch{}}return {items};
 });
 app.post('/api/v1/homework',async req=>{
   const a=getActor(req);allow(a,['owner','teacher']);const b=z.object({classId:identifier,subjectId:identifier,title:text,instructions:z.string().trim().min(3).max(10000),dueAt:z.iso.datetime(),fileIds:z.array(identifier).max(10).default([])}).strict().parse(req.body);requireThat(new Date(b.dueAt)>new Date(),'INVALID_DEADLINE','Due date must be in the future.',400);const hid=id();
   await db.transaction(async tx=>{const c=await classAccess(tx,a,b.classId,b.subjectId);requireThat((await tx.query('SELECT 1 FROM subjects WHERE org_id=$1 AND id=$2',[a.org_id,b.subjectId])).length);await tx.query('INSERT INTO homework(id,org_id,branch_id,class_id,subject_id,created_by,title,instructions,due_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[hid,a.org_id,c.branch_id,c.id,b.subjectId,a.id,b.title,b.instructions,b.dueAt]);for(const fid of b.fileIds){const [f]=await tx.query('SELECT * FROM file_assets WHERE org_id=$1 AND id=$2',[a.org_id,fid]);requireThat(f&&f.class_id===c.id&&!f.student_id);await fileAccess(tx,a,f);await tx.query('INSERT INTO homework_files(org_id,homework_id,file_id) VALUES($1,$2,$3)',[a.org_id,hid,fid]);}await audit(tx,a,'create','homework',hid,{title:b.title},c.branch_id);});return {id:hid,status:'draft'};
 });
 app.post('/api/v1/homework/:id/publish',async req=>{
   const a=getActor(req);allow(a,['owner','teacher']);const b=z.object({scheduledAt:z.iso.datetime().optional()}).strict().parse(req.body),hid=pid(req);
   await db.transaction(async tx=>{const [h]=await tx.query('SELECT * FROM homework WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,hid]);requireThat(h);await classAccess(tx,a,h.class_id,h.subject_id);requireThat(a.role==='owner'||h.created_by===a.id);if(h.status==='published'&&!b.scheduledAt)return;requireThat(h.status==='draft','INVALID_TRANSITION','Only a draft can be published.',409);requireThat(new Date(h.due_at)>new Date(),'INVALID_DEADLINE','The deadline has already passed.',409);
     if(b.scheduledAt){requireThat(new Date(b.scheduledAt)>new Date()&&new Date(b.scheduledAt)<new Date(h.due_at),'INVALID_SCHEDULE','Publication must be in the future and before the deadline.',400);await tx.query("UPDATE homework SET status='scheduled',scheduled_at=$1 WHERE id=$2",[b.scheduledAt,hid]);await enqueue(tx,a.org_id,'publish_homework:'+hid+':'+h.revision,'publish_homework',{homeworkId:hid,actorId:a.id,branchId:h.branch_id,revision:h.revision},b.scheduledAt);}
     else {await tx.query("UPDATE homework SET status='published',published_at=now() WHERE id=$1",[hid]);for(const s of(await visibleStudents(tx,a)).filter(s=>s.class_id===h.class_id))await parentNotifications(tx,a.org_id,s.id,'homework:'+hid,`Homework published: ${h.title}`,'homework');}
     await audit(tx,a,b.scheduledAt?'schedule':'publish','homework',hid,{scheduledAt:b.scheduledAt||null},h.branch_id);
   });return {ok:true};
 });
 app.post('/api/v1/homework/:id/submissions',async req=>{
   const a=getActor(req);allow(a,['parent','student']);const b=z.object({studentId:identifier,text:z.string().trim().min(1).max(10000),fileId:identifier.optional()}).strict().parse(req.body),hid=pid(req);
   return db.transaction(async tx=>{const s=await studentAccess(tx,a,b.studentId);const [h]=await tx.query("SELECT * FROM homework WHERE org_id=$1 AND id=$2 AND status='published' FOR UPDATE",[a.org_id,hid]);requireThat(h&&h.class_id===s.class_id);requireThat(new Date(h.due_at)>new Date(),'DEADLINE_PASSED','The submission deadline has passed.',409);if(b.fileId){const [f]=await tx.query('SELECT * FROM file_assets WHERE org_id=$1 AND id=$2',[a.org_id,b.fileId]);requireThat(f&&f.student_id===s.id);await fileAccess(tx,a,f);}
     const [prior]=await tx.query('SELECT * FROM submissions WHERE org_id=$1 AND homework_id=$2 AND student_id=$3 FOR UPDATE',[a.org_id,hid,s.id]);requireThat(!prior?.reviewed_at,'REVIEWED_SUBMISSION','Reviewed submissions require a new assignment or an explicit school correction process.',409);
     const rows=await tx.query('INSERT INTO submissions(id,org_id,homework_id,student_id,submitted_by,text,file_id) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(org_id,homework_id,student_id) DO UPDATE SET text=excluded.text,file_id=excluded.file_id,submitted_at=now(),revision=submissions.revision+1 RETURNING id',[id(),a.org_id,hid,s.id,a.id,b.text,b.fileId||null]);await audit(tx,a,'submit','homework',hid,{studentId:s.id},h.branch_id);return rows[0];
   });
 });
 app.post('/api/v1/submissions/:id/feedback',async req=>{
   const a=getActor(req);allow(a,['owner','teacher']);const b=z.object({feedback:z.string().trim().min(1).max(5000)}).strict().parse(req.body),sid=pid(req);
   await db.transaction(async tx=>{const [s]=await tx.query('SELECT s.*,h.class_id,h.subject_id,h.branch_id FROM submissions s JOIN homework h ON h.org_id=s.org_id AND h.id=s.homework_id WHERE s.org_id=$1 AND s.id=$2 FOR UPDATE OF s',[a.org_id,sid]);requireThat(s);await classAccess(tx,a,s.class_id,s.subject_id);await tx.query('UPDATE submissions SET feedback=$1,reviewed_by=$2,reviewed_at=now() WHERE org_id=$3 AND id=$4',[b.feedback,a.id,a.org_id,s.id]);await audit(tx,a,'feedback','submission',sid,{revision:s.revision},s.branch_id);await parentNotifications(tx,a.org_id,s.student_id,`feedback:${sid}:${s.revision}`,'Homework feedback is available.','homework');});return {ok:true};
 });
 app.get('/api/v1/leave',async req=>{
   const a=getActor(req),all=await db.query('SELECT * FROM leave_requests WHERE org_id=$1 ORDER BY created_at DESC LIMIT 500',[a.org_id]),items=[];for(const r of all){try{if(['owner','principal'].includes(a.role))await branchAccess(db,a,r.branch_id);else if(r.student_id)await studentAccess(db,a,r.student_id);else requireThat(r.created_by===a.id);items.push({...r,history:await db.query("SELECT * FROM review_decisions WHERE org_id=$1 AND entity='leave' AND entity_id=$2 ORDER BY created_at",[a.org_id,r.id])});}catch{}}return {items};
 });
 app.post('/api/v1/leave',async req=>{
   const a=getActor(req);const b=z.object({branchId:identifier,studentId:identifier.optional(),kind:text,starts:day,ends:day,reason:z.string().trim().min(5).max(2000)}).strict().refine(b=>b.ends>=b.starts&&new Date(b.ends).getTime()-new Date(b.starts).getTime()<=31*86400000).parse(req.body),lid=id();
   await db.transaction(async tx=>{if(portal(a)){requireThat(b.studentId);const s=await studentAccess(tx,a,b.studentId);requireThat(s.branch_id===b.branchId);}else{await branchAccess(tx,a,b.branchId);requireThat(!b.studentId,'INVALID_LEAVE_SCOPE','Staff requests must use the staff account.',400);}
     await tx.query('SELECT id FROM users WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,a.id]);const [conflict]=await tx.query("SELECT 1 FROM leave_requests WHERE org_id=$1 AND COALESCE(student_id,created_by)=$2 AND status IN ('submitted','approved') AND starts<=$3 AND ends>=$4",[a.org_id,b.studentId||a.id,b.ends,b.starts]);requireThat(!conflict,'LEAVE_CONFLICT','An overlapping pending or approved leave request exists.',409);
     await tx.query('INSERT INTO leave_requests(id,org_id,branch_id,student_id,created_by,kind,starts,ends,reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[lid,a.org_id,b.branchId,b.studentId||null,a.id,b.kind,b.starts,b.ends,b.reason]);await audit(tx,a,'submit','leave',lid,{starts:b.starts,ends:b.ends},b.branchId);});return {id:lid,status:'submitted'};
 });
 app.post('/api/v1/leave/:id/decision',async req=>{
   const a=getActor(req);allow(a,['owner','principal']);const b=z.object({decision:z.enum(['approved','rejected','changes_requested']),comment:z.string().trim().min(3).max(2000)}).strict().parse(req.body),lid=pid(req);
   await db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM leave_requests WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,lid]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(r.created_by!==a.id,'SELF_APPROVAL','Another authorized reviewer must decide your leave.',409);if(r.status===b.decision&&r.status!=='submitted')return;requireThat(r.status==='submitted','INVALID_TRANSITION','Leave is not awaiting a decision.',409);await tx.query('UPDATE leave_requests SET status=$1 WHERE id=$2',[b.decision,lid]);await recordDecision(tx,a,r,'leave',b.decision,b.comment);});return {ok:true};
 });
}
