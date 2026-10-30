import { openDatabase, migrate } from '../server/db.js';
import { provision } from '../server/auth.js';
if(!process.env.DATABASE_URL&&!process.env.PGLITE_PATH)process.env.PGLITE_PATH='./runtime/local-postgres';
console.error('Supply one JSON object on stdin: organization, name, ownerName, email, password. Input is never logged.');
let input='';for await(const chunk of process.stdin) input+=chunk;
const db=await openDatabase();
try { await migrate(db);console.log(await provision(db,JSON.parse(input))); } finally { await db.close(); }
