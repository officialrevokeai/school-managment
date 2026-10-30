# Hosting checklist — 30 October 2026

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
- [ ] Install the private configuration on Botkeep and rebuild latest main source.
- [ ] Verify public health, original owner login and mobile/tablet sessions on the host.
- [ ] Run separate worker; verify restart behavior and real scheduled delivery.
- [ ] Complete WhatsApp/payment/email live acceptance and all nine release gates.
- [ ] Verify production load, Docker image, pg_dump/restore and off-host recovery.

Computer Use ended because Chrome's current URL could not be verified. No further browser actions were attempted. Prepared configuration still needs a manual host handoff. Windows startup memory measurements are diagnostic, not a guarantee that the Linux host will remain within its allocation under load.
