import { isIP } from 'node:net';
import type { DB } from './db.js';
import { digest, requireThat } from './core.js';

export function normalizeIp(value:string){let ip=value.toLowerCase();requireThat(isIP(ip),'INVALID_IP','Enter an exact IPv4 or IPv6 address.',400);if(isIP(ip)===6){ip=new URL(`http://[${ip}]/`).hostname.slice(1,-1);const mapped=/^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(ip);if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);ip=[high>>8,high&255,low>>8,low&255].join('.');}}return ip;}
export const accountKey=(org:string,email:string)=>digest('account:'+org+':'+email.toLowerCase());
export const ipKey=(ip:string)=>digest('ip:'+normalizeIp(ip));
export async function ipBlocked(db:DB,ip:string){
 const [blocked]=await db.query('SELECT 1 FROM blocked_ips WHERE ip=$1 AND expires_at>now() UNION ALL SELECT 1 FROM login_guards WHERE key=$2 AND locked_until>now()',[normalizeIp(ip),ipKey(ip)]);return !!blocked;
}
export async function guardLocked(db:DB,key:string){return !!(await db.query('SELECT 1 FROM login_guards WHERE key=$1 AND locked_until>now()',[key])).length;}
export async function failedLogin(db:DB,key:string,scope:'account'|'ip',ip:string){
 const limit=scope==='account'?5:30;
 await db.query(`INSERT INTO login_guards(key,scope,ip,failures) VALUES($1,$2,$3,1)
 ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN login_guards.window_start<now()-interval '15 minutes' THEN 1 ELSE login_guards.failures+1 END,
 window_start=CASE WHEN login_guards.window_start<now()-interval '15 minutes' THEN now() ELSE login_guards.window_start END,
 locked_until=CASE WHEN login_guards.window_start>=now()-interval '15 minutes' AND login_guards.failures+1>=$4 THEN now()+interval '15 minutes' ELSE NULL END,updated_at=now(),ip=excluded.ip`,[key,scope,normalizeIp(ip),limit]);
}
