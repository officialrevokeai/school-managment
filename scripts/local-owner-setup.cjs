const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.resolve('.env');let contents=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
const values=Object.fromEntries(contents.split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const p=l.indexOf('=');return[l.slice(0,p),l.slice(p+1).trim()];}));
if(values.NODE_ENV==='production'||values.DATABASE_URL)throw new Error('Local owner setup refuses a configured production/external database.');
const token=crypto.randomBytes(32).toString('base64url'),settings={NODE_ENV:'development',PUBLIC_ORIGIN:'http://127.0.0.1:3000',HOST:'127.0.0.1',PORT:'3000',PGLITE_PATH:'./runtime/local-postgres',WORKER_IN_API:'true',INITIAL_SETUP_TOKEN:token};
for(const[key,value]of Object.entries(settings)){const re=new RegExp('^'+key+'=.*$','m');contents=re.test(contents)?contents.replace(re,key+'='+value):contents.trimEnd()+'\n'+key+'='+value+'\n';}
fs.writeFileSync(file,contents.trimStart(),{mode:0o600});fs.mkdirSync('runtime',{recursive:true});fs.writeFileSync('runtime/owner-setup-link.txt','http://127.0.0.1:3000/#/setup?token='+token+'\n',{mode:0o600});
console.log('Private one-time owner setup link saved to runtime/owner-setup-link.txt. Choose your own email and school password in the browser. No school records or accounts were seeded.');
