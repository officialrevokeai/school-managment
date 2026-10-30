import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {fixture,request} from './support.js';

test('admission setup is owner-only, atomic, tenant scoped and retry safe; saved classes support real admissions',async()=>{
 const f=await fixture(),{app,db,clients:c,ids:i}=f;
 try{
  const body={campus:{schoolName:'New Actual School',name:'East campus'},year:{name:'2027-28',starts:'2027-04-01',ends:'2028-03-31'},classes:['1 A','2 A']};
  for(const role of ['principal','teacher','office','parent','student'])assert.equal((await request(app,c[role],'POST','/api/v1/academic-setup',body)).statusCode,403);
  assert.equal((await request(app,c.owner,'POST','/api/v1/academic-setup',body,{'x-csrf-token':'invalid'})).statusCode,403);
  const result=await request(app,c.owner,'POST','/api/v1/academic-setup',body);assert.equal(result.statusCode,200,result.body);
  const saved=result.json();assert.equal(saved.classes.length,2);
  const retry=await request(app,c.owner,'POST','/api/v1/academic-setup',body);assert.equal(retry.statusCode,200,retry.body);assert.deepEqual(retry.json(),saved);
  const context=(await request(app,c.owner,'GET','/api/v1/context')).json();assert.ok(context.classes.some((x:any)=>x.id===saved.classes[0].id));
  assert.equal((await request(app,c.office,'GET','/api/v1/context')).json().classes.some((x:any)=>x.id===saved.classes[0].id),false);
  const admission=await request(app,c.owner,'POST','/api/v1/admissions',{branchId:saved.branchId,classId:saved.classes[0].id,name:'Disposable fixture child',guardianName:'Fixture guardian',guardianEmail:'fixture@example.test',notes:''});assert.equal(admission.statusCode,200,admission.body);
  assert.equal((await request(app,c.otherOwner,'POST','/api/v1/academic-setup',{campus:{branchId:saved.branchId},year:{yearId:saved.yearId},classes:['3 A']})).statusCode,403);
  const before=await db.query('SELECT id FROM branches WHERE org_id=$1',[i.org]);
  const rollback=await request(app,c.owner,'POST','/api/v1/academic-setup',{...body,campus:{name:'Must roll back',schoolId:i.school},year:{...body.year,ends:'2028-03-30'}});assert.equal(rollback.statusCode,409,rollback.body);
  assert.deepEqual(await db.query('SELECT id FROM branches WHERE org_id=$1',[i.org]),before);
  assert.equal((await request(app,c.owner,'POST','/api/v1/academic-setup',{...body,classes:['1 A','1 a']})).statusCode,400);
 }finally{await f.close();}
});

test('admission selectors explain empty setup, label real campus/year and exclude other campuses',async()=>{
 const sandbox=createContext({document:{addEventListener(){}},activeBranch:'east',context:{branches:[{id:'east',name:'East'},{id:'west',name:'West'}],years:[{id:'year',name:'2027-28'}],classes:[{id:'a',branch_id:'east',year_id:'year',name:'1 A'},{id:'b',branch_id:'west',year_id:'year',name:'1 A'}]}});
 runInContext(await readFile('web/school-modules.js','utf8'),sandbox);
 const classes=runInContext('admissionClasses()',sandbox);assert.equal(classes.length,1);assert.equal(classes[0].name,'1 A · East · 2027-28');
});
