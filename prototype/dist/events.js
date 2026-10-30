function workspaceSearch(q){
 const query=q.trim().toLowerCase();if(!query)return toast('Enter a name, record, or module to search.');
 const modules=[...new Set([...NAV[role].map(x=>x[0]),...EXTRA[role]])].filter(k=>allowedRoute(k)&&TITLES[k].toLowerCase().includes(query));
 const kinds=Object.keys(db).filter(k=>Array.isArray(db[k])&&allowedRoute(k)&&!['audit','notifications','senders','conversations','attendance','calendar','messages'].includes(k));
 const matches=kinds.flatMap(k=>scope(db[k],k).filter(x=>x.status!=='Archived'&&String(x.name||'').toLowerCase().includes(query)).map(x=>({kind:k,record:x}))).slice(0,15);
 modal('Search your workspace',`<p class="muted text-small">Results inherit your active branch and record scope.</p>${modules.length?`<h3>Modules</h3><div class="check-list">${modules.map(k=>button(TITLES[k],'searchGo',k,'full','folder')).join('')}</div>`:''}<h3>Records</h3>${matches.map(({kind:k,record:r})=>`<div class="document">${icon('file')}<div><b>${esc(r.name)}</b><small>${TITLES[k]} · ${r.class||branchName(r.branch||r.id)}</small></div>${button('Open',k==='students'?'studentDetail':k==='branches'?'branchDetail':'detail',k==='students'||k==='branches'?r.id:k+':'+r.id,'small','chevron')}</div>`).join('')||empty('No record matches','Try a student name, assignment title, or module name.')}`,'Contextual search · '+esc(q));
}
function authorizedBranches(){if(role==='owner')return db.branches.map(b=>b.id);const user=db.users.find(u=>u.name===account().name);return role==='principal'?user?.branches||[account().branch]:[account().branch]}
function senderForm(id=''){
 if(role!=='owner')return toast('Sender administration is restricted to the owner.');
 const r=db.senders.find(s=>s.id===id)||{};
 modal(id?'Configure sender':'Add WhatsApp sender',`<form id="sender-form" data-record="${id}"><div class="form-grid">${formField('name','Sender label','text',r.name||'')}${formField('number','Sender phone number','tel',r.number||'')}${formField('branch','Branch','branch',r.branch==='all'?'b1':r.branch||'b1')}<div class="form-field"><label>Connection</label><div class="field">${r.status||'Setup required'}</div><small>Live provider credentials must be configured on a production server. Do not enter secrets here.</small></div><div class="form-field wide"><label>Authorized message categories</label><div class="check-list">${['Fees','General','Attendance','Exams','Holidays','Events'].map(c=>`<label class="check-row"><input name="category" value="${c}" type="checkbox" ${r.categories?.includes(c)?'checked':''}>${c}</label>`).join('')}</div></div></div><div class="error-text" id="form-error"></div><div class="form-actions">${button('Cancel','close')}${button('Save sender configuration','submit','','primary','check','type="submit"')}</div></form>`,'Credentials remain masked · sender stays disconnected in this prototype.');
}
function downloadAttachment(kind,id,index){
 const r=record(kind,id),a=r?.attachments?.[+index];if(!a||!allowedRoute(kind))return toast('Attachment unavailable in this scope.');
 if(a.sample){modal('Sample document preview',alertBox('Illustrative supporting document','This sample represents a '+esc(a.name)+' attachment in the school’s review workflow.')+`<div class="panel flat"><h3>${esc(a.name)}</h3><p>Record: ${esc(r.name||r.type)}<br>School: ${esc(db.settings.school)}<br>Branch: ${branchName(r.branch)}</p><p class="muted text-small">This is a fictional document preview. Upload your own demo file to test file downloads.</p></div>`,'Document review · sample content');return}
 const link=document.createElement('a');link.href=a.data;link.download=a.name;link.click();
}
async function handleAction(a,id,el){
 const [kind,rid,index]=id.split(':');
 switch(a){
 case 'go':navigate(id);break;
 case 'dashboardView':localStorage.setItem(VERSION+'-dashboard-'+role,id==='detailed'?'detailed':'simple');render();break;
 case 'searchGo':closeModal(true);navigate(id);break;
 case 'sitemapGo':if(ACCOUNTS[kind]){role=kind;branch=account().branch;child=account().children?.[0]||'s1';localStorage.setItem(VERSION+'-role',role);closeModal(true);navigate(rid);render()}break;
 case 'restoreRecord':{const r=record(kind,rid);if(r&&(role==='owner'||can('archive',kind,r)))changeStatus(kind,rid,MODULES[kind]?.initial||'Draft','Restored from archive');break}
 case 'close':closeModal();break;
 case 'roles':modal('Your school. Different perspectives.',`<div class="alert neutral">${icon('info')}<div><b>Demo account switcher</b><p>Review roles with fictional records. A production user cannot change permissions using a selector.</p></div></div><div class="role-grid">${Object.entries(ACCOUNTS).map(([r,u])=>`<button class="role-card" data-action="switchRole" data-id="${r}"><span class="avatar ${role===r?'purple':''}">${u.initials}</span><span><b>${ROLE_NAMES[r]}</b><small>${u.name}</small></span>${role===r?icon('check'):''}</button>`).join('')}</div>`,'Five workspaces · six accounts including separate parent and student access.');break;
 case 'switchRole':
  if(!ACCOUNTS[id])break;if(overlayDirty&&!confirm('Discard unsaved changes and switch demo account?'))break;
  role=id;branch=role==='owner'?'all':account().branch;child=account().children?.[0]||'s1';classFilter='9 A';attendanceDraft={};localStorage.setItem(VERSION+'-role',role);closeModal(true);route='dashboard';search='';filter='All';activeTab='';location.hash='#/dashboard';render();toast(ROLE_NAMES[role]+' demo workspace opened.');break;
 case 'create':createForm(id);break;
 case 'edit':createForm(kind,rid);break;
 case 'detail':openDetail(kind,rid);break;
 case 'createBranch':branchForm();break;
 case 'branchDetail':branchDetail(id);break;
 case 'editBranch':branchForm(id);break;
 case 'openBranch':if(role==='owner'&&db.branches.some(b=>b.id===id)){branch=id;closeModal(true);navigate('dashboard');render()}break;
 case 'branchReports':if(role==='owner'){branch=id;closeModal(true);navigate('reports');render()}break;
 case 'branchSettings':if(role==='owner'){const b=db.branches.find(b=>b.id===id);modal('Branch settings · '+esc(b.name),`<form id="branch-settings" data-record="${id}">${formField('phone','Campus phone','tel',b.phone||'')}<div class="mt">${formField('notes','Campus operational preferences','textarea',b.notes||'Standard school preferences apply.')}</div><div class="form-actions">${button('Save branch settings','submit','','primary','check','type="submit"')}</div></form>`)}break;
 case 'branchPermissions':closeModal(true);navigate('roles');render();toast('Configure roles and scope for '+branchName(id)+'.');break;
 case 'toggleBranch':if(role==='owner'){const b=db.branches.find(b=>b.id===id);if(confirm((b.status==='Active'?'Deactivate':'Reactivate')+' '+b.name+'? Existing records are retained.')){let old=b.status;b.status=b.status==='Active'?'Inactive':'Active';audit('Changed campus availability',b.name,old,b.status,b.id);persist();closeModal(true);render();toast('Campus status updated.')}}break;
 case 'studentDetail':studentDetail(id);break;
 case 'classRoster':classFilter=id;navigate('students');break;
 case 'export':exportRows(id);break;
 case 'clearFilters':search='';filter='All';sort='newest';page=1;window.messageDate='';window.messageSender='';window.messageAudience='';render();break;
 case 'page':page=+id;render();break;
 case 'tab':activeTab=id;search='';filter='All';page=1;render();break;
 case 'currentYear':db.academicYear='2026–27';persist();render();break;
 case 'print':window.print();break;
 case 'decision':{
  const f=document.getElementById('decision-form');if(!f||!f.reportValidity())break;const k=f.dataset.kind,r=record(k,f.dataset.record);if(!r||!can('approve',k,r))return toast('Approval is outside your scope.');
  const comment=f.elements.comment.value.trim();if(!comment)return formError('Add decision comments so the submitter understands the outcome.');
  if(!confirm(id+' this '+TITLES[k].toLowerCase()+' request? The decision and comments will be recorded.'))break;
  changeStatus(k,r.id,id,comment);break;
 }
 case 'submitApproval':{const r=record(kind,rid);if(!r||!can('edit',kind,r))break;changeStatus(kind,rid,'Pending approval','Submitted for review');break}
 case 'publish':{const r=record(kind,rid);if(!r||!can('publish',kind,r))break;if(confirm('Publish '+r.name+' to '+(r.audience||'Class '+r.class)+'?'))changeStatus(kind,rid,'Published','Published to authorized audience');break}
 case 'scheduleHomework':{const r=record('homework',id);if(!r||!can('publish','homework',r))break;modal('Schedule assignment',`<form id="homework-schedule" data-record="${id}">${formField('schedule','Publish on','datetime-local',r.schedule||'')}${alertBox('Local schedule record','There is no background publisher in this prototype. Use Publish now from the assignment when reviewing the flow.')}<div class="form-actions">${button('Save schedule','submit','','primary','clock','type="submit"')}</div></form>`);break}
 case 'archive':{const r=record(kind,rid);if(!r||!(role==='owner'||can('archive',kind,r)))break;if(confirm('Archive '+r.name+'? It will be removed from active lists; the record and audit history are retained.'))changeStatus(kind,rid,'Archived','Reversible archive');break}
 case 'attachment':downloadAttachment(kind,rid,index);break;
 case 'removeAttachment':{const r=record(kind,rid);if(!r||!can('edit',kind,r))break;if(confirm('Remove this attachment from the demo record?')){const f=r.attachments.splice(+index,1)[0];audit('Removed attachment',r.name,f?.name,'Removed',r.branch);persist();openDetail(kind,rid);toast('Attachment removed.')}break}
 case 'toggleUser':{if(role!=='owner')break;const r=record('users',id);let old=r.status;if(confirm((r.status==='Inactive'?'Activate':'Deactivate')+' access for '+r.name+'? Their records are retained.')){r.status=r.status==='Inactive'?'Active':'Inactive';r.history??=[];r.history.push({who:account().name,action:'Access '+r.status,date:now()});audit('Changed user access',r.name,old,r.status,r.branch);persist();openDetail('users',id);render();}break}
 case 'markAttendance':{if(!can('mark','attendance'))break;const s=scope(db.students,'students').find(s=>s.id===kind&&s.class===classFilter);if(!s)break;attendanceDraft[attendanceKey()][kind]=rid;window.registerDirty=true;render();break}
 case 'bulkPresent':if(can('mark','attendance')){scope(db.students,'students').filter(s=>s.class===classFilter).forEach(s=>attendanceDraft[attendanceKey()][s.id]='Present');window.registerDirty=true;render();toast('All students marked present. Save or submit to record changes.')}break;
 case 'saveAttendance':attendanceSave(false);break;
 case 'submitAttendance':attendanceSave(true);break;
 case 'openRegister':{const r=record('attendance',id);if(r){classFilter=r.class;attendanceDate=r.date;render()}}break;
 case 'attendanceExport':{if(!can('export','attendance'))break;let rows=scope(db.attendance,'attendance');if(isPortal())rows=rows.map(r=>({...r,entries:{[child]:r.entries[child]}}));download('attendance-register.json',JSON.stringify(rows,null,2),'application/json');toast('Scoped register downloaded.');break}
 case 'enterMarks':enterMarks(id);break;
 case 'saveMarks':saveMarks(id);break;
 case 'submitWork':submitWork(id);break;
 case 'reviewWork':{const h=record('homework',kind),s=h?.submissions[+rid];if(!h||!s||!can('edit','homework',h))break;modal('Review · '+esc(studentName(s.student)),`<div class="panel flat"><p style="white-space:pre-wrap">${esc(s.text)}</p></div>${s.attachments?.map((a,i)=>`<div class="document">${icon('file')}<b>${esc(a.name)}</b>${button('Download','submissionAttachment',kind+':'+rid+':'+i,'small','download')}</div>`).join('')||''}<form id="feedback-form" data-homework="${kind}" data-index="${rid}" class="mt">${formField('feedback','Feedback for the student','textarea',s.feedback||'')}<div class="form-actions">${button('Save feedback','submit','','primary','check','type="submit"')}</div></form>`,'Submission history · '+s.date);break}
 case 'submissionAttachment':{const h=record('homework',kind),s=h?.submissions[+rid],f=s?.attachments[+index];if(!f||!can('edit','homework',h))break;const a=document.createElement('a');a.href=f.data;a.download=f.name;a.click();break}
 case 'payFees':paymentChoose(id,false);break;
 case 'recordPayment':paymentChoose(id,true);break;
 case 'startPayment':startPayment();break;
 case 'paymentStatus':paymentStatus(id);break;
 case 'paymentReturn':closeModal(true);navigate('fees');render();break;
 case 'receipt':receipt(id);break;
 case 'downloadReceipt':{const p=record('payments',id);if(!p||p.status!=='Confirmed')return toast('Only confirmed payments have receipts.');download(p.id+'.html',documentHTML('Payment receipt · '+p.id,`<h2>${money(p.amount)}</h2><p>Student: ${esc(studentName(p.student))}<br>Paid on: ${date(p.date)}<br>Method: ${esc(p.method)}<br>Reference: ${esc(p.reference)}<br>Status: Confirmed (demo)<br>Campus: ${branchName(p.branch)}</p><p>No real funds were processed.</p>`));toast('Demonstration receipt downloaded.');break}
 case 'feeStatement':{download('fee-statement.html',documentHTML('Fee statement',table(['Fee item','Student','Amount','Due date','Status'],scope(db.fees,'fees').map(f=>`<tr><td>${esc(f.name)}</td><td>${studentName(f.student)}</td><td>${money(f.amount)}</td><td>${date(f.due)}</td><td>${f.status}</td></tr>`))));break}
 case 'documentDownload':{const d=record('documents',id);if(!d||!allowedRoute('documents'))return toast('Document outside your scope.');if(d.attachments?.[0]&&!d.attachments[0].sample)return downloadAttachment('documents',id,0);download(d.name.toLowerCase().replace(/\W+/g,'-')+'.html',documentHTML(d.name,`<p>Student: <b>${esc(studentName(d.student))}</b><br>Campus: ${branchName(d.branch)}<br>Issued on: ${date(d.date)}</p><p>${esc(d.notes||'Issued for the student’s educational records.')}</p>`));toast('Demonstration document downloaded.');break}
 case 'reportCard':{const m=record('marks',id);if(!m||m.status!=='Approved'||!isPortal())return toast('Approved report cards are available in student portals.');download('report-card-'+child+'.html',documentHTML('Student report card',`<p><b>${esc(studentName(child))}</b> · Class ${studentClass()}<br>Academic year ${db.academicYear}</p><table><tr><th>Assessment</th><th>Marks</th><th>Status</th></tr>${scope(db.marks,'marks').filter(m=>m.status==='Approved').map(m=>`<tr><td>${esc(m.name)}</td><td>${m.scores[child]??'—'} / ${m.max}</td><td>Approved</td></tr>`).join('')}</table><p>${esc(m.feedback)}</p>`));toast('Approved demonstration report card downloaded.');break}
 case 'compose':composeMessage(id);break;
 case 'confirmMessage':if(messageDraft&&can('message','communication')){db.messages.unshift(messageDraft);audit('Recorded communication request',messageDraft.name,'Draft',messageDraft.status,messageDraft.branch);persist();const mid=messageDraft.id;messageDraft=null;render();messageDetail(mid);toast('Communication status recorded. No external message sent.');}break;
 case 'messageDetail':messageDetail(id);break;
 case 'cancelMessage':{const m=record('messages',id);if(!m||isPortal()||!can('message','communication'))break;if(confirm('Cancel this scheduled request? No recipients will be contacted.')){m.status='Cancelled';audit('Cancelled message schedule',m.name,'Scheduled (demo)','Cancelled',m.branch);persist();render();messageDetail(id)}break}
 case 'retryMessage':{const m=record('messages',id);if(!m||isPortal()||!can('message','communication'))break;let failed=m.delivery.filter(d=>d.status==='Failed');if(!failed.length)return toast('No failed recipients to retry.');if(confirm('Retry '+failed.length+' failed recipients only? Successful recipients will be skipped.')){failed.forEach(d=>d.reason='Retry blocked: service still disconnected. No message sent.');audit('Retried failed recipients',m.name,failed.length+' failed','Service disconnected; successes excluded',m.branch);persist();messageDetail(id);toast('Retry failed: WhatsApp service is disconnected.')}break}
 case 'addSender':senderForm();break;
 case 'editSender':senderForm(id);break;
 case 'defaultSender':if(role==='owner'&&confirm('Use this number as the default WhatsApp sender? Category permissions still apply.')){db.senders.forEach(s=>s.default=s.id===id);audit('Changed default WhatsApp sender',db.senders.find(s=>s.id===id)?.name,'Previous default',id);persist();render();toast('Default sender preference updated.')}break;
 case 'conversation':conversation(id);break;
 case 'startConversation':{const s=scope(db.students,'students').find(s=>s.id===id);if(!s||role!=='teacher'||!db.settings.messaging)break;let c=db.conversations.find(c=>c.student===id&&c.teacher===account().name);if(!c){c={id:uid('cv'),branch:s.branch,student:s.id,teacher:account().name,messages:[]};db.conversations.push(c);persist()}conversation(c.id);break}
 case 'backup':if(role==='owner'){audit('Exported demo snapshot','Network demo state','','JSON snapshot');persist();download('school-demo-snapshot.json',JSON.stringify({version:VERSION,exported:now(),data:db},null,2),'application/json');toast('Demo snapshot downloaded.')}break;
 case 'reset':if(role==='owner'&&confirm('Reset all local demo records? This replaces your edits with the original fictional data. Download a snapshot first if you need those edits.')){db=structuredClone(SEED);persist();closeModal(true);render();toast('Demo records reset.')}break;
 case 'permissionOverride':if(role==='owner')modal('Explicit permission override',`<form id="override-form"><div class="form-grid">${formField('role','Demo account role','permissionRole','teacher')}${formField('module','Module','permissionModule','homework')}${formField('action','Action','action','create')}<div class="form-field"><label for="f-allowed">Override</label><select name="allowed" id="f-allowed" class="field"><option value="false">Deny this action</option><option value="true">Restore baseline rule</option></select></div>${formField('reason','Reason for override','textarea','')}</div><div class="form-actions">${button('Confirm override','submit','','primary','shield','type="submit"')}</div></form>`,'Overrides can restrict baseline grants; they cannot expand scope.');break;
 case 'roleGrants':createForm('roles',id);break;
 case 'applyConcession':{
  const r=record('discounts',id);if(!r||!can('edit','discounts',r)||r.appliedTo)break;
  const fees=scope(db.fees).filter(f=>f.student===r.student&&f.status!=='Paid');
  modal('Apply '+esc(r.type).toLowerCase(),`<form id="concession-form" data-record="${id}"><p>${esc(studentName(r.student))} · ${esc(r.name)} · <b>${money(r.amount)}</b></p><div class="form-field"><label for="concession-fee">Outstanding fee item</label><select name="fee" id="concession-fee" class="field" required><option value="">Choose a fee item</option>${fees.map(f=>`<option value="${f.id}">${esc(f.name)} · ${money(f.amount)}</option>`).join('')}</select></div><div class="mt">${formField('reason','Authorization / reason for application','textarea',r.notes||'')}</div><div class="error-text" id="form-error" role="alert"></div><div class="form-actions">${button('Review & apply','submit','','primary','percent','type="submit"')}</div></form>`,'Fine increases the fee; discounts and scholarships reduce it. Paid fees are excluded.');break;
 }
 case 'notificationOpen':{const n=scope(db.notifications).find(n=>n.id===id&&n.roles.includes(role)&&(!isPortal()||!n.student||n.student===child));if(n){n.read=true;persist();navigate(n.route);render()}}break;
 case 'readNotifications':scope(db.notifications).filter(n=>n.roles.includes(role)&&(!isPortal()||!n.student||n.student===child)).forEach(n=>n.read=true);persist();render();toast('Your notifications are marked as read.');break;
 case 'adjustExpense':case 'reconcile':{const r=record('expenses',id);if(!r||!can('edit','expenses',r))break;modal(a==='reconcile'?'Reconcile expense':'Adjust financial record',`<form id="expense-action" data-record="${id}" data-operation="${a}">${a==='adjustExpense'?formField('amount','New amount (INR)','number',r.amount):formField('reference','Bank / statement reference','text','')}<div class="mt">${formField('reason','Reason / verification notes','textarea','')}</div><div class="form-actions">${button('Record authorized change','submit','','primary','check','type="submit"')}</div></form>`,'Original values, reason, and actor are retained in the audit trail.');break}
 case 'payrollPayment':{const r=record('payroll',id);if(!r||!can('edit','payroll',r)||r.status!=='Approved')break;modal('Record payroll payment',`<form id="payroll-payment" data-record="${id}">${alertBox('Record keeping only','This form does not transfer funds. Enter a verified payment reference.')}${formField('reference','Bank payment reference','text','')}<div class="form-actions">${button('Record paid status','submit','','primary','check','type="submit"')}</div></form>`);break}
 case 'resolve':{const r=record(kind,rid);if(!r||!can('edit',kind,r))break;modal('Resolution & follow-up',`<form id="resolution-form" data-kind="${kind}" data-record="${rid}">${formField('status','Case status','replyStatus',r.status)}<div class="mt">${formField('comment','Response and next steps','textarea','')}</div><div class="form-actions">${button('Save response','submit','','primary','message','type="submit"')}</div></form>`);break}
 case 'teacherReview':{const r=record('users',id);if(!r||!['owner','principal'].includes(role))break;modal('Teacher review · '+esc(r.name),`<form id="teacher-review" data-record="${id}">${formField('review','Review outcome','review',r.reviews?.at(-1)?.review||'Satisfactory')}<div class="mt">${formField('comment','Observations & follow-up','textarea',r.reviews?.at(-1)?.comment||'')}</div><div class="form-actions">${button('Record teacher review','submit','','primary','check','type="submit"')}</div></form>`);break}
 case 'profileEdit':modal('Contact preferences',`<form id="profile-edit">${formField('email','Contact email','email',db.profilePrefs?.[role]?.email||'demo@greenwood.example.test')}<div class="mt">${formField('phone','Contact number','tel',db.profilePrefs?.[role]?.phone||'+91 90000 10001')}</div><div class="form-actions">${button('Save contact details','submit','','primary','check','type="submit"')}</div></form>`,'Saves demo contact details only.');break;
 case 'reportGenerate':document.querySelector('#report-form button[type=submit]')?.click();break;
 case 'selectReport':{const s=document.querySelector('#report-form [name=reportType]');if(s){s.value=id;toast('Report selected: '+id);s.focus()}break}
 case 'designTab':activeTab=id;render();break;
 case 'exportDesign':download('school-management-design-reference.html',designExport(),'text/html');toast('Design reference downloaded.');break;
 case 'tabletPreview':modal('Tablet workspace · '+ROLE_NAMES[id],`<iframe title="768px ${ROLE_NAMES[id]} prototype" src="./index.html?preview=${id}#/dashboard" style="width:768px;max-width:100%;height:720px;border:1px solid var(--line);border-radius:18px;background:#f2f3f7"></iframe>`,'Live responsive prototype at 768px','large viewport-modal');break;
 case 'mobilePreview':modal('Mobile workspace · '+ROLE_NAMES[id],`<iframe title="390px ${ROLE_NAMES[id]} prototype" src="./index.html?preview=${id}#/dashboard" style="width:390px;max-width:100%;height:720px;border:1px solid var(--line);border-radius:22px;background:#f2f3f7"></iframe>`,'Live responsive prototype at 390px');break;
 }
}
async function handleSubmit(form){
 const fd=new FormData(form),val=k=>String(fd.get(k)||'').trim();
 switch(form.id){
 case 'global-search-form':workspaceSearch(document.getElementById('global-search').value);break;
 case 'record-form':await saveRecord(form);break;
 case 'branch-form':{
  if(role!=='owner')break;let old=db.branches.find(b=>b.id===form.dataset.record),principal=db.users.find(u=>u.id===val('principal')&&u.role==='principal');const previousPrincipal=old?.principal;if(val('principal')&&!principal)return formError('Choose an active principal.');
  const id=old?.id||uid('b'),b={...(old||{id,students:0,staff:0,attendance:0,collected:0,status:'Active'}),name:val('name').includes('·')?val('name'):db.settings.school.split(' ')[0]+' · '+val('name'),school:val('school'),city:val('city'),address:val('address'),phone:val('phone'),principal:principal?.name||'Unassigned'};
  if(old)Object.assign(old,b);else db.branches.push(b);
  if(previousPrincipal&&previousPrincipal!==principal?.name){const previous=db.users.find(u=>u.name===previousPrincipal&&u.role==='principal');if(previous)previous.branches=(previous.branches||[previous.branch]).filter(b=>b!==id);}
  if(principal)principal.branches=[...new Set([...(principal.branches||[principal.branch]),id])];
  audit(old?'Edited branch':'Created branch',b.name,old?'Previous configuration':'New branch','Principal: '+(principal?.name||'Unassigned'),id);persist();closeModal(true);render();
  modal('Your new campus is ready.',`${status('Active')}<h3>${esc(b.name)}</h3><p>Principal assigned: <b>${esc(principal?.name||'Unassigned')}</b></p>${alertBox('Next: confirm permissions','Review the principal’s branch scope and any explicit permission restrictions before using the campus.')}<div class="form-actions">${button('View campus','branchDetail',id)}${button('Configure permissions','branchPermissions',id,'primary','shield')}</div>`,'Branch creation → principal assignment → permission configuration');break;
 }
 case 'branch-settings':if(role==='owner'){const b=db.branches.find(b=>b.id===form.dataset.record);b.phone=val('phone');b.notes=val('notes');audit('Changed branch settings',b.name,'Previous settings',b.notes,b.id);persist();closeModal(true);render();toast('Campus settings saved.')}break;
 case 'settings-form':{
  if(role!=='owner')break;const s=db.settings,t=val('tab'),before=JSON.stringify(s);
  if(t==='identity')['school','tagline','logo','currency','timezone','dateFormat'].forEach(k=>s[k]=val(k));
  if(t==='academic'){s.academicYear=val('academicYear');s.term=val('term');s.modules=['Attendance','Academics','Finance','Communication'].filter(m=>fd.has('module-'+m))}
  if(t==='security'){s.twoFactor=fd.has('twoFactor');s.sessionMinutes=+val('sessionMinutes');s.retention=val('retention');s.privacy=val('privacy')}
  if(t==='notifications')['messaging','attendanceNotifications','notificationEmail','notificationWhatsapp','weeklyReport'].forEach(k=>s[k]=fd.has(k));
  audit('Changed system settings',t,before.slice(0,250),JSON.stringify(s).slice(0,250));persist();overlayDirty=false;render();toast('Settings saved.');break;
 }
 case 'profile-preferences':db.profilePrefs??={};db.profilePrefs[role]={...db.profilePrefs[role],whatsapp:fd.has('whatsapp'),inapp:fd.has('inapp')};persist();overlayDirty=false;toast('Notification preferences saved.');break;
 case 'profile-edit':db.profilePrefs??={};db.profilePrefs[role]={...db.profilePrefs[role],email:val('email'),phone:val('phone')};audit('Updated own contact preferences',account().name,'Previous contact','Updated contact');persist();closeModal(true);render();toast('Contact preferences saved.');break;
 case 'override-form':{
  if(role!=='owner')break;const item={role:val('role'),module:val('module'),action:val('action'),allowed:val('allowed')==='true',reason:val('reason'),actor:account().name,date:now()};
  if(!confirm('Apply '+(item.allowed?'the baseline rule':'an explicit denial')+' for '+ROLE_NAMES[item.role]+' · '+TITLES[item.module]+' · '+item.action+'?'))break;
  db.overrides??=[];db.overrides=db.overrides.filter(o=>!(o.role===item.role&&o.module===item.module&&o.action===item.action));db.overrides.push(item);audit('Changed permission override',ROLE_NAMES[item.role]+' · '+TITLES[item.module],item.action,item.allowed?'Baseline restored':'Denied · '+item.reason);persist();closeModal(true);render();toast('Permission override recorded.');break;
 }
 case 'attendance-correction':attendanceSave(true,val('reason'));break;
 case 'submission-form':{
  const h=record('homework',form.dataset.record);if(!h||!isPortal())break;
  let attachments;try{attachments=await readFiles(form.querySelector('input[type=file]').files)}catch(e){return formError(e.message)}
  const sub={student:child,text:val('text'),attachments,date:now(),feedback:''};h.submissions??=[];let i=h.submissions.findIndex(s=>s.student===child);if(i>=0)h.submissions[i]=sub;else h.submissions.push(sub);
  audit('Submitted homework',h.name,'Unsubmitted','Submitted by '+studentName(child),h.branch);notify(studentName(child)+' submitted '+h.name,['teacher'],'homework',h.branch,child);persist();closeModal(true);render();openDetail('homework',h.id);toast('Assignment submitted.');break;
 }
 case 'feedback-form':{const h=record('homework',form.dataset.homework);if(!h||!can('edit','homework',h))break;const s=h.submissions[+form.dataset.index];s.feedback=val('feedback');audit('Reviewed homework submission',h.name,studentName(s.student),'Feedback recorded',h.branch);notify('Feedback available for '+h.name,['parent','student'],'homework',h.branch,s.student);persist();closeModal(true);render();openDetail('homework',h.id);toast('Feedback saved.');break}
 case 'homework-schedule':{const h=record('homework',form.dataset.record);if(!h||!can('publish','homework',h))break;if(new Date(val('schedule'))<=new Date())return formError('Choose a future publication time.');h.schedule=val('schedule');changeStatus('homework',h.id,'Scheduled (demo)','Local schedule: '+h.schedule);break}
 case 'payment-review':reviewPayment(form);break;
 case 'payment-outcome':applyPaymentOutcome(form);break;
 case 'compose-form':previewMessage(form);break;
 case 'sender-form':{
  if(role!=='owner')break;const categories=fd.getAll('category');if(!categories.length)return formError('Choose at least one authorized category.');
  if(!/^\+\d[\d ]{8,18}$/.test(val('number')))return formError('Use an international phone number beginning with +.');
  const old=db.senders.find(s=>s.id===form.dataset.record),s={id:old?.id||uid('wa'),name:val('name'),number:val('number'),branch:val('branch'),status:old?.status||'Setup required',credential:old?.credential||'Not configured',categories,default:old?.default||false};
  if(old)Object.assign(old,s);else db.senders.push(s);audit('Configured WhatsApp sender',s.name,old?'Previous configuration':'New sender',categories.join(', '),s.branch);persist();closeModal(true);render();toast('Sender configuration saved. Live setup is still required.');break;
 }
 case 'conversation-form':{const c=record('conversations',form.dataset.record);if(!c||!db.settings.messaging||!can('message','communication')||isPortal()&&c.student!==child)break;c.messages.push({who:account().name,text:val('message'),date:now()});audit('Sent in-app demo message',studentName(c.student),'','Local conversation',c.branch);notify('New teacher conversation reply',['teacher','parent'],'communication',c.branch,c.student);persist();closeModal(true);conversation(c.id);toast('In-app demo reply recorded.');break}
 case 'expense-action':{const r=record('expenses',form.dataset.record);if(!r||!can('edit','expenses',r))break;const op=form.dataset.operation;if(!confirm('Record this financial change with its reason?'))break;if(op==='adjustExpense'){let before=r.amount;r.amount=+val('amount');if(r.amount<=0){r.amount=before;return formError('Amount must be greater than zero.')}audit('Adjusted financial amount',r.name,money(before),money(r.amount)+' · '+val('reason'),r.branch)}else{r.status='Reconciled';r.reference=val('reference');audit('Reconciled expense',r.name,'Pending reconciliation',r.reference+' · '+val('reason'),r.branch)}r.history??=[];r.history.push({who:account().name,action:op+' · '+val('reason'),date:now()});persist();closeModal(true);render();openDetail('expenses',r.id);toast('Financial change recorded.');break}
 case 'payroll-payment':{const r=record('payroll',form.dataset.record);if(!r||!can('edit','payroll',r)||r.status!=='Approved')break;r.reference=val('reference');changeStatus('payroll',r.id,'Paid (recorded)','Verified reference: '+r.reference);break}
 case 'resolution-form':{const r=record(form.dataset.kind,form.dataset.record);if(!r||!can('edit',form.dataset.kind,r))break;changeStatus(form.dataset.kind,r.id,val('status'),val('comment'));break}
 case 'teacher-review':{const r=record('users',form.dataset.record);if(!r||!['owner','principal'].includes(role))break;r.reviews??=[];r.reviews.push({review:val('review'),comment:val('comment'),who:account().name,date:now()});audit('Recorded teacher review',r.name,val('review'),val('comment'),r.branch);r.history??=[];r.history.push({who:account().name,action:'Teacher review: '+val('review')+' · '+val('comment'),date:now()});persist();closeModal(true);render();toast('Teacher review recorded in the audit trail.');break}
 case 'concession-form':{
  const r=record('discounts',form.dataset.record),fee=record('fees',val('fee'));if(!r||!fee||!can('edit','discounts',r)||fee.student!==r.student||fee.status==='Paid'||r.appliedTo)return formError('Choose an eligible outstanding fee item.');
  const next=fee.amount+(r.type==='Fine'?r.amount:-r.amount);if(next<0)return formError('The adjustment cannot exceed the outstanding fee amount.');
  if(!confirm('Change '+fee.name+' from '+money(fee.amount)+' to '+money(next)+'? The authorization and previous amount will be recorded.'))break;
  const before=fee.amount;fee.amount=next;r.appliedTo=fee.id;r.status='Applied';r.history??=[];r.history.push({who:account().name,action:'Applied to '+fee.name+' · '+val('reason'),date:now()});audit('Applied '+r.type,studentName(r.student)+' · '+fee.name,money(before),money(next)+' · '+val('reason'),r.branch);persist();closeModal(true);render();openDetail('discounts',r.id);toast('Fee adjustment applied and audited.');break;
 }
 case 'report-form':generateReport(form);break;
 case 'signin-form':role=val('account');branch=account().branch;child=account().children?.[0]||'s1';localStorage.setItem(VERSION+'-role',role);navigate('dashboard');toast('Demo workspace opened.');break;
 case 'recovery-form':document.getElementById('recovery-result').innerHTML=alertBox('Recovery request preview','A connected authentication service would send a recovery link if this account exists. No email was sent.');break;
 }
}
function generateReport(form){
 const fd=new FormData(form),from=String(fd.get('from')),to=String(fd.get('to')),type=String(fd.get('reportType'));
 if(to<from)return formError('The report end date must be on or after the start date.');
 const financial=['owner','office'].includes(role);
 if(!can('export','reports')||!optionsFor('reportType').includes(type))return toast('Report outside your permissions.');
 const inRange=x=>{let d=x.date||x.submitted||x.from;return !d||d>=from&&d<=to};
 let body=`<p>Scope: ${esc(branchName(branch))}<br>Academic year: ${db.academicYear}<br>Period: ${date(from)} – ${date(to)}<br>Prepared by: ${esc(account().name)}</p>`;
 if(/Financial|Outstanding|Payroll/.test(type)&&financial){
  let fees=scope(db.fees,'fees').filter(f=>f.status!=='Paid'),payments=scope(db.payments,'payments').filter(inRange),expenses=scope(db.expenses,'expenses').filter(inRange);
  body+=table(['Metric','Amount'],[
   `<tr><td>Confirmed collections in period</td><td>${money(payments.filter(p=>p.status==='Confirmed').reduce((a,p)=>a+p.amount,0))}</td></tr>`,
   `<tr><td>Expenses in period</td><td>${money(expenses.reduce((a,p)=>a+p.amount,0))}</td></tr>`,
   `<tr><td>Current outstanding fees (all due dates)</td><td>${money(fees.reduce((a,p)=>a+p.amount,0))}</td></tr>`]);
  body+='<h2>Transaction reconciliation</h2>'+table(['Transaction','Student','Date','Amount','Status'],payments.map(p=>`<tr><td>${esc(p.id)}</td><td>${studentName(p.student)}</td><td>${date(p.date)}</td><td>${money(p.amount)}</td><td>${p.status}</td></tr>`));
  body+='<h2>Current payroll</h2>'+table(['Staff','Month','Amount','Status'],scope(db.payroll).map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.month)}</td><td>${money(p.amount)}</td><td>${p.status}</td></tr>`));
 }else{
  body+='<h2>School overview</h2>'+table(['Campus','Students','Staff','Attendance'],scope(db.branches).map(b=>`<tr><td>${esc(b.name)}</td><td>${b.students}</td><td>${b.staff}</td><td>${b.attendance}%</td></tr>`));
  body+='<h2>Attendance submissions in period</h2>'+table(['Date','Class','Present','Absent'],scope(db.attendance).filter(inRange).map(a=>`<tr><td>${date(a.date)}</td><td>${a.class}</td><td>${Object.values(a.entries).filter(v=>v==='Present').length}</td><td>${Object.values(a.entries).filter(v=>v==='Absent').length}</td></tr>`));
  body+='<h2>Admissions in period</h2>'+table(['Student','Class','Status'],scope(db.admissions).filter(inRange).map(a=>`<tr><td>${esc(a.name)}</td><td>${a.class}</td><td>${a.status}</td></tr>`));
  body+='<h2>Academic reviews</h2>'+table(['Assessment','Class','Status'],scope(db.marks,'marks').map(m=>`<tr><td>${esc(m.name)}</td><td>${m.class}</td><td>${m.status}</td></tr>`));
 }
 audit('Generated scoped report',type,date(from),date(to));notify(type+' generated by '+account().name,['owner'],'reports');persist();download(type.toLowerCase().replace(/\W+/g,'-')+'.html',documentHTML(type,body));toast('Scoped report downloaded.');
}
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action]');
 if(el){if(el.dataset.action==='submit')return;e.preventDefault();if(el.disabled)return;try{await handleAction(el.dataset.action,el.dataset.id||'',el)}catch(err){console.error(err);toast('This action could not complete. Your saved records are retained.')}return}
 const a=e.target.closest('a[href^="#/"]');
 if(a&&(overlayDirty||window.registerDirty)){if(!confirm('Discard your unsaved changes? Save a draft first if you need to continue later.'))e.preventDefault();else{overlayDirty=false;window.registerDirty=false;closeModal(true)}}
});
document.addEventListener('submit',async e=>{e.preventDefault();if(!e.target.reportValidity())return;try{await handleSubmit(e.target)}catch(err){console.error(err);formError('Could not save. Check your entries and available browser storage.')}});
document.addEventListener('input',e=>{
 const t=e.target;
 if(t.closest('.modal form'))overlayDirty=true;
 if(t.id==='module-search'){let visible=0;document.querySelectorAll('.module-entry').forEach(el=>{const show=el.dataset.name.toLowerCase().includes(t.value.toLowerCase());el.hidden=!show;if(show)visible++});document.querySelectorAll('.module-group').forEach(group=>group.hidden=![...group.querySelectorAll('.module-entry')].some(el=>!el.hidden));document.getElementById('module-empty').hidden=visible>0;}
 if(t.id==='record-search'){search=t.value;page=1;let start=t.selectionStart;render();let el=document.getElementById('record-search');el?.focus();el?.setSelectionRange(start,start)}
 if(t.id==='recipient-search'){document.querySelectorAll('.recipient-row').forEach(r=>r.hidden=!r.dataset.name.toLowerCase().includes(t.value.toLowerCase()))}
 if(t.name==='max'&&t.closest('#marks-form'))document.querySelectorAll('.score-input').forEach(x=>x.max=t.value);
});
document.addEventListener('change',async e=>{
 const t=e.target;
 if(t.id==='branch-selector'){if(t.value!=='all'&&!authorizedBranches().includes(t.value)||t.value==='all'&&role!=='owner')return;branch=t.value;search='';filter='All';page=1;attendanceDraft={};render()}
 if(t.id==='child-selector'){if(account().children?.includes(t.value)){child=t.value;classFilter=studentClass();search='';filter='All';render()}}
 if(t.id==='status-filter'){filter=t.value;page=1;render()}
 if(t.id==='sort-filter'){sort=t.value;render()}
 if(t.id==='academic-year'){db.academicYear=t.value;persist();render()}
 if(t.id==='attendance-class'){if(window.registerDirty&&!confirm('Discard unsaved marks before changing class?')){render();return}window.registerDirty=false;classFilter=t.value;render()}
 if(t.id==='attendance-date'){if(window.registerDirty&&!confirm('Discard unsaved marks before changing date?')){render();return}window.registerDirty=false;attendanceDate=t.value;render()}
 if(t.closest('#marks-form')&&t.name==='class'){classFilter=t.value;enterMarks()}
 if(t.closest('#compose-form'))updateRecipientCount();
 if(t.id==='message-date'){window.messageDate=t.value;render()}
 if(t.id==='message-sender'){window.messageSender=t.value;render()}
 if(t.id==='message-audience'){window.messageAudience=t.value;render()}
 if(t.type==='file'&&t.id!=='restore-file'){let dest=document.getElementById('upload-'+t.name);if(dest)dest.innerHTML=[...t.files].map(f=>`<span>${esc(f.name)} · ${Math.round(f.size/1024)} KB</span>`).join('')}
 if(t.id==='restore-file'&&t.files.length&&role==='owner'){
  try{const snapshot=JSON.parse(await t.files[0].text());if(snapshot.version!==VERSION||!snapshot.data||Object.keys(SEED).some(k=>Array.isArray(SEED[k])&&!Array.isArray(snapshot.data[k])))throw Error('Choose a valid snapshot from this prototype version.');
  if(!confirm('Restore this snapshot and replace all current local demo records?'))return;
  db=snapshot.data;audit('Restored demo snapshot',t.files[0].name,'Current local records','Snapshot restored');persist();render();toast('Demo snapshot restored.');
  }catch(err){toast(err.message)}
 }
});
document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();document.getElementById('global-search')?.focus()}
 const modalEl=document.querySelector('.modal');
 if(e.key==='Escape'&&modalEl){e.preventDefault();closeModal()}
 if(e.key==='Tab'&&modalEl){const focus=[...modalEl.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(x=>x.getClientRects().length);const first=focus[0],last=focus.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}
});
window.addEventListener('beforeunload',e=>{if(overlayDirty||window.registerDirty){e.preventDefault();e.returnValue=''}});
window.addEventListener('hashchange',updateRoute);
if(new URLSearchParams(location.search).has('preview')){const preview=new URLSearchParams(location.search).get('preview');if(ACCOUNTS[preview]){role=preview;branch=account().branch;child=account().children?.[0]||'s1'}}
updateRoute();
