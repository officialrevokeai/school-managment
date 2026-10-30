import { openDatabase } from '../server/db.js';
import { requireThat } from '../server/core.js';
const pass=process.env.APP_DB_PASSWORD;requireThat(pass&&/^[A-Za-z0-9_-]{32,128}$/.test(pass),'APP_PASSWORD_REQUIRED','APP_DB_PASSWORD must be a unique URL-safe secret of 32–128 characters.');
const db=await openDatabase(),schema=process.env.DB_SCHEMA||'public';try{await db.transaction(async tx=>{const[exists]=await tx.query("SELECT 1 FROM pg_roles WHERE rolname='school_app'");if(!exists)await tx.exec('CREATE ROLE school_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT');const[q]=await tx.query("SELECT format('ALTER ROLE school_app PASSWORD %L',$1::text) AS statement",[pass]);await tx.exec(q.statement);const[grant]=await tx.query("SELECT format('GRANT CONNECT ON DATABASE %I TO school_app',current_database()) AS statement");await tx.exec(grant.statement);await tx.exec(`GRANT USAGE ON SCHEMA ${schema} TO school_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ${schema} TO school_app;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM school_app;
REVOKE UPDATE, DELETE, TRUNCATE ON platform_events FROM school_app;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON platform_admins FROM school_app;
REVOKE ALL ON schema_migrations FROM school_app;
GRANT SELECT ON schema_migrations TO school_app;
REVOKE CREATE ON SCHEMA ${schema} FROM PUBLIC;`);});console.log('Restricted application database role configured.');}finally{await db.close();}
