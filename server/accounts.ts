import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { DB } from './db.js';
import { getActor,hashPassword } from './auth.js';
import { id,text,identifier,roles,allow,audit,requireThat,branchAccess,classAccess,studentAccess } from './core.js';
export async function accountRoutes(app:FastifyInstance,db:DB){
 app.post('/api/v1/accounts',async req=>{
  const a=getActor(req);allow(a,['owner']);const b=z.object({name:text,email:z.email().max(254).transform(v=>v.toLowerCase()),password:z.string().min(12).max(128),role:roles,branchId:identifier.optional(),classId:identifier.optional(),studentId:identifier.optional(),confirmed:z.literal(true)}).strict().parse(req.body);
  requireThat(b.role==='owner'||b.branchId,'BRANCH_REQUIRED','Select the account’s school branch.',400);
  requireThat(b.role!=='student'||b.studentId||b.classId,'STUDENT_REQUIRED','Choose an existing student or a class for a new student.',400);
  requireThat(b.role==='student'||!b.studentId&&!b.classId,'INVALID_ACCOUNT_SCOPE','Student enrollment fields are only valid for student accounts.',400);
  const uid=id(),hash=await hashPassword(b.password);
  return db.transaction(async tx=>{
   if(b.branchId)await branchAccess(tx,a,b.branchId);
   let studentId=b.studentId||null;
   if(studentId){const student=await studentAccess(tx,a,studentId);requireThat(student.branch_id===b.branchId&&!student.user_id,'STUDENT_ALREADY_LINKED','The selected student belongs to another branch or already has a login.',409);await tx.query('SELECT id FROM students WHERE org_id=$1 AND id=$2 FOR UPDATE',[a.org_id,studentId]);}
   let cls;if(b.classId){cls=await classAccess(tx,a,b.classId);requireThat(cls.branch_id===b.branchId);}
   await tx.query('INSERT INTO users(id,org_id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5,$6)',[uid,a.org_id,b.name,b.email,hash,b.role]);
   if(b.branchId)await tx.query('INSERT INTO branch_assignments(org_id,branch_id,user_id) VALUES($1,$2,$3)',[a.org_id,b.branchId,uid]);
   if(b.role==='student'){
    if(studentId){const rows=await tx.query('UPDATE students SET user_id=$1 WHERE org_id=$2 AND id=$3 AND user_id IS NULL RETURNING id',[uid,a.org_id,studentId]);requireThat(rows.length,'STUDENT_ALREADY_LINKED','This student already has a login.',409);}
    else{studentId=id();await tx.query('INSERT INTO students(id,org_id,branch_id,name,user_id) VALUES($1,$2,$3,$4,$5)',[studentId,a.org_id,b.branchId,b.name,uid]);await tx.query('INSERT INTO enrollments(id,org_id,student_id,class_id) VALUES($1,$2,$3,$4)',[id(),a.org_id,studentId,cls!.id]);}
   }
   await audit(tx,a,'account_add','user',uid,{name:b.name,email:b.email,role:b.role,studentId},b.branchId||null);
   return {id:uid,name:b.name,email:b.email,role:b.role,studentId};
  });
 });
}
