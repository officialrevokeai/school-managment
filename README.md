# School Management System — current implementation

Android installer source and build instructions are in `android/README.md`. The signed APK is a client for a hosted HTTPS server; it asks for that address at first launch. It contains no school data or owner credentials. Hosting and real-device/live-server acceptance remain pending.

Latest update: Master Panel links are hidden from school navigation. On the normal login page, tap/click the school logo five times within five seconds (or press Alt+Shift+M) to reveal master sign-in. A separate server-verified master session is required; ordinary owner sign-in cannot open platform APIs. The master workspace is separate from school navigation. Permanent school deletion has two independent confirmations, a five-minute session-bound proof and password reauthentication, then deletes all tenant records and revokes every school account. Archive remains a separate recoverable action. See MASTER_PANEL_CHECKLIST.md and SCHOOL_DELETION.md.

The owner Home dashboard has **Account Add**, with owner-only creation of teacher, staff, student and additional-owner login accounts. Emails/roles and salted password hashes persist in the database; student enrollment and staff branch assignment commit with the account. Incorrect credentials and anonymous signup are rejected. Authenticated screens receive automatic database-change events; displayed counts/fees/attendance come from stored records.

The running local app is **http://127.0.0.1:3000**. On this computer localhost:3000 resolves to another service, so use the explicit IPv4 address. The initial owner has been created and its login verified; Account Add uses the ordinary school login; master access uses the concealed master sign-in with the same authorized credentials. The requested initial owner is saved in the persistent runtime. No fictional school, student, fee or attendance records were seeded. The private expiring setup link is stored in ignored runtime/owner-setup-link.txt. To issue a local initial link before an owner exists: node scripts/local-owner-setup.cjs, then npm run dev. Setup closes after the first owner is created; further accounts require owner login. Production should use the documented operator provisioning flow.

The frontend now has a TypeScript/Fastify API, PostgreSQL migrations, real login sessions, scoped workflows, durable outbox/worker, official provider adapters and tests. Production serves web/ with the original CSS/gradients/responsive shell; no demo scripts load there. Original source is retained in dist/, prototype/dist/ and Git checkpoint e6fdf8a.

Release remains open. WhatsApp has no configured account/token/approved template or authorized recipient; no real delivery/callback/reply was verified. Gateway sandbox, SMTP and Docker deployment are also unverified. Advanced UI/operator/filter gaps are listed in BLOCKERS.md and FEATURE_COVERAGE.csv. Read RELEASE_GATES.md before making readiness claims.

Local setup: Node 24; npm ci --ignore-scripts; copy .env.example to .env; npm run build; npm run migrate. Securely provide one JSON object on stdin to npm run provision with organization, name, ownerName, email and a unique password (12+ characters). No default owner password or school fixtures are seeded. Then npm run dev serves http://127.0.0.1:3000. Development uses persistent runtime/local-postgres; production requires PostgreSQL DATABASE_URL. Provisioning refuses a second initial organization.

Verification: npm run check builds, runs backend tests and preserves the 210 original prototype assertions. node build/scripts/preview-qa.js is an explicit disposable localhost fixture server, excluded from the production image and refusing configured production/persistent databases. Its credentials are test-only.

Docker/Linux is the chosen deployment target. See DEPLOYMENT.md, WHATSAPP_SETUP.md, PAYMENT_SETUP.md, API_CONTRACT.md and BACKUP_RESTORE.md. Source/migrations/lockfile/tests are in this directory; final deployment and release ZIP are held until all acceptance gates pass.

# Original prototype reference — historical, not current production claims

Smart • Secure • Connected.

A buildless, responsive frontend prototype using fictional Greenwood school records. Open dist/index.html through an HTTP server. The hosted Site serves dist/ with no package installation or build step.

## Explore

- Start in the Owner dashboard. The labelled **DEMO** account button opens six accounts across five workspaces: Owner, Principal, Teacher, Parent, Student, and Office.
- **All modules** exposes each account's secondary destinations.
- **Design reference & coverage** contains the complete role sitemap, permission matrix, visual system, component states, nine workflow walkthroughs, responsive previews, and 196 feature mappings. Download the complete reference or coverage CSV from that screen.
- **System settings → Backup & recovery** can export or restore browser-local demo data.

## Connected workflows

1. Owner creates a branch, assigns a principal, and configures permission restrictions.
2. Office creates and submits an admission; Principal approves it; student directory and branch enrollment update.
3. Teacher submits an attendance register; parent/student records and scoped notifications update; absence requests appear with disconnected-service failures in communication history.
4. Teacher publishes an assignment; the relevant portal submits work; the teacher records feedback.
5. Teacher submits validated marks; Principal approves; the student downloads an approved demonstration report card.
6. Parent reviews fees, enters the demo gateway, and chooses an explicit outcome. Only confirmed outcomes settle fees and unlock demonstration receipts. Pending verification requires accountant review.
7. Principal publishes a notice to a selected audience.
8. Owner configures a sender; Accountant schedules a fee reminder; history shows the local request and per-recipient status.
9. Staff requests leave; Principal records a decision; the requester reads the comments.

## Implementation boundaries

All identities are demonstration identities. State is stored in this browser's localStorage and shared across demo account switches. This is not production security or a multi-user database.

Real authentication, payment processing, WhatsApp sending/read receipts, automatic schedules, live backup infrastructure, and server-side access control are disconnected. They are labelled in the UI and feature coverage. Module and security preferences describe production policy; they do not claim backend enforcement.

Custom role records document grants. The fixed demo accounts use centralized route, record, action, branch, class, and linked-child checks plus explicit restrictive overrides. Production must repeat these checks on authenticated server queries, aggregates, files, exports, and mutations.

## Validation

Run node qa/smoke.cjs from the checkout. The suite checks 140 role routes, the reference tabs, scope and permission rules, and all nine core workflows (210 assertions).

Desktop browser checks verified the visual shell, admission creation and approval, student insertion, attendance submission and portal visibility, payment Processing, and a failed payment with no receipt. The refreshed interface was browser-checked in phone and tablet iframe viewports: no horizontal overflow in the checked home screens or phone fee records. Phone records become cards; tablets use a compact navigation rail.

Primary layouts target 1440px, 768px, and 390px. Reduced motion, focus indicators, dialog keyboard trapping, file constraints, and explicit integration states are included.

## Simplified interface refresh

The default home view now uses four summary cards, four contextual quick actions, and two priority panels. More details opens the complete dashboard. The main navigation shows five frequent destinations; All modules groups the remaining tools with a working module search. Soft lavender-to-blue, mint, and peach accents add warmth while primary actions remain charcoal.
