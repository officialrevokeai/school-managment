import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export type Row = Record<string, any>;
export interface DB {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  transaction<T>(fn: (db: DB) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  snapshot?(): Promise<Blob>;
}
export async function openDatabase(url = process.env.DATABASE_URL, options:{snapshot?:Blob}={}): Promise<DB> {
  if (url) {
    const schema=process.env.DB_SCHEMA||'public';
    if(!/^[a-z_][a-z0-9_]{0,62}$/.test(schema))throw new Error('DB_SCHEMA must be a simple lowercase PostgreSQL schema identifier.');
    const parsed=new URL(url),supabase=parsed.hostname.endsWith('.supabase.co')||parsed.hostname.endsWith('.supabase.com');
    if(supabase&&schema==='public')throw new Error('Use the private school_app schema on Supabase; browser Data API access is not used by this application.');
    if(supabase&&parsed.searchParams.get('sslmode')!=='verify-full')throw new Error('Supabase DATABASE_URL must use sslmode=verify-full.');
    const pool = new pg.Pool({ connectionString: url, max: Number(process.env.DB_POOL_SIZE||10),connectionTimeoutMillis:15000,options:`-c search_path=${schema}` });
    const wrap = (client: pg.Pool | pg.PoolClient): DB => ({
      query: async (s, p = []) => (await client.query(s, p)).rows,
      exec: async s => { await client.query(s); },
      transaction: async fn => {
        const c = await pool.connect();
        try { await c.query('BEGIN'); const v = await fn(wrap(c)); await c.query('COMMIT'); return v; }
        catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
      }, close: () => pool.end()
    });
    return wrap(pool);
  }
  if (process.env.NODE_ENV === 'production') throw new Error('DATABASE_URL is required in production; PGlite is development/test only.');
  const pglite = new PGlite({dataDir:process.env.PGLITE_PATH || 'memory://',...(options.snapshot?{loadDataDir:options.snapshot}:{})});
  const wrap = (client: any): DB => ({
    query: async (s, p = []) => (await client.query(s, p)).rows,
    exec: async s => { await client.exec(s); },
    transaction: fn => pglite.transaction(tx => fn(wrap(tx))),
    close: () => pglite.close(),snapshot:()=>pglite.dumpDataDir()
  });
  await pglite.waitReady;
  return wrap(pglite);
}
export async function migrate(db: DB) {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of (await readdir(resolve('migrations'))).filter(n => n.endsWith('.sql')).sort()) {
    const sql = await readFile(resolve('migrations', name), 'utf8');
    const hash = createHash('sha256').update(sql).digest('hex');
    await db.transaction(async tx => {
      await tx.query("SELECT pg_advisory_xact_lock(48290217)");
      const [prior] = await tx.query('SELECT sha256 FROM schema_migrations WHERE name=$1', [name]);
      if (prior) { if (prior.sha256 !== hash) throw new Error(`Migration checksum mismatch: ${name}`); return; }
      await tx.exec(sql);
      await tx.query('INSERT INTO schema_migrations(name,sha256) VALUES($1,$2)', [name, hash]);
    });
  }
}
