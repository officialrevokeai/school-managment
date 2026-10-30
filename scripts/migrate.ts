import { openDatabase, migrate } from '../server/db.js';
if(!process.env.DATABASE_URL&&!process.env.PGLITE_PATH)process.env.PGLITE_PATH='./runtime/local-postgres';
const db=await openDatabase();
try { await migrate(db); console.log('Migrations applied.'); } finally { await db.close(); }
