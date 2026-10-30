import { openDatabase } from './db.js';
import { workerTick } from './worker.js';
const db=await openDatabase();let stop=false;
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{stop=true;});
while(!stop){try{await workerTick(db);}catch{process.stderr.write('Worker iteration failed; inspect restricted diagnostics.\n');}await new Promise(r=>setTimeout(r,1000));}
await db.close();
