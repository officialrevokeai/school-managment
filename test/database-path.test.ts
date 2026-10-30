import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase } from '../server/db.js';

test('a fresh checkout creates missing database parents and retains records across reopen', async()=>{
  const root=await mkdtemp(join(tmpdir(),'school database '));
  const oldPath=process.env.PGLITE_PATH,oldMode=process.env.NODE_ENV;
  try{
    process.env.NODE_ENV='test';
    process.env.PGLITE_PATH=join(root,'runtime','nested','local-postgres');
    const first=await openDatabase('');
    try{
      await first.exec('CREATE TABLE persistence_check(value text NOT NULL)');
      await first.query('INSERT INTO persistence_check(value) VALUES($1)',['retained']);
    }finally{await first.close();}
    const reopened=await openDatabase('');
    try{assert.deepEqual(await reopened.query('SELECT value FROM persistence_check'),[{value:'retained'}]);}
    finally{await reopened.close();}
  }finally{
    if(oldPath===undefined)delete process.env.PGLITE_PATH;else process.env.PGLITE_PATH=oldPath;
    if(oldMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldMode;
    await rm(root,{recursive:true,force:true});
  }
});

test('production without PostgreSQL fails without creating a local database',async()=>{
  const root=await mkdtemp(join(tmpdir(),'school production '));
  const oldPath=process.env.PGLITE_PATH,oldMode=process.env.NODE_ENV;
  const target=join(root,'runtime','local-postgres');
  try{
    process.env.NODE_ENV='production';process.env.PGLITE_PATH=target;
    await assert.rejects(()=>openDatabase(''),/DATABASE_URL is required in production/);
    await assert.rejects(()=>access(join(root,'runtime')),error=>(error as NodeJS.ErrnoException).code==='ENOENT');
  }finally{
    if(oldPath===undefined)delete process.env.PGLITE_PATH;else process.env.PGLITE_PATH=oldPath;
    if(oldMode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldMode;
    await rm(root,{recursive:true,force:true});
  }
});
