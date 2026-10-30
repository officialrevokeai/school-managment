import { openDatabase,migrate } from '../server/db.js';
import { requireThat } from '../server/core.js';
import { platformAudit } from '../server/platform.js';
const [organization,email]=process.argv.slice(2);
requireThat(organization&&email,'INPUT_REQUIRED','Usage: npm run platform:bootstrap -- ORGANIZATION EMAIL',400);
if(!process.env.DATABASE_URL&&!process.env.PGLITE_PATH)process.env.PGLITE_PATH='./runtime/local-postgres';
const db=await openDatabase();
try{await migrate(db);await db.transaction(async tx=>{
 await tx.query('SELECT pg_advisory_xact_lock(48290220)');
 const [u]=await tx.query("SELECT u.* FROM users u JOIN organizations o ON o.id=u.org_id WHERE o.slug=$1 AND u.email=$2 AND u.role='owner' AND u.active AND o.status='active'",[organization,email.toLowerCase()]);
 requireThat(u,'OWNER_REQUIRED','An existing active owner account is required.',400);
 const existing=await tx.query('SELECT user_id FROM platform_admins');
 requireThat(!existing.length||existing.some(p=>p.user_id===u.id),'ALREADY_BOOTSTRAPPED','The initial master administrator is already configured.',409);
 if(!existing.length){await tx.query('INSERT INTO platform_admins(user_id) VALUES($1)',[u.id]);await platformAudit(tx,u as any,'bootstrap_master',u.org_id,{userId:u.id},'Authorized platform operator bootstrap');}
});console.log('Master administrator configured. School credentials are unchanged.');}finally{await db.close();}
