import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB,Row } from './db.js';
import { getActor } from './auth.js';
import { identifier,allow,audit,requireThat,branchAccess,visibleStudents,portal,id } from './core.js';
export function csvCell(value:unknown){let text=String(value??'');if(/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export async function reportsRoutes(app:FastifyInstance,db:DB){
 const filterStudents=async(req:any)=>{
  const a=getActor(req),q=z.object({branchId:identifier.optional()}).parse(req.query);let students=await visibleStudents(db,a);
  if(q.branchId){if(portal(a))requireThat(students.some(s=>s.branch_id===q.branchId));else await branchAccess(db,a,q.branchId);students=students.filter(s=>s.branch_id===q.branchId);}return {a,students,branchId:q.branchId};
 };
 app.get('/api/v1/dashboard',async req=>{
  const {a,students,branchId}=await filterStudents(req),ids=students.map(s=>s.id),classes=[...new Set(students.map(s=>s.class_id).filter(Boolean))];
  const [totals]=await db.query(`WITH pending AS (
    SELECT branch_id FROM admissions WHERE org_id=$1 AND status='submitted' AND created_by<>$5
    UNION ALL SELECT branch_id FROM assessments WHERE org_id=$1 AND status='submitted' AND created_by<>$5
    UNION ALL SELECT branch_id FROM leave_requests WHERE org_id=$1 AND status='submitted' AND created_by<>$5
    UNION ALL SELECT branch_id FROM school_records WHERE org_id=$1 AND status='submitted' AND created_by<>$5 AND ($4='owner' OR kind NOT IN ('expense','payroll','reconciliation'))
  ) SELECT
   (SELECT count(*)::int FROM homework h WHERE h.org_id=$1 AND h.status='published' AND h.class_id=ANY($3::text[]) AND $4<>'office' AND ($4<>'teacher' OR EXISTS(SELECT 1 FROM teacher_assignments t WHERE t.org_id=h.org_id AND t.user_id=$5 AND t.class_id=h.class_id AND t.subject_id=h.subject_id))) AS homework,
   (SELECT count(*)::int FROM pending p JOIN branches b ON b.org_id=$1 AND b.id=p.branch_id AND b.active WHERE $4 IN ('owner','principal') AND ($6::text IS NULL OR p.branch_id=$6) AND ($4='owner' OR EXISTS(SELECT 1 FROM branch_assignments x WHERE x.org_id=$1 AND x.branch_id=b.id AND x.user_id=$5))) AS approvals,
   CASE WHEN $4 IN ('owner','office','parent','student') THEN (SELECT COALESCE(sum(total_minor-paid_minor),0)::bigint FROM invoices WHERE org_id=$1 AND student_id=ANY($2::text[])) ELSE NULL END AS outstanding,
   (SELECT jsonb_build_object('total',count(*),'present',count(*) FILTER(WHERE e.status IN ('present','late'))) FROM attendance_entries e JOIN attendance_sessions s ON s.org_id=e.org_id AND s.id=e.session_id WHERE e.org_id=$1 AND e.student_id=ANY($2::text[]) AND s.status='submitted') AS attendance`,[a.org_id,ids,classes,a.role,a.id,branchId||null]);
  return {students:students.length,homework:totals.homework,approvals:totals.approvals,outstandingMinor:totals.outstanding===null?null:Number(totals.outstanding),attendance:totals.attendance.total?Math.round(totals.attendance.present/totals.attendance.total*1000)/10:null};
 });
 app.get('/api/v1/reports',async req=>{
  const {a,students}=await filterStudents(req);allow(a,['owner','principal','office','teacher']);const ids=students.map(s=>s.id);
  const attendance=await db.query("SELECT s.day,s.class_id,e.student_id,e.status FROM attendance_entries e JOIN attendance_sessions s ON s.org_id=e.org_id AND s.id=e.session_id WHERE e.org_id=$1 AND e.student_id=ANY($2::text[]) AND s.status='submitted' ORDER BY s.day DESC LIMIT 1000",[a.org_id,ids]);
  const finance=['owner','office'].includes(a.role)?await db.query('SELECT id,student_id,title,due_date,total_minor,paid_minor,total_minor-paid_minor AS balance_minor FROM invoices WHERE org_id=$1 AND student_id=ANY($2::text[]) ORDER BY due_date LIMIT 1000',[a.org_id,ids]):null;
  return {students:students.map(s=>({id:s.id,name:s.name,class:s.class_name,branchId:s.branch_id})),attendance,finance,limit:1000};
 });
 app.get('/api/v1/reports/export',async(req,reply)=>{
  const a=getActor(req),q=z.object({kind:z.enum(['students','attendance','finance','results','staff','counts']),branchId:identifier.optional(),from:z.iso.date().optional(),to:z.iso.date().optional()}).strict().refine(v=>!v.from||!v.to||v.from<=v.to).parse(req.query);if(q.kind==='finance')allow(a,['owner','office','parent','student']);else if(['staff','counts'].includes(q.kind))allow(a,['owner','principal','office']);else allow(a,['owner','principal','teacher','office','parent','student']);
  let students=await visibleStudents(db,a);if(q.branchId){if(portal(a))requireThat(students.some(s=>s.branch_id===q.branchId));else await branchAccess(db,a,q.branchId);students=students.filter(s=>s.branch_id===q.branchId);}const ids=students.map(s=>s.id);let headers:string[],rows:Row[];
  if(q.kind==='students'){headers=['id','name','class_name','branch_id'];rows=students;}
  else if(q.kind==='attendance'){headers=['day','student_id','student_name','class_name','status'];rows=await db.query("SELECT s.day::text,e.student_id,p.name AS student_name,c.name AS class_name,e.status FROM attendance_entries e JOIN attendance_sessions s ON s.org_id=e.org_id AND s.id=e.session_id JOIN students p ON p.org_id=e.org_id AND p.id=e.student_id JOIN classes c ON c.org_id=s.org_id AND c.id=s.class_id WHERE e.org_id=$1 AND e.student_id=ANY($2::text[]) AND s.status='submitted' AND ($3::date IS NULL OR s.day>=$3) AND ($4::date IS NULL OR s.day<=$4) ORDER BY s.day DESC,e.student_id LIMIT 10001",[a.org_id,ids,q.from||null,q.to||null]);}
  else if(q.kind==='finance'){headers=['id','student_id','title','due_date','currency','total_minor','paid_minor','balance_minor'];rows=await db.query('SELECT *,due_date::text AS due_date,total_minor-paid_minor AS balance_minor FROM invoices WHERE org_id=$1 AND student_id=ANY($2::text[]) AND ($3::date IS NULL OR due_date>=$3) AND ($4::date IS NULL OR due_date<=$4) ORDER BY due_date,id LIMIT 10001',[a.org_id,ids,q.from||null,q.to||null]);}
  else if(q.kind==='results'){headers=['assessment_id','title','student_id','student_name','subject','kind','score','maximum','published_at'];rows=await db.query(`SELECT a.id AS assessment_id,a.title,m.student_id,s.name AS student_name,t.name AS subject,m.kind,m.score,a.maximum,a.published_at::text
   FROM mark_entries m JOIN assessments a ON a.org_id=m.org_id AND a.id=m.assessment_id JOIN students s ON s.org_id=m.org_id AND s.id=m.student_id JOIN subjects t ON t.org_id=a.org_id AND t.id=a.subject_id
   WHERE m.org_id=$1 AND m.student_id=ANY($2::text[]) AND a.status='published' AND ($3::date IS NULL OR a.published_at::date>=$3) AND ($4::date IS NULL OR a.published_at::date<=$4)
   AND ($5<>'teacher' OR EXISTS(SELECT 1 FROM teacher_assignments x WHERE x.org_id=a.org_id AND x.class_id=a.class_id AND x.subject_id=a.subject_id AND x.user_id=$6)) ORDER BY a.published_at DESC,a.id,m.student_id LIMIT 10001`,[a.org_id,ids,q.from||null,q.to||null,a.role,a.id]);}
  else {
   const people=await db.query(`SELECT u.id,u.name,u.role FROM users u WHERE u.org_id=$1 AND u.active AND u.role IN ('owner','principal','teacher','office') AND
   (($3='owner' AND $4::text IS NULL) OR EXISTS(SELECT 1 FROM branch_assignments b WHERE b.org_id=u.org_id AND b.user_id=u.id AND ($4::text IS NULL OR b.branch_id=$4) AND ($3='owner' OR EXISTS(SELECT 1 FROM branch_assignments mine WHERE mine.org_id=b.org_id AND mine.branch_id=b.branch_id AND mine.user_id=$2)))) ORDER BY u.name,u.id`,[a.org_id,a.id,a.role,q.branchId||null]);
   if(q.kind==='staff'){headers=['id','name','role'];rows=people;}
   else{headers=['metric','count'];rows=[{metric:'students',count:students.length},{metric:'staff',count:people.length},...['owner','principal','teacher','office'].map(role=>({metric:role,count:people.filter(p=>p.role===role).length}))];}
  }
  requireThat(rows.length<=10000,'EXPORT_TOO_LARGE','More than 10,000 rows match. Narrow the branch or date filters before exporting.',413);
  await audit(db,a,'export',q.kind,id(),{count:rows.length},q.branchId||null);
  reply.type('text/csv; charset=utf-8').header('Content-Disposition',`attachment; filename="${q.kind}.csv"`);return '\uFEFF'+[headers.map(csvCell).join(','),...rows.map(r=>headers.map(h=>csvCell(r[h])).join(','))].join('\r\n');
 });
 app.get('/api/v1/settings',async req=>{const a=getActor(req);allow(a,['owner']);return (await db.query('SELECT name,timezone,settings FROM organizations WHERE id=$1',[a.org_id]))[0];});
 app.patch('/api/v1/settings',async req=>{
  const a=getActor(req);allow(a,['owner']);const b=z.object({name:z.string().trim().min(1).max(200),timezone:z.string().max(80),parentMessaging:z.boolean(),quietStart:z.number().int().min(0).max(23),quietEnd:z.number().int().min(0).max(23)}).strict().parse(req.body);let valid=true;try{new Intl.DateTimeFormat('en',{timeZone:b.timezone}).format();}catch{valid=false;}requireThat(valid,'INVALID_TIMEZONE','Choose an IANA timezone.',400);
  await db.transaction(async tx=>{await tx.query('UPDATE organizations SET name=$1,timezone=$2,settings=settings||$3::jsonb WHERE id=$4',[b.name,b.timezone,{parentMessaging:b.parentMessaging,quietStart:b.quietStart,quietEnd:b.quietEnd},a.org_id]);await audit(tx,a,'update','settings',a.org_id,b);});return {ok:true};
 });
 app.get('/api/v1/integrations/health',async req=>{const a=getActor(req);allow(a,['owner']);const [heartbeat]=await db.query("SELECT seen_at FROM worker_heartbeats WHERE id='school-worker'");return {worker:{lastSeenAt:heartbeat?.seen_at||null,healthy:!!heartbeat&&Date.now()-new Date(heartbeat.seen_at).getTime()<120000},outbox:await db.query('SELECT kind,status,count(*)::int AS count FROM outbox WHERE org_id=$1 GROUP BY kind,status',[a.org_id]),webhooks:await db.query('SELECT provider,status,count(*)::int AS count FROM webhook_events WHERE org_id=$1 GROUP BY provider,status',[a.org_id])};});
}
