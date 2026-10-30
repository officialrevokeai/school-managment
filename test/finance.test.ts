import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { fixture,request } from './support.js';
import { processRazorpayEvent } from '../server/finance.js';
import type { Transport } from '../server/providers.js';
test('Phase 6: authoritative fees, mock Razorpay capture reconciliation and accounting integrity',async t=>{
 let amount=650000,captured=true,refundStatus='pending';const providerCalls:any[]=[];
 const transport:Transport=async(input,init)=>{providerCalls.push({url:String(input),body:init?.body});if(String(input).includes('/refunds/'))return Response.json({id:'rfnd_fixture_1',payment_id:'pay_fixture_1',amount:10000,currency:'INR',status:refundStatus});if(String(input).endsWith('/orders'))return Response.json({id:'order_fixture_1',amount,currency:'INR'});return Response.json({id:'pay_fixture_1',order_id:'order_fixture_1',amount,currency:'INR',status:captured?'captured':'authorized',captured});};
 const f=await fixture({transport}),{db,app,clients:c,ids:i}=f;const envKeys:string[]=[];try{
  let invoiceId='',accountId='',orderId='';
  await t.test('office creates fee structure and invoice; client amount tampering rejected',async()=>{
   const r=await request(app,c.office,'POST','/api/v1/fee-structures',{classId:i.cls,name:'Tuition November',amountMinor:650000});assert.equal(r.statusCode,200,r.body);
   const inv=await request(app,c.office,'POST','/api/v1/invoices',{studentId:i.student,title:'November fees',dueDate:'2026-11-05',structureIds:[r.json().id],eventKey:'tuition-november-fixture'});assert.equal(inv.statusCode,200,inv.body);invoiceId=inv.json().id;
   assert.equal((await request(app,c.teacher,'GET','/api/v1/fees')).statusCode,403);
   assert.equal((await request(app,c.student,'POST','/api/v1/payments/orders',{studentId:i.student,invoiceIds:[invoiceId],eventKey:'student-payment'})).statusCode,403);
   const tamper=await request(app,c.parent,'POST','/api/v1/payments/orders',{studentId:i.student,invoiceIds:[invoiceId],eventKey:'tampered-order',amountMinor:1});assert.equal(tamper.statusCode,400);
   assert.equal((await request(app,c.parent,'POST','/api/v1/payments/orders',{studentId:i.student,invoiceIds:[invoiceId],eventKey:'missing-provider'})).statusCode,503);
  });
  await t.test('configured test account creates server order, no receipt from click, concurrent order blocked',async()=>{
   const r=await request(app,c.owner,'POST','/api/v1/payments/accounts',{merchantAccountRef:'acc_fixture',mode:'test'});assert.equal(r.statusCode,200,r.body);accountId=r.json().id;const [a]=await db.query('SELECT credential_key FROM integration_accounts WHERE id=$1',[accountId]);for(const p of ['RAZORPAY_KEY_ID','RAZORPAY_KEY_SECRET','RAZORPAY_WEBHOOK_SECRET']){const k=p+'_'+a.credential_key;process.env[k]='fixture-payment-secret';envKeys.push(k);}
   const order=await request(app,c.parent,'POST','/api/v1/payments/orders',{studentId:i.student,invoiceIds:[invoiceId],eventKey:'authorized-fixture-order'});assert.equal(order.statusCode,200,order.body);orderId=order.json().id;assert.equal(order.json().amountMinor,650000);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM receipts'))[0].n,0);assert.equal((await db.query('SELECT paid_minor FROM invoices WHERE id=$1',[invoiceId]))[0].paid_minor,0);
   assert.equal((await request(app,c.parent,'POST','/api/v1/payments/orders',{studentId:i.student,invoiceIds:[invoiceId],eventKey:'second-order'})).statusCode,409);
   assert.equal(JSON.parse(providerCalls[0].body).amount,650000);
  });
  const body=()=>({account_id:'acc_fixture',event:'payment.captured',payload:{payment:{entity:{id:'pay_fixture_1',order_id:'order_fixture_1',amount:650000,currency:'INR'}}}});
  const callback=async(eventId:string,payload:any=body(),valid=true)=>{const raw=JSON.stringify(payload);return app.inject({method:'POST',url:'/webhooks/razorpay/'+accountId,headers:{'content-type':'application/json','x-razorpay-event-id':eventId,'x-razorpay-signature':valid?createHmac('sha256','fixture-payment-secret').update(raw).digest('hex'):'invalid'},payload:raw});};
  await t.test('raw HMAC and merchant mapping reject altered or unrecognized callback',async()=>{
   assert.equal((await callback('event_bad_signature',body(),false)).statusCode,403);const wrong={...body(),account_id:'acc_unrecognized'};assert.equal((await callback('event_bad_merchant',wrong)).statusCode,403);
  });
  await t.test('noncaptured or mismatched fetched provider amount creates no confirmed receipt',async()=>{
   assert.equal((await callback('event_fixture_captured')).statusCode,200);const [ev]=await db.query("SELECT * FROM webhook_events WHERE provider='razorpay'");captured=false;await assert.rejects(()=>processRazorpayEvent(db,ev.id,transport));captured=true;amount=1;await assert.rejects(()=>processRazorpayEvent(db,ev.id,transport),/amount or currency/);assert.equal((await db.query('SELECT count(*)::int AS n FROM receipts'))[0].n,0);amount=650000;
  });
  await t.test('verified captured payment settles exact ledger/allocation once under duplicate/reordered callbacks',async()=>{
   const [ev]=await db.query("SELECT * FROM webhook_events WHERE provider='razorpay'");await processRazorpayEvent(db,ev.id,transport);await processRazorpayEvent(db,ev.id,transport);
   await callback('event_fixture_captured');await callback('event_fixture_order_paid',{...body(),event:'order.paid'});for(const e of await db.query("SELECT * FROM webhook_events WHERE provider='razorpay'"))await processRazorpayEvent(db,e.id,transport);
   assert.equal((await db.query('SELECT paid_minor FROM invoices WHERE id=$1',[invoiceId]))[0].paid_minor,650000);assert.equal((await db.query('SELECT count(*)::int AS n FROM receipts'))[0].n,1);assert.equal((await db.query('SELECT count(*)::int AS n FROM payments'))[0].n,1);
   assert.equal((await db.query('SELECT sum(amount_minor)::int AS n FROM ledger_entries WHERE invoice_id=$1',[invoiceId]))[0].n,0);assert.equal((await db.query('SELECT status FROM payment_orders WHERE id=$1',[orderId]))[0].status,'captured');
   const fees=(await request(app,c.parent,'GET','/api/v1/fees')).json();const receipt=await request(app,c.parent,'GET',`/api/v1/receipts/${fees.payments[0].receipt_id}`);assert.equal(receipt.statusCode,200);assert.match(receipt.body,/6500\.00/);
   assert.equal((await request(app,c.otherOwner,'GET',`/api/v1/receipts/${fees.payments[0].receipt_id}`)).statusCode,403);
   assert.equal((await request(app,c.office,'POST',`/api/v1/invoices/${invoiceId}/adjustments`,{amountMinor:-100,reason:'Tamper with paid invoice',eventKey:'illegal-adjustment'})).statusCode,409);
  });
  await t.test('only fetched processed refunds reopen the exact allocated balance; duplicate/old events have one effect',async()=>{
   const refund={account_id:'acc_fixture',event:'refund.created',payload:{refund:{entity:{id:'rfnd_fixture_1'}}}};assert.equal((await callback('event_fixture_refund_created',refund)).statusCode,200);let [ev]=await db.query("SELECT * FROM webhook_events WHERE event_hash='event_fixture_refund_created'");await processRazorpayEvent(db,ev.id,transport);assert.equal((await db.query('SELECT paid_minor FROM invoices WHERE id=$1',[invoiceId]))[0].paid_minor,650000);
   refundStatus='processed';await callback('event_fixture_refund_processed',{...refund,event:'refund.processed'});[ev]=await db.query("SELECT * FROM webhook_events WHERE event_hash='event_fixture_refund_processed'");await processRazorpayEvent(db,ev.id,transport);await processRazorpayEvent(db,ev.id,transport);
   assert.equal((await db.query('SELECT paid_minor FROM invoices WHERE id=$1',[invoiceId]))[0].paid_minor,640000);assert.equal((await db.query("SELECT count(*)::int AS n FROM ledger_entries WHERE kind='refund'"))[0].n,1);
   refundStatus='pending';await callback('event_fixture_refund_old',refund);[ev]=await db.query("SELECT * FROM webhook_events WHERE event_hash='event_fixture_refund_old'");await processRazorpayEvent(db,ev.id,transport);assert.equal((await db.query('SELECT status FROM refunds'))[0].status,'processed');
  });
 }finally{for(const k of envKeys)delete process.env[k];await f.close();}
});
