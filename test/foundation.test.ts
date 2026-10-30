import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request,password } from './support.js';
import { provision } from '../server/auth.js';

test('Phase 1: genuine sessions, direct API tenant/branch/class/child boundaries and revocation',async t=>{
  const f=await fixture(),{app,db,clients:c,ids:i}=f;
  try {
    await t.test('owner cannot cross tenant; principal cannot change branch URL',async()=>{
      assert.equal((await request(app,c.otherOwner,'GET',`/api/v1/students/${i.student}`)).statusCode,403);
      assert.equal((await request(app,c.principal,'GET',`/api/v1/students/${i.unlinked}`)).statusCode,403);
      assert.equal((await request(app,c.principal,'POST','/api/v1/classes',{name:'Hacked',branchId:i.secondBranch,yearId:i.year})).statusCode,403);
    });
    await t.test('teacher, parent, student cannot access unassigned children',async()=>{
      for(const role of ['teacher','parent','student']) {
        assert.equal((await request(app,c[role],'GET',`/api/v1/students/${i.unlinked}`)).statusCode,403);
        const students=(await request(app,c[role],'GET','/api/v1/students')).json().items;
        assert.deepEqual(students.map((s:any)=>s.id),[i.student]);
      }
    });
    await t.test('office cannot change assignments and role cannot be spoofed',async()=>{
      assert.equal((await request(app,c.office,'POST','/api/v1/teacher-assignments',{userId:c.office.id,classId:i.cls,subjectId:i.subject})).statusCode,403);
      assert.equal((await request(app,c.student,'GET',`/api/v1/students/${i.unlinked}`,undefined,{'x-role':'owner'})).statusCode,403);
    });
    await t.test('CSRF and origin checked; secure session flags; provisioning one-time',async()=>{
      assert.equal((await request(app,c.owner,'POST','/api/v1/subjects',{name:'Invalid'},{'x-csrf-token':'wrong'})).statusCode,403);
      assert.equal((await request(app,c.owner,'POST','/api/v1/subjects',{name:'Invalid'},{origin:'https://evil.example'})).statusCode,403);
      const login=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'http://localhost:3000'},payload:{organization:'test-school',email:'owner@example.test',password}});
      assert.match(String(login.headers['set-cookie']),/HttpOnly/);assert.match(String(login.headers['set-cookie']),/SameSite=Strict/i);
      assert.equal((await db.query('SELECT * FROM sessions WHERE token_hash=$1',[login.cookies[0].value])).length,0);
      await assert.rejects(()=>provision(db,{organization:'second',name:'X',ownerName:'X',email:'x@example.test',password}),/disabled/);
    });
    await t.test('private files deny cross-child and cross-organization access',async()=>{
      const r=await request(app,c.owner,'POST','/api/v1/files',{branchId:i.secondBranch,studentId:i.unlinked,name:'document.txt',mime:'text/plain',base64:Buffer.from('Private child document').toString('base64')});assert.equal(r.statusCode,200,r.body);const fid=r.json().id;
      for(const role of ['parent','student','teacher','otherOwner'])assert.equal((await request(app,c[role],'GET',`/api/v1/files/${fid}`)).statusCode,403);
      assert.equal((await request(app,c.owner,'GET',`/api/v1/files/${fid}`)).body,'Private child document');
    });
    await t.test('removed branch scope is effective immediately',async()=>{
      const remove=await request(app,c.owner,'POST','/api/v1/assignments',{userId:c.principal.id,branchId:i.branch,remove:true});assert.equal(remove.statusCode,200,remove.body);
      assert.equal((await request(app,c.principal,'GET',`/api/v1/students/${i.student}`)).statusCode,403);
    });
    await t.test('disabled account existing session stops working',async()=>{
      assert.equal((await request(app,c.owner,'PATCH',`/api/v1/users/${c.teacher.id}`,{active:false})).statusCode,200);
      assert.equal((await request(app,c.teacher,'GET','/api/v1/auth/me')).statusCode,401);
    });
    await t.test('unconfigured recovery returns an honest configuration blocker',async()=>{
      const r=await app.inject({method:'POST',url:'/api/v1/auth/forgot',headers:{origin:'http://localhost:3000'},payload:{organization:'test-school',email:'parent@example.test'}});
      assert.equal(r.statusCode,503);assert.equal(r.json().error.code,'EMAIL_NOT_CONFIGURED');
    });
  } finally { await f.close(); }
});
