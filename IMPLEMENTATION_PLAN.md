# Implementation checkpoints

The attached specification is requirements input, subordinate to the user's request. Original frontend files remain in dist/ and prototype/dist/. Production serves web/ and reuses the original styles and UI helpers; demo scripts are never loaded there.

- [x] Phase 0: source read, baseline checked, workflow image received, source inventory and 196 prototype coverage items extracted.
- [ ] Phase 1: PostgreSQL migrations, authentication, provisioning, policy, private files, API client, direct API isolation tests.
- [ ] Phase 2: explicit WhatsApp navigation, official server adapter, signed durable callbacks, worker, consent, tests. Live verification BLOCKED EXTERNAL.
- [ ] Phase 3: owner scope/people, admissions and transfers.
- [ ] Phase 4: attendance, homework, schedules and leave.
- [ ] Phase 5: reviews, marks/publication, family portals, announcements.
- [ ] Phase 6: authoritative invoices, signed gateway settlement, accounting.
- [ ] Phase 7: sender routing, scheduled recipient jobs, cancellation/retries/suppression/inbox.
- [ ] Phase 8: reports, private documents, settings, audit and recovery.
- [ ] Phase 9: security/regression/browser QA, all nine workflows, defect log.
- [ ] Phase 10: containers, actual deployment, authorized live acceptance and final ZIP handover. Held until release gates pass.

Each phase must distinguish implemented code, tested behavior and external acceptance. An incomplete phase does not become complete because later independent work proceeds.

## Phase 0 findings

15 archived files; no package manifest/backend/database. Baseline `node qa/smoke.cjs`: 210 assertions, 140 rendered role routes, nine demo workflows, 196 coverage items PASS. This proves only the prototype behavior. See docs/SOURCE_INVENTORY.json for forms/actions/functions and docs/PROTOTYPE_COVERAGE.json for the original coverage. The workflow diagram is docs/workflow.jpg.

Demo authority: dist/data.js stores the seed, fixed date and account identities; dist/events.js switches roles and applies local changes; dist/workflows.js simulates gateway outcomes, disconnected sends and browser schedules; dist/system.js contains local approval/record policy. No demo state will migrate automatically to production.

## Nine release gates

1. Branch assignment and scope.
2. Admission decision creates one enrollment.
3. Attendance reaches correct parent and one real configured WhatsApp event.
4. Homework publication/submission/feedback.
5. Approved published marks and private report.
6. Verified gateway settlement, ledger and receipt.
7. Audience-scoped announcements.
8. Browser-independent scheduled reminder, receipt/callback/reply evidence.
9. Staff leave and principal decision notification.

Keep each gate open until its actual evidence exists. Do not confuse local/mocked assertions with real provider acceptance.

## Current checkpoint after implementation

Phases 1–8 contain implemented backend/UI vertical slices and regression suites: foundation, visible official WhatsApp adapter/worker, admissions/transfers, attendance/homework/leave, marks/publication/portals, fees/capture/refunds, reminder routing/reliability, operations/reports/private files/settings/audit and encrypted restore. Supplemental migrations add custom-role restrictions, profile/file lifecycle, result revisions, service-window replies and evidence-gated sender acceptance. Phase 9 is partially verified; Phase 10 Docker/Linux configuration is prepared and unexecuted.

The boxes above remain open where the whole phase gate has not passed. FEATURE_COVERAGE.csv maps all 196 inherited requirement items to production services, phase, status, tests and blockers. BLOCKERS.md lists coding gaps separately from Meta/Razorpay/SMTP/deployment dependencies. The workflow image's five role groups, WhatsApp integration and shared controls are covered by the same matrix; real delivery/payment and full release acceptance are still open.
