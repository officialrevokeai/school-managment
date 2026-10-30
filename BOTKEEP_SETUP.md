# Botkeep / Pterodactyl Node.js hosting

The repository contains TypeScript source. `build/` is generated locally and is intentionally not committed. A source import must install development dependencies and compile before starting. This project supports **Node.js 24.x**; the reported Node.js 22.23.2 runtime must be changed.

## Files and commands

Import `officialrevokeai/school-managment`, branch `main`. The project root is the directory containing `package.json`, `package-lock.json`, `tsconfig.json`, `server/`, `scripts/`, `migrations/` and `web/`. On the reported host that directory is `/home/container`.

Run in a shell / build command from that directory:

```sh
npm ci --include=dev --ignore-scripts
npm run build
```

Set the startup command to:

```sh
npm start
```

If the host provides only a single shell startup command, use:

```sh
npm ci --include=dev --ignore-scripts && npm run build && npm start
```

`npm start` also compiles automatically when `build/server/main.js` is absent and the local compiler is installed. If dependencies are missing, it stops with an actionable error. Existing prebuilt installations can start without development dependencies. After each source update, explicitly run `npm run build` to replace previous compiled output. Do not enter shell commands into an application-only stdin console; use the host's startup/build configuration or its shell.

## Required hosting configuration

Use the host's assigned port and an HTTPS domain routed to that port. Configure the following privately in the hosting Environment settings (or a private, uncommitted `.env`):

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=YOUR_ASSIGNED_PORT
PUBLIC_ORIGIN=https://YOUR_APP_DOMAIN
DATABASE_URL=YOUR_PRIVATE_POSTGRESQL_CONNECTION_STRING
WORKER_IN_API=false
```

Replace placeholders; never commit the actual database connection. `PORT` must be numeric and `PUBLIC_ORIGIN` must be the browser's HTTPS origin without a path. When the panel supplies `SERVER_PORT`, the API automatically uses that allocated port and binds `0.0.0.0`, overriding stale local `PORT` / `HOST` values. On other hosts it uses `PORT`; production defaults to `0.0.0.0`, while local development stays on loopback. Invalid ports fail clearly. Only configure `TRUST_PROXY` after confirming the actual trusted proxy addresses; do not trust all clients.

## Application is not responding

The reported `ENOENT ... mkdir '/home/container/runtime/local-postgres'` crash occurs because a source-only checkout has no ignored `runtime/` parent directory. Development/test filesystem databases now create their missing parents automatically and retain stored records across restart. This does not enable local PGlite in production: PostgreSQL is still required there. If this local path appears in hosted startup logs, no `DATABASE_URL` is in use and the process is not running in production mode. It is a separate database from the one on your computer.

After importing a newer source revision, run `npm run build` before restarting; an existing `build/` directory may contain the previous compiled server. Keep the startup command as `npm start`.

In Network, note the assigned application port. In Domains, route your app's HTTPS address to that same port. The new startup log prints the actual bind address, for example `School Management API listening: http://0.0.0.0:27135`. That port must match the panel allocation and domain target. If the host does not export `SERVER_PORT`, set `HOST=0.0.0.0` and `PORT` to the numeric allocation manually. Set `PUBLIC_ORIGIN` to the real public HTTPS origin for login/CSRF checks; a localhost origin is not correct for a hosted browser session.

Check the public HTTPS URL's `/health/live` endpoint. If it is unreachable although the console shows the expected listening address, inspect domain/proxy routing and the host's port allocation. If the listening line never appears, read the preceding startup error (including database, migration or HTTPS-origin errors). A panel's running status alone does not prove the HTTP app is reachable. Never disable login/CSRF or enable the development database to hide a production configuration failure.

Production refuses to start without PostgreSQL and an HTTPS origin. It does not fall back to the local development database. New remote databases do not contain the owner account or school records from your computer. Use the documented secure provisioning or transfer process; do not seed default credentials. Database migration credentials must stay separate from the restricted runtime identity. Follow DEPLOYMENT.md / SUPABASE_SETUP.md for migrations, role permissions, owner provisioning and backup setup before exposing the app.

Run a separate always-on process with matching runtime configuration for scheduled reminders and provider work:

```sh
npm run worker
```

Production deliberately does not run this worker inside the API. A host that permits only one process needs a separate worker service. Real WhatsApp delivery remains blocked until provider credentials, approval and an opted-in test recipient are configured and authentic callbacks are verified.

Check `/health/live` and `/health/ready` after startup. Building successfully fixes the missing-file crash; it does not prove database configuration, HTTPS routing, worker operation or the nine live release workflows. No remote Botkeep deployment has been verified from this workspace.

Official references: [Botkeep Node.js guide](https://botkeep.cloud/docs/nodejs), [GitHub imports](https://botkeep.cloud/docs/github), [npm scripts](https://docs.npmjs.com/cli/v11/using-npm/scripts/).
