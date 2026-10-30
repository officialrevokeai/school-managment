import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createContext,runInContext} from 'node:vm';
import {fixture,request} from './support.js';
import {sessionAuthorization} from '../server/auth.js';
import {digest} from '../server/core.js';

async function client(fetch:unknown){
 let now=1000;
 const sandbox=createContext({fetch,structuredClone,Date:{now:()=>now},localStorage:{setItem(){}}});
 runInContext(await readFile('web/api-client.js','utf8'),sandbox);
 return {sandbox,run:(code:string)=>runInContext(code,sandbox),advance:()=>{now+=10001;}};
}
const response=(value:unknown,status=200)=>({ok:status===200,status,json:async()=>value});

test('concurrent reads coalesce; cached navigation is scoped by path, expires and cannot be mutated by callers',async()=>{
 let calls=0;
 const f=await client(async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return response({items:[{name:'Stored record'}]});});
 const [first,second]=await Promise.all([f.run("api.request('users')"),f.run("api.request('users')")]);
 assert.equal(calls,1);first.items[0].name='Unsaved edit';assert.equal(second.items[0].name,'Stored record');
 assert.equal((await f.run("api.request('users')")).items[0].name,'Stored record');assert.equal(calls,1);
 await f.run("api.request('users?branchId=another-branch')");assert.equal(calls,2);
 f.advance();await f.run("api.request('users')");assert.equal(calls,3);
 await f.run("api.request('accounts','POST',{})");await f.run("api.request('users')");assert.equal(calls,5);
});

test('auth/context always revalidate; permission errors purge cached data and are never cached',async()=>{
 let calls=0,denied=false;
 const f=await client(async()=>{calls++;return denied?response({error:{message:'Access revoked',code:'UNAUTHENTICATED'}},401):response({stored:true});});
 await f.run("api.request('context')");await f.run("api.request('context')");
 await f.run("api.request('auth/me')");await f.run("api.request('auth/me')");assert.equal(calls,4);
 await f.run("api.request('users')");denied=true;
 await assert.rejects(f.run("api.request('auth/me')"),/Access revoked/);
 await assert.rejects(f.run("api.request('users')"),/Access revoked/);assert.equal(calls,7);
});

test('an old read cannot repopulate the cache after sign-out or session invalidation',async()=>{
 let finish:(value:unknown)=>void=()=>{};let first=true;
 const f=await client(()=>{if(first){first=false;return new Promise(resolve=>{finish=resolve;});}return Promise.resolve(response({owner:'new-session'}));});
 const old=f.run("api.request('users')");f.run('api.invalidate()');
 assert.equal((await f.run("api.request('users')")).owner,'new-session');
 finish(response({owner:'old-session'}));await old;
 assert.equal((await f.run("api.request('users')")).owner,'new-session');
});

async function workspace(){
 const writes:string[]=[],timers:Function[]=[],listeners:Record<string,Function>={};
 class Events {handlers:Record<string,Function>={};onerror:Function=()=>{};close(){}addEventListener(name:string,fn:Function){this.handlers[name]=fn;}}
 const sandbox=createContext({structuredClone,URLSearchParams,EventSource:Events,
  api:{csrf:'',invalidate(){},request:()=>new Promise(()=>{})},localStorage:{getItem:()=>null},
  location:{hash:'#/dashboard'},history:{replaceState(){}},
  window:{scrollY:120,scrollTo(){},addEventListener:(name:string,fn:Function)=>{listeners[name]=fn;}},
  document:{hidden:false,addEventListener(){},querySelector:()=>null,getElementById:()=>({replaceChildren(){},classList:{remove(){},add(){}}})},
  setTimeout:(fn:Function)=>{timers.push(fn);return timers.length;},clearTimeout(){},
  renderSignIn(){},checkBuildUpdate(){},showBuildUpdate(){},heading:()=>'',panel:()=>'',alertBox:()=>'',
 });
 for(const file of ['web/accounts-ui.js','web/access-ui.js','web/live.js'])runInContext(await readFile(file,'utf8'),sandbox);
 sandbox.capture=(html:string)=>writes.push(html);
 runInContext("currentUser={id:'owner',name:'Owner',role:'owner'};context={organization:{settings:{}}};shell=html=>capture(html);renderSignIn=()=>{};",sandbox);
 return {sandbox,writes,timers,listeners,run:(code:string)=>runInContext(code,sandbox)};
}

test('rapid navigation never lets an older response replace the latest page',async()=>{
 const f=await workspace();let finish:(html:string)=>void=()=>{};
 f.sandbox.slow=()=>new Promise(resolve=>{finish=resolve;});
 f.run("renderView=()=>view==='dashboard'?slow():Promise.resolve('reports-page')");
 const old=f.run('loadView()');f.run("location.hash='#/reports'");await f.run('loadView()');
 finish('old-dashboard');await old;assert.equal(f.writes.at(-1),'reports-page');
});

test('background updates avoid loading flashes, skip identical markup and protect newly edited forms',async()=>{
 const f=await workspace();f.run("renderView=async()=> 'real-data'");await f.run('loadView()');f.writes.length=0;
 await f.run('loadView({background:true})');assert.equal(f.writes.length,0);
 f.run("renderView=async()=> 'changed-data'");await f.run('loadView({background:true})');assert.deepEqual(f.writes,['changed-data']);
 let finish:(html:string)=>void=()=>{};f.sandbox.slow=()=>new Promise(resolve=>{finish=resolve;});f.run('renderView=()=>slow()');
 const pending=f.run('loadView({background:true})');f.run('dirty=true');finish('new-data-during-edit');await pending;
 assert.deepEqual(f.writes,['changed-data']);assert.equal(f.run('pendingLiveRefresh'),true);
});

test('late context responses cannot restore private state after logout',async()=>{
 const f=await workspace();let finish:(data:unknown)=>void=()=>{};
 f.sandbox.waitForContext=()=>new Promise(resolve=>{finish=resolve;});f.run('api.request=()=>waitForContext()');
 const pending=f.run('loadContext()');f.run('clearWorkspace()');
 finish({user:{id:'owner'},branches:[],students:[]});await pending;
 assert.equal(f.run('currentUser===null&&context===null'),true);
});

test('live ready/duplicate events do not refetch; actual changes coalesce and refresh quietly',async()=>{
 const f=await workspace();f.run('var refreshed=0;loadContext=async()=>{refreshed++;};loadView=async options=>{if(!options.background)throw Error("Full reload");};startLiveUpdates()');
 const fire=(name:string,revision:string)=>f.run(`liveSource.handlers.${name}({data:JSON.stringify({revision:'${revision}',buildVersion:'same'})})`);
 fire('ready','one');assert.equal(f.timers.length,0);
 fire('change','two');fire('change','two');fire('change','three');assert.equal(f.timers.length,1);
 await f.timers[0]();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.run('refreshed'),1);
 f.run('dirty=true');fire('change','four');assert.equal(f.timers.length,1);assert.equal(f.run('pendingLiveRefresh'),true);
 f.listeners.storage({key:'school-session-epoch'});assert.equal(f.run('currentUser'),null);
});

test('batched context/dashboard preserve role scope and use bounded database round trips without auth caching',async()=>{
 const f=await fixture(),{db,app,clients:c,ids:i}=f;let calls=0;const original=db.query;
 db.query=async(sql,params)=>{calls++;return original(sql,params);};
 try{
  for(const role of ['owner','principal','teacher','office','parent','student']){
   calls=0;const r=await request(app,c[role],'GET','/api/v1/context');assert.equal(r.statusCode,200,r.body);assert.equal(calls,2,role+' context round trips');
   if(role!=='owner'){assert.deepEqual(r.json().students.map((s:any)=>s.id),[i.student]);assert.ok(!r.json().branches.some((b:any)=>b.id===i.secondBranch));}
  }
  calls=0;const dashboard=await request(app,c.owner,'GET','/api/v1/dashboard');assert.equal(dashboard.statusCode,200,dashboard.body);assert.equal(calls,3);assert.equal(dashboard.json().students,2);
  const hash=digest(c.teacher.cookie.split('=')[1]);assert.ok((await sessionAuthorization(db,hash,'127.0.0.1')).actor);
  await db.query('DELETE FROM sessions WHERE user_id=$1',[c.teacher.id]);assert.equal((await sessionAuthorization(db,hash,'127.0.0.1')).actor,null);
 }finally{await f.close();}
});
