import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext,runInContext } from 'node:vm';

test('Android CSV export uses authenticated same-origin downloads; browser exports retain their existing path',async()=>{
 const code=await readFile('web/platform-ui.js','utf8'),requested:string[]=[];let notices:string[]=[];
 const sandbox=createContext({navigator:{userAgent:'Android WebView SchoolManagementAndroid/1.0'},URLSearchParams,activeBranch:'branch-fixture',dirty:true,toast:(s:string)=>notices.push(s),document:{createElement:()=>({href:'',download:'',click(){requested.push((this as any).href);}})},fetch:()=>{throw new Error('Android must not create a blob download.');}});
 runInContext(code,sandbox);await runInContext("submitDataExport({kind:'attendance',from:'2026-10-01',to:'2026-10-30'})",sandbox);
 assert.equal(requested.length,1);const url=new URL(requested[0],'https://school.example.test');assert.equal(url.pathname,'/api/v1/reports/export');assert.equal(url.searchParams.get('branchId'),'branch-fixture');assert.equal(url.searchParams.get('from'),'2026-10-01');assert.equal(url.searchParams.get('kind'),'attendance');assert.equal(sandbox.dirty,false);assert.ok(!notices[0].includes('downloaded'));
 let fetched='';notices=[];sandbox.navigator.userAgent='Ordinary browser';sandbox.fetch=async(path:string)=>{fetched=path;return {ok:false,json:async()=>({error:{message:'Session expired'}})}};
 await assert.rejects(runInContext("submitDataExport({kind:'counts'})",sandbox),/Session expired/);assert.ok(fetched.startsWith('/api/v1/reports/export?'));assert.equal(notices.length,0);
});
