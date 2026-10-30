FROM node:24.22.2-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --ignore-scripts
COPY server ./server
COPY scripts ./scripts
COPY test ./test
RUN npm run build && npm prune --omit=dev --ignore-scripts

FROM node:24.22.2-bookworm-slim AS runtime
# Matching PostgreSQL client for encrypted operational backups; official PGDG repository.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
 && install -d /usr/share/postgresql-common/pgdg \
 && curl --fail --show-error --silent https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
 && printf 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main\n' > /etc/apt/sources.list.d/pgdg.list \
 && apt-get update && apt-get install -y --no-install-recommends postgresql-client-18 \
 && apt-get purge -y curl gnupg && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 WORKER_IN_API=false
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build/server ./build/server
COPY --from=build /app/build/scripts/migrate.js /app/build/scripts/provision.js /app/build/scripts/backup.js /app/build/scripts/restore.js /app/build/scripts/configure-app-role.js ./build/scripts/
COPY --from=build /app/build/scripts/platform-admin.js /app/build/scripts/supabase-prepare.js /app/build/scripts/supabase-transfer.js ./build/scripts/
COPY migrations ./migrations
COPY deploy/certs ./deploy/certs
COPY deploy/supabase-harden.sql ./deploy/supabase-harden.sql
COPY web ./web
RUN mkdir -p /backups && chown node:node /backups
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","build/server/main.js"]
