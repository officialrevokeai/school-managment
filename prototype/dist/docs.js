const PERMISSION_MATRIX=[
 {role:'Owner / Super Admin',scope:'All authorized schools & branches',view:'All modules',create:'All modules',edit:'All modules',approve:'All requests',export:'All scoped records',delete:'Archive + confirmation'},
 {role:'Principal',scope:'Assigned branches',view:'Campus & academic records',create:'Announcements, exams, cases, events',edit:'School announcements & cases',approve:'Admissions, transfers, academics, leave',export:'Campus & academic reports',delete:'None'},
 {role:'Teacher',scope:'Assigned classes & students',view:'Roster & academic records',create:'Work, materials, plans, own leave',edit:'Own academic drafts & feedback',approve:'None',export:'Assigned class records',delete:'None'},
 {role:'Parent',scope:'Currently selected linked child',view:'Published child records',create:'Leave, submissions & messages',edit:'Own preferences & submissions',approve:'None',export:'Child statements & documents',delete:'None'},
 {role:'Student',scope:'Own record only',view:'Own published records',create:'Allowed submissions & leave',edit:'Own preferences & submissions',approve:'None',export:'Approved documents only',delete:'None'},
 {role:'Office / Accountant',scope:'Assigned branch operations',view:'Admissions & authorized finance',create:'Admissions, finance & documents',edit:'Authorized financial records',approve:'No principal approvals',export:'Admissions & financial reports',delete:'Archive financial drafts'}
];
const COVERAGE=[];
function coverage(role,screen,items,status='Working demo'){items.split('\n').filter(Boolean).forEach(line=>{const [feature,action]=line.split('|');COVERAGE.push({feature,role,screen:TITLES[screen]||screen,route:screen,action:action||'Open, review, and record changes',status})})}
coverage('Shared','dashboard',`Responsive role-aware shell|Desktop sidebar, tablet rail, mobile bottom navigation
School identity and current role|Visible school badge and demo account
Page title, contextual search, year, notifications, profile|Top bar destinations and scope
Authorized multi-branch selector|Owner and assigned principal branch controls
Breadcrumbs and contextual actions|Deep-page breadcrumb and primary controls
Separate parent and student permissions|Six clearly labelled fictional accounts
Demo role switcher|Choose account; never presented as production authorization
Dashboard totals and alerts follow active scope|Recalculate and filter when scope changes`);
coverage('Shared','signin',`Sign-in screen|Choose demo account and validate credentials
Password recovery|Email form with explicit no-email-sent response
Session expired|Retain saved data and return to sign-in`);
coverage('Shared','denied',`Access-denied screen|Route guard and recovery account chooser`);
coverage('Shared','profile',`Profile, contact preferences and documents|Edit own contacts and download scoped documents
WhatsApp notification preferences|Save local preference with disconnected-service label`);
coverage('Shared','notifications',`Scoped in-app notifications|Unread count, open destination, mark as read`);
coverage('Owner','dashboard',`Global school network overview|Scoped totals and analytics
School and branch comparison|Campus performance table and branch detail
Student and staff totals|Enrolled and staff metrics
Attendance summaries|Campus aggregates and daily registers
Financial overview|Collections and branch drill-down
Pending approvals|Queue and linked review drawers
Recent activity|Actor, record, timestamp, scope
System alerts|Integration and reconciliation alerts`);
coverage('Owner','branches',`Schools and branches list, search and filters|Find campus by school, name, city or status
Add, view, edit and deactivate branches|Branch form, detail, confirmation, retained records
School identity and branch addresses|School field supports multiple school identities
Assign and remove principals|Edit branch assignment; update authorized principal scope
Branch detail pages|Enrollment, staff, principal, address and actions
Branch-specific settings and reports|Settings drawer and scoped report builder
Core flow 1: branch → principal → permissions|Create campus, assign principal, open permissions`);
coverage('Owner','users',`Manage principals, teachers, parents, students and office staff|Role-aware user directory and form
Invite and create user accounts|Local invitation record, no email delivery claimed
Edit roles and branch assignments|User edit form and assigned class metadata
Deactivate and reactivate access|Confirmation and audit history
User profiles and activity history|Details, status, role, branch and timeline`);
coverage('Owner','roles',`Create and edit roles|Custom role definition with grants
Permission matrix: view, create, edit, approve, export and delete|Baseline matrix; permanent deletion uses archive policy
Branch, class, child and record scope|Central scope function and policy matrix
Explicit permission overrides|Deny or restore baseline action with reason
Permission override confirmation and audit history|Review confirmation, actor, reason and timestamp`);
coverage('Owner','roles',`Custom role assignment and production authorization|Design records describe role grants; demo identities remain fixed`,'UI + design spec');
coverage('Owner / Office','finance',`Manage authorized financial records|Expenses, payments, fees, payroll and reconciliation
Consolidated financial reports|Owner report builder across campuses
Branch financial drill-down|Select branch before generating report
Financial adjustments with reasons and history|Amount change, verification reason and audit
Transaction and reconciliation history|Payment details, ledger and audit events`);
coverage('Owner','settings',`School identity and branding|Name, tagline and monogram
Academic years and terms|Year selector, term and academic preferences
Global preferences and module configuration|Module policy definitions
Configurable currency, timezone and date preferences|INR and DD MMM YYYY; timezone choices
Security and data privacy preferences|Two-factor, session and retention design policies
Notification policies|Teacher messaging, absence requests and channels
Local demo backup and recovery|Download and restore JSON snapshot
Activity tracking|Owner audit trail with scoped exports`);
coverage('Owner','settings',`Production backups and scheduled recovery|Server backup, encryption and disaster recovery integration
Production identity, security and privacy enforcement|Server sessions, access checks and operational policies
Production module enablement and background tasks|Saved policy preferences require backend enforcement`,'Integration required');
coverage('Principal','dashboard',`School overview and performance|Assigned-campus metrics
Attendance and discipline overview|Registers, wellbeing cases and alerts
Pending admissions and student transfers|Principal approval queue
Leave requests and approval comments|Scoped leave detail and decision history
Timetable and exam approvals|Academic queue and dedicated screens
Teacher review tasks|Teacher review form with follow-up
Parent complaints and meetings|Case management and meeting scheduling
School announcements|Create, select audience and publish`);
coverage('Principal','approvals',`Review, approve, reject, request changes|Submitted details, required comments and confirmation
Supporting documents|Preview samples; upload and download local files
Decision status and history|Recorded actor, comment and timestamp
Core flow 2: office admission → principal decision → student record|Approval adds student and updates branch total`);
coverage('Principal','academics',`Review teacher performance|Outcome, observations and follow-up
Review lesson plans|Objectives, resources, comments and decisions
Approve exam schedules and results|Published schedules and approved report cards
Review timetable changes|Proposal, supporting document and history`);
coverage('Principal','complaints',`Manage parent complaints|Open, in progress, resolved and response comments`);
coverage('Principal','meetings',`Manage parent meetings|Student, teacher, date, time and agenda`);
coverage('Principal','discipline',`Monitor discipline and wellbeing|Restricted case record and support plan`);
coverage('Principal','reports',`Daily and weekly owner reports|Date range, campus scope, generate, print and download
Permission-scoped reports|Financial reports excluded from principal account`);
coverage('Principal','announcements',`Core flow 7: publish announcement to selected audience|Draft → audience confirmation → published portal notice`);
coverage('Teacher','dashboard',`Today’s timetable and upcoming classes|Teaching plan and full weekly view
Attendance tasks|Class register entry point
Assignment submissions|Submission counts, reviews and feedback
Marks awaiting entry or approval|Draft and pending review states
Student progress alerts|Low-attendance check-ins and profiles
Announcements and leave status|Published notices and recorded leave decisions`);
coverage('Teacher','classes',`Class list, subjects and roster|Assigned Science classes 9 A and 9 B
Scoped student profiles|Parent contact, attendance and approved progress`);
coverage('Teacher','attendance',`Select class and date|Assigned class choices and date input
Present, absent, late and excused|Explicit per-student controls
Bulk marking|Mark all present
Save attendance draft|Resume local draft after reload
Submit attendance with validation|Every student must be marked
Permitted corrections|Reason required and prior entries audited
Core flow 3: teacher attendance → portals → communication history|Submit, scoped notifications, failed disconnected WhatsApp record`);
coverage('Teacher','homework',`Create and edit homework or classwork|Title, class, subject, instructions and due date
Attachments and deadlines|Validated file uploads and date fields
Assign and publish|Class audience and publish confirmation
Schedule homework|Local scheduled record and explicit Publish now control
Review student submissions|Answer, attachment downloads and feedback
Core flow 4: teacher publishes → parent and student view|Shared class-scoped published assignment`);
coverage('Teacher','marks',`Enter marks and feedback|Assessment roster and score fields
Validate maximum scores|Numeric validation between zero and maximum
Save marks drafts|Partial scores retained as draft
Submit marks for review|All scores required before submission
Track student progress|Approved average and attendance
Core flow 5: marks → principal approval → report card|Pending → approved → downloadable student report`);
coverage('Teacher','materials',`Study materials and notes|Upload, organize by subject/class and publish`);
coverage('Teacher','lessonplans',`Submit lesson plans for review|Objectives, activities, assessment and supporting resources`);
coverage('Teacher','communication',`Parent messaging through approved channels|Class-scoped in-app conversations and WhatsApp composer
Conversation history|Read and reply within permitted student scope
Class announcements|Restricted to assigned-class audience`);
coverage('Staff / Parent / Student','leave',`Request leave|Type, dates, reason and supporting documents
Track leave status and comments|Submitted details and decision history
Core flow 9: request leave → recorded approval|Create request, principal decides, requester reads response`);
coverage('Parent / Student','dashboard',`Linked-child and own-record portal|Parent switches only linked children; student only self
Attendance, homework, exams and fees overview|Child-scoped metric cards and module destinations
Timetable, announcements and upcoming events|Published school and class information`);
coverage('Parent / Student','attendance',`Attendance history and leave status|Daily registers and approved leave records
Permitted leave requests|Selected linked child only`);
coverage('Parent / Student','homework',`Homework, notices and allowed submissions|Instructions, files, answer entry and submission history
Teacher feedback|Recorded comments visible on own submission`);
coverage('Parent / Student','exams',`Exam timetable and results|Approved class schedules only
Download report cards|Approved assessments only`);
coverage('Parent / Student','fees',`Fee dues, balance and payment history|Child-specific statement and transaction statuses
Confirmed receipts|Download and print only for confirmed transactions
Review outstanding fee selection and amount|Choose student fees, review method and total
Payment processing state|Explicit Processing before outcome
Payment failed, cancelled and pending verification|No receipts and clear recovery destination
Core flow 6: fee review → demo gateway → confirmed receipt|Separate review, start, outcome and receipt steps`);
coverage('Parent / Student','fees',`Online fee payment integration|Prototype gateway uses explicitly chosen demo outcomes`,'Integration required');
coverage('Parent / Student','timetable',`Weekly timetable|Responsive deliberately scrollable schedule`);
coverage('Parent / Student','calendar',`Holidays and events|Date-labelled calendar cards and event details`);
coverage('Parent','communication',`Teacher messaging controlled by school permissions|Hidden portal messaging when disabled; inbox and replies`);
coverage('Parent / Student','documents',`Profile documents, downloadable reports and certificates|Scoped document directory and generated demonstration documents`);
coverage('Office / Accountant','dashboard',`Collections today and outstanding balances|Confirmed transaction and unpaid-fee metrics
Pending admissions and upcoming payments|Admission queue and upcoming dues
Expense summary, payroll and reconciliation alerts|Ledger, staff payroll, verification tasks`);
coverage('Office / Accountant','admissions',`Admission forms and records|Student, parent, class, date of birth and documents
Submit admission for principal approval|Draft → pending approval; decision history and return path`);
coverage('Office / Accountant','fees',`Fee collection and outstanding balances|Student search, item selection and collection record
Record payments and generate receipts|Confirmed collection reference required
Review payment history|Transaction method, reference and status`);
coverage('Office / Accountant','feeStructures',`Fee structures and collection schedules|Class, amount, frequency, due date and included services`);
coverage('Office / Accountant','discounts',`Discounts, scholarships and fines|Student-scoped adjustment record with authorization reason`);
coverage('Office / Accountant','discounts',`Application of concessions to outstanding fees|Select a fee, review the adjustment, confirm authorization, and retain before/after amounts`);
coverage('Office / Accountant','expenses',`Expenses and invoices|Amount, vendor, category, date, reason and invoice attachments
Financial adjustment and verification|Reason, bank reference and audit history`);
coverage('Office / Accountant','vendors',`Vendor records|Contact details, category, notes and status`);
coverage('Office / Accountant','payroll',`Staff payroll and expense records|Draft, approval review and verified paid record
Real payroll transfers|Payment references record prior transfers; no money moved`,'UI + design spec');
coverage('Office / Accountant','documents',`Certificates, receipts and reports|Create certificates, print, download and scoped exports`);
coverage('Owner / Principal / Teacher / Office','communication',`Automatic pending-fee reminders|Audience selection, template, schedule and monitoring record
Selected-group notifications|Group or individual recipients with exact count
Manual and scheduled sends|Preview and confirm, failed attempts or local scheduled requests
Attendance message tracking|Absence-generated communication records with failure reasons
Exam, holiday and event alerts|General template variables and authorized categories
School / branch selection within scope|Owner selector; other roles fixed to active branch
Search recipients|Names and guardians, individual checkboxes
Template and variable fields|Preview final composed message
Authorized sender selection|Branch and message-category checks
Review before sending|Audience, sender, count, schedule and final content
Bulk and individual messaging|Scoped parent, student, staff, and individual groups with per-recipient status
Sent, scheduled, failed and cancelled states|Status filters; no fabricated successful delivery
Failure reasons and failed-recipient retry|Retry skips successful recipients
Filter by branch, sender, audience, date and status|Global scope plus message history controls
Setup-required, disconnected and service failure|Explicit sender and composer states
Core flow 8: sender → fee reminder schedule → monitoring|Owner configures, accountant composes, history shows local schedule`);
coverage('Owner','senders',`Manage multiple sender numbers|Add and edit number, branch and categories
Change default sender|Confirmation and audit event
Category-specific sender routing|Fees, general, attendance, exams, holidays, events
Masked credentials and restricted administration|No actual provider secrets accepted
Messaging permission controls|Role/category restrictions and school messaging toggle`);
coverage('Owner','templates',`Custom message templates|Name, category and variable-based body`);
coverage('Shared','communication',`Real WhatsApp sending, automation, delivery and read receipts|Disconnected; requires approved provider and background scheduler
Reply tracking on WhatsApp|Provider integration required; in-app demo history is functional`,'Integration required');
coverage('Shared','audit',`Audit actor, action, time and school/branch|Scoped history and exports
Reasons and before/after values|Status, permission and financial change history`);
coverage('Shared','design',`Reusable search, filters, sort and clear-all|Operational toolbar patterns
Pagination and readable table scrolling|Seven-row pages on general records
Academic-year and date-range filters|Current year, archived-year empty state, report range
Permission-controlled actions and exports|Central checks plus scope filtering
Detail pages and drawers|Records, supporting documents and history
Create and edit forms|Persistent labels, native constraints, contextual error text
File upload, validation, preview, download and removal|File type hints, size/count checks, sample and uploaded-file previews
Confirmations and reversible archiving|Explicit consequences, retained audit and archive restoration
Status chips and helpful empty states|Readable text; semantic color supplements labels
Unsaved-change protection|Modal dismissal, navigation and browser-leave guard
Accessible dialogs and focus management|Role, modal state, focus trap, escape and return focus
Keyboard focus and navigation|Visible focus, skip link and tab controls
Responsive desktop, tablet and mobile|1440px full sidebar, 768px rail, 390px bottom nav
44px primary touch targets and contrast|Control sizing, token definitions and component reference
Default, hover, pressed, selected and disabled states|CSS interactions and component gallery
Loading, empty, validation, failure and success states|State gallery and functional workflow outcomes
Reduced-motion support|Animation and transition override
Indian names, INR and DD MMM YYYY|Consistent demo dataset and formatting
Core workflow destinations|Records stay accessible after completing each action`);
const CORE_FLOWS=[
 ['Branch setup','Owner','branches','Create branch → assign an existing principal → review campus → configure permission scope.','Branch form validates required fields; assignment is recorded; permission changes require a reason.'],
 ['Admission decision','Office → Principal','admissions','Save admission draft → submit for approval → principal reviews documents and comments → approve, reject, or request changes.','Approval adds the student to the directory, increases campus enrollment, and records history.'],
 ['Daily attendance','Teacher → Principal / Parent','attendance','Select class/date → mark or bulk mark → save draft or submit → inspect notifications and communication history.','All students must be marked. Corrections require a reason. Absent requests show service-disconnected failures.'],
 ['Homework','Teacher → Student / Parent','homework','Create assignment → add files and deadline → publish → portal opens assignment → submit → teacher gives feedback.','Only matching classes see published work. Drafts and scheduled demo requests stay out of portals.'],
 ['Results','Teacher → Principal → Student','marks','Enter scores → validate maximum → save draft or submit → principal approves → portal downloads report card.','Approved marks are locked; report-card download uses approved assessments only.'],
 ['Fee payment','Parent → Demo gateway','fees','Select fee items → review amount/method → continue → Processing → choose demo outcome → download confirmed receipt.','Failed, cancelled, and pending-verification outcomes never produce receipts. Real payment service is disconnected.'],
 ['Announcement','Principal → Audience','announcements','Create draft → select audience → review → confirm publication → portal sees matching notice.','Class and staff audiences are filtered; publishing creates a scoped activity record.'],
 ['Fee reminders','Owner → Accountant','communication','Configure sender/categories → compose fee reminder → group or individuals → preview count → future schedule → monitor.','Schedules are local requests. Manual attempts fail transparently while the service is disconnected.'],
 ['Leave request','Staff / Parent → Principal','leave','Choose leave type/dates → add reason and document → submit → principal records decision → requester reads history.','End date must follow start date. Every approval, rejection, and change request retains comments.']
];
function sitemapHTML(){return `<div class="doc-module">${Object.keys(NAV).map(r=>`<section class="panel flat"><h3>${ROLE_NAMES[r]}</h3><p class="muted text-small">${PERMISSION_MATRIX.find(x=>x.role===ROLE_NAMES[r])?.scope||'Linked child / own record'}</p>${[...new Set([...NAV[r].map(x=>x[0]),...EXTRA[r],'profile','notifications'])].map(m=>`<button class="btn small" style="margin:3px" data-action="sitemapGo" data-id="${r}:${m}">${TITLES[m]}</button>`).join('')}</section>`).join('')}</div><div class="panel flat mt"><h3>Shared authentication & utility routes</h3>${[['signin','Sign-in'],['recovery','Password recovery'],['expired','Session expired'],['denied','Access denied']].map(([r,t])=>link(t,r,'small')).join(' ')}</div>`}
function coverageHTML(){return table(['Roadmap feature','Role','Screen / route','Action / behaviour','Status'],COVERAGE.map(c=>`<tr><td>${esc(c.feature)}</td><td>${esc(c.role)}</td><td>${esc(c.screen)}<small>/${c.route}</small></td><td>${esc(c.action)}</td><td>${status(c.status)}</td></tr>`),'coverage-table')}
function designSystemHTML(){
 const tokens=[['Application','#F2F3F7'],['Card','#F7F8FB'],['Elevated','#FFFFFF'],['Primary text','#17181C'],['Secondary text','#626775'],['Boundary','#DDE1E9'],['Purple accent','#7C5CFC'],['Blue accent','#4F7DFF']];
 return panel('A calm visual foundation',`<p class="muted">Neutral surfaces carry the product. Purple and blue identify selected or focused states; operational content remains crisp.</p><div class="token-grid">${tokens.map(([n,v])=>`<div class="token"><div class="swatch" style="background:${v};border:1px solid #d9dde5"></div><b>${n}</b><br>${v}</div>`).join('')}</div><div class="detail-grid"><div><h3>Typography</h3><p>Inter / Arial · 10 / 11 / 13 / 16 / 20 / 28 / 32 px. Normal copy uses charcoal; labels use medium weight. Finance uses tabular numerals.</p></div><div><h3>Spacing & surfaces</h3><p>8px rhythm · 12px controls · 18–24px cards. Dual shadows: 6px 6px 16px rgba(35,45,70,.08), −6px −6px 16px rgba(255,255,255,.85). Inset controls use subtle paired shadows.</p></div><div><h3>Responsive rules</h3><p>1440px: 248px sidebar and two-column workspace. 768px: 80px navigation rail and stacked dense content. 390px: compact header, 2-column metrics, record drawers and bottom navigation.</p></div><div><h3>Motion & accessibility</h3><p>180ms hover and press feedback. Reduced-motion overrides all animation. Persistent labels, text status, focus ring, modal trap, skip link, and readable boundaries.</p></div></div>`)+
 panel('Components & interaction states',`<div class="state-grid"><div><b>Default / hover / pressed</b>${button('Open sample record','detail','admissions:ad1','primary','plus')}</div><div><b>Secondary action</b>${button('View notifications','go','notifications','','bell')}</div><div><b>Selected</b><span class="badge accent">Selected navigation</span></div><div><b>Disabled</b>${button('Live send unavailable','noop','','','','disabled aria-describedby="disabled-note"')}<p id="disabled-note" class="muted text-small">WhatsApp service is disconnected.</p></div><div><b>Keyboard focus</b><input class="field" placeholder="Tab to focus" aria-label="Focus sample"></div><div><b>Loading</b><div class="skeleton"></div><div class="skeleton" style="width:65%"></div><span class="muted text-small" role="status">Loading sample</span></div><div><b>Empty</b><p class="muted text-small">No matches. Clear filters or add your first record.</p></div><div><b>Validation error</b><input class="field" aria-invalid="true" aria-label="Invalid email example" value="aarav@" style="border-color:#b86b64"><span class="error-text">Enter a valid email address.</span></div><div><b>Service failure</b>${status('Disconnected')}<p class="muted text-small">No message was sent.</p></div><div><b>Success</b>${status('Approved')}<p class="muted text-small">Decision recorded with comments.</p></div><div><b>Status labels</b>${status('Pending approval')} ${status('Published')} ${status('Rejected')}</div><div><b>Access denied</b>${link('Preview restriction','denied','small','lock')}</div></div>`)+
 panel('Reusable operational patterns',`<p>Search + status filter + sort + pagination. List → detail drawer → labelled form → validation → confirmation → recorded status and history → clear return destination.</p><p class="muted">Dense tables use boundaries, not repeated shadows. Important controls have text labels. Table wrappers intentionally scroll when record cards would hide useful comparisons.</p>`);
}
function designScreen(){
 const tab=activeTab||'sitemap';
 return heading('Designed for a calmer school day.','Complete structure, component rules, connected workflows, and honest implementation coverage.',button('Download reference','exportDesign','','','download'),'PRODUCT DESIGN REFERENCE')+
 `<div class="stats">${stat('Role workspaces','5','','6 demo accounts','users')}${stat('Module destinations',Object.keys(TITLES).length,'','role-scoped screens','layers')}${stat('Connected core flows','9','','with state changes','link')}${stat('Coverage items',COVERAGE.length,'','mapped to the brief','checkSquare')}</div>`+
 tabs([['sitemap','Sitemap'],['permissions','Permissions'],['system','Design system'],['flows','Core workflows'],['mobile','Responsive previews'],['coverage','Feature coverage']],tab)+
 (tab==='sitemap'?sitemapHTML():tab==='permissions'?panel('Role & permission matrix',table(['Role','Scope','View','Create','Edit','Approve','Export','Delete'],PERMISSION_MATRIX.map(r=>`<tr>${['role','scope','view','create','edit','approve','export','delete'].map(k=>`<td style="white-space:normal;min-width:140px">${esc(r[k])}</td>`).join('')}</tr>`)))+alertBox('Server contract','Enforce authenticated role grants and branch, class, child, and record ownership on every query, aggregate, download, and mutation in production. The frontend scope checks demonstrate this contract.'):tab==='system'?designSystemHTML():tab==='flows'?`<div class="doc-module">${CORE_FLOWS.map(([name,r,screen,path,notes],i)=>panel('0'+(i+1)+' · '+name,`<p><b>${r}</b></p><p>${path}</p><p class="muted">${notes}</p>${button('Open flow entry point','sitemapGo',({branches:'owner',admissions:'office',attendance:'teacher',homework:'teacher',marks:'teacher',fees:'parent',announcements:'principal',communication:'owner',leave:'teacher'}[screen])+':'+screen,'small','arrow')}`)).join('')}</div>`:tab==='mobile'?`<div class="cards">${['owner','principal','teacher','parent','office'].map(r=>`<section class="panel"><div class="panel-head"><h2>${ROLE_NAMES[r]}</h2>${icon(ACCOUNTS[r].icon)}</div><p class="muted text-small">Phone and tablet previews with clear navigation, readable controls, and responsive records.</p>${button('Open mobile preview','mobilePreview',r,'full','eye')}<div style="margin-top:8px">${button('Open tablet preview','tabletPreview',r,'full','eye')}</div></section>`).join('')}</div><div class="panel mt"><h2>Resize the live application</h2><p class="muted">At 1440px: full sidebar and two-column workspace. At 768px: navigation rail and stacked operational panels. At 390px: compact header and frequent destinations in the bottom bar. All routes use the same breakpoints and component rules.</p></div>`:panel('Every feature, accounted for',`${alertBox('Coverage status definitions','Working demo = local interaction and persistence. UI + design spec = represented controls or policy with a stated limit. Integration required = external service, background task, or production enforcement remains disconnected.')}<div class="mb">${button('Export coverage CSV','export','design','small','download')}</div>${coverageHTML()}`));
}
function designExport(){return documentHTML('School Management System v2.0 — Product design reference',`<p>Smart • Secure • Connected. Premium neutral neumorphism; responsive web application. Fictional Greenwood school network.</p><h2>Role sitemap</h2>${Object.keys(NAV).map(r=>`<h3>${ROLE_NAMES[r]}</h3><p>${[...new Set([...NAV[r].map(x=>x[0]),...EXTRA[r]])].map(m=>TITLES[m]).join(' · ')}</p>`).join('')}<h2>Permission matrix</h2>${table(['Role','Scope','View','Create','Edit','Approve','Export','Delete'],PERMISSION_MATRIX.map(r=>`<tr>${Object.values(r).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`))}<h2>Visual system</h2><p>Background #F2F3F7; cards #F7F8FB; elevated #FFFFFF; primary #17181C; secondary #626775; boundary #DDE1E9. Accent #7C5CFC to #4F7DFF. 8px spacing; 12px controls; 18–24px cards. Inter or comparable sans-serif; 180ms transitions; reduced-motion support.</p><h2>Core workflows</h2>${CORE_FLOWS.map(([n,r,screen,p,note],i)=>`<h3>${i+1}. ${n}</h3><p>${r}<br>Entry: /${screen}<br>${p}</p><p>${note}</p>`).join('')}<h2>Implementation boundary</h2><p>Browser-local state and fictional demo accounts. Authentication, payment providers, WhatsApp sending and receipts, automated schedules, operational backups and production server security are not connected. Demo receipts require explicit confirmed outcomes.</p><h2>Feature coverage — ${COVERAGE.length} items</h2>${coverageHTML()}`)}
