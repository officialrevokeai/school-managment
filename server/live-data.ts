import type { FastifyInstance } from 'fastify';
import type { DB } from './db.js';
import { getActor } from './auth.js';
import { digest,visibleStudents,actorById,type Actor } from './core.js';
import { ipBlocked } from './security.js';
import { isPlatformAdmin,platformOverview } from './platform.js';
export async function dataRevision(db:DB,a:Actor){
 const students=await visibleStudents(db,a),ids=students.map(s=>s.id),classes=[...new Set(students.map(s=>s.class_id).filter(Boolean))],branches=a.role==='owner'?null:(await db.query('SELECT branch_id FROM branch_assignments WHERE org_id=$1 AND user_id=$2',[a.org_id,a.id])).map(b=>b.branch_id),family=['parent','student'].includes(a.role);
 const [v]=await db.query(`SELECT
 (SELECT max(created_at)::text FROM audit_events WHERE org_id=$1 AND (actor_id=$2 OR ($3='owner') OR ($3 IN ('principal','office','teacher') AND branch_id=ANY($4::text[])))) AS audit,
 (SELECT max(created_at)::text FROM notifications WHERE org_id=$1 AND user_id=$2) AS notifications,
 (SELECT jsonb_agg(jsonb_build_array(s.id,s.revision,e.student_id,e.status)) FROM attendance_sessions s JOIN attendance_entries e ON e.org_id=s.org_id AND e.session_id=s.id WHERE s.org_id=$1 AND e.student_id=ANY($5::text[]) AND (NOT $7::boolean OR s.status='submitted')) AS attendance,
 (SELECT jsonb_agg(jsonb_build_array(id,status,revision,due_at)) FROM homework WHERE org_id=$1 AND class_id=ANY($6::text[]) AND (NOT $7::boolean OR status='published')) AS homework,
 (SELECT jsonb_agg(jsonb_build_array(id,status,revision)) FROM assessments WHERE org_id=$1 AND class_id=ANY($6::text[]) AND (NOT $7::boolean OR status='published')) AS assessments,
 (SELECT jsonb_agg(jsonb_build_array(s.id,s.revision,s.reviewed_at)) FROM submissions s JOIN homework h ON h.org_id=s.org_id AND h.id=s.homework_id WHERE s.org_id=$1 AND ((NOT $7::boolean AND h.class_id=ANY($6::text[])) OR s.student_id=ANY($5::text[]))) AS submissions,
 (SELECT jsonb_agg(jsonb_build_array(id,status,revision)) FROM leave_requests WHERE org_id=$1 AND (created_by=$2 OR student_id=ANY($5::text[]))) AS leave,
 (SELECT jsonb_agg(jsonb_build_array(id,total_minor,paid_minor,pending_order_id)) FROM invoices WHERE org_id=$1 AND student_id=ANY($5::text[]) AND $3 IN ('owner','office','parent','student')) AS fees,
 (SELECT max(published_at)::text FROM announcements WHERE org_id=$1 AND status='published' AND (class_id=ANY($6::text[]) OR (class_id IS NULL AND branch_id IN (SELECT branch_id FROM students WHERE org_id=$1 AND id=ANY($5::text[])))) AND audience_roles ? $3) AS notices,
 (SELECT max(d.created_at)::text FROM delivery_events d JOIN message_recipients m ON m.org_id=d.org_id AND m.id=d.recipient_id JOIN message_requests r ON r.org_id=m.org_id AND r.id=m.request_id WHERE d.org_id=$1 AND ($3='owner' OR ($3 IN ('principal','office','teacher') AND r.branch_id=ANY($4::text[]) AND ($3<>'teacher' OR r.actor_id=$2)))) AS messages,
 (SELECT jsonb_build_object('name',name,'timezone',timezone,'settings',settings) FROM organizations WHERE id=$1) AS settings`,[a.org_id,a.id,a.role,branches,ids,classes,family]);
 const platform=a.workspace==='platform'&&await isPlatformAdmin(db,a)?{...await platformOverview(db),events:await db.query('SELECT max(created_at)::text AS latest,count(*)::int AS count FROM platform_events')}:null;
 return digest(JSON.stringify({students:students.map(s=>[s.id,s.name,s.class_id]),version:v,platform}));
}
export async function liveDataRoutes(app:FastifyInstance,db:DB){
 const connections=new Set<import('node:http').ServerResponse>();
 app.addHook('preClose',async()=>{for(const response of connections)response.end();connections.clear();});
 app.get('/api/v1/events',async(req,reply)=>{
  const actor=getActor(req),token=digest(req.cookies.school_session||'');let closed=false,busy=false,revision='';
  reply.hijack();connections.add(reply.raw);reply.raw.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});reply.raw.write(': connected\n\n');
  const tick=async()=>{if(closed||busy)return;busy=true;try{const[session]=await db.query("SELECT 1 FROM sessions s JOIN users u ON u.org_id=s.org_id AND u.id=s.user_id JOIN organizations o ON o.id=u.org_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND o.status='active'",[token]);if(!session||await ipBlocked(db,req.ip)){reply.raw.write('event: revoked\ndata: {}\n\n');reply.raw.end();return;}const current=await dataRevision(db,{...await actorById(db,actor.org_id,actor.id),workspace:actor.workspace});if(current!==revision){reply.raw.write(`event: ${revision?'change':'ready'}\ndata: ${JSON.stringify({revision:current,buildVersion:app.buildVersion})}\n\n`);revision=current;}else reply.raw.write(': heartbeat\n\n');}catch{if(!closed)reply.raw.write('event: unavailable\ndata: {}\n\n');}finally{busy=false;}};
  const timer=setInterval(tick,2000);reply.raw.on('close',()=>{closed=true;clearInterval(timer);connections.delete(reply.raw);});await tick();
 });
}
