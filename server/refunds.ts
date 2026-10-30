import { z } from 'zod';
import type { DB,Row } from './db.js';
import { id,requireThat } from './core.js';
import { razorRequest } from './finance.js';
import type { Transport } from './providers.js';
export async function processRefundEvent(db:DB,event:Row,transport:Transport=fetch){
 const observed=event.payload.payload?.refund?.entity;requireThat(observed?.id,'INVALID_REFUND_EVENT','Refund identity is missing.',400);
 const [account]=await db.query("SELECT * FROM integration_accounts WHERE org_id=$1 AND id=$2 AND active AND provider='razorpay'",[event.org_id,event.account_id]);requireThat(account);
 const actual=z.object({id:z.string(),payment_id:z.string(),amount:z.number().int().positive(),currency:z.literal('INR'),status:z.enum(['pending','processed','failed'])}).passthrough().parse(await razorRequest(account,'refunds/'+observed.id,'GET',null,transport));requireThat(actual.id===observed.id,'REFUND_ID_MISMATCH');
 await db.transaction(async tx=>{
  const [ev]=await tx.query('SELECT * FROM webhook_events WHERE id=$1 FOR UPDATE',[event.id]);if(ev.status==='done')return;
  const [payment]=await tx.query('SELECT p.* FROM payments p JOIN payment_orders o ON o.org_id=p.org_id AND o.id=p.order_id WHERE p.org_id=$1 AND p.provider_payment_id=$2 AND o.account_id=$3 FOR UPDATE OF p',[event.org_id,actual.payment_id,account.id]);
  // Auto-refunds of uncaptured payments have no collection to reverse and need reconciliation.
  requireThat(payment,'REFUND_WITHOUT_CAPTURE','No confirmed captured school payment matches this refund. Manual reconciliation is required.',409);
  const existing=await tx.query('SELECT * FROM refunds WHERE provider_refund_id=$1 FOR UPDATE',[actual.id]);let refund=existing[0];
  if(refund)requireThat(refund.org_id===event.org_id&&refund.payment_id===payment.id&&refund.amount_minor===actual.amount,'REFUND_MISMATCH');
  else{const rid=id();[refund]=await tx.query('INSERT INTO refunds(id,org_id,payment_id,provider_refund_id,amount_minor,currency,status) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[rid,event.org_id,payment.id,actual.id,actual.amount,actual.currency,actual.status]);}
  if(actual.status==='processed'&&!refund.applied_at){
   const [total]=await tx.query('SELECT COALESCE(sum(amount_minor),0)::int AS amount FROM refunds WHERE org_id=$1 AND payment_id=$2 AND applied_at IS NOT NULL',[event.org_id,payment.id]);requireThat(total.amount+actual.amount<=payment.amount_minor,'REFUND_EXCEEDS_CAPTURE');
   let remaining=actual.amount;const allocations=await tx.query('SELECT p.*,COALESCE((SELECT sum(r.amount_minor) FROM refund_allocations r WHERE r.org_id=p.org_id AND r.payment_id=p.payment_id AND r.invoice_id=p.invoice_id),0)::int AS refunded FROM payment_allocations p WHERE p.org_id=$1 AND p.payment_id=$2 ORDER BY p.invoice_id',[event.org_id,payment.id]);
   for(const allocation of allocations){if(!remaining)break;const delta=Math.min(remaining,allocation.amount_minor-allocation.refunded);if(delta<=0)continue;const [inv]=await tx.query('SELECT * FROM invoices WHERE org_id=$1 AND id=$2 FOR UPDATE',[event.org_id,allocation.invoice_id]);requireThat(inv.paid_minor>=delta&&!inv.pending_order_id,'REFUND_RECONCILIATION_REQUIRED');await tx.query('UPDATE invoices SET paid_minor=paid_minor-$1 WHERE id=$2',[delta,inv.id]);await tx.query('INSERT INTO refund_allocations(org_id,refund_id,payment_id,invoice_id,amount_minor) VALUES($1,$2,$3,$4,$5)',[event.org_id,refund.id,payment.id,inv.id,delta]);await tx.query("INSERT INTO ledger_entries(id,org_id,branch_id,invoice_id,payment_id,event_key,kind,amount_minor,reason) VALUES($1,$2,$3,$4,$5,$6,'refund',$7,'Verified processed gateway refund; invoice balance reopened')",[id(),event.org_id,inv.branch_id,inv.id,payment.id,'refund:'+refund.id+':'+inv.id,delta]);remaining-=delta;}
   requireThat(remaining===0,'REFUND_ALLOCATION_MISMATCH');await tx.query("UPDATE refunds SET status='processed',applied_at=now() WHERE id=$1",[refund.id]);
  }else if(!refund.applied_at)await tx.query('UPDATE refunds SET status=$1 WHERE id=$2',[actual.status,refund.id]);
  await tx.query("UPDATE webhook_events SET status='done',processed_at=now() WHERE id=$1",[event.id]);
 });
}
