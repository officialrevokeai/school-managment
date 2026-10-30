# Decisions

2026-10-30: Retain original CSS, gradients, responsive rules and component markup. Keep demo source and smoke checks intact, but isolate it from authenticated web/. No localStorage school data in production.

2026-10-30: Use Fastify with SQL and node-postgres, not a new frontend framework. PGlite is a local/testing adapter for the real PostgreSQL schema; separate production PostgreSQL and worker containers. No Docker/psql was installed on the current host.

2026-10-30: Database queue avoids a second Redis infrastructure. Provider uncertainty is explicit; no promise of exactly-once external transport.

2026-10-30: Meta account model evolves beyond WABA; integration account stores account type and reference separately from phone sender. Require explicitly configured supported Graph version. Conservative approved-template outbound path only; optional direct-send/coexistence remains disabled until verified for the actual account.

2026-10-30: Owner confirms WhatsApp is not configured. Do not contact anyone. Implement and test adapters with clearly identified mocked transport, then hold live gates.

2026-10-30: User requested Account Add and strict database-backed login/live updates while conserving remaining usage. Added focused owner-only provisioning, salted hashes, protected first-owner UI and two-second scoped SSE invalidation. The persistent local runtime starts empty. Use 127.0.0.1:3000 explicitly: an unrelated IPv6 listener on localhost:3000 serves another app and was not changed/stopped.
