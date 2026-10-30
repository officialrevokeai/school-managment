import { readFile } from 'node:fs/promises';
import { decryptBackup,postgresTool } from '../server/backup.js';
import { requireThat } from '../server/core.js';
const target=process.env.RESTORE_DATABASE_URL,source=process.env.DATABASE_URL,pass=process.env.BACKUP_PASSPHRASE,file=process.argv[2];
requireThat(target&&source&&pass&&file,'RESTORE_CONFIGURATION_REQUIRED','Set a distinct empty RESTORE_DATABASE_URL, DATABASE_URL, BACKUP_PASSPHRASE and backup path.');
const a=new URL(target),b=new URL(source);requireThat(a.hostname!==b.hostname||a.port!==b.port||a.pathname!==b.pathname,'RESTORE_TARGET_REJECTED','Restore target must be a separate empty database.');
await postgresTool('pg_restore',target,decryptBackup(await readFile(file),pass));console.log('Restore completed into the isolated target. Validate record counts, files and application access before promotion.');
