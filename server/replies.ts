import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { getActor } from './auth.js';
import { id,identifier,allow,audit,requireThat,portal } from './core.js';
import { waScope } from './whatsapp.js';
export async function replyRoutes(app:FastifyInstance,db:DB){
 app.post('/api/v1/whatsapp/replies',async req=>{
  const a=getActor(req);requireThat(!portal(a));const b=z.object({inboundId:identifier,body:z.string().trim().min(1).max(4096),eventKey:z.string().min(8).max(180),authorizedTest:z.boolean().default(false),confirmed:z.literal(true)}).strict().parse(req.body);if(b.authorizedTest)allow(a,['owner']);
  const rid=id();await db.transaction(async tx=>{const[m]=await tx.query('SELECT m.*,s.branch_id,c.student_id,c.opted_in,c.opted_out_at,c.categories FROM inbound_messages m JOIN whatsapp_senders s ON s.org_id=m.org_id AND s.id=m.sender_id JOIN recipient_consents c ON c.org_id=m.org_id AND c.id=m.consent_id WHERE m.org_id=$1 AND m.id=$2',[a.org_id,b.inboundId]);requireThat(m,'UNRESOLVED_IDENTITY','Only an authenticated, unambiguously linked inbound thread can receive replies.');await waScope(tx,a,m.branch_id,m.student_id);requireThat(m.opted_in&&!m.opted_out_at&&m.categories.includes('general'),'CONSENT_NOT_ELIGIBLE','Recipient has not opted in for this category.');requireThat(new Date(m.received_at).getTime()>Date.now()-24*3600000&&new Date(m.received_at).getTime()<=Date.now()+300000,'SERVICE_WINDOW_CLOSED','The customer-service window has closed. Use an approved template.',409);
   await tx.query("INSERT INTO message_requests(id,org_id,branch_id,actor_id,sender_id,template_id,template_version,category,parameters,purpose,event_key,scheduled_at,authorized_test,outbound_kind,text_body,inbound_context_id) VALUES($1,$2,$3,$4,$5,NULL,'service-window','general','[]','Reply to an authenticated WhatsApp thread',$6,now(),$7,'text',$8,$9)",[rid,a.org_id,m.branch_id,a.id,m.sender_id,b.eventKey,b.authorizedTest,b.body,m.id]);await tx.query('INSERT INTO message_recipients(id,org_id,request_id,consent_id) VALUES($1,$2,$3,$4)',[id(),a.org_id,rid,m.consent_id]);await audit(tx,a,'confirm_whatsapp_reply','message_request',rid,{inboundId:m.id},m.branch_id);
  });return {id:rid,status:'queued'};
 });
}
