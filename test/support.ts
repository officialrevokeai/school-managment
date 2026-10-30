import { openDatabase,migrate, type DB } from '../server/db.js';
import { createApp } from '../server/app.js';
import { hashPassword,provision } from '../server/auth.js';
import { id } from '../server/core.js';
import type { FastifyInstance } from 'fastify';
export const password='Test-only unique long passphrase!';
export type Client={id:string;org:string;role:string;cookie:string;csrf:string};
export async function fixture(options:Parameters<typeof createApp>[1]={}) {
  const db=await openDatabase();await migrate(db);const app=await createApp(db,{static:false,...options});
  const first=await provision(db,{organization:'test-school',name:'Test Vidyalaya',ownerName:'Vikram Mehta',email:'owner@example.test',password});
  const [org]=await db.query('SELECT id FROM organizations WHERE slug=$1',['test-school']);
  const other=id(),school=id(),branch=id(),secondBranch=id(),year=id(),cls=id(),otherClass=id(),subject=id(),student=id(),unlinked=id();
  const hash=await hashPassword(password),users:Record<string,string>={owner:first.ownerId};
  await db.transaction(async tx=>{
    await tx.query('INSERT INTO organizations(id,slug,name) VALUES($1,$2,$3)',[other,'other-school','Other School']);
    await tx.query('INSERT INTO schools(id,org_id,name) VALUES($1,$2,$3)',[school,org.id,'Test Vidyalaya']);
    for(const [bid,name]of [[branch,'Main'],[secondBranch,'North']])await tx.query('INSERT INTO branches(id,org_id,school_id,name) VALUES($1,$2,$3,$4)',[bid,org.id,school,name]);
    await tx.query("INSERT INTO academic_years(id,org_id,name,starts,ends) VALUES($1,$2,'2026–27','2026-04-01','2027-03-31')",[year,org.id]);
    for(const[cid,name,bid]of [[cls,'9 A',branch],[otherClass,'8 B',secondBranch]])await tx.query('INSERT INTO classes(id,org_id,branch_id,year_id,name) VALUES($1,$2,$3,$4,$5)',[cid,org.id,bid,year,name]);
    await tx.query("INSERT INTO subjects(id,org_id,name) VALUES($1,$2,'Science')",[subject,org.id]);
    for(const role of ['principal','teacher','office','parent','student','otherOwner']) {
      const uid=id();users[role]=uid;await tx.query('INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',[uid,role==='otherOwner'?other:org.id,role,role.toLowerCase()+'@example.test',hash,role==='otherOwner'?'owner':role]);
      if(['principal','teacher','office'].includes(role))await tx.query('INSERT INTO branch_assignments(org_id,branch_id,user_id) VALUES($1,$2,$3)',[org.id,branch,uid]);
    }
    await tx.query('INSERT INTO teacher_assignments(org_id,user_id,class_id,subject_id) VALUES($1,$2,$3,$4)',[org.id,users.teacher,cls,subject]);
    for(const[sid,cid,bid,name,uid]of [[student,cls,branch,'Aarav Kumar',users.student],[unlinked,otherClass,secondBranch,'Diya Sharma',null]]) {
      await tx.query('INSERT INTO students(id,org_id,branch_id,name,user_id) VALUES($1,$2,$3,$4,$5)',[sid,org.id,bid,name,uid]);
      await tx.query('INSERT INTO enrollments(id,org_id,student_id,class_id) VALUES($1,$2,$3,$4)',[id(),org.id,sid,cid]);
    }
    await tx.query('INSERT INTO guardian_links(org_id,user_id,student_id) VALUES($1,$2,$3)',[org.id,users.parent,student]);
  });
  const clients:Record<string,Client>={};
  for(const role of Object.keys(users)) {
    const r=await app.inject({method:'POST',url:'/api/v1/auth/login',headers:{origin:'http://localhost:3000'},payload:{organization:role==='otherOwner'?'other-school':'test-school',email:role+'@example.test',password}});
    if(r.statusCode!==200)throw new Error(r.body);
    clients[role]={id:users[role],org:role==='otherOwner'?other:org.id,role,cookie:r.cookies.map(c=>`${c.name}=${c.value}`).join('; '),csrf:r.json().csrf};
  }
  return {db,app,clients,ids:{org:org.id,other,school,branch,secondBranch,year,cls,otherClass,subject,student,unlinked},close:async()=>{await app.close();await db.close();}};
}
export async function request(app:FastifyInstance,c:Client,method:any,url:string,payload?:any,extra:Record<string,string>={}) {
  return app.inject({method,url,headers:{cookie:c.cookie,origin:'http://localhost:3000','x-csrf-token':c.csrf,...extra},...(payload!==undefined?{payload}:{})});
}
