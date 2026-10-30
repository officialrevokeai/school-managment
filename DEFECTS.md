# Defects and release gaps

|ID|Severity|Reproduction / effect|Resolution / evidence|
|---|---|---|---|
|D01|Critical, fixed for implemented routes|Original localStorage/account switching could impersonate roles|Production web loads no demo scripts; real API sessions and direct isolation/revocation tests pass|
|D02|High, repaired in visible shell|WhatsApp hidden behind Messages|Explicit staff navigation, Home action, mobile destination and permission-filtered tabs; checked owner desktop/tablet/phone|
|D03|Critical, fixed in adapter design|Prototype sends/toasts/local state could be mistaken for provider delivery|Real adapter IDs and signed durable callbacks only; fixture ordering/consent/uncertain tests pass; live gate remains blocked|
|D04|Critical, fixed for implemented settlement|Client payment outcome could settle balance|Server totals, signature/fetched capture, atomic allocations/receipt and refund tests pass; real sandbox still pending|
|D05|High, fixed|Published result edits could erase reviewed values|Withdrawal snapshots/revision and fresh reapproval tests pass|
|G01|High, open|Lost provider-order response lacks complete operator discovery/reconciliation UI|Reservation stays uncertain and cannot be casually paid/replaced; implement provider-backed reconciliation before release|
|G02|Medium, open|Bounded list endpoints and incomplete filters can omit older records at scale|Complete cursor/date/year/search/sort coverage and declared load measurement needed|
|G03|Medium, open|Some APIs lack full transfer/adjustment/record-edit/term/acceptance UI controls|Feature checklist identifies unfinished controls; do not declare whole phases complete|
|G04|Medium, open|WhatsApp advanced templates, staff/student onboarding and newer account/identity variants unsupported|Conservative guardian/text-template path only; unsupported capabilities fail rather than simulate|
|V01|Release blocking, open|No authentic live messaging, real sandbox payment, SMTP or Linux restore/deployment evidence|Exact external configuration in setup guides/BLOCKERS.md; no production release|

No test assertions were weakened or removed to make failures pass. Initial TypeScript proxy typing, fixture email normalization and runner compatibility were corrected; test execution uses compiled Node JavaScript because tsx encountered a Windows sandbox userInfo error. Source and original prototype checks remain preserved.

Fixed during Account Add work: localhost routed to another IPv6 app while the backend listened on IPv4; private setup now explicitly uses 127.0.0.1. Added regression checks prevent principal approval counts from leaking financial requests and teacher homework counts from including unassigned subjects. Dashboard sparkline decoration is hidden so it cannot imply a data trend.

Resolved in concealed-master update: master navigation leaked into every owner workspace; development status repeated as a product banner; archive was labelled Remove and could be mistaken for deletion; school-login sessions could access master routes; stale dialogs could survive session revocation; expired SSE reconnection could leave private views visible; select labels and form errors had inconsistent accessibility/focus; forms could be discarded by navigation without confirmation. New irreversible deletion is separately labelled and requires two server-validated confirmations. Other gaps in BLOCKERS.md remain open.

Final phone screenshot also exposed an inherited two-column login grid and an icon color override. Both were corrected and rechecked at 390px/768px. Login card widths are now 358px/440px respectively.
