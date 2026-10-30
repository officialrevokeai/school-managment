# Hosting checklist — 30 October 2026

- [x] Performance/admission setup/mobile fixes built and tested; signed live-origin APK prepared (PERFORMANCE_AND_MOBILE.md).
- [ ] Verify this update on the live host after source sync/rebuild.

- [x] Source-only startup builds missing output and reports missing compiler/runtime clearly.
- [x] Node 24 build and 13 startup/database/port regressions pass.
- [x] Managed host binds 0.0.0.0 and uses SERVER_PORT; invalid ports fail clearly.
- [x] Development database creates missing parent directories and persists records.
- [x] PostgreSQL mode does not import the embedded WASM engine.
- [x] Supabase private schema: 75 tables, 15 checked app migrations; existing public schema preserved.
- [x] Encrypted source backup restored and checked before atomic transfer.
- [x] All 68 copied tables compared for exact contents; original credentials/master membership retained.
- [x] Restricted database login and provider-CA TLS/hostname verification pass.
- [x] Private schema RLS/grants applied; no private-schema security advisor findings.
- [x] Actual production API against live PostgreSQL: readiness/frontend 200; anonymous users API 401.
- [x] Private host configuration prepared outside Git, with pool size 2 and app port 45318.
- [x] Installed encrypted private configuration on Botkeep; source commit 8038f29 merged and rebuilt on Node 24.
- [x] Public homepage/live/readiness return 200; anonymous users API returns 401; configuration URLs return 404.
- [x] Original owner signed in through HTTPS; dashboard and Account Add load real Supabase records; live updates connect.
- [ ] Complete additional-role and mobile/tablet/device acceptance on the host.
- [ ] Run separate worker; verify restart behavior and real scheduled delivery.
- [ ] Complete WhatsApp/payment/email live acceptance and all nine release gates.
- [ ] Verify production load, Docker image, pg_dump/restore and off-host recovery.

Current host: https://school-management-system.bot-keep.xyz. The initial Chrome control blocker was resolved using the in-app browser after the user signed in. Runtime observed approximately 108 MB of the 512 MB allocation after authenticated use. Startup is `npm run build && npm start`; the host performs dependency installation. The temporary import copy was renamed `.env.botkeep-import` and is ignored by Git; managed environment values are saved as secrets. This is startup/owner smoke acceptance, not production load, external-provider or all-nine-workflow acceptance. The current Free plan has one allocated workload slot; a separate worker has not been deployed.
