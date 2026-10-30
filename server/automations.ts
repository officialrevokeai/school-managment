import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB,Row } from './db.js';
import { getActor } from './auth.js';
import { id,text,identifier,allow,audit,requireThat,branchAccess,actorById,enqueue,studentAccess } from './core.js';
import { waScope } from './whatsapp.js';
export async function automationRoutes(app:FastifyInstance,db:DB){
 app.post('/api/v1/whatsapp/routing',async req=>{
  const a=getActor(req);allow(a,['owner']);const b=z.object({branchId:identifier,category:z.enum(['fees','attendance','general','exams','homework','receipts','leave','admissions','events']),senderId:identifier,templateId:identifier}).strict().parse(req.body);
  await db.transaction(async tx=>{await branchAccess(tx,a,b.branchId);const [s]=await tx.query('SELECT * FROM whatsapp_senders WHERE org_id=$1 AND id=$2 AND branch_id=$3 AND active',[a.org_id,b.senderId,b.branchId]);requireThat(s);const [t]=await tx.query("SELECT * FROM message_templates WHERE org_id=$1 AND id=$2 AND account_id=$3 AND provider_status='APPROVED' AND supported",[a.org_id,b.templateId,s.account_id]);requireThat(t&&t.parameter_count===1,'AUTOMATION_TEMPLATE','Automation templates currently require one text body parameter for the event summary.',400);await tx.query('INSERT INTO sender_routes(org_id,branch_id,category,sender_id,template_id,actor_id) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(org_id,branch_id,category) DO UPDATE SET sender_id=excluded.sender_id,template_id=excluded.template_id,actor_id=excluded.actor_id',[a.org_id,b.branchId,b.category,b.senderId,b.templateId,a.id]);await audit(tx,a,'route','whatsapp_sender',s.id,b,b.branchId);});return {ok:true};
 });
 app.get('/api/v1/whatsapp/routing',async req=>{const a=getActor(req);allow(a,['owner','office','principal']);const all=await db.query('SELECT * FROM sender_routes WHERE org_id=$1',[a.org_id]),items=[];for(const r of all){try{await branchAccess(db,a,r.branch_id);items.push(r);}catch{}}return {items};});
 app.post('/api/v1/whatsapp/reminder-rules',async req=>{
  const a=getActor(req);allow(a,['owner','office']);const b=z.object({branchId:identifier,name:text,daysOverdue:z.number().int().min(0).max(365),cadenceDays:z.number().int().min(1).max(90),maxFollowups:z.number().int().min(1).max(12)}).strict().parse(req.body),rid=id();
  await db.transaction(async tx=>{await branchAccess(tx,a,b.branchId);requireThat((await tx.query("SELECT 1 FROM sender_routes WHERE org_id=$1 AND branch_id=$2 AND category='fees'",[a.org_id,b.branchId])).length,'ROUTING_REQUIRED','Configure a fee sender and approved automation template first.',409);await tx.query('INSERT INTO reminder_rules(id,org_id,branch_id,actor_id,name,days_overdue,cadence_days,max_followups) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[rid,a.org_id,b.branchId,a.id,b.name,b.daysOverdue,b.cadenceDays,b.maxFollowups]);await audit(tx,a,'create','reminder_rule',rid,b,b.branchId);});return {id:rid};
 });
 app.get('/api/v1/whatsapp/reminder-rules',async req=>{const a=getActor(req);allow(a,['owner','office']);const all=await db.query('SELECT * FROM reminder_rules WHERE org_id=$1',[a.org_id]),items=[];for(const r of all){try{await branchAccess(db,a,r.branch_id);items.push(r);}catch{}}return {items};});
 app.patch('/api/v1/whatsapp/reminder-rules/:id',async req=>{const a=getActor(req);allow(a,['owner','office']);const b=z.object({active:z.boolean()}).strict().parse(req.body),rid=identifier.parse((req.params as any).id);await db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM reminder_rules WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,rid]);requireThat(r);await branchAccess(tx,a,r.branch_id);await tx.query('UPDATE reminder_rules SET active=$1 WHERE id=$2',[b.active,rid]);await audit(tx,a,'update','reminder_rule',rid,b,r.branch_id);});return {ok:true};});
}
export async function expandSchoolEvent(db:DB,org:string,event:Row){
 await db.transaction(async tx=>{
  const [route]=await tx.query('SELECT * FROM sender_routes WHERE org_id=$1 AND branch_id=$2 AND category=$3',[org,event.branchId,event.category]);
  if(!route){await tx.query("INSERT INTO audit_events(id,org_id,branch_id,operation,entity,entity_id,changes) VALUES($1,$2,$3,'notification_channel_unconfigured','school_event',$4,$5)",[id(),org,event.branchId,event.businessKey,{category:event.category,status:'blocked_configuration'}]);return;}
  // The owner explicitly delegated automation routing; revocation of that owner still blocks execution.
  const actor=await actorById(tx,org,route.actor_id);allow(actor,['owner']);await waScope(tx,actor,event.branchId,event.studentId);
  const [s]=await tx.query('SELECT * FROM whatsapp_senders WHERE org_id=$1 AND id=$2 AND active',[org,route.sender_id]);const [t]=await tx.query("SELECT * FROM message_templates WHERE org_id=$1 AND id=$2 AND provider_status='APPROVED' AND supported",[org,route.template_id]);requireThat(s&&t&&s.account_id===t.account_id&&t.parameter_count===1,'ROUTE_NOT_READY');
  const recipients=await tx.query("SELECT c.* FROM recipient_consents c JOIN guardian_links g ON g.org_id=c.org_id AND g.user_id=c.user_id AND g.student_id=c.student_id JOIN users u ON u.org_id=c.org_id AND u.id=c.user_id AND u.active WHERE c.org_id=$1 AND c.branch_id=$2 AND c.student_id=$3 AND c.opted_in AND c.opted_out_at IS NULL AND c.categories ? $4",[org,event.branchId,event.studentId,event.category]);
  if(!recipients.length)return;
  const rid=id(),eventKey='auto:'+event.businessKey;const rows=await tx.query('INSERT INTO message_requests(id,org_id,branch_id,actor_id,sender_id,template_id,template_version,category,parameters,purpose,event_key,scheduled_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now()) ON CONFLICT(org_id,event_key) DO NOTHING RETURNING id',[rid,org,event.branchId,actor.id,s.id,t.id,t.version_hash,event.category,JSON.stringify([event.purpose]),event.purpose,eventKey]);if(!rows.length)return;
  // One confirmed provider identity per business event; shared-guardian duplicates are excluded.
  const identities=new Set();for(const c of recipients){if(identities.has(c.identity))continue;identities.add(c.identity);await tx.query('INSERT INTO message_recipients(id,org_id,request_id,consent_id,invoice_id) VALUES($1,$2,$3,$4,$5)',[id(),org,rid,c.id,event.invoiceId||null]);}
 });
}
export async function runReminderRules(db:DB){
 const rules=await db.query("SELECT r.*,o.timezone FROM reminder_rules r JOIN organizations o ON o.id=r.org_id WHERE o.status='active' AND r.active AND (r.last_run_date IS NULL OR r.last_run_date<(now() AT TIME ZONE o.timezone)::date) ORDER BY r.id LIMIT 100");
 for(const rule of rules){
  try{const actor=await actorById(db,rule.org_id,rule.actor_id);allow(actor,['owner','office']);await branchAccess(db,actor,rule.branch_id);}catch{continue;}
  await db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM reminder_rules WHERE id=$1 AND active FOR UPDATE',[rule.id]);if(!r)return;
   const [clock]=await tx.query('SELECT (now() AT TIME ZONE $1)::date AS today',[rule.timezone]);if(String(r.last_run_date)===String(clock.today))return;
   const invoices=await tx.query('SELECT * FROM invoices WHERE org_id=$1 AND branch_id=$2 AND total_minor>paid_minor AND due_date<=((now() AT TIME ZONE $3)::date-$4::int) ORDER BY id',[r.org_id,r.branch_id,rule.timezone,r.days_overdue]);
   for(const inv of invoices){const [prior]=await tx.query('SELECT count(*)::int AS count,max(occurred_at) AS last FROM reminder_occurrences WHERE org_id=$1 AND rule_id=$2 AND invoice_id=$3',[r.org_id,r.id,inv.id]);if(prior.count>=r.max_followups||prior.last&&Date.now()-new Date(prior.last).getTime()<r.cadence_days*86400000)continue;
    const seq=prior.count+1;await tx.query('INSERT INTO reminder_occurrences(org_id,rule_id,invoice_id,sequence) VALUES($1,$2,$3,$4)',[r.org_id,r.id,inv.id,seq]);await enqueue(tx,r.org_id,`fee_reminder:${r.id}:${inv.id}:${seq}`,'school_event',{actorId:r.actor_id,branchId:r.branch_id,studentId:inv.student_id,invoiceId:inv.id,category:'fees',purpose:`Fee reminder: ${inv.title}. Outstanding INR ${((inv.total_minor-inv.paid_minor)/100).toFixed(2)}. Review your secure school portal or contact the school office.`,businessKey:`fees:${r.branch_id}:${r.id}:${inv.id}:${seq}`});
   }await tx.query('UPDATE reminder_rules SET last_run_date=(now() AT TIME ZONE $1)::date WHERE id=$2',[rule.timezone,r.id]);
  });
 }
}
