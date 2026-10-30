# Performance, admissions and live Android client

- [x] Fresh session/IP authorization uses one database query; no cross-request authorization cache.
- [x] Context uses two total queries including authorization (previously eight); owner dashboard uses three without per-record branch checks.
- [x] Dashboard requests run concurrently. Duplicate GETs coalesce; bounded, memory-only data cache expires in ten seconds and clears on writes, live changes, authorization errors and session changes.
- [x] SSE still revalidates sessions every two seconds; scoped data fingerprints run about every four seconds. Unchanged/initial events do not reload pages. Background refresh protects open forms, navigation and scroll position.
- [x] Mobile dialog width uses a definite grid column, full available width and a scrollable viewport height. Mobile form controls use 16px text, avoiding focus zoom on iOS. Header, button labels and toast positioning are corrected.
- [x] Admissions explains missing setup instead of displaying an unusable empty class selector. Owners can save campus/year/classes through one atomic, tenant-scoped `POST /api/v1/academic-setup` operation. Retries reuse existing records; invalid/conflicting setup rolls back. No default school/class/student records are seeded.
- [x] Admission class labels include campus and academic year; new forms refresh their scope from the server. Application notes are optional.
- [x] Signed Android 3.0.1 (code 2) defaults to the live HTTPS host and retains the original signing certificate. No login or database secret is included. Native Share this APK remains available; server web updates appear in this client.
- [ ] Physical Android/iOS device, keyboard, file-picker/share and all-role live acceptance.
- [ ] Separate production worker and genuine external-provider acceptance remain open.

To add admission classes, open Admissions → Set up classes, enter the actual school/campus and academic year (or choose existing records), and list one class/section per line. Save classes, then complete the admission form. Staff without owner access must ask their owner to configure classes.

Verification: full performance regression checkpoint passed 113 backend tests and 210 prototype assertions. After adding admission setup/mobile/APK changes, compilation and 16 focused backend/frontend tests passed, followed by 210 prototype assertions. Signed APK passed 35 JVM URL-policy checks, DEX/ZIP integrity, 16KB alignment and v2/v3 signature verification. Local browser at 390px measured a 366px admission dialog (previous live version 236px), no horizontal document overflow, 16px controls and real fixture classes labeled by campus/year. Production setup records were not invented or submitted for testing. These results do not establish all-nine-workflow live or physical-device acceptance.
