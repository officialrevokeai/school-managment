import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import serveStatic from '@fastify/static';
import { resolve } from 'node:path';
import { ZodError } from 'zod';
import { type DB, migrate } from './db.js';
import { Fault } from './core.js';
import { authRoutes } from './auth.js';
import { foundationRoutes } from './foundation.js';
import { whatsappRoutes } from './whatsapp.js';
import { ProviderFailure, type Transport } from './providers.js';
import { peopleRoutes } from './people.js';
import { classroomRoutes } from './classroom.js';
import { academicsRoutes } from './academics.js';
import { financeRoutes } from './finance.js';
import { automationRoutes } from './automations.js';
import { operationsRoutes } from './operations.js';
import { reportsRoutes } from './reports.js';
import { governanceRoutes } from './governance.js';
import { revisionRoutes } from './revisions.js';
import { replyRoutes } from './replies.js';
import { liveAcceptanceRoutes } from './live-acceptance.js';
import { accountRoutes } from './accounts.js';
import { liveDataRoutes } from './live-data.js';
import { setupRoutes } from './setup.js';
import { platformRoutes } from './platform.js';
import { webBuildVersion } from './app-version.js';
declare module 'fastify' { interface FastifyInstance { buildVersion:string; } }

declare module 'fastify' { interface FastifyRequest { rawBody?: Buffer; } }
export async function createApp(db:DB, options:{static?:boolean;transport?:Transport}={}) {
  const app=Fastify({logger:false,bodyLimit:7500000,trustProxy:process.env.TRUST_PROXY||false});
  app.decorate('buildVersion',options.static===false?'test':await webBuildVersion());
  await app.register(helmet,{contentSecurityPolicy:{directives:{defaultSrc:["'self'"],scriptSrc:["'self'",'https://checkout.razorpay.com'],connectSrc:["'self'",'https://*.razorpay.com'],frameSrc:['https://*.razorpay.com'],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:",'https://*.razorpay.com'],objectSrc:["'none'"],frameAncestors:["'none'"]}}});
  await app.register(cookie);await app.register(rateLimit,{max:150,timeWindow:'1 minute'});
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json',{parseAs:'buffer'},(req,body,done)=>{
    req.rawBody=body as Buffer;try{done(null,JSON.parse((body as Buffer).toString('utf8')));}catch{done(new Fault(400,'INVALID_JSON','Send a valid JSON body.'));}
  });
  app.setErrorHandler((err:any,req,reply)=>{
    if(err instanceof ZodError)return reply.code(400).send({error:{code:'VALIDATION',message:'Check the submitted fields.',fields:err.issues.map(i=>({path:i.path.join('.'),message:i.message})),requestId:req.id}});
    if(err instanceof Fault)return reply.code(err.status).send({error:{code:err.code,message:err.message,requestId:req.id}});
    if(err instanceof ProviderFailure)return reply.code(502).send({error:{code:err.code,message:'The provider request failed. Check integration configuration and history.',requestId:req.id}});
    if(err.code==='23505')return reply.code(409).send({error:{code:'CONFLICT',message:'This record or action already exists.',requestId:req.id}});
    if(['23503','23514','22P02','22007','22008'].includes(err.code))return reply.code(400).send({error:{code:'INVALID_REFERENCE',message:'Check record relationships and values.',requestId:req.id}});
    const code=err.statusCode||500;
    if(code>=500)process.stderr.write(JSON.stringify({level:'error',requestId:req.id,type:err.constructor.name,code:err.code||'INTERNAL'})+'\n');
    return reply.code(code).send({error:{code:code===429?'RATE_LIMITED':'INTERNAL',message:code===429?'Too many requests. Try again later.':'The request could not be completed.',requestId:req.id}});
  });
  app.addHook('onSend',async(req,reply,payload)=>{if(req.url.startsWith('/api/'))reply.header('Cache-Control','no-store');return payload;});
  if(process.env.NODE_ENV==='production')app.addHook('onResponse',async(req,reply)=>{process.stdout.write(JSON.stringify({requestId:req.id,method:req.method,route:req.routeOptions.url,status:reply.statusCode,durationMs:Math.round(reply.elapsedTime)})+'\n');});
  app.get('/health/live',async()=>({ok:true}));
  app.get('/health/ready',async()=>{await db.query('SELECT 1');return {database:true};});
  await authRoutes(app,db);await governanceRoutes(app,db);await foundationRoutes(app,db);
  await platformRoutes(app,db);
  await whatsappRoutes(app,db,options.transport);
  await peopleRoutes(app,db);
  await classroomRoutes(app,db);
  await academicsRoutes(app,db);
  await financeRoutes(app,db,options.transport);
  await automationRoutes(app,db);
  await operationsRoutes(app,db);await reportsRoutes(app,db);
  await revisionRoutes(app,db);
  await replyRoutes(app,db);
  await liveAcceptanceRoutes(app,db);
  await accountRoutes(app,db);await liveDataRoutes(app,db);
  await setupRoutes(app,db);
  if(options.static!==false)await app.register(serveStatic,{root:resolve('web'),index:'index.html',maxAge:0});
  return app;
}
