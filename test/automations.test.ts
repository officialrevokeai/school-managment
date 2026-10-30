import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './support.js';
import { id } from '../server/core.js';
import { runReminderRules,expandSchoolEvent } from '../server/automations.js';
import { dispatchOne,workerTick,processOutboxOne } from '../server/worker.js';
import type { Transport } from '../server/providers.js';
test('Phase 7: durable automation snapshots, paid suppression, retries and worker restart safety (MOCK provider)',async t=>{
 let sends=0,unavailable=false;const transport:Transport=async()=>{sends++;return unavailable?Response.json({error:{code:2}},{status:503}):Response.json({messages:[{id:'wamid.automation.'+sends}]});};
 const f=await fixture({transport}),{db,app,clients:c,ids:i}=f;const account=id(),sender=id(),template=id(),consent=id(),structure=id(),invoice=id(),key=account.replaceAll('-','').toUpperCase();const vars=['META_ACCESS_TOKEN','META_APP_SECRET','META_VERIFY_TOKEN'].map(x=>x+'_'+key);try{
  for(const v of vars)process.env[v]='fixture-automation-secret';process.env.META_GRAPH_VERSION='v99.0';
  await db.transaction(async tx=>{
   await tx.query('UPDATE organizations SET settings=$1 WHERE id=$2',[{quietStart:0,quietEnd:0},i.org]);
   await tx.query("INSERT INTO integration_accounts(id,org_id,provider,model,account_ref,template_account_ref,credential_key) VALUES($1,$2,'meta','legacy_waba','55555','55555',$3)",[account,i.org,key]);
   await tx.query("INSERT INTO whatsapp_senders(id,org_id,branch_id,account_id,phone_id,display_number,name,connection_state,health_checked_at,live_verified_at,live_verified_api_version) VALUES($1,$2,$3,$4,'66666','+919000000000','MOCK fixture only','ready',now(),now(),'v99.0')",[sender,i.org,i.branch,account]);
   await tx.query("INSERT INTO message_templates(id,org_id,account_id,provider_id,name,language,category,provider_status,parameter_count,supported,body,version_hash) VALUES($1,$2,$3,'77777','fee_notice','en_US','UTILITY','APPROVED',1,true,'Notice: {{1}}','fixture-version')",[template,i.org,account]);
   await tx.query("INSERT INTO recipient_consents(id,org_id,branch_id,user_id,student_id,identity,opted_in,categories,source,evidence,recorded_by) VALUES($1,$2,$3,$4,$5,'919000000000',true,'[\"fees\",\"general\"]','MOCK','Synthetic test only',$6)",[consent,i.org,i.branch,c.parent.id,i.student,c.owner.id]);
   await tx.query("INSERT INTO fee_structures(id,org_id,branch_id,class_id,name,amount_minor) VALUES($1,$2,$3,$4,'Fixture fee',10000)",[structure,i.org,i.branch,i.cls]);
   await tx.query("INSERT INTO invoices(id,org_id,branch_id,student_id,title,due_date,total_minor,event_key) VALUES($1,$2,$3,$4,'Overdue test invoice',current_date-10,10000,'overdue-test')",[invoice,i.org,i.branch,i.student]);
  });
  await t.test('routing and rule persist once per invoice/cadence, and snapshot configured sender',async()=>{
   const route=await request(app,c.owner,'POST','/api/v1/whatsapp/routing',{branchId:i.branch,category:'fees',senderId:sender,templateId:template});assert.equal(route.statusCode,200,route.body);
   const rule=await request(app,c.office,'POST','/api/v1/whatsapp/reminder-rules',{branchId:i.branch,name:'Overdue fees',daysOverdue:1,cadenceDays:3,maxFollowups:2});assert.equal(rule.statusCode,200,rule.body);
   await runReminderRules(db);await runReminderRules(db);assert.equal((await db.query('SELECT count(*)::int AS n FROM reminder_occurrences'))[0].n,1);
   await processOutboxOne(db,transport);const [r]=await db.query('SELECT * FROM message_requests');assert.equal(r.sender_id,sender);assert.equal(r.authorized_test,false);
  });
  await t.test('payment before dispatch suppresses real stored reminder; successful collection remains independent',async()=>{
   const pay=await request(app,c.office,'POST','/api/v1/payments/offline',{invoiceId:invoice,reference:'fixture-offline-collection',verification:'Fixture office verified the externally received payment.',verified:true});assert.equal(pay.statusCode,200,pay.body);
   await dispatchOne(db,transport);assert.equal(sends,0);assert.equal((await db.query('SELECT error_code FROM message_recipients'))[0].error_code,'INVOICE_ALREADY_PAID');
  });
  const schedule=async(eventKey:string)=>{const r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',{branchId:i.branch,senderId:sender,templateId:template,category:'general',consentIds:[consent],parameters:['Fixture reference'],purpose:'Browser-independent mock job',eventKey,authorizedTest:false,confirmed:true});assert.equal(r.statusCode,200,r.body);return r.json().id;};
  await t.test('capped retry on explicit provider unavailability, successful recipients excluded',async()=>{
   const rid=await schedule('retry-explicit-error');unavailable=true;await dispatchOne(db,transport);let [m]=await db.query('SELECT * FROM message_recipients WHERE request_id=$1',[rid]);assert.equal(m.status,'queued');assert.equal(m.retryable,true);assert.equal(m.attempts,1);
   await db.query('UPDATE message_recipients SET next_attempt_at=now() WHERE id=$1',[m.id]);unavailable=false;await dispatchOne(db,transport);[m]=await db.query('SELECT * FROM message_recipients WHERE request_id=$1',[rid]);assert.equal(m.status,'accepted');assert.equal(m.attempts,2);
   assert.equal((await request(app,c.owner,'POST',`/api/v1/whatsapp/requests/${rid}/retry`,{})).json().queued,0);
  });
  await t.test('worker restart never blindly resends a crashed in-flight submission',async()=>{
   const rid=await schedule('crashed-worker-job');await db.query("UPDATE message_recipients SET status='processing',locked_at=now()-interval '10 minutes' WHERE request_id=$1",[rid]);const count=sends;await workerTick(db,transport);assert.equal(sends,count);assert.equal((await db.query('SELECT status FROM message_recipients WHERE request_id=$1',[rid]))[0].status,'uncertain');
  });
  await t.test('quiet hours defer rather than falsely failing',async()=>{
   const rid=await schedule('quiet-hours-deferral');const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',hour:'2-digit',hourCycle:'h23'}).format(new Date()));await db.query('UPDATE organizations SET settings=$1 WHERE id=$2',[{quietStart:hour,quietEnd:(hour+1)%24},i.org]);const count=sends;await dispatchOne(db,transport);const[m]=await db.query('SELECT * FROM message_recipients WHERE request_id=$1',[rid]);assert.equal(m.status,'queued');assert.equal(m.attempts,0);assert.equal(sends,count);await db.query('UPDATE organizations SET settings=$1 WHERE id=$2',[{quietStart:0,quietEnd:0},i.org]);await request(app,c.owner,'POST',`/api/v1/whatsapp/requests/${rid}/cancel`,{});
  });
  await t.test('current actor revocation blocks queued send',async()=>{
   const rid=await schedule('current-auth-recheck');await db.query('UPDATE users SET active=false WHERE org_id=$1 AND id=$2',[i.org,c.owner.id]);await dispatchOne(db,transport);const[m]=await db.query('SELECT * FROM message_recipients WHERE request_id=$1',[rid]);assert.equal(m.status,'suppressed');assert.equal(m.error_code,'ACCESS_REVOKED');
  });
 }finally{for(const v of [...vars,'META_GRAPH_VERSION'])delete process.env[v];await f.close();}
});
