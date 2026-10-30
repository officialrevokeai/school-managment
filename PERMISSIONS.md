# Server access policy

Every role is restricted to its authenticated organization. Owner has organization-wide scope; principals and office staff require active branch assignments; teachers also require class/subject assignments; parents require verified guardian links; students require their user-student relation. Requests and private documents inherit the same checks.

|Role|Allowed operations|Restrictions|
|---|---|---|
|Owner|Organization schools, branches, users, assignments, academic/finance administration, senders, audit|Cannot escape tenant; required audit cannot be disabled|
|Principal|Assigned branch admissions/transfers/academic/leave decisions, announcements, operational reports|No global settings or financial mutation|
|Teacher|Assigned class/subject attendance, homework, materials, own marks drafts, feedback, own leave|No finance editing, self-approval, unrelated students|
|Office|Assigned branch admissions, invoices, accounting, authorized fee reminders|No academic mutation, permissions or principal approvals|
|Parent|Verified children, published learning, fees/payment, preferences, complaints, allowed submissions|No unrelated child, drafts, bulk sending or sender administration|
|Student|Own published academic records, submissions, preferences|Read-only fees; no payment initiation by default|

Each mutation also validates state. Decisions require comments and cannot approve the actor's own submission. Deactivation invalidates sessions and queued authorization. No production role switcher. Revoked memberships are read afresh, including by workers.

Custom roles refine a fixed base workspace using module/action grants. They cannot widen its protected owner-only, financial, organization, class or child boundaries. Assigning/editing grants and explicit restrictions requires owner confirmation, a reason and audit; restrictions apply to existing sessions immediately. Owner administrative actions already operate across their authorized organization, with state/self-approval/audit fences retained. No role can disable audit integrity.

Platform administrator is a separate platform_admins membership, not an owner role or user-editable claim. Platform routes recheck it in the database on every request. Owners retain only their organization. Master school controls expose aggregate counts, lifecycle and account roles; they do not impersonate another school user. Master membership is bootstrapped by the database operator and cannot be granted through school APIs. Suspended/archived organizations cannot authenticate; their sessions are revoked and actor checks block school jobs.

Master APIs additionally require a session issued through master sign-in (sessions.workspace=platform). The same owner credentials used for ordinary school login do not grant platform-route access in that session. Permanent deletion requires two separate requests, an exact organization code, a hashed expiring actor/session/target-bound proof, an exact final phrase and correct current master password. A master-containing organization cannot be purged. Tenant audit mutation remains blocked except for a tenant cascade after that organization is removed. Only a hashed deletion receipt is retained under the master organization.
