import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { fixture,request } from './support.js';
import { dispatchOne,workerTick } from '../server/worker.js';
import { id } from '../server/core.js';
import type { Transport } from '../server/providers.js';

test('Phase 2: official adapter protocol with MOCK transport and SIGNED FIXTURES; no live delivery claim',async t=>{
 let sends=0,mode='ok';const outbound:any[]=[];
 const transport:Transport=async(input,init)=>{
   const url=String(input);
   if(url.includes('/message_templates'))return Response.json({data:[{id:'44444',name:'school_test',language:'en_US',category:'UTILITY',status:'APPROVED',components:[{type:'BODY',text:'School update: {{1}}'}]}]});
   if(url.endsWith('/messages')){sends++;outbound.push(JSON.parse(String(init?.body)));if(mode==='timeout')throw new Error('timeout');if(mode==='expired')return Response.json({error:{code:190}},{status:401});return Response.json({messages:[{id:'wamid.fixture.'+sends}]});}
   return Response.json({id:'22222'});
 };
 const f=await fixture({transport}),{app,db,clients:c,ids:i}=f;const envKeys:string[]=[];
 try{
   let accountId='',senderId='',templateId='',consentId='',key='';
   await t.test('account setup exposes env names only; missing config fails honestly',async()=>{
     const r=await request(app,c.owner,'POST','/api/v1/whatsapp/accounts',{model:'legacy_waba',accountRef:'11111',templateAccountRef:'33333'});assert.equal(r.statusCode,200,r.body);accountId=r.json().id;
     key=(await db.query('SELECT credential_key FROM integration_accounts WHERE id=$1',[accountId]))[0].credential_key;
     const s=await request(app,c.owner,'POST','/api/v1/whatsapp/senders',{accountId,branchId:i.branch,phoneId:'22222',displayNumber:'+919000000000',name:'Fixture sender',isDefault:true});assert.equal(s.statusCode,200,s.body);senderId=s.json().id;
     const health=await request(app,c.owner,'POST',`/api/v1/whatsapp/senders/${senderId}/check`,{});assert.equal(health.statusCode,503);assert.equal(health.json().error.code,'META_NOT_CONFIGURED');assert.equal(sends,0);
     for(const p of ['META_ACCESS_TOKEN','META_APP_SECRET','META_VERIFY_TOKEN']){const name=p+'_'+key;process.env[name]='fixture-secret-only';envKeys.push(name);}process.env.META_GRAPH_VERSION='v99.0';envKeys.push('META_GRAPH_VERSION');
     assert.equal((await request(app,c.owner,'POST',`/api/v1/whatsapp/senders/${senderId}/check`,{})).statusCode,200);
     const overview=(await request(app,c.teacher,'GET','/api/v1/whatsapp/overview')).json();assert.equal(overview.senders[0].connection_state,'ready');assert.equal(overview.senders[0].liveVerified,false);assert.ok(!JSON.stringify(overview).includes('fixture-secret-only'));
   });
   await t.test('template approval originates from provider; verified guardian opt-in required',async()=>{
     const sync=await request(app,c.owner,'POST',`/api/v1/whatsapp/accounts/${accountId}/sync-templates`,{});assert.equal(sync.statusCode,200,sync.body);templateId=(await db.query('SELECT id FROM message_templates'))[0].id;
     const opt=await request(app,c.owner,'POST','/api/v1/whatsapp/consents',{branchId:i.branch,userId:c.parent.id,studentId:i.student,identity:'919000000000',optedIn:true,categories:['general','fees'],source:'authorized test fixture',evidence:'Synthetic consent for mocked provider tests only.'});assert.equal(opt.statusCode,200,opt.body);consentId=opt.json().id;
   });
   const compose=(key:string,extra:any={})=>({branchId:i.branch,senderId,templateId,category:'general',consentIds:[consentId],parameters:['unique fixture reference'],purpose:'Mock transport test',eventKey:key,authorizedTest:true,confirmed:true,...extra});
   let rid='';
   await t.test('parent cannot bulk send; parameter mismatch rejected; immutable schedule snapshot',async()=>{
     assert.equal((await request(app,c.parent,'POST','/api/v1/whatsapp/requests',compose('parent-attempt'))).statusCode,403);
     assert.equal((await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('wrong-parameters',{parameters:[]}))).statusCode,400);
     const r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('test-fixture-1'));assert.equal(r.statusCode,200,r.body);rid=r.json().id;
     assert.equal((await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('test-fixture-1'))).statusCode,409);
     assert.equal(await dispatchOne(db,transport),true);assert.equal(sends,1);
     const [m]=await db.query('SELECT * FROM message_recipients WHERE request_id=$1',[rid]);assert.equal(m.status,'accepted');assert.equal(m.provider_message_id,'wamid.fixture.1');assert.equal(m.delivered_at,null);
     assert.deepEqual(outbound[0],{messaging_product:'whatsapp',to:'919000000000',type:'template',template:{name:'school_test',language:{code:'en_US'},components:[{type:'body',parameters:[{type:'text',text:'unique fixture reference'}]}]}});
   });
   const event=(status:string,extra:any={})=>({object:'whatsapp_business_account',entry:[{id:'11111',changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:'22222'},statuses:[{id:'wamid.fixture.1',status,timestamp:'1793318400'}],...extra}}]}]});
   const callback=(payload:any,valid=true)=>{const raw=JSON.stringify(payload);return app.inject({method:'POST',url:`/webhooks/meta/${accountId}`,headers:{'content-type':'application/json','x-hub-signature-256':valid?'sha256='+createHmac('sha256','fixture-secret-only').update(raw).digest('hex'):'sha256=wrong'},payload:raw});};
   await t.test('raw signature, unknown sender/account rejection; durable acknowledgment before status application',async()=>{
     assert.equal((await callback(event('delivered'),false)).statusCode,403);
     const unknown=event('delivered');unknown.entry[0].id='77777';assert.equal((await callback(unknown)).statusCode,403);
     const unknownSender=event('delivered');unknownSender.entry[0].changes[0].value.metadata.phone_number_id='88888';assert.equal((await callback(unknownSender)).statusCode,403);
     const result=await callback(event('delivered'));assert.equal(result.statusCode,200,result.body);
     assert.equal((await db.query('SELECT status FROM message_recipients WHERE request_id=$1',[rid]))[0].status,'accepted');assert.equal((await db.query('SELECT count(*)::int AS n FROM webhook_events'))[0].n,1);
     await workerTick(db,transport);assert.equal((await db.query('SELECT status FROM message_recipients WHERE request_id=$1',[rid]))[0].status,'delivered');
   });
   await t.test('duplicates and old statuses cannot regress delivered/read or resend successes',async()=>{
     await callback(event('delivered'));await callback(event('sent'));await callback(event('read'));await workerTick(db,transport);
     assert.equal((await db.query('SELECT status FROM message_recipients WHERE request_id=$1',[rid]))[0].status,'read');assert.equal((await db.query('SELECT count(*)::int AS n FROM delivery_events'))[0].n,3);
     const r=await request(app,c.owner,'POST',`/api/v1/whatsapp/requests/${rid}/retry`,{});assert.equal(r.json().queued,0);await workerTick(db,transport);assert.equal(sends,1);
   });
   await t.test('authentic inbound fixture routes only to matching existing identity and STOP suppresses queued message',async()=>{
     const r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('test-before-stop'));assert.equal(r.statusCode,200,r.body);
     await callback(event('sent',{statuses:[],messages:[{id:'inbound-fixture-1',from:'919000000000',timestamp:'1793318401',type:'text',text:{body:'STOP'}}]}));
     await workerTick(db,transport);assert.equal(sends,1);const inbox=(await request(app,c.parent,'GET','/api/v1/whatsapp/inbox')).json();assert.equal(inbox.items[0].text,'STOP');assert.equal(inbox.items[0].consent_id,consentId);
     assert.equal((await db.query('SELECT opted_in FROM recipient_consents WHERE id=$1',[consentId]))[0].opted_in,false);assert.equal((await db.query('SELECT status FROM message_recipients WHERE request_id=$1',[r.json().id]))[0].status,'suppressed');
     await db.query('UPDATE recipient_consents SET opted_in=true,opted_out_at=NULL WHERE id=$1',[consentId]);
   });
   await t.test('cancel wins before dispatch; submitted cannot be recalled',async()=>{
     const r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('cancel-before-dispatch'));assert.equal(r.statusCode,200,r.body);assert.equal((await request(app,c.owner,'POST',`/api/v1/whatsapp/requests/${r.json().id}/cancel`,{})).statusCode,200);await workerTick(db,transport);assert.equal(sends,1);
     assert.equal((await request(app,c.owner,'POST',`/api/v1/whatsapp/requests/${rid}/cancel`,{})).statusCode,409);
   });
   await t.test('provider timeout is uncertain and never blindly retried',async()=>{
     const r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('timeout-review'));assert.equal(r.statusCode,200,r.body);mode='timeout';await dispatchOne(db,transport);const [m]=await db.query('SELECT * FROM message_recipients WHERE request_id=$1',[r.json().id]);assert.equal(m.status,'uncertain');assert.equal(m.retryable,false);await workerTick(db,transport);assert.equal(sends,2);mode='ok';
   });
   await t.test('expired credentials fail visibly without successful outcome',async()=>{
     const r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('expired-token'));mode='expired';await dispatchOne(db,transport);const [m]=await db.query('SELECT * FROM message_recipients WHERE request_id=$1',[r.json().id]);assert.equal(m.status,'failed');assert.equal(m.error_code,'TOKEN_EXPIRED');assert.equal(m.provider_message_id,null);assert.equal(m.retryable,false);mode='ok';
   });
   await t.test('disabled actor or sender and unverified production send are suppressed',async()=>{
     let r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('unverified-production',{authorizedTest:false}));assert.equal(r.statusCode,200,r.body);await dispatchOne(db,transport);assert.equal((await db.query('SELECT error_code FROM message_recipients WHERE request_id=$1',[r.json().id]))[0].error_code,'SENDER_NOT_LIVE_VERIFIED');
     r=await request(app,c.owner,'POST','/api/v1/whatsapp/requests',compose('disabled-sender'));await request(app,c.owner,'PATCH',`/api/v1/whatsapp/senders/${senderId}`,{active:false});await dispatchOne(db,transport);assert.equal((await db.query('SELECT error_code FROM message_recipients WHERE request_id=$1',[r.json().id]))[0].error_code,'SENDER_DISABLED');assert.equal(sends,3);
   });
   await t.test('freeform reply requires an authentic same-sender inbound window, verified identity and confirmation',async()=>{
     await request(app,c.owner,'PATCH',`/api/v1/whatsapp/senders/${senderId}`,{active:true});await callback(event('sent',{statuses:[],messages:[{id:'inbound-reply-fixture',from:'919000000000',timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:'Please send the school office contact.'}}]}));await workerTick(db,transport);
     const [inbound]=await db.query("SELECT id FROM inbound_messages WHERE provider_message_id='inbound-reply-fixture'");const payload={inboundId:inbound.id,body:'Please contact the school office through your secure portal.',eventKey:'reply-window-fixture',authorizedTest:true,confirmed:true};
     assert.equal((await request(app,c.parent,'POST','/api/v1/whatsapp/replies',payload)).statusCode,403);const r=await request(app,c.owner,'POST','/api/v1/whatsapp/replies',payload);assert.equal(r.statusCode,200,r.body);await dispatchOne(db,transport);assert.equal(outbound.at(-1).type,'text');assert.equal(outbound.at(-1).context.message_id,'inbound-reply-fixture');
     await db.query("UPDATE inbound_messages SET received_at=now()-interval '25 hours' WHERE id=$1",[inbound.id]);assert.equal((await request(app,c.owner,'POST','/api/v1/whatsapp/replies',{...payload,eventKey:'reply-expired-fixture'})).statusCode,409);
   });
 }finally{for(const k of envKeys)delete process.env[k];await f.close();}
});
