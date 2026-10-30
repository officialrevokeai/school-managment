# API contract

Base /api/v1, same-origin JSON; strict Zod request schemas in server/ are the detailed payload contract. docs/API_ROUTES.json inventories actual methods/paths/source files. Server UUIDs, tenant joins and policies are authoritative. Client roles, permission flags, amounts and sender spoofing cannot grant authority.

Error shape: {error:{code,message,requestId,fields?}}. Codes: 400 validation, 401 session, 403 scope/policy, 404 unavailable document, 409 transition/idempotency conflict, 429 limits, 503 missing setup, 502 provider failure. Internal errors omit database details/secrets. Cookie mutations require exact Origin and X-CSRF-Token; login/recovery/reset enforce origin and dedicated rate limits. auth/me returns CSRF.

|Area|Service and transaction boundary|
|---|---|
|Auth|Hashed password/session/recovery tokens, login/logout, one-use reset and session revocation|
|Administration|Organization-safe schools/branches/users, years/classes/subjects, assignments, guardian/student links and audit|
|Governance|Confirmed/reasoned custom roles and restrictions; base-role and record fences remain mandatory; current grants checked on requests/jobs|
|Admissions/transfers|Draft/revision/submit/commented decision; locked approval creates enrollment once|
|Attendance|Unique class/date/session; complete final roster, reasoned before/after corrections; notifications/outbox commit together|
|Homework|Draft edit, publish/schedule/cancel, secure files, child submission and teacher feedback; jobs retain revision|
|Academics|Marks validation, submission/review, separate publication, retained correction snapshot/reapproval and private generated reports|
|Operations|Typed schemas/state transitions for materials, lesson plans, timetable/exams, cases/complaints/meetings/reviews, accounting and certificates/reports|
|Finance|Exact invoices, reserved parent orders, offline verification, signed/fetched capture/refund, unique ledger/allocation/receipt|
|WhatsApp|Official account/sender health, template sync, opt-in, confirmed recipient snapshot, schedule/cancel/retry/history, inbox/service-window reply and evidence-gated sender acceptance|
|Files/reports|Type/size validation, private downloads, recoverable archive, scoped dashboards and formula-safe CSV|
|Settings/health|Timezone/quiet hours, effective messaging preferences, scoped queue health and worker heartbeat|

Idempotency keys protect attendance, enrollment, submissions, outbox events, message recipients, callbacks, payment allocations/receipts and refunds. In-flight sends cannot be recalled. Unknown submission outcomes become uncertain, not blind retries.

School records support kind/search/offset/limit (max 100); audit supports offset. Other endpoints currently return bounded recent lists (100–1000). Broader cursor pagination/filtering and lost-order reconciliation remain release gaps, not completed scale coverage.

Account Add: POST /accounts accepts name, email, password (12–128 characters), role, confirmed:true, plus branchId for non-owner accounts. Student accounts additionally require an existing unlinked studentId or a classId for a new student. Account/assignment/enrollment/audit writes are atomic. Only an authenticated owner can call it; no password hash is returned.

Initial owner UI is operator-token protected: GET /setup/status returns availability only. POST /setup/owner requires an expiring server-issued setupToken and owner/school details. It closes once the first organization exists. This is not public signup. The local setup code is kept out of tracked source and is consumed from a URL fragment; the browser removes it from the address bar.

GET /events is an authenticated server-sent event stream. The server checks persisted authorized record revisions every two seconds, sends only invalidation hashes and rechecks active session/role. The client refetches authorized API data, deferring while forms are being edited. No other student's values are sent in the stream; wrong/disabled sessions cannot use it. This is automatic live refresh over a database-polled stream, not a promise of zero latency or tested production throughput.
