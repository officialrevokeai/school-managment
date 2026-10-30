import { openDatabase } from './db.js';
const db=await openDatabase();try{const [r]=await db.query("SELECT seen_at FROM worker_heartbeats WHERE id='school-worker'");if(!r||Date.now()-new Date(r.seen_at).getTime()>120000)process.exitCode=1;}catch{process.exitCode=1;}finally{await db.close();}
