import { openDatabase } from '../server/db.js';
import { createOperationalBackup } from '../server/backup.js';
const db=await openDatabase();try{console.log(await createOperationalBackup(db));}finally{await db.close();}
