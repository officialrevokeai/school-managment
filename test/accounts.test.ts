import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request,password } from './support.js';
import { dataRevision } from '../server/live-data.js';
import { actorById,id } from '../server/core.js';
import { openDatabase,migrate } from '../server/db.js';
import { createApp } from '../server/app.js';

test('Account Add: real credentials, role-bound identities, student enrollment and live data revisions',async t=>{
 const f=await fixture(),{app,db,clients:c,ids:i}=f;try{
  const body={name:'Meera Joshi',email:'Meera.Joshi@gmail.com',password:'A unique school password 2026!',role:'teacher',branchId:i.branch,confirmed:true};
  await t.test('anonymous/non-owner cannot add accounts and there is no public sign-up',async()=>{
   assert.equal((await app.inject({method:'POST',url:'/api/v1/accounts',headers:{origin:'http://localhost:3000'},payload:body})).statusCode,401);
   for(const role of ['teacher','office','parent','student','principal'])assert.equal((await request(app,c[role],'POST','/api/v1/accounts',body)).statusCode,403);
   assert.equal((await app.inject({method:'GET',url:'/api/v1/signup'})).statusCode,404);
  });
  await t.test('owner saves normalized email/role and salted hash; correct login succeeds, wrong email/password fail',async()=>{
   const r=await request(app,c.owner,'POST','/api/v1/accounts',body);assert.equal(r.statusCode,200,r.body);const[u]=await db.query('SELECT * FROM users WHERE id=$1',[r.json().id]);assert.equal(u.email,'meera.joshi@gmail.com');assert.equal(u.role,'teacher');assert.match(u.password_hash,/^scrypt\$/);assert.notEqual(u.password_hash,body.password);assert.ok(!r.body.includes(body.password));
   const login=async(email:string,pw:string)=>app.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'http://localhost:3000'},payload:{organization:'test-school',email,password:pw}});
   const signed=await login('MEERA.JOSHI@gmail.com',body.password);assert.equal(signed.statusCode,200,signed.body);assert.equal(signed.json().user.role,'teacher');assert.equal((await login('meera.joshi@gmail.com','incorrect password')).statusCode,401);assert.equal((await login('nonexistent@gmail.com',body.password)).statusCode,401);
   assert.equal((await request(app,c.owner,'POST','/api/v1/accounts',body)).statusCode,409);
  });
  let student='';
  await t.test('student account and enrollment commit together; staff branch assignment persists',async()=>{
   const r=await request(app,c.owner,'POST','/api/v1/accounts',{name:'Riya Kumar',email:'riya@gmail.com',password:body.password,role:'student',branchId:i.branch,classId:i.cls,confirmed:true});assert.equal(r.statusCode,200,r.body);student=r.json().studentId;
   assert.equal((await db.query('SELECT class_id FROM enrollments WHERE org_id=$1 AND student_id=$2 AND active',[i.org,student]))[0].class_id,i.cls);
   const staff=await request(app,c.owner,'POST','/api/v1/accounts',{name:'New Office Staff',email:'staff@gmail.com',password:body.password,role:'office',branchId:i.branch,confirmed:true});assert.equal(staff.statusCode,200,staff.body);assert.equal((await db.query('SELECT branch_id FROM branch_assignments WHERE user_id=$1',[staff.json().id]))[0].branch_id,i.branch);
   assert.equal((await request(app,c.otherOwner,'POST','/api/v1/accounts',{...body,email:'another@gmail.com'})).statusCode,403);
  });
  await t.test('live revision reflects actual own-child fees/attendance and hides unrelated-child changes',async()=>{
   const owner=await actorById(db,i.org,c.owner.id),parent=await actorById(db,i.org,c.parent.id);const before=await dataRevision(db,parent);
   const fee=await request(app,c.office,'POST','/api/v1/fee-structures',{classId:i.cls,name:'Live fee',amountMinor:12345});assert.equal(fee.statusCode,200,fee.body);
   const other=await request(app,c.office,'POST','/api/v1/invoices',{studentId:student,title:'Other child invoice',dueDate:'2026-11-05',structureIds:[fee.json().id],eventKey:'live-other-child'});assert.equal(other.statusCode,200,other.body);assert.equal(await dataRevision(db,parent),before);
   const own=await request(app,c.office,'POST','/api/v1/invoices',{studentId:i.student,title:'Own child invoice',dueDate:'2026-11-05',structureIds:[fee.json().id],eventKey:'live-own-child'});assert.equal(own.statusCode,200,own.body);const feesRevision=await dataRevision(db,parent);assert.notEqual(feesRevision,before);
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());const attendance=await request(app,c.teacher,'POST','/api/v1/attendance',{classId:i.cls,date:today,entries:[{studentId:i.student,status:'present'},{studentId:student,status:'absent'}],submit:true});assert.equal(attendance.statusCode,200,attendance.body);assert.notEqual(await dataRevision(db,parent),feesRevision);
   const dashboard=(await request(app,c.owner,'GET','/api/v1/dashboard')).json();assert.equal(dashboard.students,3);assert.equal(dashboard.outstandingMinor,24690);assert.ok(await dataRevision(db,owner));
   const payroll=await request(app,c.office,'POST','/api/v1/records',{kind:'payroll',branchId:i.branch,title:'Private finance review',data:{userId:c.teacher.id,period:'2026-11-01',baseMinor:10000,allowanceMinor:0,deductionMinor:0}});assert.equal(payroll.statusCode,200,payroll.body);await request(app,c.office,'POST',`/api/v1/records/${payroll.json().id}/submit`,{});const principal=(await request(app,c.principal,'GET','/api/v1/dashboard')).json();assert.equal(principal.approvals,0);assert.equal(principal.outstandingMinor,null);
   const subject=await request(app,c.owner,'POST','/api/v1/subjects',{name:'Mathematics'});const hw=await request(app,c.owner,'POST','/api/v1/homework',{classId:i.cls,subjectId:subject.json().id,title:'Other subject work',instructions:'Assignment outside the science teacher subject scope.',dueAt:new Date(Date.now()+86400000).toISOString()});assert.equal(hw.statusCode,200,hw.body);await request(app,c.owner,'POST',`/api/v1/homework/${hw.json().id}/publish`,{});assert.equal((await request(app,c.teacher,'GET','/api/v1/dashboard')).json().homework,0);
  });
 }finally{await f.close();}
});
test('First owner setup is operator-token protected and closes permanently after provisioning',async()=>{
 const token='operator-only-expiring-token-for-test-2026';process.env.INITIAL_SETUP_TOKEN=token;const db=await openDatabase();await migrate(db);const app=await createApp(db,{static:false});try{
  assert.equal((await app.inject({url:'/api/v1/setup/status'})).json().available,true);
  const body={setupToken:'wrong-operator-token-that-is-long-enough',organization:'new-school',name:'New School',ownerName:'School Owner',email:'owner@gmail.com',password,confirmed:true};
  const post=(b:any)=>app.inject({method:'POST',url:'/api/v1/setup/owner',headers:{origin:'http://localhost:3000'},payload:b});assert.equal((await post(body)).statusCode,401);
  const r=await post({...body,setupToken:token});assert.equal(r.statusCode,200,r.body);assert.equal((await app.inject({url:'/api/v1/setup/status'})).json().available,false);assert.equal((await post({...body,setupToken:token})).statusCode,409);
  const login=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'http://localhost:3000'},payload:{organization:'new-school',email:'owner@gmail.com',password}});assert.equal(login.statusCode,200,login.body);assert.equal(login.json().user.role,'owner');assert.equal((await db.query('SELECT count(*)::int AS n FROM students'))[0].n,0);
 }finally{delete process.env.INITIAL_SETUP_TOKEN;await app.close();await db.close();}
});
