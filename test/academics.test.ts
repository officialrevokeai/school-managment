import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './support.js';
test('Phase 5: marks review/publication, private report cards, targeted notices and messaging policy',async t=>{
 const f=await fixture(),{app,db,clients:c,ids:i}=f;try{
  let assessment='';
  await t.test('teacher mark validation, draft/submitted/approved isolation and separate publication',async()=>{
   const b={classId:i.cls,subjectId:i.subject,title:'Science Unit Test',maximum:50,marks:[{studentId:i.student,kind:'numeric',score:44}]};
   assert.equal((await request(app,c.teacher,'POST','/api/v1/assessments',{...b,marks:[{studentId:i.student,kind:'numeric',score:51}]})).statusCode,400);
   const r=await request(app,c.teacher,'POST','/api/v1/assessments',b);assert.equal(r.statusCode,200,r.body);assessment=r.json().id;
   assert.equal((await request(app,c.parent,'GET','/api/v1/assessments')).json().items.length,0);
   assert.equal((await request(app,c.teacher,'POST',`/api/v1/assessments/${assessment}/submit`,{})).statusCode,200);
   assert.equal((await request(app,c.teacher,'POST',`/api/v1/assessments/${assessment}/decision`,{decision:'approved',comment:'Self review'})).statusCode,403);
   assert.equal((await request(app,c.principal,'POST',`/api/v1/assessments/${assessment}/decision`,{decision:'approved',comment:'Moderation checked'})).statusCode,200);
   assert.equal((await request(app,c.student,'GET',`/api/v1/students/${i.student}/report-card`)).statusCode,404);
   assert.equal((await request(app,c.principal,'POST',`/api/v1/assessments/${assessment}/publish`,{})).statusCode,200);
   const list=(await request(app,c.parent,'GET','/api/v1/assessments')).json();assert.equal(list.items[0].marks.length,1);assert.equal(Number(list.items[0].marks[0].score),44);
   assert.equal((await request(app,c.teacher,'PATCH',`/api/v1/assessments/${assessment}`,b)).statusCode,409);
  });
  await t.test('real generated report contains only authorized child published marks',async()=>{
   const report=await request(app,c.student,'GET',`/api/v1/students/${i.student}/report-card`);assert.equal(report.statusCode,200,report.body);assert.match(report.body,/Aarav Kumar/);assert.match(report.body,/Science Unit Test/);assert.ok(!report.body.includes('Diya Sharma'));
   assert.equal((await request(app,c.parent,'GET',`/api/v1/students/${i.unlinked}/report-card`)).statusCode,403);
   assert.equal((await request(app,c.otherOwner,'GET',`/api/v1/students/${i.student}/report-card`)).statusCode,403);
  });
  await t.test('principal targets exact branch/class/role audience',async()=>{
   const r=await request(app,c.principal,'POST','/api/v1/announcements',{branchId:i.branch,classId:i.cls,title:'Parent meeting',body:'Meet your class teacher on Saturday.',audienceRoles:['parent'],publish:true});assert.equal(r.statusCode,200,r.body);
   assert.ok((await request(app,c.parent,'GET','/api/v1/announcements')).json().items.some((a:any)=>a.id===r.json().id));
   assert.ok(!(await request(app,c.student,'GET','/api/v1/announcements')).json().items.some((a:any)=>a.id===r.json().id));
   assert.equal((await request(app,c.otherOwner,'GET','/api/v1/announcements')).json().items.length,0);
   assert.equal((await request(app,c.teacher,'POST','/api/v1/announcements',{branchId:i.branch,title:'School-wide unauthorized',body:'No class scope supplied',audienceRoles:['parent'],publish:true})).statusCode,400);
  });
  await t.test('parent messaging disabled is rejected server-side; enabled messages remain in-app',async()=>{
   assert.equal((await request(app,c.parent,'POST','/api/v1/conversations',{studentId:i.student,teacherId:c.teacher.id})).statusCode,403);
   await db.query('UPDATE organizations SET settings=$1 WHERE id=$2',[{parentMessaging:true},i.org]);
   const r=await request(app,c.parent,'POST','/api/v1/conversations',{studentId:i.student,teacherId:c.teacher.id});assert.equal(r.statusCode,200,r.body);
   const m=await request(app,c.parent,'POST',`/api/v1/conversations/${r.json().id}/messages`,{body:'Please share learning suggestions.'});assert.equal(m.statusCode,200,m.body);assert.equal(m.json().channel,'in_app');
   await db.query('UPDATE organizations SET settings=$1 WHERE id=$2',[{parentMessaging:false},i.org]);
   assert.equal((await request(app,c.parent,'POST',`/api/v1/conversations/${r.json().id}/messages`,{body:'Disabled attempt'})).statusCode,403);
  });
 }finally{await f.close();}
});
