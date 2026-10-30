# Architecture

Node 24 + TypeScript + Fastify; same-origin cookie API and retained buildless frontend. PostgreSQL is the production database. PGlite runs the same SQL migrations in local development/tests without requiring Docker on this Windows host; production rejects PGlite. A PostgreSQL queue/outbox is the one job implementation; worker leases use SKIP LOCKED, and a crashed provider submission becomes uncertain rather than a blind resend.

Production file assets are private database bytea objects with metadata, limits and authorization on every download. This is durable with the database and included in its backup; no public attachment URLs. Large external object stores can be added behind the same API later.

Tenant keys are mandatory in queries, foreign keys and unique indexes. A shared policy intersects organization, branch membership, class/subject assignment, linked child and workflow state. Server roles are authenticated identity data. Client role/organization overrides are ignored/rejected.

Core normalized tables: organization, school, branch, academic year/term, identity/session/recovery token, branch/class assignment, guardian link, class/subject, student/enrollment/admission/transfer, attendance register/entries/revisions, homework/submission/feedback, assessment/marks/result publication, requests/decisions, invoices/orders/payments/allocations/receipts, notifications/audit, private files, provider accounts/senders/templates/consent/messages/attempts/webhook events/outbox/jobs. Ancillary structured operational records use a typed record registry; they must not bypass per-kind scope/validation.

Business transitions, audit and notification/outbox enqueueing happen in one transaction. Approved records require recorded corrections; production has no client mark-paid/delivered endpoints. Provider secrets remain environment references. Webhooks verify exact request bytes before durable storage. Callback IDs never create a tenant mapping.
