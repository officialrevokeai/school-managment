import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './support.js';
test('Phase 4: attendance, class homework, submissions, feedback and leave across genuine sessions',async t=>{
 const f=await fixture(),{db,app,clients:c,ids:i}=f;try{
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  let register='';
  await t.test('attendance draft is private and creates no absence event',async()=>{
   const r=await request(app,c.teacher,'POST','/api/v1/attendance',{classId:i.cls,date:today,entries:[{studentId:i.student,status:'absent'}],submit:false});assert.equal(r.statusCode,200,r.body);register=r.json().id;
   assert.equal((await request(app,c.parent,'GET','/api/v1/attendance')).json().items.length,0);assert.equal((await db.query("SELECT count(*)::int AS n FROM outbox WHERE kind='school_event'"))[0].n,0);
   assert.equal((await request(app,c.office,'POST','/api/v1/attendance',{classId:i.cls,date:today,entries:[],submit:true})).statusCode,403);
  });
  await t.test('final submit reaches correct parent; resubmit and concurrent clicks are idempotent',async()=>{
   const submit=()=>request(app,c.teacher,'POST','/api/v1/attendance',{classId:i.cls,date:today,entries:[{studentId:i.student,status:'absent'}],submit:true});const results=await Promise.all([submit(),submit()]);for(const r of results)assert.equal(r.statusCode,200,r.body);
   const parent=(await request(app,c.parent,'GET','/api/v1/attendance')).json();assert.deepEqual(parent.items[0].entries,[{studentId:i.student,status:'absent'}]);assert.equal((await db.query("SELECT count(*)::int AS n FROM outbox WHERE kind='school_event'"))[0].n,1);
   assert.equal((await request(app,c.otherOwner,'GET','/api/v1/attendance')).json().items.length,0);
  });
  await t.test('corrections require a reason and preserve prior state',async()=>{
   const body={classId:i.cls,date:today,entries:[{studentId:i.student,status:'present'}],submit:true};assert.equal((await request(app,c.teacher,'POST','/api/v1/attendance',body)).statusCode,409);
   const r=await request(app,c.teacher,'POST','/api/v1/attendance',{...body,reason:'Incorrect initial roll-call entry'});assert.equal(r.statusCode,200,r.body);assert.equal(r.json().revision,2);
   const history=await db.query('SELECT * FROM attendance_revisions WHERE session_id=$1',[register]);assert.equal(history.length,1);assert.equal(history[0].before_entries[0].status,'absent');assert.equal(history[0].after_entries[0].status,'present');
  });
  let homework='',submission='';
  await t.test('draft homework hidden, published homework only assigned class',async()=>{
   const r=await request(app,c.teacher,'POST','/api/v1/homework',{classId:i.cls,subjectId:i.subject,title:'Motion examples',instructions:'Describe three types of motion.',dueAt:new Date(Date.now()+86400000).toISOString()});assert.equal(r.statusCode,200,r.body);homework=r.json().id;
   assert.equal((await request(app,c.parent,'GET','/api/v1/homework')).json().items.length,0);
   assert.equal((await request(app,c.teacher,'POST',`/api/v1/homework/${homework}/publish`,{})).statusCode,200);
   assert.equal((await request(app,c.student,'GET','/api/v1/homework')).json().items[0].id,homework);assert.equal((await request(app,c.otherOwner,'GET','/api/v1/homework')).json().items.length,0);
  });
  await t.test('own student submits, teacher reviews, linked parent sees feedback',async()=>{
   const r=await request(app,c.student,'POST',`/api/v1/homework/${homework}/submissions`,{studentId:i.student,text:'A bus, a spinning fan and a pendulum.'});assert.equal(r.statusCode,200,r.body);submission=r.json().id;
   assert.equal((await request(app,c.student,'POST',`/api/v1/homework/${homework}/submissions`,{studentId:i.unlinked,text:'Impersonation'})).statusCode,403);
   assert.equal((await request(app,c.teacher,'POST',`/api/v1/submissions/${submission}/feedback`,{feedback:'Clear examples. Describe speed too.'})).statusCode,200);
   assert.match((await request(app,c.parent,'GET','/api/v1/homework')).json().items[0].submissions[0].feedback,/Clear examples/);
   assert.equal((await request(app,c.student,'POST',`/api/v1/homework/${homework}/submissions`,{studentId:i.student,text:'Overwriting reviewed work'})).statusCode,409);
  });
  await t.test('staff leave, overlapping request blocked, principal decision and requester notification',async()=>{
   const body={branchId:i.branch,kind:'Casual leave',starts:'2026-11-02',ends:'2026-11-03',reason:'Family commitment with lesson cover arranged'};
   const r=await request(app,c.teacher,'POST','/api/v1/leave',body);assert.equal(r.statusCode,200,r.body);assert.equal((await request(app,c.teacher,'POST','/api/v1/leave',body)).statusCode,409);
   assert.equal((await request(app,c.principal,'POST',`/api/v1/leave/${r.json().id}/decision`,{decision:'approved',comment:'Substitution plan approved'})).statusCode,200);
   const list=(await request(app,c.teacher,'GET','/api/v1/leave')).json();assert.equal(list.items[0].status,'approved');assert.equal(list.items[0].history[0].comment,'Substitution plan approved');
   assert.ok((await request(app,c.teacher,'GET','/api/v1/notifications')).json().items.some((n:any)=>n.title.includes('Substitution plan')));
  });
 }finally{await f.close();}
});
