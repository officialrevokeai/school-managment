import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture,request } from './support.js';
import { workerTick } from '../server/worker.js';
test('Revision and schedule regression: withdrawn results retain immutable snapshots; server publication survives UI closure',async t=>{
 const f=await fixture(),{db,app,clients:c,ids:i}=f;try{
  await t.test('published marks require a principal withdrawal, recorded snapshot and fresh approval',async()=>{
   const input={classId:i.cls,subjectId:i.subject,title:'Revision test',maximum:50,marks:[{studentId:i.student,kind:'numeric',score:41}]};const r=await request(app,c.teacher,'POST','/api/v1/assessments',input);const aid=r.json().id;await request(app,c.teacher,'POST',`/api/v1/assessments/${aid}/submit`,{});await request(app,c.principal,'POST',`/api/v1/assessments/${aid}/decision`,{decision:'approved',comment:'Original moderated marks'});await request(app,c.principal,'POST',`/api/v1/assessments/${aid}/publish`,{});
   assert.equal((await request(app,c.teacher,'POST',`/api/v1/assessments/${aid}/correction`,{reason:'Teacher cannot withdraw published results'})).statusCode,403);
   assert.equal((await request(app,c.principal,'POST',`/api/v1/assessments/${aid}/correction`,{reason:'Transcription error confirmed by assessment panel'})).statusCode,200);
   assert.equal((await request(app,c.parent,'GET','/api/v1/assessments')).json().items.length,0);const [snapshot]=await db.query('SELECT * FROM assessment_revisions WHERE assessment_id=$1',[aid]);assert.equal(Number(snapshot.snapshot.marks[0].score),41);
   assert.equal((await request(app,c.teacher,'PATCH',`/api/v1/assessments/${aid}`,{...input,marks:[{studentId:i.student,kind:'numeric',score:43}]})).statusCode,200);assert.equal((await request(app,c.principal,'POST',`/api/v1/assessments/${aid}/publish`,{})).statusCode,409);
   await request(app,c.teacher,'POST',`/api/v1/assessments/${aid}/submit`,{});await request(app,c.principal,'POST',`/api/v1/assessments/${aid}/decision`,{decision:'approved',comment:'Corrected marks moderated'});await request(app,c.principal,'POST',`/api/v1/assessments/${aid}/publish`,{});assert.equal((await db.query('SELECT count(*)::int AS n FROM result_publications WHERE assessment_id=$1',[aid]))[0].n,2);
  });
  await t.test('scheduled homework persists in outbox and a worker publishes it after the HTTP app closes',async()=>{
   const r=await request(app,c.teacher,'POST','/api/v1/homework',{classId:i.cls,subjectId:i.subject,title:'Scheduled work',instructions:'Server publishes without a browser.',dueAt:new Date(Date.now()+86400000).toISOString()});const hid=r.json().id;assert.equal((await request(app,c.teacher,'POST',`/api/v1/homework/${hid}/publish`,{scheduledAt:new Date(Date.now()+3600000).toISOString()})).statusCode,200);
   assert.equal((await request(app,c.parent,'GET','/api/v1/homework')).json().items.length,0);
   // Advance only the fixture job due time; no client timer or client status setter is involved.
   await db.query("UPDATE outbox SET available_at=now() WHERE kind='publish_homework'");await app.close();await workerTick(db);assert.equal((await db.query('SELECT status FROM homework WHERE id=$1',[hid]))[0].status,'published');
  });
 }finally{await app.close();await db.close();}
});
