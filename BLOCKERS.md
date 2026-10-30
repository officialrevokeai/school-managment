# External blockers and remaining work

## External dependencies

- ANDROID — signed APK built and signature/alignment/URL policy checks passed. A Botkeep HTTPS origin is selected, but hosted app/device acceptance remains unverified. The first-launch server-address screen is implemented; localhost cannot serve shared phones. See android/README.md. No APK feature is marked live-verified merely because the installer builds.

- SUPABASE — private schema, 15 migrations, exact transfer comparison, restricted runtime login and provider-CA TLS connection verified on the selected project. Encrypted source backup restore passed. A local production API using live PostgreSQL returned readiness/frontend 200 and anonymous private-API 401. The private configuration must still be installed on Botkeep; hosted login/device/worker/load acceptance remains pending. See SUPABASE_SETUP.md.

- WHATSAPP — NOT LIVE VERIFIED. Owner confirmed “Not configured yet; continue code and tests.” Missing onboarded provider account and sender phone ID, scoped access token, app secret, webhook verify secret, supported Graph version verified for that account, approved template/language/parameter schema, public HTTPS callback and subscriptions, explicitly authorized opted-in test recipient. Required evidence: correct sender received on device, real provider message ID, authentic delivery callback, inbound reply, scheduled send with browser closed. No real sends authorized/configured.
- PAYMENTS — no Razorpay test merchant keys, webhook secret, account mapping or accessible HTTPS callback supplied. No gateway sandbox result. Production charge requires separate explicit authorization.
- EMAIL — no SMTP host/credentials/from address supplied; recovery/invite email cannot be live verified.
- DEPLOYMENT — Botkeep Node 24 host / HTTPS origin selected. Its 512 MB allocation killed the development embedded database (exit 137, OOM=true). External PostgreSQL is now prepared; install the private runtime connection on Botkeep and rebuild latest source. Computer Use cannot control the dashboard because its browser URL could not be verified. Separate worker, hosted acceptance, container build, real pg_dump restore and off-host backups remain open. No production-ready claim is made.
- PROVIDER CONTRACT — some Meta technical docs return 429/login requirements. Require account-specific contract verification; do not infer a Graph version from an old tutorial.

## Coding and verification

Phase checklist and FEATURE_COVERAGE.csv distinguish unfinished code from missing accounts. Workflow image received and stored; no image blocker remains. Containerized PostgreSQL/HTTPS/backup restore and actual browser/device QA still need evidence. Do not call this production-ready while these remain open.

## Remaining coding/UI gaps (not external account blockers)

- Several list APIs use bounded recent-record responses; complete cursor pagination, academic-year/date filters, search/sort and high-volume performance testing remain unfinished.
- Transfer, invoice-adjustment, generic record edit/archive, term setup and sender live-acceptance APIs do not yet have complete operator UI controls. Consolidated approval/detail screens and complete supporting-document admission UI need further work.
- Lost/uncertain gateway-order response discovery/reconciliation lacks a complete operator workflow. Failed/cancelled order lifecycle needs provider-backed reconciliation before reservations can safely be released.
- WhatsApp recipient UI currently targets verified guardians; staff/student recipient onboarding, recipient search, full history filtering, advanced template creation/media and newer-account/opaque identity transport remain incomplete. Approved simple text templates are synchronized from Meta; saving custom local content cannot approve it.
- All nine workflows have backend regression coverage for their implemented slices, but full browser acceptance across every role/device is not complete. Only the documented owner UI paths/viewport checks were exercised.
- Encrypted local PGlite restore passed; real PostgreSQL multi-worker/container/pg_dump restore, off-host recovery and production load evidence remain open.

The user asked to conserve remaining account usage during finalization. Work is checkpointed with these gaps explicitly open; no phase/release is being declared complete to fit that limit.
