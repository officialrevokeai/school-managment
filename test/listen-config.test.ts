import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { resolveListenConfig } from '../server/listen-config.js';

test('Botkeep allocation overrides stale local HOST and PORT settings', () => {
  assert.deepEqual(resolveListenConfig({SERVER_PORT:' 27135 ',PORT:'3000',HOST:'127.0.0.1'}),
    {host:'0.0.0.0',port:27135});
});

test('other production hosts use PORT and bind all interfaces by default', () => {
  assert.deepEqual(resolveListenConfig({NODE_ENV:'production',PORT:'10000'}),
    {host:'0.0.0.0',port:10000});
  assert.deepEqual(resolveListenConfig({NODE_ENV:'production',PORT:'10000',HOST:'::'}),
    {host:'::',port:10000});
});

test('local development keeps loopback defaults and handles empty panel variables', () => {
  assert.deepEqual(resolveListenConfig({}),{host:'127.0.0.1',port:3000});
  assert.deepEqual(resolveListenConfig({SERVER_PORT:' ',PORT:'4100',HOST:'127.0.0.2'}),
    {host:'127.0.0.2',port:4100});
});

test('invalid configured ports fail explicitly instead of listening on another port', () => {
  for (const value of ['0','65536','-1','1.5','NaN','${SERVER_PORT}','3000abc']) {
    assert.throws(()=>resolveListenConfig({SERVER_PORT:value,PORT:'3000'}),/SERVER_PORT must/);
    assert.throws(()=>resolveListenConfig({PORT:value}),/PORT must/);
  }
  assert.equal(resolveListenConfig({SERVER_PORT:'65535'}).port,65535);
});

test('real API starts on the panel port despite copied local settings', {timeout:60000}, async t => {
  const reservation=createServer();
  reservation.listen(0,'127.0.0.1');
  await once(reservation,'listening');
  const address=reservation.address();
  assert.ok(address && typeof address==='object');
  const port=address.port;
  await new Promise<void>((resolve,reject)=>reservation.close(error=>error?reject(error):resolve()));
  const child=spawn(process.execPath,['build/server/main.js'],{
    env:{...process.env,NODE_ENV:'development',DATABASE_URL:'',PGLITE_PATH:'memory://',
      SERVER_PORT:String(port),PORT:'3000',HOST:'127.0.0.1',WORKER_IN_API:'false',
      PUBLIC_ORIGIN:`http://127.0.0.1:${port}`},stdio:['ignore','pipe','pipe']
  });
  let output='',spawnError:Error|undefined;
  child.stdout.on('data',data=>{output+=data;});
  child.stderr.on('data',data=>{output+=data;});
  child.on('error',error=>{spawnError=error;});
  t.after(async()=>{
    if(child.exitCode!==null||spawnError)return;
    const exited=once(child,'exit');
    const force=setTimeout(()=>child.kill('SIGKILL'),5000);
    child.kill('SIGTERM');
    try{await exited;}finally{clearTimeout(force);}
  });
  const deadline=Date.now()+45000;
  let response:Response|undefined;
  while(Date.now()<deadline){
    if(spawnError)throw spawnError;
    assert.equal(child.exitCode,null,`API stopped before listening:\n${output}`);
    try{
      response=await fetch(`http://127.0.0.1:${port}/health/ready`,{signal:AbortSignal.timeout(1000)});
      if(response.ok)break;
    }catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  assert.ok(response?.ok,`API did not become ready on the assigned port:\n${output}`);
  assert.deepEqual(await response.json(),{database:true});
  assert.match(output,new RegExp(`School Management API listening: http://0\\.0\\.0\\.0:${port}`));
  const home=await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(home.status,200);
  assert.match(home.headers.get('content-type')||'',/text\/html/);
});
