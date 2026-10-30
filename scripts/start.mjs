import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Source-only hosts may run npm start without a separate build step.
const root = new URL('../', import.meta.url);
const entry = new URL('build/server/main.js', root);

if (Number(process.versions.node.split('.')[0]) !== 24) {
  console.error('School Management requires Node.js 24.x. Select Node.js 24 in your hosting runtime settings.');
  process.exit(1);
}

if (!existsSync(entry)) {
  const compiler = new URL('node_modules/typescript/bin/tsc', root);
  if (!existsSync(compiler)) {
    console.error('Server build is missing. Run npm ci --include=dev --ignore-scripts, then npm run build, then npm start.');
    process.exit(1);
  }
  console.log('Server build is missing; compiling TypeScript before startup...');
  const result = spawnSync(process.execPath, [fileURLToPath(compiler)], {
    cwd: fileURLToPath(root), stdio: 'inherit'
  });
  if (result.error || result.status !== 0) {
    console.error('Server build failed; the app has not been started.');
    process.exit(result.status || 1);
  }
  if (!existsSync(entry)) {
    console.error('Build finished without build/server/main.js. Check tsconfig.json and upload the complete project source.');
    process.exit(1);
  }
}

await import(entry.href);
