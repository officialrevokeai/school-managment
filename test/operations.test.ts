import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './support.js';
import { openDatabase,migrate } from '../server/db.js';
import { encryptBackup,decryptBackup } from '../server/backup.js';
import { csvCell } from '../server/reports.js';
test('Phase 8: operational review, scoped reports/settings, append-only audit and encrypted isolated restore',async t=>{
 const f=await fixture(),{app,db,clients:c,ids:i}=f;try{
  await t.test('timetable overlap rejected at approval; family sees only approved timetable',async()=>{
   const create=async(title:string,start:number,end:number)=>request(app,c.teacher,'POST','/api/v1/records',{kind:'timetable',branchId:i.branch,classId:i.cls,title,data:{teacherId:c.teacher.id,subjectId:i.subject,weekday:1,startsMinute:start,endsMinute:end}});
   const first=await create('Monday science',540,585);assert.equal(first.statusCode,200,first.body);const rid=first.json().id;await request(app,c.teacher,'POST',`/api/v1/records/${rid}/submit`,{});
   assert.equal((await request(app,c.parent,'GET','/api/v1/records?kind=timetable')).json().items.length,0);
   assert.equal((await request(app,c.principal,'POST',`/api/v1/records/${rid}/decision`,{decision:'approved',comment:'Teacher/class availability checked'})).statusCode,200);
   assert.equal((await request(app,c.parent,'GET','/api/v1/records?kind=timetable')).json().items.length,1);
   const conflict=await create('Conflicting lesson',560,600);const cid=conflict.json().id;await request(app,c.teacher,'POST',`/api/v1/records/${cid}/submit`,{});assert.equal((await request(app,c.principal,'POST',`/api/v1/records/${cid}/decision`,{decision:'approved',comment:'Would conflict with prior lesson'})).statusCode,409);
  });
  await t.test('financial operations calculate payroll exactly and record external payout without claiming transfer',async()=>{
   const p=await request(app,c.office,'POST','/api/v1/records',{kind:'payroll',branchId:i.branch,title:'November payroll',data:{userId:c.teacher.id,period:'2026-11-01',baseMinor:4000000,allowanceMinor:200000,deductionMinor:100000}});assert.equal(p.statusCode,200,p.body);const rid=p.json().id;await request(app,c.office,'POST',`/api/v1/records/${rid}/submit`,{});
   assert.equal((await request(app,c.principal,'POST',`/api/v1/records/${rid}/decision`,{decision:'approved',comment:'Unauthorized finance approval'})).statusCode,403);
   assert.equal((await request(app,c.owner,'POST',`/api/v1/records/${rid}/decision`,{decision:'approved',comment:'Payroll calculation checked'})).statusCode,200);
   const paid=await request(app,c.office,'POST',`/api/v1/records/${rid}/record-external-payroll`,{reference:'fixture-bank-reference',verification:'Synthetic external bank statement checked'});assert.equal(paid.statusCode,200,paid.body);assert.equal(paid.json().transferredByApplication,false);
   assert.equal((await db.query('SELECT data FROM school_records WHERE id=$1',[rid]))[0].data.netMinor,4100000);
   assert.equal((await request(app,c.teacher,'GET','/api/v1/records?kind=payroll')).json().items.length,0);
  });
  await t.test('reports and exports inherit child/branch scope and escape spreadsheet formula cells',async()=>{
   const r=await request(app,c.parent,'GET','/api/v1/reports/export?kind=students');assert.equal(r.statusCode,200,r.body);assert.match(r.body,/Aarav Kumar/);assert.ok(!r.body.includes('Diya Sharma'));assert.equal((await request(app,c.principal,'GET','/api/v1/reports?branchId='+i.secondBranch)).statusCode,403);
   assert.equal(csvCell('=HYPERLINK("evil")'),'"\'=HYPERLINK(""evil"")"');assert.equal(csvCell(' +1'),'"\' +1"');
  });
  await t.test('settings validate timezone and change effective messaging policy; audit resists mutation',async()=>{
   const settings={name:'Test Vidyalaya',timezone:'Asia/Kolkata',parentMessaging:true,quietStart:20,quietEnd:8};assert.equal((await request(app,c.owner,'PATCH','/api/v1/settings',{...settings,timezone:'Invalid/Timezone'})).statusCode,400);assert.equal((await request(app,c.owner,'PATCH','/api/v1/settings',settings)).statusCode,200);
   assert.equal((await request(app,c.parent,'GET','/api/v1/context')).json().organization.settings.parentMessaging,true);
   await assert.rejects(()=>db.query("DELETE FROM audit_events WHERE org_id=$1",[i.org]),/append-only/);
  });
  await t.test('encrypted PostgreSQL-engine snapshot restores records and private file bytes into an isolated PGlite instance',async()=>{
   const file=await request(app,c.owner,'POST','/api/v1/files',{branchId:i.branch,studentId:i.student,name:'restore.txt',mime:'text/plain',base64:Buffer.from('Restore proof').toString('base64')});assert.equal(file.statusCode,200,file.body);
   const snapshot=Buffer.from(await (await db.snapshot!()).arrayBuffer()),key='test-only-backup-passphrase-32-characters';const encrypted=encryptBackup(snapshot,key);assert.ok(!encrypted.includes(Buffer.from('Restore proof')));assert.throws(()=>decryptBackup(encrypted,'wrong-key'),/auth|decrypt|Unsupported/i);
   const restored=await openDatabase(undefined,{snapshot:new Blob([Uint8Array.from(decryptBackup(encrypted,key))])});try{await migrate(restored);assert.equal((await restored.query('SELECT count(*)::int AS n FROM students'))[0].n,2);assert.equal(Buffer.from((await restored.query('SELECT bytes FROM file_assets WHERE id=$1',[file.json().id]))[0].bytes).toString(),'Restore proof');}finally{await restored.close();}
  });
 }finally{await f.close();}
});
