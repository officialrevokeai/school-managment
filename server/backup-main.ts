import { openDatabase } from './db.js';
import { createOperationalBackup } from './backup.js';
const db=await openDatabase();let stop=false,last=0;const interval=Number(process.env.BACKUP_INTERVAL_HOURS||24)*3600000;if(!Number.isFinite(interval)||interval<3600000)throw new Error('BACKUP_INTERVAL_HOURS must be at least 1');
for(const s of ['SIGINT','SIGTERM'])process.on(s,()=>{stop=true;});
while(!stop){if(Date.now()-last>=interval){try{console.log(JSON.stringify(await createOperationalBackup(db)));last=Date.now();}catch{console.error('Encrypted backup failed; operator action required.');last=Date.now()-interval+60000;}}await new Promise(r=>setTimeout(r,1000));}await db.close();
