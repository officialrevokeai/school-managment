import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { provision } from './auth.js';
import { digest,requireThat } from './core.js';
export async function setupRoutes(app:FastifyInstance,db:DB){
 const token=process.env.INITIAL_SETUP_TOKEN;
 if(token&&token.length>=32)await db.query("INSERT INTO initial_setup_tokens(token_hash,expires_at) VALUES($1,now()+interval '2 hours') ON CONFLICT DO NOTHING",[digest(token)]);
 const available=async()=>!!token&&!(await db.query('SELECT 1 FROM organizations LIMIT 1')).length&&(await db.query('SELECT 1 FROM initial_setup_tokens WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL',[digest(token)])).length>0;
 app.get('/api/v1/setup/status',async()=>({available:await available()}));
 app.post('/api/v1/setup/owner',{config:{rateLimit:{max:5,timeWindow:'15 minutes'}}},async req=>{
  const b=z.object({setupToken:z.string().min(32).max(128),organization:z.string().regex(/^[a-z0-9-]{3,60}$/),name:z.string().trim().min(1).max(200),ownerName:z.string().trim().min(1).max(200),email:z.email(),password:z.string().min(12).max(128),confirmed:z.literal(true)}).strict().parse(req.body);
  requireThat(await available(),'SETUP_CLOSED','Initial owner setup is unavailable or already completed.',409);
  const [valid]=await db.query('SELECT 1 FROM initial_setup_tokens WHERE token_hash=$1 AND expires_at>now() AND used_at IS NULL',[digest(b.setupToken)]);requireThat(valid&&digest(b.setupToken)===digest(token!),'INVALID_SETUP_TOKEN','A valid operator-issued setup code is required.',401);
  const {setupToken,confirmed,...input}=b;const result=await provision(db,input);await db.query('UPDATE initial_setup_tokens SET used_at=now() WHERE token_hash=$1',[digest(b.setupToken)]);return {...result,email:b.email.toLowerCase()};
 });
}
