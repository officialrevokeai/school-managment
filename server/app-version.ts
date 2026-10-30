import { readdir,readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest } from './core.js';
export async function webBuildVersion(){const files=(await readdir(resolve('web'))).sort();return digest(JSON.stringify(await Promise.all(files.map(async name=>[name,digest(await readFile(resolve('web',name)))])))).slice(0,20);}
