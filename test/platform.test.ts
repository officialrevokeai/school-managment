import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request,password } from './support.js';
import { actorById,id } from '../server/core.js';
import { dataRevision } from '../server/live-data.js';
import { ipKey,accountKey,normalizeIp } from '../server/security.js';
import { openDatabase,migrate } from '../server/db.js';
import { copyDatabase } from '../scripts/supabase-transfer.js';

test('Master Panel: isolation, real counts, school lifecycle, roles, exports and login security',async t=>{
 const f=await fixture(),{app,db,clients:c,ids:i}=f;
 const login=(organization:string,email:string,pw:string,ip='192.0.2.20')=>app.inject({method:'POST',url:'/api/v1/auth/login',remoteAddress:ip,headers:{origin:'http://localhost:3000'},payload:{organization,email,password:pw}});
 const why={reason:'Authorized school administration',confirmed:true};
 let org='',branch='',ownerClient:any;
 try{
  await t.test('ordinary owners and every other role cannot access global data or promote themselves',async()=>{
   for(const role of Object.keys(c))assert.equal((await request(app,c[role],'GET','/api/v1/platform/overview')).statusCode,403);
   assert.equal((await request(app,c.owner,'POST','/api/v1/accounts',{name:'Forged master',email:'master@test.invalid',password,role:'platform_admin',confirmed:true})).statusCode,400);
   await db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[c.owner.id]);await db.query("UPDATE sessions SET workspace='platform' WHERE user_id=$1",[c.owner.id]);
   assert.equal((await request(app,c.owner,'GET','/api/v1/context')).json().user.platformAdmin,true);
   assert.equal((await request(app,c.otherOwner,'GET','/api/v1/context')).json().user.platformAdmin,false);
  });
  await t.test('school creation is atomic with owner, branch and real cross-school totals; live revision changes',async()=>{
   const a={...await actorById(db,i.org,c.owner.id),workspace:'platform' as const},other=await actorById(db,i.other,c.otherOwner.id),before=await dataRevision(db,a),privateBefore=await dataRevision(db,other);
   const r=await request(app,c.owner,'POST','/api/v1/platform/organizations',{...why,name:'New Real School',organization:'new-school',ownerName:'School Owner',email:'new@example.test',password,branchName:'Main'});assert.equal(r.statusCode,200,r.body);org=r.json().id;branch=r.json().branchId;
   assert.notEqual(await dataRevision(db,a),before);assert.equal(await dataRevision(db,other),privateBefore);
   const data=(await request(app,c.owner,'GET','/api/v1/platform/overview')).json();assert.equal(data.totals.organizations,3);assert.equal(data.totals.runningSchools,2);assert.equal(data.totals.students,2);assert.equal(data.items.find((o:any)=>o.id===org).staff,1);assert.ok(!JSON.stringify(data).includes('password_hash'));
   const signed=await login('new-school','new@example.test',password);assert.equal(signed.statusCode,200,signed.body);ownerClient={id:signed.json().user.id,cookie:signed.cookies.map(c=>`${c.name}=${c.value}`).join('; '),csrf:signed.json().csrf};
   const duplicate=await request(app,c.owner,'POST','/api/v1/platform/organizations',{...why,name:'Duplicate',organization:'new-school',ownerName:'Other',email:'other@example.test',password,branchName:'Main'});assert.equal(duplicate.statusCode,409);assert.equal((await db.query('SELECT count(*)::int AS n FROM organizations'))[0].n,3);
  });
  await t.test('suspend/archive revoke old logins and workers; restore retains data and requires new login',async()=>{
   for(const state of ['suspended','archived']){
    assert.equal((await request(app,c.owner,'PATCH',`/api/v1/platform/organizations/${org}`,{...why,status:state})).statusCode,200);
    assert.equal((await request(app,ownerClient,'GET','/api/v1/auth/me')).statusCode,401);await assert.rejects(actorById(db,org,ownerClient.id));
    assert.equal((await login('new-school','new@example.test',password)).statusCode,401);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM schools WHERE org_id=$1',[org]))[0].n,1);
    assert.equal((await request(app,c.owner,'PATCH',`/api/v1/platform/organizations/${org}`,{...why,status:'active'})).statusCode,200);
    assert.equal((await request(app,ownerClient,'GET','/api/v1/auth/me')).statusCode,401);
   }
   assert.equal((await login('new-school','new@example.test',password)).statusCode,200);
   assert.equal((await request(app,c.owner,'PATCH',`/api/v1/platform/organizations/${i.org}`,{...why,status:'archived'})).statusCode,409);
  });
  await t.test('school role edits enforce branch, protect the last owner/master and revoke stale grants/sessions',async()=>{
   const update=(o:string,u:string,b:any)=>request(app,c.owner,'PATCH',`/api/v1/platform/organizations/${o}/users/${u}`,{...why,...b});
   assert.equal((await update(org,ownerClient.id,{role:'teacher',active:true,branchId:branch})).json().error.code,'LAST_OWNER');
   assert.equal((await update(i.org,c.teacher.id,{role:'principal',active:true,branchId:branch})).statusCode,400);
   assert.equal((await update(i.org,c.teacher.id,{role:'principal',active:true,branchId:i.branch})).statusCode,200);
   assert.equal((await request(app,c.teacher,'GET','/api/v1/auth/me')).statusCode,401);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM teacher_assignments WHERE user_id=$1',[c.teacher.id]))[0].n,0);
   assert.equal((await update(i.org,c.parent.id,{role:'owner',active:true})).statusCode,409);
   assert.equal((await update(org,c.parent.id,{role:'owner',active:true})).statusCode,404);
   assert.equal((await update(i.org,c.owner.id,{role:'teacher',active:true,branchId:i.branch})).statusCode,409);
  });
  await t.test('CSV staff/results/counts respect roles, scope, publication, date validation and formula escaping',async()=>{
   const staff=await request(app,c.owner,'GET','/api/v1/reports/export?kind=staff');assert.equal(staff.statusCode,200);assert.ok(staff.body.includes('Vikram Mehta'));assert.ok(!staff.body.includes('otherowner'));assert.ok(!staff.body.includes('password_hash'));
   assert.equal((await request(app,c.parent,'GET','/api/v1/reports/export?kind=staff')).statusCode,403);
   const count=await request(app,c.owner,'GET','/api/v1/reports/export?kind=counts');assert.ok(count.body.includes('"students","2"'));
   await db.query('UPDATE students SET name=$1 WHERE id=$2',['=HYPERLINK("bad")',i.student]);const roster=await request(app,c.parent,'GET','/api/v1/reports/export?kind=students');assert.ok(roster.body.includes("'=HYPERLINK"));assert.ok(!roster.body.includes('Diya'));
   const assessment=id();await db.query("INSERT INTO assessments(id,org_id,branch_id,class_id,subject_id,created_by,title,maximum,status,published_at) VALUES($1,$2,$3,$4,$5,$6,'Private draft',100,'draft',NULL)",[assessment,i.org,i.branch,i.cls,i.subject,c.owner.id]);await db.query("INSERT INTO mark_entries(org_id,assessment_id,student_id,kind,score) VALUES($1,$2,$3,'numeric',80)",[i.org,assessment,i.student]);
   assert.ok(!(await request(app,c.parent,'GET','/api/v1/reports/export?kind=results')).body.includes('Private draft'));
   await db.query("UPDATE assessments SET status='published',published_at=now() WHERE id=$1",[assessment]);const result=await request(app,c.parent,'GET','/api/v1/reports/export?kind=results');assert.equal(result.statusCode,200,result.body);assert.ok(result.body.includes('"80.00"'));assert.ok(result.body.includes('Private draft'));
   assert.equal((await request(app,c.owner,'GET','/api/v1/reports/export?kind=attendance&from=2026-12-01&to=2026-01-01')).statusCode,400);
   assert.equal((await request(app,c.otherOwner,'GET',`/api/v1/reports/export?kind=staff&branchId=${i.branch}`)).statusCode,403);
  });
  await t.test('five failures persistently lock an account; explicit unlock and expiry restore valid login',async()=>{
   for(let n=0;n<5;n++)assert.equal((await login('test-school','parent@example.test','wrong password','198.51.100.40')).statusCode,401);
   const locked=await login('test-school','parent@example.test',password,'198.51.100.41');assert.equal(locked.statusCode,429,locked.body);
   assert.equal((await login('test-school','student@example.test',password,'198.51.100.42')).statusCode,200);
   const key=accountKey('test-school','parent@example.test');assert.equal((await request(app,c.owner,'POST','/api/v1/platform/security/unlock',{...why,key})).statusCode,200);
   assert.equal((await login('test-school','parent@example.test',password,'198.51.100.41')).statusCode,200);
   await db.query("INSERT INTO login_guards(key,scope,ip,failures,locked_until,window_start) VALUES($1,'account','198.51.100.40',5,now()-interval '1 minute',now()-interval '20 minutes')",[key]);assert.equal((await login('test-school','parent@example.test',password,'198.51.100.41')).statusCode,200);
  });
  await t.test('manual and automatic IP blocks apply to existing sessions; forwarded headers cannot spoof identity',async()=>{
   assert.equal(normalizeIp('::ffff:192.0.2.25'),'192.0.2.25');
   const r=await request(app,c.owner,'POST','/api/v1/platform/security/blocks',{...why,ip:'198.51.100.77',hours:2});assert.equal(r.statusCode,200,r.body);
   const blocked=await app.inject({url:'/api/v1/auth/me',remoteAddress:'198.51.100.77',headers:{cookie:c.parent.cookie,'x-forwarded-for':'198.51.100.99'}});assert.equal(blocked.statusCode,403);assert.equal(blocked.json().error.code,'IP_BLOCKED');
   assert.equal((await request(app,c.owner,'POST','/api/v1/platform/security/blocks',{...why,ip:'127.0.0.1',hours:2})).statusCode,409);
   assert.equal((await request(app,c.owner,'POST','/api/v1/platform/security/unblock',{...why,ip:'198.51.100.77'})).statusCode,200);
   for(let n=0;n<30;n++)assert.equal((await login('test-school',`unknown${n}@example.test`,'incorrect password','198.51.100.88')).statusCode,401);assert.equal((await app.inject({url:'/api/v1/auth/me',remoteAddress:'198.51.100.88',headers:{cookie:c.parent.cookie}})).statusCode,403);
   await db.query("UPDATE login_guards SET locked_until=now()-interval '1 minute' WHERE key=$1",[ipKey('198.51.100.88')]);assert.equal((await app.inject({url:'/api/v1/auth/me',remoteAddress:'198.51.100.88',headers:{cookie:c.parent.cookie}})).statusCode,200);
  });
  await t.test('session limit and revoke-others preserve the current session and invalidate older ones',async()=>{
   let newest:any;for(let n=0;n<6;n++)newest=await login('test-school','office@example.test',password,'192.0.2.'+(100+n));assert.equal(newest.statusCode,200);
   assert.equal((await db.query('SELECT count(*)::int AS n FROM sessions WHERE user_id=$1',[c.office.id]))[0].n,5);
   const office={...c.office,cookie:newest.cookies.map((x:any)=>`${x.name}=${x.value}`).join('; '),csrf:newest.json().csrf};
   assert.equal((await request(app,office,'POST','/api/v1/auth/sessions/revoke-others',{})).statusCode,200);assert.equal((await request(app,office,'GET','/api/v1/auth/sessions')).json().items.length,1);assert.equal((await request(app,c.office,'GET','/api/v1/auth/me')).statusCode,401);
  });
 }finally{await f.close();}
});

test('Supabase data transfer preserves rows, hashes, JSON and binary files; skips sessions and refuses nonempty target',async()=>{
 const f=await fixture(),target=await openDatabase();await migrate(target);
 try{
  const file=id(),bytes=Buffer.from('Private school document fixture');
  await f.db.query('INSERT INTO platform_admins(user_id) VALUES($1)',[f.clients.owner.id]);
  await f.db.query('UPDATE users SET preferences=$1 WHERE id=$2',[{contacts:['one','two'],settings:{notifications:true}},f.clients.owner.id]);
  await f.db.query("INSERT INTO file_assets(id,org_id,branch_id,owner_id,name,mime,bytes,sha256,size) VALUES($1,$2,$3,$4,'private.txt','text/plain',$5,'test-only-digest',$6)",[file,f.ids.org,f.ids.branch,f.clients.owner.id,bytes,bytes.length]);
  const counts=await copyDatabase(f.db,target,'public');assert.equal(counts.organizations,2);assert.equal(counts.students,2);assert.equal(counts.platform_admins,1);assert.equal((await target.query('SELECT count(*)::int AS n FROM sessions'))[0].n,0);assert.deepEqual((await target.query('SELECT password_hash,preferences FROM users ORDER BY id')),(await f.db.query('SELECT password_hash,preferences FROM users ORDER BY id')));assert.deepEqual(Buffer.from((await target.query('SELECT bytes FROM file_assets WHERE id=$1',[file]))[0].bytes),bytes);await assert.rejects(copyDatabase(f.db,target,'public'),/empty destination/);
 }finally{await f.close();await target.close();}
});
