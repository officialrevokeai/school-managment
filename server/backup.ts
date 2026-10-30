import { createCipheriv,createDecipheriv,scryptSync,randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile,writeFile,mkdir,rename,readdir,stat,unlink } from 'node:fs/promises';
import { resolve,join,dirname } from 'node:path';
import { id,digest,requireThat } from './core.js';
import type { DB } from './db.js';
const magic=Buffer.from('SCHOOLBACKUP1\n');
export function encryptBackup(bytes:Buffer,passphrase:string){requireThat(passphrase.length>=32,'BACKUP_KEY_REQUIRED','Backup encryption passphrase must have at least 32 characters.',400);const salt=randomBytes(32),iv=randomBytes(12),key=scryptSync(passphrase,salt,32);const cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([magic,salt,iv,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);}
export function decryptBackup(bytes:Buffer,passphrase:string){requireThat(bytes.subarray(0,magic.length).equals(magic),'INVALID_BACKUP','Unsupported backup format.',400);const offset=magic.length,salt=bytes.subarray(offset,offset+32),iv=bytes.subarray(offset+32,offset+44),tag=bytes.subarray(-16);const decipher=createDecipheriv('aes-256-gcm',scryptSync(passphrase,salt,32),iv);decipher.setAuthTag(tag);return Buffer.concat([decipher.update(bytes.subarray(offset+44,-16)),decipher.final()]);}
export async function postgresTool(command:'pg_dump'|'pg_restore',databaseUrl:string,input?:Buffer){
 // Credentials go through child environment, never process arguments or logs.
 const u=new URL(databaseUrl);const env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1)),...(u.searchParams.get('sslmode')?{PGSSLMODE:u.searchParams.get('sslmode')!}:{})};
 return new Promise<Buffer>((resolve,reject)=>{
  const child=spawn(command,command==='pg_dump'?['--format=custom','--no-owner','--no-acl']:['--exit-on-error','--no-owner','--no-acl','--dbname',env.PGDATABASE],{env,stdio:['pipe','pipe','pipe'],windowsHide:true});
  const chunks:Buffer[]=[];let size=0;child.stdout.on('data',chunk=>{size+=chunk.length;if(size>268435456){child.kill();reject(new Error('BACKUP_PILOT_LIMIT_256_MIB'));}else chunks.push(chunk);});child.stderr.resume();child.on('error',()=>reject(new Error('POSTGRES_TOOL_UNAVAILABLE')));child.on('close',code=>code===0?resolve(Buffer.concat(chunks)):reject(new Error('POSTGRES_TOOL_FAILED')));child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
export async function createOperationalBackup(db:DB){
 const url=process.env.DATABASE_URL,pass=process.env.BACKUP_PASSPHRASE,root=process.env.BACKUP_DIRECTORY;requireThat(url&&pass&&root,'BACKUP_NOT_CONFIGURED','DATABASE_URL, BACKUP_PASSPHRASE and BACKUP_DIRECTORY are required.',503);
 const bytes=encryptBackup(await postgresTool('pg_dump',url),pass),bid=id(),folder=resolve(root);await mkdir(folder,{recursive:true});const target=join(folder,`${new Date().toISOString().replaceAll(':','-')}-${bid}.schoolbackup`);await writeFile(target+'.partial',bytes,{mode:0o600});await rename(target+'.partial',target);
 await db.query("INSERT INTO backup_records(id,encrypted_sha256,bytes,status,note) VALUES($1,$2,$3,'created','Encrypted PostgreSQL custom dump; includes private file bytes')",[bid,digest(bytes),bytes.length]);
 const retention=Number(process.env.BACKUP_RETENTION_DAYS||30);requireThat(Number.isInteger(retention)&&retention>=7&&retention<=3650,'INVALID_RETENTION');for(const name of await readdir(folder)){if(!/^[\dTZ.-]+-[a-f0-9-]{36}\.schoolbackup$/.test(name))continue;const file=resolve(folder,name);if(dirname(file)!==folder)throw new Error('INVALID_BACKUP_PATH');if(Date.now()-(await stat(file)).mtimeMs>retention*86400000)await unlink(file);}
 return {id:bid,bytes:bytes.length,sha256:digest(bytes)};
}
