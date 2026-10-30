import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  const root = await mkdtemp(join(tmpdir(), 'school startup '));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, 'scripts'));
  await copyFile('scripts/start.mjs', join(root, 'scripts/start.mjs'));
  await writeFile(join(root, 'package.json'), '{"type":"module"}');
  return {
    async put(path: string, content: string) {
      const target = join(root, path);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, content);
    },
    run: () => spawnSync(process.execPath, [join(root, 'scripts/start.mjs')], {
      cwd: tmpdir(), encoding: 'utf8', timeout: 20000
    })
  };
}

test('source-only startup compiles from the project root before loading the server', async t => {
  const f = await fixture(t);
  await f.put('node_modules/typescript/bin/tsc', `
    const fs = require('node:fs');
    fs.mkdirSync('build/server', {recursive:true});
    fs.writeFileSync('build/server/main.js', 'console.log("SERVER_READY");');
  `);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /compiling TypeScript/);
  assert.match(result.stdout, /SERVER_READY/);
});

test('prebuilt startup works without development dependencies', async t => {
  const f = await fixture(t);
  await f.put('build/server/main.js', 'console.log("SERVER_READY");');
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /SERVER_READY/);
  assert.doesNotMatch(result.stdout, /compiling/);
});

test('missing compiler reports the installation command and never starts', async t => {
  const f = await fixture(t), result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /npm ci --include=dev --ignore-scripts/);
  assert.doesNotMatch(result.stderr, /MODULE_NOT_FOUND/);
});

test('failed compilation aborts startup and preserves the compiler exit code', async t => {
  const f = await fixture(t);
  await f.put('node_modules/typescript/bin/tsc', 'process.exit(2);');
  const result = f.run();
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Server build failed/);
  assert.doesNotMatch(result.stdout, /SERVER_READY/);
});

test('compiler success without server output still aborts startup', async t => {
  const f = await fixture(t);
  await f.put('node_modules/typescript/bin/tsc', 'process.exit(0);');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /without build\/server\/main.js/);
});
