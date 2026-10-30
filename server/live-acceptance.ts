import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { getActor } from './auth.js';
import { id,identifier,allow,audit,requireThat } from './core.js';
import { metaConfiguration } from './providers.js';
export async function liveAcceptanceRoutes(app:FastifyInstance,db:DB){
 app.post('/api/v1/whatsapp/senders/:id/verify-live',async req=>{
  const a=getActor(req);allow(a,['owner']);const sid=identifier.parse((req.params as any).id),b=z.object({recipientId:identifier,inboundId:identifier,receiptEvidence:z.string().trim().min(15).max(2000),browserClosedConfirmed:z.literal(true),confirmed:z.literal(true)}).strict().parse(req.body);
  await db.transaction(async tx=>{
   const[s]=await tx.query('SELECT s.*,a.model,a.credential_key FROM whatsapp_senders s JOIN integration_accounts a ON a.org_id=s.org_id AND a.id=s.account_id WHERE s.org_id=$1 AND s.id=$2 AND s.active AND a.active FOR UPDATE OF s',[a.org_id,sid]);requireThat(s&&s.connection_state==='ready'&&!metaConfiguration(s).length,'SENDER_NOT_READY','Complete a real provider configuration check first.',409);
   const[m]=await tx.query(`SELECT m.*,r.sender_id,r.authorized_test,r.scheduled_at,r.confirmed_at FROM message_recipients m JOIN message_requests r ON r.org_id=m.org_id AND r.id=m.request_id WHERE m.org_id=$1 AND m.id=$2 AND r.sender_id=$3`,[a.org_id,b.recipientId,sid]);
   requireThat(m?.authorized_test&&m.provider_message_id&&['delivered','read'].includes(m.status),'REAL_DELIVERY_REQUIRED','An owner-authorized test needs a real provider ID and matching signed delivery callback.',409);
   requireThat((await tx.query("SELECT 1 FROM delivery_events WHERE org_id=$1 AND recipient_id=$2 AND status IN ('delivered','read')",[a.org_id,m.id])).length,'AUTHENTIC_CALLBACK_REQUIRED','A matching authentic delivery event is required.',409);
   const[inbound]=await tx.query('SELECT * FROM inbound_messages WHERE org_id=$1 AND id=$2 AND sender_id=$3 AND consent_id=$4',[a.org_id,b.inboundId,sid,m.consent_id]);requireThat(inbound&&new Date(inbound.received_at)>=new Date(m.accepted_at),'INBOUND_REPLY_REQUIRED','A matching authentic reply after the send is required.',409);
   requireThat(new Date(m.scheduled_at).getTime()>new Date(m.confirmed_at).getTime()+1000&&new Date(m.accepted_at)>=new Date(m.scheduled_at),'SCHEDULED_WORKER_PROOF_REQUIRED','Use a future scheduled test executed by the server worker.',409);
   const version=process.env.META_GRAPH_VERSION!;requireThat((await tx.query('SELECT 1 FROM message_attempts WHERE org_id=$1 AND recipient_id=$2 AND provider_message_id=$3 AND provider_api_version=$4',[a.org_id,m.id,m.provider_message_id,version])).length,'API_VERSION_EVIDENCE_REQUIRED','The accepted send must use the currently configured supported API version.',409);
   await tx.query('INSERT INTO live_acceptances(id,org_id,sender_id,recipient_id,inbound_id,verified_by,api_version,receipt_evidence,browser_closed_confirmed) VALUES($1,$2,$3,$4,$5,$6,$7,$8,true)',[id(),a.org_id,sid,m.id,inbound.id,a.id,version,b.receiptEvidence]);await tx.query('UPDATE whatsapp_senders SET live_verified_at=now(),live_verified_api_version=$1 WHERE id=$2',[version,sid]);await audit(tx,a,'live_acceptance','whatsapp_sender',sid,{recipientId:m.id,inboundId:inbound.id,apiVersion:version,browserClosedConfirmed:true},s.branch_id,b.receiptEvidence);
  });return {liveVerified:true};
 });
}
