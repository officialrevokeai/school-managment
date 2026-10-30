// Explicit disposable development fixture server. Never used by npm start or Docker production.
import { fixture,password } from '../test/support.js';
import { createApp } from '../server/app.js';
if(process.env.NODE_ENV==='production'||process.env.DATABASE_URL||process.env.PGLITE_PATH)throw new Error('QA preview refuses production or configured persistent databases.');
process.env.QA_PREVIEW='true';
const f=await fixture();await f.app.close();
await f.db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[f.clients.owner.id]);
const port=Number(process.env.PORT||3000);process.env.PUBLIC_ORIGIN=`http://127.0.0.1:${port}`;
const app=await createApp(f.db);await app.listen({host:'127.0.0.1',port});
console.log('DISPOSABLE SYNTHETIC QA PREVIEW: '+process.env.PUBLIC_ORIGIN);
console.log('Organization test-school. Accounts owner/principal/teacher/office/parent/student@example.test. Test-only password: '+password);
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();await f.db.close();process.exit(0);});
