import type { FastifyInstance } from 'fastify';
import { randomBytes,timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { DB,Row } from './db.js';
import { getActor } from './auth.js';
import { id,text,identifier,allow,audit,requireThat,branchAccess,studentAccess,portal,digest,enqueue,actorById,type Actor } from './core.js';
import { metaConfiguration,metaRequest,checkSignature,type Transport,ProviderFailure } from './providers.js';
import { syncTemplates } from './templates.js';

const category=z.enum(['fees','attendance','general','exams','homework','receipts','leave','admissions','events']);
const pid=(req:any)=>identifier.parse(req.params.id);
export async function waScope(db:DB,a:Actor,branch:string,student?:string|null) {
  if(student)await studentAccess(db,a,student);else{requireThat(!portal(a));await branchAccess(db,a,branch);}
  if(!portal(a))await branchAccess(db,a,branch);
}
export async function whatsappRoutes(app:FastifyInstance,db:DB,transport:Transport=fetch) {
  app.get('/api/v1/whatsapp/overview',async req=>{
    const a=getActor(req);requireThat(!portal(a));
    const all=await db.query('SELECT s.*,a.model,a.account_ref,a.template_account_ref,a.credential_key FROM whatsapp_senders s JOIN integration_accounts a ON a.org_id=s.org_id AND a.id=s.account_id WHERE s.org_id=$1 ORDER BY s.name',[a.org_id]);
    const senders=[];for(const s of all){try{await branchAccess(db,a,s.branch_id);}catch{continue;}const missing=metaConfiguration(s);const {credential_key,...safe}=s;senders.push({...safe,connection_state:!s.active?'disabled':missing.length?'setup_required':s.connection_state,missing,liveVerified:!!s.live_verified_at});}
    return {senders,liveVerified:false,note:'Ready is a configuration check. Delivery requires real provider callbacks. Live acceptance remains open until receipt and reply evidence is verified.'};
  });
  app.post('/api/v1/whatsapp/accounts',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({model:z.enum(['legacy_waba','waac_pma']),accountRef:z.string().regex(/^\d{4,40}$/),templateAccountRef:z.string().regex(/^\d{4,40}$/)}).strict().parse(req.body),aid=id(),key=aid.replaceAll('-','').toUpperCase();
    await db.transaction(async tx=>{await tx.query("INSERT INTO integration_accounts(id,org_id,provider,model,account_ref,template_account_ref,credential_key) VALUES($1,$2,'meta',$3,$4,$5,$6)",[aid,a.org_id,b.model,b.accountRef,b.templateAccountRef,key]);await audit(tx,a,'create','integration_account',aid,b);});
    return {id:aid,requiredServerVariables:[`META_ACCESS_TOKEN_${key}`,`META_APP_SECRET_${key}`,`META_VERIFY_TOKEN_${key}`,'META_GRAPH_VERSION'],webhookPath:`/webhooks/meta/${aid}`};
  });
  app.post('/api/v1/whatsapp/senders',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({accountId:identifier,branchId:identifier,phoneId:z.string().regex(/^\d{4,40}$/),displayNumber:z.string().regex(/^\+[1-9]\d{7,14}$/),name:text,isDefault:z.boolean().default(false)}).strict().parse(req.body),sid=id();
    await db.transaction(async tx=>{await branchAccess(tx,a,b.branchId);requireThat((await tx.query("SELECT 1 FROM integration_accounts WHERE org_id=$1 AND id=$2 AND provider='meta' AND active",[a.org_id,b.accountId])).length);if(b.isDefault)await tx.query('UPDATE whatsapp_senders SET is_default=false WHERE org_id=$1 AND branch_id=$2',[a.org_id,b.branchId]);await tx.query('INSERT INTO whatsapp_senders(id,org_id,branch_id,account_id,phone_id,display_number,name,is_default) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[sid,a.org_id,b.branchId,b.accountId,b.phoneId,b.displayNumber,b.name,b.isDefault]);await audit(tx,a,'create','whatsapp_sender',sid,b,b.branchId);});return {id:sid,connectionState:'setup_required'};
  });
  app.patch('/api/v1/whatsapp/senders/:id',async req=>{
    const a=getActor(req);allow(a,['owner']);const b=z.object({active:z.boolean().optional(),isDefault:z.boolean().optional()}).strict().parse(req.body),sid=pid(req);
    await db.transaction(async tx=>{const [s]=await tx.query('SELECT * FROM whatsapp_senders WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,sid]);requireThat(s);if(b.isDefault)await tx.query('UPDATE whatsapp_senders SET is_default=false WHERE org_id=$1 AND branch_id=$2',[a.org_id,s.branch_id]);await tx.query('UPDATE whatsapp_senders SET active=COALESCE($1,active),is_default=COALESCE($2,is_default) WHERE org_id=$3 AND id=$4',[b.active??null,b.isDefault??null,a.org_id,sid]);await audit(tx,a,'update','whatsapp_sender',sid,b,s.branch_id);});return {ok:true};
  });
  app.post('/api/v1/whatsapp/senders/:id/check',async req=>{
    const a=getActor(req);allow(a,['owner']);const [s]=await db.query('SELECT s.*,a.model,a.account_ref,a.credential_key FROM whatsapp_senders s JOIN integration_accounts a ON a.org_id=s.org_id AND a.id=s.account_id WHERE s.org_id=$1 AND s.id=$2 AND s.active AND a.active',[a.org_id,pid(req)]);requireThat(s);
    let state='not_verified';
    try{const data=await metaRequest(s,s.phone_id,'GET',null,transport);requireThat(data.id===s.phone_id,'SENDER_MISMATCH','The provider returned another sender.',502);state='ready';}
    catch(e){state=metaConfiguration(s).length?'setup_required':e instanceof ProviderFailure&&e.code==='TOKEN_EXPIRED'?'token_expired':e instanceof ProviderFailure&&e.code==='PROVIDER_UNAVAILABLE'?'provider_unavailable':'restricted';await db.query('UPDATE whatsapp_senders SET connection_state=$1,health_checked_at=now() WHERE org_id=$2 AND id=$3',[state,a.org_id,s.id]);throw e;}
    await db.transaction(async tx=>{await tx.query('UPDATE whatsapp_senders SET connection_state=$1,health_checked_at=now() WHERE org_id=$2 AND id=$3',[state,a.org_id,s.id]);await audit(tx,a,'health_check','whatsapp_sender',s.id,{state},s.branch_id);});return {connectionState:state,liveVerified:false};
  });
  app.post('/api/v1/whatsapp/accounts/:id/sync-templates',async req=>{
    const a=getActor(req);allow(a,['owner']);const [account]=await db.query("SELECT * FROM integration_accounts WHERE org_id=$1 AND id=$2 AND provider='meta' AND active",[a.org_id,pid(req)]);requireThat(account);
    const result=await syncTemplates(db,account,transport);await audit(db,a,'sync','message_template',account.id,{count:result.count});return result;
  });
  app.get('/api/v1/whatsapp/templates',async req=>{const a=getActor(req);requireThat(!portal(a));return {items:await db.query('SELECT t.* FROM message_templates t WHERE t.org_id=$1 AND EXISTS(SELECT 1 FROM whatsapp_senders s WHERE s.org_id=t.org_id AND s.account_id=t.account_id AND ($2=\'owner\' OR EXISTS(SELECT 1 FROM branch_assignments b WHERE b.org_id=s.org_id AND b.branch_id=s.branch_id AND b.user_id=$3))) ORDER BY t.name',[a.org_id,a.role,a.id])};});
  app.post('/api/v1/whatsapp/consents',async req=>{
    const a=getActor(req);allow(a,['owner','principal','parent']);const b=z.object({branchId:identifier,userId:identifier,studentId:identifier,identity:z.string().regex(/^[1-9]\d{7,14}$/),optedIn:z.boolean(),categories:z.array(category).min(1),source:text,evidence:z.string().trim().min(5).max(1000)}).strict().parse(req.body);await waScope(db,a,b.branchId,b.studentId);requireThat(a.role!=='parent'||a.id===b.userId);const s=await studentAccess(db,a,b.studentId);requireThat(s.branch_id===b.branchId);
    requireThat((await db.query("SELECT 1 FROM guardian_links g JOIN users u ON u.org_id=g.org_id AND u.id=g.user_id WHERE g.org_id=$1 AND g.user_id=$2 AND g.student_id=$3 AND u.active AND u.role='parent'",[a.org_id,b.userId,b.studentId])).length);
    const cid=id();const result=await db.transaction(async tx=>{const rows=await tx.query(`INSERT INTO recipient_consents(id,org_id,branch_id,user_id,student_id,identity,opted_in,categories,source,evidence,recorded_by,opted_out_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,CASE WHEN $7 THEN NULL ELSE now() END) ON CONFLICT(org_id,user_id,student_id,identity) DO UPDATE SET opted_in=excluded.opted_in,categories=excluded.categories,source=excluded.source,evidence=excluded.evidence,recorded_by=excluded.recorded_by,recorded_at=now(),opted_out_at=excluded.opted_out_at RETURNING id`,[cid,a.org_id,b.branchId,b.userId,b.studentId,b.identity,b.optedIn,JSON.stringify(b.categories),b.source,b.evidence,a.id]);await audit(tx,a,b.optedIn?'consent':'opt_out','recipient_consent',rows[0].id,{categories:b.categories,source:b.source,optedIn:b.optedIn},b.branchId);return rows[0];});return result;
  });
  app.get('/api/v1/whatsapp/consents',async req=>{const a=getActor(req);const all=await db.query('SELECT id,org_id,branch_id,user_id,student_id,identity,opted_in,categories,source,recorded_at,opted_out_at FROM recipient_consents WHERE org_id=$1',[a.org_id]);const items=[];for(const r of all){if(portal(a)&&r.user_id!==a.id)continue;try{await waScope(db,a,r.branch_id,r.student_id);items.push(r);}catch{}}return {items};});
  const compose=z.object({branchId:identifier,senderId:identifier,templateId:identifier,category,consentIds:z.array(identifier).min(1).max(500),parameters:z.array(z.string().trim().min(1).max(500)).max(20),purpose:text,eventKey:z.string().min(8).max(180),scheduledAt:z.iso.datetime().optional(),authorizedTest:z.boolean().default(false),invoiceId:identifier.optional(),confirmed:z.literal(true)}).strict();
  const preview=async(a:Actor,input:unknown)=>{
    requireThat(!portal(a));const b=compose.parse(input);await branchAccess(db,a,b.branchId);
    if(a.role==='office')requireThat(['fees','receipts'].includes(b.category));
    if(a.role==='teacher')requireThat(['attendance','homework','general'].includes(b.category));
    if(b.authorizedTest)allow(a,['owner']);
    const [sender]=await db.query('SELECT * FROM whatsapp_senders WHERE org_id=$1 AND id=$2 AND branch_id=$3 AND active',[a.org_id,b.senderId,b.branchId]);requireThat(sender);
    const [template]=await db.query('SELECT * FROM message_templates WHERE org_id=$1 AND id=$2 AND account_id=$3',[a.org_id,b.templateId,sender.account_id]);requireThat(template&&template.provider_status==='APPROVED'&&template.supported,'TEMPLATE_NOT_APPROVED','Select a provider-approved supported template.',409);
    requireThat(b.parameters.length===template.parameter_count,'TEMPLATE_PARAMETERS','The template parameter count does not match.',400);
    const eligible:Row[]=[],skipped:Row[]=[];
    for(const cid of [...new Set(b.consentIds)]){const [c]=await db.query('SELECT * FROM recipient_consents WHERE org_id=$1 AND id=$2 AND branch_id=$3',[a.org_id,cid,b.branchId]);requireThat(c);await waScope(db,a,c.branch_id,c.student_id);if(!c.opted_in||c.opted_out_at||!c.categories.includes(b.category))skipped.push({id:cid,reason:'CONSENT_NOT_ELIGIBLE'});else eligible.push(c);}
    requireThat(b.invoiceId?b.category==='fees':true,'INVALID_INVOICE','Invoice binding is only for fee reminders.',400);
    if(b.invoiceId){const [inv]=await db.query('SELECT * FROM invoices WHERE org_id=$1 AND id=$2',[a.org_id,b.invoiceId]);requireThat(inv&&inv.branch_id===b.branchId);requireThat(eligible.every(c=>c.student_id===inv.student_id));}
    const schedule=b.scheduledAt||new Date().toISOString();requireThat(new Date(schedule).getTime()>=Date.now()-60000,'INVALID_SCHEDULE','Schedule must be current or in the future.',400);
    return {b,sender,template,eligible,skipped,schedule};
  };
  app.post('/api/v1/whatsapp/preview',async req=>{const p=await preview(getActor(req),req.body);return {eligibleCount:p.eligible.length,skipped:p.skipped,sender:p.sender.display_number,template:p.template.name,language:p.template.language,body:p.template.body,parameters:p.b.parameters,scheduledAt:p.schedule,estimatedCost:null};});
  app.post('/api/v1/whatsapp/requests',async req=>{
    const a=getActor(req),p=await preview(a,req.body);requireThat(p.eligible.length,'NO_RECIPIENTS','No eligible recipients remain.',409);const rid=id();
    await db.transaction(async tx=>{await tx.query('INSERT INTO message_requests(id,org_id,branch_id,actor_id,sender_id,template_id,template_version,category,parameters,purpose,event_key,scheduled_at,authorized_test) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)',[rid,a.org_id,p.b.branchId,a.id,p.sender.id,p.template.id,p.template.version_hash,p.b.category,JSON.stringify(p.b.parameters),p.b.purpose,p.b.eventKey,p.schedule,p.b.authorizedTest]);for(const c of p.eligible)await tx.query('INSERT INTO message_recipients(id,org_id,request_id,consent_id,invoice_id,next_attempt_at) VALUES($1,$2,$3,$4,$5,$6)',[id(),a.org_id,rid,c.id,p.b.invoiceId||null,p.schedule]);await audit(tx,a,'confirm_schedule','message_request',rid,{senderId:p.sender.id,templateId:p.template.id,count:p.eligible.length,scheduledAt:p.schedule},p.b.branchId);});return {id:rid,status:'scheduled',eligibleCount:p.eligible.length,skipped:p.skipped};
  });
  app.get('/api/v1/whatsapp/history',async req=>{
    const a=getActor(req);requireThat(!portal(a));const rows=await db.query(`SELECT r.*,s.name AS sender_name FROM message_requests r JOIN whatsapp_senders s ON s.org_id=r.org_id AND s.id=r.sender_id WHERE r.org_id=$1 ORDER BY r.confirmed_at DESC LIMIT 100`,[a.org_id]);const items=[];for(const r of rows){try{await branchAccess(db,a,r.branch_id);if(a.role==='teacher'&&r.actor_id!==a.id)continue;const recipients=await db.query('SELECT m.*,c.identity,c.student_id FROM message_recipients m JOIN recipient_consents c ON c.org_id=m.org_id AND c.id=m.consent_id WHERE m.org_id=$1 AND m.request_id=$2',[a.org_id,r.id]);for(const x of recipients)await waScope(db,a,r.branch_id,x.student_id);items.push({...r,recipients});}catch{}}return {items};
  });
  app.post('/api/v1/whatsapp/requests/:id/cancel',async req=>{
    const a=getActor(req);requireThat(!portal(a));await db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM message_requests WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,pid(req)]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(a.role==='owner'||r.actor_id===a.id);const recipients=await tx.query('SELECT * FROM message_recipients WHERE org_id=$1 AND request_id=$2 FOR UPDATE',[a.org_id,r.id]);requireThat(recipients.every(x=>['queued','failed','cancelled','suppressed'].includes(x.status)),'ALREADY_SUBMITTED','Dispatch has begun; a submitted message cannot be recalled.',409);await tx.query("UPDATE message_requests SET status='cancelled' WHERE org_id=$1 AND id=$2",[a.org_id,r.id]);await tx.query("UPDATE message_recipients SET status='cancelled' WHERE org_id=$1 AND request_id=$2 AND status IN ('queued','failed')",[a.org_id,r.id]);await audit(tx,a,'cancel','message_request',r.id,{},r.branch_id);});return {ok:true};
  });
  app.post('/api/v1/whatsapp/requests/:id/retry',async req=>{
    const a=getActor(req);requireThat(!portal(a));return db.transaction(async tx=>{const [r]=await tx.query('SELECT * FROM message_requests WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,pid(req)]);requireThat(r);await branchAccess(tx,a,r.branch_id);requireThat(a.role==='owner'||r.actor_id===a.id);requireThat(r.status!=='cancelled');const rows=await tx.query("UPDATE message_recipients SET status='queued',next_attempt_at=now() WHERE org_id=$1 AND request_id=$2 AND status='failed' AND retryable AND attempts<5 RETURNING id",[a.org_id,r.id]);await audit(tx,a,'retry_failed_only','message_request',r.id,{count:rows.length},r.branch_id);return {queued:rows.length};});
  });
  app.get('/api/v1/whatsapp/inbox',async req=>{
    const a=getActor(req);const rows=await db.query(`SELECT m.*,s.branch_id,c.student_id,c.user_id FROM inbound_messages m JOIN whatsapp_senders s ON s.org_id=m.org_id AND s.id=m.sender_id LEFT JOIN recipient_consents c ON c.org_id=m.org_id AND c.id=m.consent_id WHERE m.org_id=$1 ORDER BY m.received_at DESC LIMIT 100`,[a.org_id]);const items=[];for(const r of rows){if(!r.consent_id&&a.role!=='owner')continue;if(portal(a)&&r.user_id!==a.id)continue;try{await waScope(db,a,r.branch_id,r.student_id);items.push(r);}catch{}}return {items};
  });
  app.get('/webhooks/meta/:id',async(req,reply)=>{
    const [account]=await db.query("SELECT * FROM integration_accounts WHERE id=$1 AND provider='meta' AND active",[pid(req)]);requireThat(account,'UNKNOWN_ACCOUNT','Unknown callback account.',404);const q=z.record(z.string(),z.string()).parse(req.query);const secret=process.env[`META_VERIFY_TOKEN_${account.credential_key}`];requireThat(secret&&q['hub.mode']==='subscribe'&&q['hub.verify_token']===secret,'INVALID_VERIFY_TOKEN','Webhook verification failed.');return reply.type('text/plain').send(q['hub.challenge']||'');
  });
  app.post('/webhooks/meta/:id',async(req,reply)=>{
    const [account]=await db.query("SELECT * FROM integration_accounts WHERE id=$1 AND provider='meta' AND active",[pid(req)]);requireThat(account,'UNKNOWN_ACCOUNT','Unknown callback account.',404);
    requireThat(checkSignature(req.rawBody||Buffer.alloc(0),process.env[`META_APP_SECRET_${account.credential_key}`],req.headers['x-hub-signature-256'] as string,'sha256='),'INVALID_SIGNATURE','Webhook signature failed.');
    const envelope=z.object({object:z.literal('whatsapp_business_account'),entry:z.array(z.object({id:z.string(),changes:z.array(z.object({field:z.literal('messages'),value:z.record(z.string(),z.unknown())}))})).min(1)}).parse(req.body);
    for(const e of envelope.entry){requireThat(e.id===account.account_ref,'UNKNOWN_ACCOUNT','Callback account does not match.');for(const change of e.changes){const v=change.value as Row;const phone=(v.metadata as Row)?.phone_number_id;requireThat(typeof phone==='string'&&(await db.query('SELECT 1 FROM whatsapp_senders WHERE org_id=$1 AND account_id=$2 AND phone_id=$3',[account.org_id,account.id,phone])).length,'UNKNOWN_SENDER','Callback sender is not configured.');}}
    await db.transaction(async tx=>{const eid=id(),hash=digest(req.rawBody!);const rows=await tx.query('INSERT INTO webhook_events(id,org_id,account_id,provider,event_hash,payload) VALUES($1,$2,$3,\'meta\',$4,$5) ON CONFLICT(account_id,event_hash) DO NOTHING RETURNING id',[eid,account.org_id,account.id,hash,envelope]);if(rows.length)await enqueue(tx,account.org_id,'webhook:'+eid,'meta_webhook',{eventId:eid});});return reply.code(200).send({accepted:true});
  });
}
