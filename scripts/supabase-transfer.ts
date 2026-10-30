import { openDatabase,migrate,type DB } from '../server/db.js';
import { requireThat } from '../server/core.js';
import { targetConfiguration } from './supabase-prepare.js';
const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"';
const excluded=new Set(['schema_migrations','sessions','recovery_tokens','initial_setup_tokens','worker_heartbeats','login_guards','school_deletion_challenges']);
// Stop the API and take an encrypted backup first. No existing target rows are overwritten.
export async function copyDatabase(source:DB,target:DB,schema:string){
 requireThat(/^[a-z_][a-z0-9_]*$/.test(schema),'INVALID_SCHEMA');
 const tables=(await source.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name")).map(r=>r.table_name).filter(n=>!excluded.has(n));
 const targetTables=await target.query("SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE'",[schema]);
 const counts:Record<string,number>={};
 await source.transaction(async src=>target.transaction(async dst=>{
  await dst.query('SELECT pg_advisory_xact_lock(48290221)');
  // Lock all destination tables before checking emptiness, preventing concurrent writes.
  await dst.exec('LOCK TABLE '+targetTables.map(r=>quote(r.table_name)).join(',')+' IN ACCESS EXCLUSIVE MODE');
  for(const {table_name} of targetTables.filter(r=>r.table_name!=='schema_migrations'))requireThat(Number((await dst.query(`SELECT count(*) AS n FROM ${quote(table_name)}`))[0].n)===0,'TARGET_NOT_EMPTY','Transfer requires an empty destination.',409);
  const constraints=await dst.query("SELECT c.conname,t.relname,c.condeferrable,c.condeferred FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=$1 AND c.contype='f'",[schema]);
  for(const c of constraints)await dst.exec(`ALTER TABLE ${quote(c.relname)} ALTER CONSTRAINT ${quote(c.conname)} DEFERRABLE INITIALLY DEFERRED`);
  for(const table of tables){
   requireThat(targetTables.some(t=>t.table_name===table),'MISSING_TABLE','Run all target migrations before transfer.',409);
   const columns=await src.query("SELECT column_name,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position",[table]);let offset=0;
   for(;;){const rows=await src.query(`SELECT * FROM ${quote(table)} ORDER BY ctid LIMIT 250 OFFSET $1`,[offset]);if(!rows.length)break;
    for(const row of rows)await dst.query(`INSERT INTO ${quote(table)} (${columns.map(c=>quote(c.column_name)).join(',')}) VALUES(${columns.map((_,i)=>'$'+(i+1)).join(',')})`,columns.map(c=>row[c.column_name]===null?null:['json','jsonb'].includes(c.udt_name)?JSON.stringify(row[c.column_name]):row[c.column_name]));offset+=rows.length;
   }counts[table]=offset;requireThat(Number((await dst.query(`SELECT count(*) AS n FROM ${quote(table)}`))[0].n)===offset,'COUNT_MISMATCH','Transferred row verification failed.',500);
  }
  await dst.exec('SET CONSTRAINTS ALL IMMEDIATE');
  for(const c of constraints)await dst.exec(`ALTER TABLE ${quote(c.relname)} ALTER CONSTRAINT ${quote(c.conname)} ${c.condeferrable?`DEFERRABLE INITIALLY ${c.condeferred?'DEFERRED':'IMMEDIATE'}`:'NOT DEFERRABLE'}`);
 }));return counts;
}
if(process.argv[1]?.endsWith('supabase-transfer.js')){
 const url=targetConfiguration();requireThat(process.env.PGLITE_PATH,'SOURCE_REQUIRED','Set PGLITE_PATH to the existing local database; stop the API and back up first.',400);
 const source=await openDatabase(''),target=await openDatabase(url);
 try{await migrate(source);const counts=await copyDatabase(source,target,'school_app');console.log(JSON.stringify({verified:true,project:process.env.SUPABASE_PROJECT_REF,counts,sessionsCopied:false}));}finally{await source.close();await target.close();}
}
