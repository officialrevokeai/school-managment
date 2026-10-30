import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './support.js';
test('Governance: custom roles, immediate restrictions, scoped profiles and recoverable private file archive',async t=>{
 const f=await fixture(),{db,app,clients:c,ids:i}=f;try{
  let role='';
  await t.test('owner creates a refined teacher role and existing session immediately obeys it',async()=>{
   const r=await request(app,c.owner,'POST','/api/v1/roles',{name:'Attendance reader',baseRole:'teacher',permissions:[{module:'attendance',action:'view'},{module:'students',action:'view'}],reason:'Limit the pilot teacher to attendance review',confirmed:true});assert.equal(r.statusCode,200,r.body);role=r.json().id;
   const assigned=await request(app,c.owner,'POST','/api/v1/roles/assign',{userId:c.teacher.id,roleId:role,reason:'Pilot role restriction requested by owner',confirmed:true});assert.equal(assigned.statusCode,200,assigned.body);
   assert.equal((await request(app,c.teacher,'GET','/api/v1/attendance')).statusCode,200);
   assert.equal((await request(app,c.teacher,'GET','/api/v1/homework')).statusCode,403);
   assert.equal((await request(app,c.teacher,'POST','/api/v1/attendance',{})).statusCode,403);
   assert.equal((await request(app,c.teacher,'GET',`/api/v1/students/${i.unlinked}`)).statusCode,403);
  });
  await t.test('editing grants applies without stale session caches, but cannot escape the base workspace',async()=>{
   const r=await request(app,c.owner,'PATCH','/api/v1/roles/'+role,{name:'Pilot teacher',baseRole:'teacher',permissions:[{module:'homework',action:'view'},{module:'fees',action:'create'}],reason:'Allow homework reading while retaining teacher scope',confirmed:true});assert.equal(r.statusCode,200,r.body);
   assert.equal((await request(app,c.teacher,'GET','/api/v1/homework')).statusCode,200);
   assert.equal((await request(app,c.teacher,'POST','/api/v1/fee-structures',{classId:i.cls,name:'Forged finance',amountMinor:1})).statusCode,403);
   assert.equal((await request(app,c.principal,'POST','/api/v1/roles/assign',{userId:c.parent.id,roleId:role,reason:'Unauthorized escalation',confirmed:true})).statusCode,403);
  });
  await t.test('explicit restriction requires confirmation/reason, audits and takes immediate effect',async()=>{
   const b={userId:c.teacher.id,module:'homework',action:'view',denied:true,reason:'Temporary parent privacy investigation',confirmed:true};assert.equal((await request(app,c.owner,'POST','/api/v1/permissions/overrides',b)).statusCode,200);
   assert.equal((await request(app,c.teacher,'GET','/api/v1/homework')).statusCode,403);assert.ok((await db.query("SELECT * FROM audit_events WHERE operation='permission_override'"))[0].reason);
  });
  await t.test('profile preferences cannot change login email or role',async()=>{
   const r=await request(app,c.parent,'PATCH','/api/v1/profile',{name:'Rajesh Kumar',phone:'+919000000000',contactEmail:'contact@example.test',inAppNotifications:false});assert.equal(r.statusCode,200,r.body);
   const profile=(await request(app,c.parent,'GET','/api/v1/profile')).json();assert.equal(profile.role,'parent');assert.equal(profile.email,'parent@example.test');assert.equal(profile.preferences.contactEmail,'contact@example.test');
   assert.equal((await request(app,c.parent,'PATCH','/api/v1/profile',{name:'X',phone:'',contactEmail:'x@example.test',inAppNotifications:true,role:'owner'})).statusCode,400);
  });
  await t.test('private file archive blocks downloads until authorized restoration',async()=>{
   const file=await request(app,c.parent,'POST','/api/v1/files',{branchId:i.branch,studentId:i.student,name:'child.txt',mime:'text/plain',base64:Buffer.from('Private profile document').toString('base64')});assert.equal(file.statusCode,200,file.body);const fid=file.json().id;
   assert.equal((await request(app,c.parent,'PATCH','/api/v1/files/'+fid,{archived:true,reason:'Parent requested recoverable removal'})).statusCode,200);
   assert.equal((await request(app,c.parent,'GET','/api/v1/files/'+fid)).statusCode,404);
   assert.equal((await request(app,c.parent,'PATCH','/api/v1/files/'+fid,{archived:false,reason:'Parent requested document restoration'})).statusCode,200);assert.equal((await request(app,c.parent,'GET','/api/v1/files/'+fid)).statusCode,200);
  });
 }finally{await f.close();}
});
