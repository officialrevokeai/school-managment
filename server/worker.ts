import nodemailer from 'nodemailer';
import { z } from 'zod';
import type { DB,Row } from './db.js';
import { actorById,requireThat,studentAccess,branchAccess,id,enqueue,digest } from './core.js';
import { waScope } from './whatsapp.js';
import { sendTemplate,sendTextReply,metaRequest,metaConfiguration,ProviderFailure,type Transport } from './providers.js';
import { revalidateTemplate } from './templates.js';
import { processRazorpayEvent } from './finance.js';
import { expandSchoolEvent,runReminderRules } from './automations.js';
import { enforcePermission } from './governance.js';

export async function processMetaEvent(db:DB,eventId:string) {
  await db.transaction(async tx=>{
    const [event]=await tx.query("SELECT * FROM webhook_events WHERE id=$1 AND provider='meta' FOR UPDATE",[eventId]);requireThat(event);if(event.status==='done')return;
    for(const entry of event.payload.entry)for(const change of entry.changes){
      const v=change.value;const [sender]=await tx.query('SELECT * FROM whatsapp_senders WHERE org_id=$1 AND account_id=$2 AND phone_id=$3',[event.org_id,event.account_id,v.metadata.phone_number_id]);requireThat(sender);
      for(const item of (v.statuses||[])){
        const s=z.object({id:z.string().min(1),status:z.enum(['sent','delivered','read','failed']),timestamp:z.string().regex(/^\d{1,12}$/),errors:z.array(z.object({code:z.number()})).optional()}).passthrough().parse(item);
        const [r]=await tx.query(`SELECT m.* FROM message_recipients m JOIN message_requests r ON r.org_id=m.org_id AND r.id=m.request_id WHERE m.org_id=$1 AND m.provider_message_id=$2 AND r.sender_id=$3 FOR UPDATE OF m`,[event.org_id,s.id,sender.id]);
        if(!r)continue; // Retain unmatched callback in event payload; never create a recipient/tenant.
        const at=new Date(Number(s.timestamp)*1000);requireThat(Number.isFinite(at.getTime()),'INVALID_PROVIDER_TIME');
        const key=digest(`${event.account_id}:${sender.id}:${s.id}:${s.status}:${s.timestamp}`),code=s.errors?.[0]?.code?.toString()||null;
        const rows=await tx.query('INSERT INTO delivery_events(id,org_id,recipient_id,event_key,status,provider_time,error_code) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(event_key) DO NOTHING RETURNING id',[id(),event.org_id,r.id,key,s.status,at.toISOString(),code]);if(!rows.length)continue;
        const rank:Record<string,number>={queued:0,processing:0,accepted:1,failed:1,sent:2,delivered:3,read:4};
        const next=s.status==='failed'?(['delivered','read'].includes(r.status)?r.status:'failed'):(rank[s.status]>(rank[r.status]||0)?s.status:r.status);
        await tx.query(`UPDATE message_recipients SET status=$1,error_code=COALESCE($2,error_code),sent_at=CASE WHEN $3='sent' THEN COALESCE(sent_at,$4::timestamptz) ELSE sent_at END,delivered_at=CASE WHEN $3='delivered' THEN COALESCE(delivered_at,$4::timestamptz) ELSE delivered_at END,read_at=CASE WHEN $3='read' THEN COALESCE(read_at,$4::timestamptz) ELSE read_at END WHERE org_id=$5 AND id=$6`,[next,code,s.status,at.toISOString(),event.org_id,r.id]);
      }
      for(const item of(v.messages||[])){
        const m=z.object({id:z.string().min(1),from:z.string().min(1).max(200),timestamp:z.string().regex(/^\d{1,12}$/),type:z.string(),text:z.object({body:z.string().max(10000)}).optional(),context:z.object({id:z.string()}).passthrough().optional()}).passthrough().parse(item);
        const text=m.type==='text'?(m.text?.body||''):`[Unsupported inbound ${m.type.slice(0,30)} content; retained in authenticated event]`;
        const consents=await tx.query('SELECT * FROM recipient_consents WHERE org_id=$1 AND branch_id=$2 AND identity=$3',[event.org_id,sender.branch_id,m.from]);
        // Resolve only an unambiguous, already verified recipient relationship. No new child links from a phone number.
        const consent=consents.length===1?consents[0]:null;
        await tx.query('INSERT INTO inbound_messages(id,org_id,sender_id,provider_message_id,provider_identity,consent_id,text,received_at,context_message_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(provider_message_id) DO NOTHING',[id(),event.org_id,sender.id,m.id,m.from,consent?.id||null,text,new Date(Number(m.timestamp)*1000).toISOString(),m.context?.id||null]);
        if(/^(stop|unsubscribe|opt[ -]?out)$/i.test(text.trim()))await tx.query('UPDATE recipient_consents SET opted_in=false,opted_out_at=now() WHERE org_id=$1 AND identity=$2',[event.org_id,m.from]);
      }
    }
    await tx.query("UPDATE webhook_events SET status='done',processed_at=now() WHERE id=$1",[event.id]);
  });
}

export async function dispatchOne(db:DB,transport:Transport=fetch) {
  const job=await db.transaction(async tx=>{
    const [request]=await tx.query(`SELECT r.* FROM message_requests r WHERE r.status IN ('scheduled','queued','processing') AND r.scheduled_at<=now() AND EXISTS(SELECT 1 FROM message_recipients m WHERE m.org_id=r.org_id AND m.request_id=r.id AND m.status='queued' AND m.next_attempt_at<=now()) ORDER BY r.scheduled_at FOR UPDATE SKIP LOCKED LIMIT 1`);
    if(!request)return null;
    const [r]=await tx.query("SELECT * FROM message_recipients WHERE org_id=$1 AND request_id=$2 AND status='queued' AND next_attempt_at<=now() ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1",[request.org_id,request.id]);if(!r)return null;
    await tx.query("UPDATE message_recipients SET status='processing',attempts=attempts+1,locked_at=now() WHERE id=$1",[r.id]);
    await tx.query("UPDATE message_requests SET status='processing' WHERE id=$1",[request.id]);
    return {r:{...r,attempts:r.attempts+1},request};
  });
  if(!job)return false;
  const r:Row=job.r,request:Row=job.request;let outcome='failed',providerId:string|null=null,error:string|null=null,retryable=false;
  try{
    const [school]=await db.query('SELECT timezone,settings FROM organizations WHERE id=$1',[r.org_id]);
    const actor=await actorById(db,request.org_id,request.actor_id);
    await enforcePermission(db,actor,'whatsapp','create');
    const [consent]=await db.query('SELECT c.* FROM recipient_consents c JOIN users u ON u.org_id=c.org_id AND u.id=c.user_id AND u.active WHERE c.org_id=$1 AND c.id=$2',[r.org_id,r.consent_id]);
    requireThat(consent&&consent.opted_in&&!consent.opted_out_at&&consent.categories.includes(request.category),'CONSENT_REVOKED');
    await waScope(db,actor,request.branch_id,consent.student_id);
    if(consent.student_id)requireThat((await db.query('SELECT 1 FROM guardian_links WHERE org_id=$1 AND user_id=$2 AND student_id=$3',[r.org_id,consent.user_id,consent.student_id])).length,'LINK_REVOKED');
    if(actor.role==='office')requireThat(['fees','receipts'].includes(request.category));if(actor.role==='teacher')requireThat(['attendance','homework','general'].includes(request.category));
    const [sender]=await db.query('SELECT * FROM whatsapp_senders WHERE org_id=$1 AND id=$2',[r.org_id,request.sender_id]);
    requireThat(sender?.active&&sender.branch_id===request.branch_id,'SENDER_DISABLED');
    requireThat(request.authorized_test?actor.role==='owner':sender.live_verified_at&&sender.live_verified_api_version===process.env.META_GRAPH_VERSION,'SENDER_NOT_LIVE_VERIFIED');
    const [account]=await db.query('SELECT * FROM integration_accounts WHERE org_id=$1 AND id=$2 AND active',[r.org_id,sender.account_id]);requireThat(account,'ACCOUNT_DISABLED');
    requireThat(!metaConfiguration(account).length,'META_NOT_CONFIGURED');
    if(!request.authorized_test){const hour=Number(new Intl.DateTimeFormat('en-GB',{hour:'2-digit',hourCycle:'h23',timeZone:school.timezone}).format(new Date()));const start=school.settings.quietStart??20,end=school.settings.quietEnd??8;const quiet=start===end?false:start>end?(hour>=start||hour<end):(hour>=start&&hour<end);if(quiet){await db.query("UPDATE message_recipients SET status='queued',attempts=attempts-1,locked_at=NULL,next_attempt_at=now()+interval '15 minutes' WHERE id=$1",[r.id]);return true;}}
    if(['provider_unavailable','token_expired'].includes(sender.connection_state)||!sender.health_checked_at||Date.now()-new Date(sender.health_checked_at).getTime()>3600000){const health=await metaRequest(account,sender.phone_id,'GET',null,transport);requireThat(health.id===sender.phone_id,'SENDER_MISMATCH');await db.query("UPDATE whatsapp_senders SET connection_state='ready',health_checked_at=now() WHERE id=$1",[sender.id]);sender.connection_state='ready';}
    requireThat(sender.connection_state==='ready','SENDER_NOT_READY');
    let template:Row|undefined;
    if(request.outbound_kind==='template'){const [stored]=await db.query('SELECT * FROM message_templates WHERE org_id=$1 AND id=$2 AND account_id=$3',[r.org_id,request.template_id,account.id]);requireThat(stored);template=await revalidateTemplate(db,account,stored,transport);requireThat(template?.provider_status==='APPROVED'&&template.supported&&template.version_hash===request.template_version,'TEMPLATE_REVALIDATION_REQUIRED');requireThat(request.parameters.length===template.parameter_count,'TEMPLATE_PARAMETERS');}
    if(r.invoice_id){const [invoice]=await db.query('SELECT * FROM invoices WHERE org_id=$1 AND id=$2',[r.org_id,r.invoice_id]);requireThat(invoice&&invoice.student_id===consent.student_id&&invoice.branch_id===request.branch_id,'INVOICE_SCOPE_CHANGED');requireThat(invoice.total_minor>invoice.paid_minor,'INVOICE_ALREADY_PAID');}
    if(request.outbound_kind==='text'){const[inbound]=await db.query('SELECT * FROM inbound_messages WHERE org_id=$1 AND id=$2 AND sender_id=$3 AND consent_id=$4',[r.org_id,request.inbound_context_id,sender.id,consent.id]);requireThat(inbound&&new Date(inbound.received_at).getTime()>Date.now()-86400000&&new Date(inbound.received_at).getTime()<=Date.now()+300000,'SERVICE_WINDOW_CLOSED');providerId=await sendTextReply(account,sender,consent,request.text_body,inbound.provider_message_id,transport);}else providerId=await sendTemplate(account,sender,template!,consent,request.parameters,transport);outcome='accepted';
  }catch(e:any){error=e.code||'DISPATCH_FAILED';if(e instanceof ProviderFailure){outcome=e.uncertain?'uncertain':'failed';retryable=e.retryable;if(e.code==='TOKEN_EXPIRED')await db.query("UPDATE whatsapp_senders SET connection_state='token_expired' WHERE org_id=$1 AND id=$2",[r.org_id,request.sender_id]);}else outcome='suppressed';}
  await db.transaction(async tx=>{
    const backoff=Math.min(3600,30*2**Math.min(r.attempts,6))+Math.floor(Math.random()*15);
    const retry=retryable&&r.attempts<5;
    await tx.query("UPDATE message_recipients SET status=$1,provider_message_id=$2,error_code=$3,retryable=$4,accepted_at=CASE WHEN $2::text IS NOT NULL THEN now() ELSE accepted_at END,next_attempt_at=now()+($5::int*interval '1 second'),locked_at=NULL WHERE org_id=$6 AND id=$7",[retry?'queued':outcome,providerId,error,retryable,backoff,r.org_id,r.id]);
    await tx.query('INSERT INTO message_attempts(id,org_id,recipient_id,number,outcome,provider_message_id,error_code,provider_api_version) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[id(),r.org_id,r.id,r.attempts,outcome,providerId,error,process.env.META_GRAPH_VERSION||null]);
    await tx.query("UPDATE message_requests SET status='completed' WHERE org_id=$1 AND id=$2 AND NOT EXISTS(SELECT 1 FROM message_recipients WHERE org_id=$1 AND request_id=$2 AND status IN ('queued','processing'))",[r.org_id,request.id]);
  });
  return true;
}
export async function processOutboxOne(db:DB,transport:Transport=fetch) {
  const job=await db.transaction(async tx=>{
    const [j]=await tx.query("SELECT * FROM outbox WHERE status='queued' AND available_at<=now() ORDER BY available_at FOR UPDATE SKIP LOCKED LIMIT 1");if(!j)return null;
    await tx.query("UPDATE outbox SET status='processing',locked_at=now(),attempts=attempts+1 WHERE id=$1",[j.id]);return j;
  });if(!job)return false;
  try{
    if(job.kind==='meta_webhook')await processMetaEvent(db,job.data.eventId);
    else if(job.kind==='razorpay_webhook')await processRazorpayEvent(db,job.data.eventId,transport);
    else if(job.kind==='school_event')await expandSchoolEvent(db,job.org_id,job.data);
    else if(job.kind==='email'){
      const user=await actorById(db,job.org_id,job.data.userId);requireThat(process.env.SMTP_HOST&&process.env.SMTP_FROM,'SMTP_NOT_CONFIGURED');
      const smtp=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:process.env.SMTP_SECURE==='true',auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD}:undefined,connectionTimeout:15000,socketTimeout:15000});
      await smtp.sendMail({from:process.env.SMTP_FROM,to:user.email,subject:job.data.subject,text:job.data.text,messageId:`<${job.id}@school.local>`});
    }else if(job.kind==='publish_homework'){
      const actor=await actorById(db,job.org_id,job.data.actorId);await branchAccess(db,actor,job.data.branchId);
      await db.transaction(async tx=>{const [h]=await tx.query("SELECT * FROM homework WHERE org_id=$1 AND id=$2 AND status='scheduled' FOR UPDATE",[job.org_id,job.data.homeworkId]);if(h&&h.revision===job.data.revision){await studentAccessForClass(tx,actor,h.class_id);await enforcePermission(tx,actor,'homework','edit');await tx.query("UPDATE homework SET status='published',published_at=now() WHERE id=$1",[h.id]);}});
    }else if(job.kind==='publish_announcement'){
      const actor=await actorById(db,job.org_id,job.data.actorId);await branchAccess(db,actor,job.data.branchId);
      await db.transaction(async tx=>{const [a]=await tx.query("SELECT * FROM announcements WHERE org_id=$1 AND id=$2 AND status='scheduled' FOR UPDATE",[job.org_id,job.data.announcementId]);if(a){if(actor.role==='teacher'){requireThat(a.class_id);await studentAccessForClass(tx,actor,a.class_id);}else requireThat(['owner','principal'].includes(actor.role));await tx.query("UPDATE announcements SET status='published',published_at=now() WHERE id=$1",[a.id]);}});
    }else throw new Error('UNSUPPORTED_JOB_KIND');
    await db.query("UPDATE outbox SET status='done',locked_at=NULL,data=CASE WHEN kind='email' THEN jsonb_build_object('userId',data->>'userId') ELSE data END WHERE id=$1",[job.id]);
  }catch(e:any){await db.query("UPDATE outbox SET status=$1,last_error=$2,locked_at=NULL,available_at=now()+interval '60 seconds' WHERE id=$3",[job.attempts>=4?'failed':'queued',e.code||'JOB_FAILED',job.id]);}
  return true;
}
async function studentAccessForClass(db:DB,actor:any,classId:string){const {classAccess}=await import('./core.js');return classAccess(db,actor,classId);}
export async function workerTick(db:DB,transport:Transport=fetch) {
  await db.query('DELETE FROM school_deletion_challenges WHERE expires_at<=now()');
  await runReminderRules(db);
  await db.query("UPDATE message_recipients SET status='uncertain',error_code='WORKER_LEASE_EXPIRED',locked_at=NULL WHERE status='processing' AND locked_at<now()-interval '2 minutes'");
  // Webhook processing is transactional/idempotent; SMTP completion may be uncertain after a crash.
  await db.query("UPDATE outbox SET status=CASE WHEN kind='email' THEN 'uncertain' ELSE 'queued' END,locked_at=NULL WHERE status='processing' AND locked_at<now()-interval '2 minutes'");
  await db.query("INSERT INTO worker_heartbeats(id,seen_at) VALUES('school-worker',now()) ON CONFLICT(id) DO UPDATE SET seen_at=now()");
  let work=0;for(let n=0;n<30;n++){const a=await processOutboxOne(db,transport),b=await dispatchOne(db,transport);if(!a&&!b)break;work++;}return work;
}
