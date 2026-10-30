import pg from 'pg';
import { openDatabase,migrate } from '../server/db.js';
import { requireThat } from '../server/core.js';
export function targetConfiguration(){
 const value=process.env.DATABASE_URL;requireThat(value,'DATABASE_REQUIRED','Set the target Supabase DATABASE_URL privately in .env.',400);
 const url=new URL(value),ref=process.env.SUPABASE_PROJECT_REF;
 requireThat(ref&&/^[a-z]{20}$/.test(ref),'PROJECT_REQUIRED','Set SUPABASE_PROJECT_REF to your target project reference.',400);
 requireThat(url.hostname===`db.${ref}.supabase.co`||url.hostname.endsWith('.pooler.supabase.com')&&decodeURIComponent(url.username).endsWith('.'+ref),'WRONG_PROJECT','DATABASE_URL must address the configured Supabase project.',400);
 requireThat(url.searchParams.get('sslmode')==='verify-full','TLS_REQUIRED','Use sslmode=verify-full and the provider root certificate if required.',400);
 requireThat(process.env.DB_SCHEMA==='school_app','PRIVATE_SCHEMA_REQUIRED','Set DB_SCHEMA=school_app. Do not expose this schema through the Supabase Data API.',400);
 return value;
}
export async function prepareSupabase(){
 const url=targetConfiguration(),client=new pg.Client({connectionString:url,connectionTimeoutMillis:15000});await client.connect();
 try{
  const [{exists}]=(await client.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='school_app') AS exists")).rows;
  if(exists){const[{tables,tracked}]=(await client.query("SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='school_app') AS tables,to_regclass('school_app.schema_migrations') IS NOT NULL AS tracked")).rows;requireThat(!tables||tracked,'SCHEMA_IN_USE','The school_app schema contains unrelated tables. Choose a clean project or review it before migration.',409);}
  if(!exists)await client.query('CREATE SCHEMA school_app');
  await client.query('REVOKE ALL ON SCHEMA school_app FROM PUBLIC, anon, authenticated');
  await client.query('REVOKE ALL ON ALL TABLES IN SCHEMA school_app FROM PUBLIC, anon, authenticated');
  await client.query('REVOKE ALL ON ALL SEQUENCES IN SCHEMA school_app FROM PUBLIC, anon, authenticated');
 }finally{await client.end();}
 const db=await openDatabase(url);try{await migrate(db);await db.exec('REVOKE ALL ON ALL TABLES IN SCHEMA school_app FROM PUBLIC, anon, authenticated');const [check]=await db.query("SELECT current_schema() AS schema,(SELECT count(*)::int FROM schema_migrations) AS migrations");requireThat(check.schema==='school_app','SCHEMA_MISMATCH','Migration schema check failed.');console.log(JSON.stringify({project:process.env.SUPABASE_PROJECT_REF,schema:check.schema,migrations:check.migrations,verified:true}));}finally{await db.close();}
}
if(process.argv[1]?.endsWith('supabase-prepare.js'))await prepareSupabase();
