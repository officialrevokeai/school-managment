# Master Panel feature checklist

- [x] Separate platform-admin membership; ordinary school owners cannot access global endpoints or grant master access.
- [x] Bootstrap the requested existing owner as the initial master administrator without changing credentials.
- [x] Real organization/school/student/staff totals; no sample records seeded into the persistent app.
- [x] Add a school organization with first school, branch and hashed owner account atomically.
- [x] Suspend, archive, restore; revoke existing sessions and block school background actions. Archive is recoverable. Permanent deletion is separate.
- [x] Hide master links from school navigation; deliberate login-page entry and separate server-checked master workspace session.
- [x] Two-confirmation permanent tenant deletion; exact code, expiring session-bound proof, password reauthentication, cascade of all tenant tables and all-role logout. Tests only delete disposable fixtures.
- [x] Clear overlays, cached records, CSRF, pending deletion proof and unsaved form state when a session ends; blocked clients can still securely log out.
- [x] Manage school account roles/access; verify branch ownership, protect master users/last owner, revoke old sessions/grants.
- [x] Audit master actions with actor, target, timestamp and reason.
- [x] Persistent account lock after five failures/15 minutes; persistent IP lock after 30 failures/15 minutes.
- [x] Exact IPv4/IPv6 manual IP blocking/unblocking with expiry and self-lockout prevention; normalize mapped addresses.
- [x] 12–128 character password limits, salted scrypt, five-session cap, session list/revoke others, Origin/CSRF and HttpOnly cookies.
- [x] CSV students, attendance, fees/balances, published results, staff and counts; scoped access, date/branch filters, formula escaping, explicit row cap.
- [x] Authenticated SSE refresh of master totals and school data; no reload over an edited form.
- [x] Deployed frontend-version notification with explicit update after forms are saved/closed.
- [x] Retain gradients, touch-sized controls and responsive phone/tablet layouts; checked Master Panel/form at 390px and security page at 768px without horizontal overflow.
- [x] Prepare private-schema Supabase migrations, verified TLS, restricted runtime role and empty-target transactional data transfer.
- [x] Configure selected-project Supabase MCP server and verify OAuth login status.
- [ ] Actual Supabase connection, schema migration, advisor checks and real PostgreSQL transfer/restore (requires runtime database connection and available account tools).
- [ ] Complete staging/browser acceptance across all roles/devices, all nine release gates, authentic WhatsApp/payment/email provider acceptance and production deployment.

Local tests establish their documented assertions, not live provider delivery or completed cloud deployment. Other feature gaps remain in BLOCKERS.md; this checklist does not close unrelated unfinished work.
