import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request,password } from './support.js';
import { id,actorById,digest } from '../server/core.js';
import { workerTick } from '../server/worker.js';
import { readFile } from 'node:fs/promises';
import { createContext,runInContext } from 'node:vm';

test('Revoked sessions wipe dialogs, cached records, CSRF and unsaved work before displaying sign-in',async()=>{
 const sandbox=createContext({document:{getElementById:()=>({replaceChildren:()=>{sandbox.modalCleared=true;}}),addEventListener:()=>{}},history:{replaceState:()=>{}},login:()=>{sandbox.signinShown=true;},toast:()=>{},modalCleared:false,signinShown:false});
 runInContext("var currentUser={id:'private-user'},context={students:['private']},currentData={deleteProof:'secret-proof'},api={csrf:'secret-csrf'},dirty=true,liveSource={close:()=>{}};",sandbox);
 runInContext(await readFile('web/access-ui.js','utf8'),sandbox);runInContext("endSession('Access revoked')",sandbox);
 assert.equal(runInContext('currentUser===null&&context===null&&liveSource===null&&!dirty&&api.csrf===\'\'&&Object.keys(currentData).length===0',sandbox),true);assert.equal(sandbox.modalCleared,true);assert.equal(sandbox.signinShown,true);
});

test('A blocked IP can still revoke its own valid session through CSRF-protected logout',async()=>{
 const f=await fixture(),{app,db,clients:c}=f;try{
  await db.query("INSERT INTO blocked_ips(ip,reason,expires_at,created_by) VALUES('198.51.100.9','Disposable logout test',now()+interval '1 hour',$1)",[c.owner.id]);
  const r=await app.inject({method:'POST',url:'/api/v1/auth/logout',remoteAddress:'198.51.100.9',headers:{cookie:c.student.cookie,origin:'http://localhost:3000','x-csrf-token':c.student.csrf},payload:{}});assert.equal(r.statusCode,200,r.body);
  assert.equal((await request(app,c.student,'GET','/api/v1/auth/me')).statusCode,401);
 }finally{await f.close();}
});

test('Separate master sign-in: correct school credentials alone cannot access master APIs',async()=>{
 const f=await fixture(),{app,db,clients:c}=f;
 const login=(who:string,pw:string,workspace:string)=>app.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'http://localhost:3000'},payload:{organization:'test-school',email:who+'@example.test',password:pw,workspace}});
 try{
  await db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[c.owner.id]);
  assert.equal((await request(app,c.owner,'GET','/api/v1/context')).json().user.platformAdmin,false);
  assert.equal((await request(app,c.owner,'GET','/api/v1/platform/overview')).json().error.code,'MASTER_LOGIN_REQUIRED');
  assert.equal((await login('owner','wrong password','platform')).statusCode,401);
  assert.equal((await login('teacher',password,'platform')).statusCode,401);
  const r=await login('owner',password,'platform');assert.equal(r.statusCode,200,r.body);
  const master={...c.owner,cookie:r.cookies.map(x=>`${x.name}=${x.value}`).join('; '),csrf:r.json().csrf};
  assert.equal((await request(app,master,'GET','/api/v1/platform/overview')).statusCode,200);
  assert.equal((await request(app,master,'GET','/api/v1/context')).json().user.platformAdmin,true);
  assert.equal((await request(app,c.owner,'GET','/api/v1/platform/overview')).statusCode,403);
  for(const url of ['/api/v1/students','/api/v1/context','/api/v1/platform/overview'])assert.equal((await app.inject({url})).statusCode,401);
  assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'http://localhost:3000'},payload:{organization:'test-school',email:'owner@example.test',password:''}})).statusCode,400);
  assert.equal((await login('owner',password+'incorrect','school')).statusCode,401);
 }finally{await f.close();}
});

test('Permanent school deletion requires two session-bound confirmations, reauthentication and atomic tenant cascade',async t=>{
 const f=await fixture(),{app,db,clients:c,ids:i}=f,admin=c.otherOwner;
 await db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[admin.id]);await db.query("UPDATE sessions SET workspace='platform' WHERE user_id=$1",[admin.id]);
 const base=`/api/v1/platform/organizations/${i.org}/deletion`;
 let address=50;const post=(who:any,url:string,payload:any,extra:any={})=>app.inject({method:'POST',url,remoteAddress:'198.51.100.'+(address++),headers:{cookie:who.cookie,origin:'http://localhost:3000','x-csrf-token':who.csrf,...extra},payload});
 const prepare=(body:any={})=>post(admin,base+'/prepare',{organizationCode:'test-school',reason:'Disposable QA school deletion',confirmed:true,...body});
 const finish=(token:string,body:any={},who=admin)=>post(who,base+'/confirm',{token,confirmation:'DELETE test-school',password,confirmed:true,...body});
 try{
  await t.test('ordinary school roles, absent CSRF, missing first confirmation and protected master organizations are rejected',async()=>{
   for(const role of ['owner','principal','teacher','office','student','parent'])assert.equal((await post(c[role],base+'/prepare',{organizationCode:'test-school',reason:'Not permitted here',confirmed:true})).statusCode,403);
   assert.equal((await post(admin,base+'/prepare',{organizationCode:'test-school',reason:'Missing CSRF test',confirmed:true},{'x-csrf-token':''})).statusCode,403);
   assert.equal((await finish('nonexistent-proof-token-long-enough-2026')).statusCode,409);
   assert.equal((await prepare({organizationCode:'wrong-school'})).statusCode,400);
   assert.equal((await post(admin,`/api/v1/platform/organizations/${i.other}/deletion/prepare`,{organizationCode:'other-school',reason:'Protected organization test',confirmed:true})).statusCode,409);
  });
  let token='';
  await t.test('first confirmation only prepares a hashed, short-lived proof and never logs anyone out',async()=>{
   const r=await prepare();assert.equal(r.statusCode,200,r.body);token=r.json().token;
   const[p]=await db.query('SELECT * FROM school_deletion_challenges WHERE token_hash=$1',[digest(token)]);assert.ok(p);assert.notEqual(p.token_hash,token);
   for(const role of ['owner','principal','teacher','office','student','parent'])assert.equal((await request(app,c[role],'GET','/api/v1/auth/me')).statusCode,200);
   assert.equal((await finish(token,{confirmation:'DELETE another-school'})).statusCode,400);
   assert.equal((await finish(token,{password:'incorrect password'})).statusCode,401);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM organizations'))[0].n,2);
  });
  await t.test('proofs cannot be moved to another session and expired proofs cannot delete data',async()=>{
   const r=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'http://localhost:3000'},payload:{organization:'other-school',email:'otherOwner@example.test',password,workspace:'platform'}});assert.equal(r.statusCode,200,r.body);
   const otherSession={...admin,cookie:r.cookies.map(x=>`${x.name}=${x.value}`).join('; '),csrf:r.json().csrf};assert.equal((await finish(token,{},otherSession)).statusCode,409);
   await db.query("UPDATE school_deletion_challenges SET expires_at=now()-interval '1 second' WHERE token_hash=$1",[digest(token)]);assert.equal((await finish(token)).statusCode,409);
  });
  await t.test('second confirmation deletes all tenant tables/files/jobs/fees and logs out all six roles, without touching another organization',async()=>{
   const file=id();await db.query("INSERT INTO file_assets(id,org_id,branch_id,owner_id,name,mime,bytes,sha256,size) VALUES($1,$2,$3,$4,'secret.txt','text/plain',$5,'fixture',4)",[file,i.org,i.branch,c.owner.id,Buffer.from('data')]);
   const fee=await request(app,c.office,'POST','/api/v1/fee-structures',{classId:i.cls,name:'Fixture fee',amountMinor:1000});assert.equal(fee.statusCode,200,fee.body);
   const invoice=await request(app,c.office,'POST','/api/v1/invoices',{studentId:i.student,title:'Fixture invoice',dueDate:'2026-11-01',structureIds:[fee.json().id],eventKey:'purge-fixture'});assert.equal(invoice.statusCode,200,invoice.body);
   await db.query("INSERT INTO outbox(id,org_id,event_key,kind,data) VALUES($1,$2,'pending-school-job','email',$3)",[id(),i.org,{userId:c.parent.id}]);
   const r=await prepare();assert.equal(r.statusCode,200,r.body);token=r.json().token;
   const deleted=await finish(token);assert.equal(deleted.statusCode,200,deleted.body);assert.equal(deleted.json().deleted,true);
   const tables=await db.query("SELECT table_name FROM information_schema.columns WHERE table_schema=current_schema() AND column_name='org_id'");
   for(const {table_name} of tables){const[{n}]=await db.query(`SELECT count(*)::int AS n FROM "${table_name}" WHERE org_id=$1`,[i.org]);assert.equal(n,0,table_name+' retained tenant data');}
   assert.equal((await db.query('SELECT count(*)::int AS n FROM organizations'))[0].n,1);
   assert.equal((await request(app,admin,'GET','/api/v1/auth/me')).statusCode,200);
   assert.equal((await db.query("SELECT count(*)::int AS n FROM platform_events WHERE operation='delete_school' AND org_id=$1",[i.other]))[0].n,1);
   for(const role of ['owner','principal','teacher','office','student','parent']){assert.equal((await request(app,c[role],'GET','/api/v1/auth/me')).statusCode,401);await assert.rejects(actorById(db,i.org,c[role].id));}
   assert.equal((await app.inject({method:'POST',url:'/api/v1/auth/login',remoteAddress:'192.0.2.55',headers:{origin:'http://localhost:3000'},payload:{organization:'test-school',email:'owner@example.test',password}})).statusCode,401);
   assert.equal((await finish(token)).statusCode,404);await workerTick(db);
  });
 }finally{await f.close();}
});
