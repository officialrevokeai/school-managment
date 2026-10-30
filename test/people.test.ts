import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './support.js';
test('Phase 3: branch provisioning, assignments, admissions and transfer decisions',async t=>{
 const f=await fixture(),{db,app,clients:c,ids:i}=f;try{
  await t.test('owner creates branch and grants/revokes exactly that scope',async()=>{
   const r=await request(app,c.owner,'POST','/api/v1/branches',{schoolId:i.school,name:'West Campus'});assert.equal(r.statusCode,200,r.body);const bid=r.json().id;
   await request(app,c.owner,'POST','/api/v1/assignments',{userId:c.principal.id,branchId:bid});assert.ok((await request(app,c.principal,'GET','/api/v1/context')).json().branches.some((b:any)=>b.id===bid));
   await request(app,c.owner,'POST','/api/v1/assignments',{userId:c.principal.id,branchId:bid,remove:true});assert.ok(!(await request(app,c.principal,'GET','/api/v1/context')).json().branches.some((b:any)=>b.id===bid));
   assert.equal((await request(app,c.otherOwner,'POST','/api/v1/branches',{schoolId:i.school,name:'Tenant attack'})).statusCode,403);
  });
  let admission='';
  await t.test('office draft, changes requested, recorded revision and resubmission',async()=>{
   const body={branchId:i.branch,classId:i.cls,name:'Riya Malhotra',guardianName:'Sunil Malhotra',guardianEmail:'sunil@example.test',notes:'Verified documents'};
   const r=await request(app,c.office,'POST','/api/v1/admissions',body);assert.equal(r.statusCode,200,r.body);admission=r.json().id;
   assert.equal((await request(app,c.principal,'POST',`/api/v1/admissions/${admission}/decision`,{decision:'approved',comment:'Checked documents'})).statusCode,409);
   await request(app,c.office,'POST',`/api/v1/admissions/${admission}/submit`,{});
   assert.equal((await request(app,c.principal,'POST',`/api/v1/admissions/${admission}/decision`,{decision:'changes_requested',comment:'Please correct guardian address'})).statusCode,200);
   const {branchId,...revision}=body;assert.equal((await request(app,c.office,'PATCH',`/api/v1/admissions/${admission}`,{...revision,notes:'Corrected address evidence'})).statusCode,200);
   assert.equal((await request(app,c.office,'POST',`/api/v1/admissions/${admission}/submit`,{})).statusCode,200);
  });
  await t.test('concurrent/repeated approvals create exactly one student and enrollment',async()=>{
   const action=()=>request(app,c.principal,'POST',`/api/v1/admissions/${admission}/decision`,{decision:'approved',comment:'All records checked'});
   const results=await Promise.all([action(),action(),action()]);for(const r of results)assert.equal(r.statusCode,200,r.body);
   assert.equal(new Set(results.map(r=>r.json().studentId)).size,1);const sid=results[0].json().studentId;
   assert.equal((await db.query('SELECT count(*)::int AS n FROM enrollments WHERE student_id=$1',[sid]))[0].n,1);
   assert.equal((await request(app,c.office,'POST',`/api/v1/admissions/${admission}/decision`,{decision:'approved',comment:'Unauthorized'})).statusCode,403);
   const listing=(await request(app,c.principal,'GET','/api/v1/admissions')).json();assert.equal(listing.items[0].history.length,2);assert.equal(listing.items[0].revision,2);
  });
  await t.test('external transfer records history and deactivates only enrollment once',async()=>{
   const r=await request(app,c.office,'POST','/api/v1/transfers',{studentId:i.student,externalDestination:'Jaipur Vidyalaya',notes:'Family relocation requested'});assert.equal(r.statusCode,200,r.body);
   const decide=()=>request(app,c.principal,'POST',`/api/v1/transfers/${r.json().id}/decision`,{decision:'approved',comment:'Transfer certificate verified'});
   assert.equal((await decide()).statusCode,200);assert.equal((await decide()).statusCode,200);
   assert.equal((await db.query('SELECT active FROM enrollments WHERE student_id=$1',[i.student]))[0].active,false);
   assert.equal((await request(app,c.parent,'GET',`/api/v1/students/${i.student}`)).statusCode,200);
  });
 }finally{await f.close();}
});
