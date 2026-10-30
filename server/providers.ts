import { createHmac, timingSafeEqual } from 'node:crypto';
import { Fault, requireThat } from './core.js';
import type { Row } from './db.js';
export type Transport = typeof fetch;
export function checkSignature(raw:Buffer, secret:string|undefined, supplied:string|undefined, prefix='') {
  if(!secret||!supplied)return false;
  const expected=Buffer.from(prefix+createHmac('sha256',secret).update(raw).digest('hex'));
  const actual=Buffer.from(supplied);return expected.length===actual.length&&timingSafeEqual(expected,actual);
}
export function metaConfiguration(account:Row) {
  const missing=[];
  for(const key of [`META_ACCESS_TOKEN_${account.credential_key}`,`META_APP_SECRET_${account.credential_key}`,`META_VERIFY_TOKEN_${account.credential_key}`])if(!process.env[key])missing.push(key);
  if(!/^v\d+\.0$/.test(process.env.META_GRAPH_VERSION||''))missing.push('META_GRAPH_VERSION (supported version verified for this account)');
  if(account.model!=='legacy_waba')missing.push('verified current WAAC/PMA API contract (new model transport not enabled)');
  return missing;
}
export class ProviderFailure extends Error {
  constructor(public code:string, public retryable=false, public uncertain=false) {super(code);}
}
export async function metaRequest(account:Row,path:string,method:string,body:unknown,transport:Transport=fetch) {
  const missing=metaConfiguration(account);requireThat(!missing.length,'META_NOT_CONFIGURED',`Missing: ${missing.join(', ')}`,503);
  requireThat(/^[a-zA-Z0-9_-]+(?:\/(?:message_templates|messages))?(?:\?(?:fields|after|limit)=[a-zA-Z0-9_,%.-]+(?:&(?:fields|after|limit)=[a-zA-Z0-9_,%.-]+)*)?$/.test(path),'INVALID_PROVIDER_PATH','Provider path is not supported.',400);
  let result:Response;
  try { result=await transport(`https://graph.facebook.com/${process.env.META_GRAPH_VERSION}/${path}`,{method,headers:{Authorization:`Bearer ${process.env[`META_ACCESS_TOKEN_${account.credential_key}`]}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)}); }
  catch {throw new ProviderFailure('PROVIDER_NETWORK_UNCERTAIN',false,method==='POST');}
  let json:any;try{json=await result.json();}catch{throw new ProviderFailure('MALFORMED_PROVIDER_RESPONSE',false,method==='POST');}
  if(!result.ok) {
    const code=Number(json?.error?.code||0);
    throw new ProviderFailure(code===190?'TOKEN_EXPIRED':result.status===429?'RATE_LIMITED':result.status>=500?'PROVIDER_UNAVAILABLE':`META_${code||result.status}`,result.status===429||result.status>=500,false);
  }
  return json;
}
export async function sendTemplate(account:Row,sender:Row,template:Row,recipient:Row,parameters:string[],transport:Transport=fetch) {
  const payload={messaging_product:'whatsapp',to:recipient.identity,type:'template',template:{name:template.name,language:{code:template.language},...(parameters.length?{components:[{type:'body',parameters:parameters.map(text=>({type:'text',text}))}]}:{})}};
  const result=await metaRequest(account,`${sender.phone_id}/messages`,'POST',payload,transport);
  const providerId=result.messages?.[0]?.id;
  if(typeof providerId!=='string'||!providerId)throw new ProviderFailure('MISSING_PROVIDER_MESSAGE_ID',false,true);
  return providerId;
}
export async function sendTextReply(account:Row,sender:Row,recipient:Row,body:string,contextId:string,transport:Transport=fetch){const result=await metaRequest(account,`${sender.phone_id}/messages`,'POST',{messaging_product:'whatsapp',to:recipient.identity,type:'text',context:{message_id:contextId},text:{preview_url:false,body}},transport);const providerId=result.messages?.[0]?.id;if(typeof providerId!=='string'||!providerId)throw new ProviderFailure('MISSING_PROVIDER_MESSAGE_ID',false,true);return providerId;}
