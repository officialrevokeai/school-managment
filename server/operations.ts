import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB,Row } from './db.js';
import { getActor } from './auth.js';
import { id,text,day,identifier,allow,audit,requireThat,branchAccess,classAccess,studentAccess,visibleStudents,fileAccess,portal,type Actor } from './core.js';
import { recordDecision } from './people.js';
import { printable,escapeHtml } from './academics.js';
const minor=z.number().int().min(0).max(100000000),files=z.array(identifier).max(10).default([]);
const specs={
 material:{roles:['owner','teacher'],read:['owner','principal','teacher','parent','student'],schema:z.object({description:z.string().max(5000),fileIds:files}),review:false,class:true},
 lesson_plan:{roles:['owner','teacher'],read:['owner','principal','teacher'],schema:z.object({subjectId:identifier,objectives:text,content:z.string().min(3).max(10000),fileIds:files}),review:true,class:true},
 exam:{roles:['owner','principal'],read:['owner','principal','teacher','parent','student'],schema:z.object({subjectId:identifier,startsAt:z.iso.datetime(),endsAt:z.iso.datetime(),venue:text}).refine(b=>b.endsAt>b.startsAt),review:true,class:true},
 calendar:{roles:['owner','principal'],read:['owner','principal','teacher','office','parent','student'],schema:z.object({starts:day,ends:day,description:z.string().max(5000)}).refine(b=>b.ends>=b.starts),review:false,class:false},
 discipline:{roles:['owner','principal','teacher'],read:['owner','principal','teacher'],schema:z.object({description:z.string().min(5).max(5000),followUp:day}),review:true,class:false,student:true},
 complaint:{roles:['parent'],read:['owner','principal','parent'],schema:z.object({description:z.string().min(5).max(5000),desiredResolution:z.string().max(2000)}),review:true,class:false,student:true},
 meeting:{roles:['owner','principal','teacher','parent'],read:['owner','principal','teacher','parent'],schema:z.object({startsAt:z.iso.datetime(),endsAt:z.iso.datetime(),agenda:text}).refine(b=>b.endsAt>b.startsAt),review:true,class:false,student:true},
 teacher_review:{roles:['owner','principal'],read:['owner','principal'],schema:z.object({teacherId:identifier,period:text,rating:z.number().int().min(1).max(5),comments:z.string().min(5).max(5000)}),review:true,class:false},
 vendor:{roles:['owner','office'],read:['owner','office'],schema:z.object({email:z.email(),phone:z.string().regex(/^\+[1-9]\d{7,14}$/),category:text}),review:false,class:false},
 expense:{roles:['owner','office'],read:['owner','office'],schema:z.object({vendorId:identifier,amountMinor:minor.refine(n=>n>0),date:day,category:text,invoiceReference:text,fileIds:files}),review:true,class:false},
 payroll:{roles:['owner','office'],read:['owner','office'],schema:z.object({userId:identifier,period:day,baseMinor:minor,allowanceMinor:minor,deductionMinor:minor}),review:true,class:false},
 reconciliation:{roles:['owner','office'],read:['owner','office'],schema:z.object({reference:text,date:day,amountMinor:minor,notes:z.string().min(5).max(5000)}),review:true,class:false},
 certificate:{roles:['owner','office'],read:['owner','office','parent','student'],schema:z.object({certificateType:text,body:z.string().min(5).max(10000)}),review:false,class:false,student:true},
 principal_report:{roles:['principal'],read:['owner','principal'],schema:z.object({periodStart:day,periodEnd:day,summary:z.string().min(5).max(10000)}).refine(b=>b.periodEnd>=b.periodStart),review:false,class:false},
 timetable:{roles:['owner','principal','teacher'],read:['owner','principal','teacher','parent','student'],schema:z.object({teacherId:identifier,subjectId:identifier,weekday:z.number().int().min(1).max(7),startsMinute:z.number().int().min(0).max(1439),endsMinute:z.number().int().min(1).max(1440)}).refine(b=>b.endsMinute>b.startsMinute),review:true,class:true}
} as const;
export const recordKinds=Object.keys(specs);
const kindSchema=z.enum(recordKinds as [keyof typeof specs,...(keyof typeof specs)[]]);
const recordSchema=z.object({kind:kindSchema,branchId:identifier,classId:identifier.optional(),studentId:identifier.optional(),title:text,data:z.unknown()}).strict();
async function recordRead(db:DB,a:Actor,r:Row){
 const spec=specs[r.kind as keyof typeof specs];requireThat(spec&&(spec.read as readonly string[]).includes(a.role));
 if(portal(a)){
  requireThat(['published','approved'].includes(r.status)||r.created_by===a.id);
  if(r.kind==='complaint')requireThat(r.created_by===a.id);
  if(r.student_id)await studentAccess(db,a,r.student_id);
  else if(r.class_id)await classAccess(db,a,r.class_id);
  else requireThat((await visibleStudents(db,a)).some(s=>s.branch_id===r.branch_id));
 }else{
  await branchAccess(db,a,r.branch_id);if(r.student_id)await studentAccess(db,a,r.student_id);if(r.class_id)await classAccess(db,a,r.class_id,r.kind==='lesson_plan'?r.data.subjectId:undefined);
  if(a.role==='teacher'&&['lesson_plan','material'].includes(r.kind)&&r.created_by!==a.id)requireThat(['approved','published'].includes(r.status));
 }
}
async function validateRecord(db:DB,a:Actor,b:z.infer<typeof recordSchema>){
 const spec=specs[b.kind];requireThat((spec.roles as readonly string[]).includes(a.role));const data=spec.schema.parse(b.data) as Row;
 requireThat(!spec.class||b.classId,'CLASS_REQUIRED','This record requires a class.',400);requireThat(!('student'in spec&&spec.student)||b.studentId,'STUDENT_REQUIRED','This record requires a student.',400);
 if(portal(a)){requireThat(b.studentId);const s=await studentAccess(db,a,b.studentId);requireThat(s.branch_id===b.branchId);if(b.classId)requireThat(b.classId===s.class_id);}
 else await branchAccess(db,a,b.branchId);
 if(b.classId){const c=await classAccess(db,a,b.classId,b.kind==='lesson_plan'?data.subjectId:undefined);requireThat(c.branch_id===b.branchId);}
 if(b.studentId)requireThat((await studentAccess(db,a,b.studentId)).branch_id===b.branchId);
 for(const fid of data.fileIds||[]){const[f]=await db.query('SELECT * FROM file_assets WHERE org_id=$1 AND id=$2',[a.org_id,fid]);requireThat(f&&f.branch_id===b.branchId&&(!f.student_id||f.student_id===b.studentId)&&(!f.class_id||f.class_id===b.classId));await fileAccess(db,a,f);}
 if(['exam','lesson_plan','timetable'].includes(b.kind))requireThat((await db.query('SELECT 1 FROM subjects WHERE org_id=$1 AND id=$2',[a.org_id,data.subjectId])).length);
 if(b.kind==='expense'){const [v]=await db.query("SELECT * FROM school_records WHERE org_id=$1 AND id=$2 AND kind='vendor' AND branch_id=$3 AND status='published'",[a.org_id,data.vendorId,b.branchId]);requireThat(v,'INVALID_VENDOR','Select an active branch vendor.',400);}
 if(['payroll','teacher_review','timetable'].includes(b.kind)){const userId=data.userId||data.teacherId;requireThat((await db.query('SELECT 1 FROM users u JOIN branch_assignments b ON b.org_id=u.org_id AND b.user_id=u.id WHERE u.org_id=$1 AND u.id=$2 AND u.active AND b.branch_id=$3',[a.org_id,userId,b.branchId])).length);}
 if(b.kind==='payroll'){data.netMinor=data.baseMinor+data.allowanceMinor-data.deductionMinor;requireThat(Number.isSafeInteger(data.netMinor)&&data.netMinor>=0&&data.netMinor<=100000000,'INVALID_PAYROLL','Payroll net amount is outside the supported range.',400);}
 if(b.kind==='timetable'){requireThat((await db.query("SELECT 1 FROM teacher_assignments t JOIN users u ON u.org_id=t.org_id AND u.id=t.user_id WHERE t.org_id=$1 AND t.user_id=$2 AND t.class_id=$3 AND t.subject_id=$4 AND u.active AND u.role='teacher'",[a.org_id,data.teacherId,b.classId,data.subjectId])).length);}
 return data;
}
export async function operationsRoutes(app:FastifyInstance,db:DB){
 app.get('/api/v1/records',async req=>{
  const a=getActor(req),q=z.object({kind:kindSchema,offset:z.coerce.number().int().min(0).default(0),limit:z.coerce.number().int().min(1).max(100).default(50),search:z.string().max(200).default('')}).parse(req.query);const rows=await db.query('SELECT * FROM school_records WHERE org_id=$1 AND kind=$2 AND title ILIKE $3 ORDER BY created_at DESC',[a.org_id,q.kind,'%'+q.search+'%']),visible=[];
  for(const r of rows){try{await recordRead(db,a,r);visible.push(r);}catch{}}return {items:visible.slice(q.offset,q.offset+q.limit),total:visible.length};
 });
 app.post('/api/v1/records',async req=>{
  const a=getActor(req),b=recordSchema.parse(req.body),rid=id();await db.transaction(async tx=>{const data=await validateRecord(tx,a,b);const spec=specs[b.kind];await tx.query('INSERT INTO school_records(id,org_id,branch_id,class_id,student_id,created_by,kind,title,data,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[rid,a.org_id,b.branchId,b.classId||null,b.studentId||null,a.id,b.kind,b.title,data,spec.review?'draft':'published']);await audit(tx,a,'create',b.kind,rid,{title:b.title},b.branchId);});return {id:rid};
 });
 app.post('/api/v1/records/:id/submit',async req=>{
  const a=getActor(req),rid=identifier.parse((req.params as any).id);await db.transaction(async tx=>{const[r]=await tx.query('SELECT * FROM school_records WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,rid]);requireThat(r);await recordRead(tx,a,r);requireThat(r.created_by===a.id||a.role==='owner');if(r.status==='submitted')return;requireThat(['draft','changes_requested'].includes(r.status),'INVALID_TRANSITION','Only a draft or revised request can be submitted.',409);await tx.query("UPDATE school_records SET status='submitted',updated_at=now() WHERE id=$1",[rid]);await audit(tx,a,'submit',r.kind,rid,{revision:r.revision},r.branch_id);});return {ok:true};
 });
 app.patch('/api/v1/records/:id',async req=>{
  const a=getActor(req),rid=identifier.parse((req.params as any).id),b=recordSchema.extend({reason:z.string().trim().min(5).max(1000)}).parse(req.body);
  await db.transaction(async tx=>{const[r]=await tx.query('SELECT * FROM school_records WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,rid]);requireThat(r);await recordRead(tx,a,r);requireThat(r.created_by===a.id||a.role==='owner');requireThat(['draft','changes_requested'].includes(r.status),'LOCKED_RECORD','Reviewed or published records require a new revision workflow.',409);requireThat(r.kind===b.kind&&r.branch_id===b.branchId&&r.class_id===(b.classId||null)&&r.student_id===(b.studentId||null),'IMMUTABLE_SCOPE','Record scope cannot change during revision.',400);const data=await validateRecord(tx,a,b);await tx.query("UPDATE school_records SET title=$1,data=$2,status='draft',revision=revision+1,updated_at=now() WHERE id=$3",[b.title,data,rid]);await audit(tx,a,'revise',r.kind,rid,{before:{title:r.title,data:r.data},after:{title:b.title,data},revision:r.revision+1},r.branch_id,b.reason);});return {ok:true};
 });
 app.post('/api/v1/records/:id/archive',async req=>{
  const a=getActor(req),rid=identifier.parse((req.params as any).id),b=z.object({reason:z.string().trim().min(5).max(1000)}).strict().parse(req.body);await db.transaction(async tx=>{const[r]=await tx.query('SELECT * FROM school_records WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,rid]);requireThat(r);await recordRead(tx,a,r);requireThat(a.role==='owner'||r.created_by===a.id);requireThat(['draft','rejected'].includes(r.status),'LOCKED_RECORD','Only non-posted draft/rejected records may be archived.',409);await tx.query("UPDATE school_records SET status='archived',updated_at=now() WHERE id=$1",[rid]);await audit(tx,a,'archive',r.kind,rid,{previous:r.status},r.branch_id,b.reason);});return {ok:true};
 });
 app.post('/api/v1/records/:id/decision',async req=>{
  const a=getActor(req),rid=identifier.parse((req.params as any).id),b=z.object({decision:z.enum(['approved','rejected','changes_requested']),comment:z.string().trim().min(3).max(2000)}).strict().parse(req.body);
  await db.transaction(async tx=>{const[r]=await tx.query('SELECT * FROM school_records WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,rid]);requireThat(r);const financial=['expense','payroll','reconciliation'].includes(r.kind);allow(a,financial?['owner']:['owner','principal']);await branchAccess(tx,a,r.branch_id);requireThat(r.created_by!==a.id,'SELF_APPROVAL','Another authorized reviewer is required.',409);if(r.status===b.decision)return;requireThat(r.status==='submitted','INVALID_TRANSITION','Record is not awaiting review.',409);
   if(b.decision==='approved'&&r.kind==='timetable'){
    await tx.query('SELECT id FROM branches WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,r.branch_id]);
    const[conflict]=await tx.query("SELECT 1 FROM school_records WHERE org_id=$1 AND branch_id=$2 AND kind='timetable' AND status='approved' AND (class_id=$3 OR data->>'teacherId'=$4) AND (data->>'weekday')::int=$5 AND (data->>'startsMinute')::int<$6 AND (data->>'endsMinute')::int>$7",[a.org_id,r.branch_id,r.class_id,r.data.teacherId,r.data.weekday,r.data.endsMinute,r.data.startsMinute]);requireThat(!conflict,'TIMETABLE_CONFLICT','Class or teacher already has an approved overlapping lesson.',409);
   }
   await tx.query('UPDATE school_records SET status=$1,updated_at=now() WHERE id=$2',[b.decision,rid]);await recordDecision(tx,a,r,r.kind,b.decision,b.comment);
  });return {ok:true};
 });
 app.post('/api/v1/records/:id/record-external-payroll',async req=>{
  const a=getActor(req);allow(a,['owner','office']);const rid=identifier.parse((req.params as any).id),b=z.object({reference:text,verification:z.string().trim().min(10).max(1000)}).strict().parse(req.body);
  await db.transaction(async tx=>{const[r]=await tx.query("SELECT * FROM school_records WHERE org_id=$1 AND id=$2 AND kind='payroll' FOR UPDATE",[a.org_id,rid]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(r.status==='approved','INVALID_TRANSITION','Only an approved payroll record may record a verified external payout.',409);await tx.query("UPDATE school_records SET status='paid_external',data=data||$1::jsonb,updated_at=now() WHERE id=$2",[{externalReference:b.reference},rid]);await audit(tx,a,'record_external_payout','payroll',rid,{reference:b.reference,netMinor:r.data.netMinor},r.branch_id,b.verification);});return {recorded:true,transferredByApplication:false};
 });
 app.get('/api/v1/records/:id/document',async(req,reply)=>{
  const a=getActor(req),rid=identifier.parse((req.params as any).id),[r]=await db.query("SELECT * FROM school_records WHERE org_id=$1 AND id=$2 AND kind IN ('certificate','principal_report')",[a.org_id,rid]);requireThat(r);await recordRead(db,a,r);requireThat(['approved','published'].includes(r.status));const [org]=await db.query('SELECT name FROM organizations WHERE id=$1',[a.org_id]);const student=r.student_id?await studentAccess(db,a,r.student_id):null;reply.type('text/html; charset=utf-8').header('Content-Disposition',`attachment; filename="${r.kind}-${rid}.html"`);return printable(r.title,org.name,`<p>${escapeHtml(student?.name||'')}</p><p>${escapeHtml(r.data.body||r.data.summary)}</p>`);
 });
}
