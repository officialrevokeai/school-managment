function optionsFor(type){
 const obj={
 class:role==='teacher'?account().classes:isPortal()?[studentClass()]:['9 A','9 B','6 B','8 A','7 A','10 A'],
 role:Object.keys(ROLE_NAMES).filter(r=>r!=='owner').map(r=>[r,ROLE_NAMES[r]]),
 student:scope(db.students,'students').map(s=>[s.id,s.name+' · '+s.class]),
 leaveType:['Casual leave','Medical leave','Personal leave','Duty leave'],
 frequency:['Monthly','Quarterly','Annual'],discountType:['Discount','Scholarship','Fine'],
 documentType:['Certificate','Report','Identity','Transfer certificate'],
 audience:role==='teacher'?account().classes:['All','Parents','Students','Staff','9 A','9 B','6 B'],
 eventType:['Event','Holiday','Meeting'],category:['Fees','General','Attendance','Exams','Holidays','Events'],
 roleScope:['Assigned branch','Assigned classes','Linked children','Own record'],
 currency:['INR'],timezone:['Asia/Kolkata','Asia/Dubai','UTC'],dateFormat:['DD MMM YYYY'],
 reportType:['Daily school summary','Weekly owner report',...(['owner','office'].includes(role)?['Financial reconciliation','Outstanding fees','Payroll summary']:['Academic performance','Attendance summary'])],
 account:Object.entries(ROLE_NAMES),branch:db.branches.map(b=>[b.id,b.name]),
 action:['create','edit','approve','export','publish'],permissionRole:Object.entries(ROLE_NAMES).filter(([r])=>r!=='owner'),
 permissionModule:['admissions','homework','marks','leave','announcements','expenses','reports','students'].map(k=>[k,TITLES[k]]),
 paymentMethod:['UPI','Net banking','Card'],sender:scope(db.senders).map(s=>[s.id,s.name+' · '+s.number]),
 template:scope(db.templates).map(t=>[t.id,t.name]),
 messageAudience:role==='office'?['Outstanding fees','Individual']:role==='teacher'?account().classes.concat(['Individual']):['Outstanding fees','All parents','All students','Staff','9 A','9 B','6 B','Individual'],
 outcome:['Successful (demo)','Failed','Cancelled','Pending verification'],recordMethod:['Cash','UPI','Bank transfer','Card'],
 replyStatus:['Open','In progress','Resolved'],review:['Satisfactory','Follow-up required','Needs support']
 };return obj[type];
}
function formField(name,label,type,value='',optional=false){
 let input,opts=optionsFor(type);const common=`id="f-${name}" name="${name}" class="field" ${!optional&&!['file','checkbox'].includes(type)?'required':''}`;
 if(opts)input=`<select ${common}>${opts.map(o=>{let [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(l)}</option>`}).join('')}</select>`;
 else if(type==='textarea')input=`<textarea ${common} maxlength="4000">${esc(value)}</textarea>`;
 else if(type==='file')input=`<input ${common} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.txt"><small>Up to 3 files, 2 MB each. Browser-local demo uploads.</small><div class="upload-preview" id="upload-${name}"></div>`;
 else input=`<input ${common} type="${type}" value="${esc(value)}" ${type==='number'?'min="0" step="0.01"':''} ${type==='password'?'minlength="6" autocomplete="off"':''} ${type==='text'?'maxlength="200"':''}>`;
 return `<div class="form-field ${['textarea','file'].includes(type)?'wide':''}"><label for="f-${name}">${esc(label)} ${optional?'<span class="muted">(optional)</span>':''}</label>${input}</div>`;
}
function formError(msg){const e=document.getElementById('form-error')||document.getElementById('report-error');if(e)e.textContent=msg;else toast(msg)}
function record(kind,id){return scope(db[kind]||[],kind).find(x=>x.id===id)}
function createForm(kind,id=''){
 if(!MODULES[kind]||!can(id?'edit':'create',kind,id?record(kind,id):null))return toast('This action is outside your permissions.');
 const cfg=MODULES[kind],old=id?record(kind,id):{};
 if(id&&!old)return toast('Record not available in this scope.');
 const defaults={class:isPortal()?studentClass():classFilter,date:TODAY,from:TODAY,to:TODAY,due:'2026-11-05',deadline:'2026-10-30',teacher:account().name,student:child,role:'teacher',month:'October 2026'};
 modal((id?'Edit ':'Create ')+({admissions:'admission',homework:'assignment',users:'user',leave:'leave request',roles:'role'}[kind]||TITLES[kind].toLowerCase()),`<form id="record-form" data-kind="${kind}" data-record="${id}"><div class="form-grid">${role==='owner'?formField('branch','Branch','branch',old.branch|| (branch==='all'?'b1':branch)):''}${cfg.fields.map(([k,l,t,opt])=>formField(k,l,t,old[k]??defaults[k]??'',opt)).join('')}${kind==='roles'?`<div class="form-field wide"><label>Permission grants (design definition)</label><div class="check-list">${['view','create','edit','approve','export','archive'].map(p=>`<label class="check-row"><input type="checkbox" name="grant" value="${p}" ${old.permissions?.includes(p)?'checked':''}>${p}</label>`).join('')}</div><small>Custom roles document grants. Use explicit overrides to test baseline demo account restrictions.</small></div>`:''}</div>${id&&old.attachments?.length?`<h3>Existing attachments</h3>${attachmentList(kind,old)}`:''}<div class="error-text" id="form-error" role="alert"></div><div class="form-actions">${button('Cancel','close')}${button(id?'Save changes':kind==='leave'?'Submit leave request':'Save '+(cfg.initial==='Draft'?'draft':'record'),'submit','','primary','check','type="submit"')}</div></form>`,id?'Changes are recorded in the activity history.':'Your active school and record scope apply.');
}
async function readFiles(files){
 const list=[...files];if(list.some(f=>!/^.+\.(pdf|png|jpe?g|docx|txt)$/i.test(f.name)))throw Error('Use PDF, PNG, JPG, DOCX, or TXT files.');if(list.length>3)throw Error('Choose up to 3 files.');
 if(list.some(f=>f.size>2*1024*1024))throw Error('Each file must be 2 MB or smaller.');
 return await Promise.all(list.map(f=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve({name:f.name,type:f.type,data:reader.result,size:f.size});reader.onerror=()=>reject(Error('Could not read '+f.name));reader.readAsDataURL(f)})));
}
async function saveRecord(form){
 const kind=form.dataset.kind,id=form.dataset.record,cfg=MODULES[kind],old=id?record(kind,id):null;
 if(!can(id?'edit':'create',kind,old))return formError('Your account cannot change this record.');
 const beforeData=old?JSON.stringify(Object.fromEntries(Object.entries(old).filter(([k])=>!['attachments','history','submissions'].includes(k)))):'New record';
 const fd=new FormData(form),obj={};for(const [k,l,t] of cfg.fields){if(t!=='file')obj[k]=String(fd.get(k)||'').trim();if(t==='number')obj[k]=+obj[k]}
 if(obj.from&&obj.to&&obj.to<obj.from)return formError('The end date must be on or after the start date.');
 if(obj.dob&&obj.dob>=TODAY)return formError('Date of birth must be before today.');
 if(obj.amount!=null&&(!Number.isFinite(obj.amount)||obj.amount<=0))return formError('Enter an amount greater than zero.');
 if(obj.max!=null&&obj.max<=0)return formError('Maximum marks must be greater than zero.');
 if(obj.phone&&!/^[+\d\s()-]{8,20}$/.test(obj.phone))return formError('Enter a valid contact number.');
 if(kind==='users'&&db.users.some(u=>u.id!==id&&u.email.toLowerCase()===obj.email.toLowerCase()))return formError('A user with this email already exists.');
 if(obj.class&&role==='teacher'&&!account().classes.includes(obj.class))return formError('Choose one of your assigned classes.');
 if(obj.class&&isPortal()&&obj.class!==studentClass())return formError('This class is outside your linked student scope.');
 if(obj.student&&!scope(db.students,'students').some(s=>s.id===obj.student))return formError('This student is outside your record scope.');
 try{
  let files=await readFiles(form.querySelector('input[type=file]')?.files||[]);
  obj.attachments=[...(old?.attachments||[]),...files];if(obj.attachments.length>6)return formError('Remove an existing attachment before adding more than six.');
 }catch(e){return formError(e.message)}
 obj.branch=role==='owner'?String(fd.get('branch')):branch;
 if(!db.branches.some(b=>b.id===obj.branch))return formError('Select an existing branch.');
 obj.history=old?.history||[];obj.status=old?.status||cfg.initial;obj.id=old?.id||uid(kind.slice(0,3));
 if(['homework','materials','lessonplans'].includes(kind))obj.teacher=old?.teacher||account().name;
 if(kind==='homework')obj.submissions=old?.submissions||[];
 if(kind==='admissions')obj.submitted=old?.submitted||TODAY;
 if(kind==='leave'){obj.name=isPortal()?studentName(child):account().name;if(isPortal()){obj.student=child;obj.class=studentClass()}}
 if(kind==='roles')obj.permissions=fd.getAll('grant');
 if(kind==='announcements'&&role==='teacher'){obj.class=obj.audience;obj.teacher=account().name}
 if(!obj.date&&['documents','complaints','announcements'].includes(kind))obj.date=TODAY;
 obj.history.push({who:account().name,action:old?'Edited record':'Created record',date:now()});
 if(old)Object.assign(old,obj);else db[kind].unshift(obj);
 audit(old?'Edited '+TITLES[kind]:'Created '+TITLES[kind],obj.name||obj.type,beforeData.slice(0,500),JSON.stringify(Object.fromEntries(Object.entries(obj).filter(([k])=>!['attachments','history','submissions'].includes(k)))).slice(0,500),obj.branch);
 if(obj.status==='Pending approval')notify((obj.name||obj.type)+' needs review',['owner','principal'],'approvals',obj.branch,obj.student);
 if(!persist())return;
 closeModal(true);render();toast(kind==='leave'?'Leave request submitted for review.':old?'Changes saved.':'Record saved. Open it to continue the workflow.');
 openDetail(kind,obj.id);
}
function attachmentList(kind,r){return (r.attachments||[]).map((f,i)=>`<div class="document">${icon('file')}<div><b>${esc(f.name)}</b><small>${f.sample?'Sample supporting document':Math.round((f.size||0)/1024)+' KB · local upload'}</small></div>${button(f.sample?'Preview':'Download','attachment',kind+':'+r.id+':'+i,'small','eye')}${can('edit',kind,r)?button('Remove','removeAttachment',kind+':'+r.id+':'+i,'small ghost','trash'):''}</div>`).join('')||'<p class="muted text-small">No supporting documents attached.</p>'}
function detailHistory(r){return `<div class="timeline">${(r.history||[]).map(h=>`<p>${esc(h.action)}<small>${esc(h.who)} · ${esc(h.date)}</small></p>`).join('')||'<p>No decisions recorded yet.</p>'}</div>`}
function openDetail(kind,id){
 const r=record(kind,id);if(!r||!allowedRoute(kind))return toast('Record not available in your scope.');
 let fields=Object.entries(r).filter(([k,v])=>!['id','status','notes','history','attachments','scores','submissions','feedback','credential','permissions'].includes(k)&&typeof v!=='object').map(([k,v])=>`<div class="detail-item"><small>${esc(k.replace(/([A-Z])/g,' $1'))}</small><b>${esc(k==='branch'?branchName(v):k==='student'?studentName(v):['date','deadline','from','to','submitted','dob','due'].includes(k)?date(v):k==='amount'?money(v):k==='role'?ROLE_NAMES[v]||v:v)}</b></div>`).join('');
 let body=`<div style="display:flex;align-items:center;justify-content:space-between">${status(r.status)}<small class="muted">${esc(r.id.toUpperCase())}</small></div><div class="detail-grid">${fields}</div>${r.notes||r.feedback?`<h3>${kind==='homework'?'Instructions':'Details & comments'}</h3><p style="font-size:12px;white-space:pre-wrap">${esc(r.notes||r.feedback)}</p>`:''}`;
 if(kind==='marks')body+=table(['Student','Score','Feedback'],scope(db.students,'students').filter(s=>s.class===r.class).map(s=>`<tr><td>${person(s.name,s.class)}</td><td>${r.scores[s.id]??'—'} / ${r.max}</td><td>${esc(r.feedback||'—')}</td></tr>`));
 body+=`<h3>Supporting documents</h3>${attachmentList(kind,r)}`;
 if(kind==='homework'){
  if(isPortal())body+=`<h3>Your submission</h3>${r.submissions?.filter(s=>s.student===child).map(s=>`<div class="panel flat"><p style="white-space:pre-wrap">${esc(s.text)}</p>${status(s.feedback?'Reviewed':'Submitted')}<small class="muted"> ${s.date}</small>${s.feedback?`<p><b>Teacher feedback</b><br>${esc(s.feedback)}</p>`:''}</div>`).join('')||'<p class="muted text-small">You have not submitted this assignment.</p>'}${button('Submit work','submitWork',r.id,'primary mt','upload')}`;
  else body+=`<h3>Submissions (${r.submissions?.length||0})</h3>${r.submissions?.map((s,i)=>`<div class="document">${icon('file')}<div><b>${studentName(s.student)}</b><small>${s.date} · ${s.feedback?'Feedback recorded':'Awaiting review'}</small></div>${button('Review','reviewWork',r.id+':'+i,'small')}</div>`).join('')||'<p class="muted text-small">No student submissions yet.</p>'}`;
 }
 body+=`<h3>Activity & decision history</h3>${detailHistory(r)}`;
 if(can('approve',kind,r)&&r.status==='Pending approval')body+=`<form id="decision-form" data-kind="${kind}" data-record="${id}"><h3>Record your decision</h3>${formField('comment','Decision comments','textarea','')}<div class="form-actions">${button('Request changes','decision','Changes requested','','edit')}${button('Reject','decision','Rejected','danger')}${button('Approve','decision','Approved','primary','check')}</div><div class="error-text" id="form-error" role="alert"></div></form>`;
 let actions='';
 if(can('edit',kind,r))actions+=button('Edit','edit',kind+':'+id,'','edit');
 if(MODULES[kind]?.approval&&can('edit',kind,r)&&['Draft','Changes requested','Rejected'].includes(r.status))actions+=button('Submit for approval','submitApproval',kind+':'+id,'primary','send');
 if(can('publish',kind,r)&&['Draft','Scheduled (demo)'].includes(r.status))actions+=button('Publish now','publish',kind+':'+id,'primary','megaphone')+(kind==='homework'&&r.status==='Draft'?button('Schedule publication','scheduleHomework',id,'','clock'):'');
 if(kind==='discounts'&&can('edit',kind,r)&&!r.appliedTo)actions+=button('Apply to outstanding fee','applyConcession',id,'primary','percent');
 if(kind==='documents')actions+=button('Download document','documentDownload',id,'','download');
 if(kind==='users'&&role==='owner')actions+=button(r.status==='Inactive'?'Activate access':'Deactivate access','toggleUser',id,'','shield');
 if(kind==='expenses'&&['owner','office'].includes(role))actions+=button('Adjust amount','adjustExpense',id,'','edit')+(r.status!=='Reconciled'?button('Reconcile','reconcile',id,'','check'):'');
 if(kind==='payroll'&&['owner','office'].includes(role)&&r.status==='Approved')actions+=button('Record payroll payment','payrollPayment',id,'','wallet');
 if(['complaints','discipline'].includes(kind)&&['owner','principal'].includes(role))actions+=button('Update resolution','resolve',kind+':'+id,'','message');
 if(kind==='roles'&&role==='owner')actions+=button('Review permissions','roleGrants',id,'','shield');
 if(r.status==='Archived'&&(role==='owner'||can('archive',kind,r)))actions+=button('Restore record','restoreRecord',kind+':'+id,'','refresh');
 if((role==='owner'||can('archive',kind,r))&&!['Approved','Confirmed','Published','Archived'].includes(r.status))actions+=button('Archive','archive',kind+':'+id,'danger','trash');
 if(kind==='marks'&&['owner','teacher'].includes(role)&&['Draft','Changes requested','Rejected'].includes(r.status))actions+=button('Edit marks','enterMarks',id,'','chart');
 if(actions)body+=`<div class="form-actions">${actions}</div>`;
 modal(esc(r.name||r.type),body,branchName(r.branch),'drawer');
}
function changeStatus(kind,id,next,comment=''){
 const r=record(kind,id);if(!r)return toast('This record is outside your scope.');
 const before=r.status;r.status=next;r.history??=[];r.history.push({who:account().name,action:next+(comment?' · '+comment:''),date:now()});
 audit('Changed '+TITLES[kind]+' status',r.name||r.type,before,next+(comment?' · '+comment:''),r.branch);
 if(kind==='admissions'&&next==='Approved'&&!db.students.some(s=>s.admission===r.id)){
  db.students.push({id:uid('s'),name:r.name,class:r.class,branch:r.branch,roll:String(db.students.filter(s=>s.branch===r.branch).length+1).padStart(2,'0'),parent:r.parent,email:r.email,phone:r.phone,attendance:100,status:'Active',admission:r.id});
  const b=db.branches.find(b=>b.id===r.branch);if(b)b.students++;
 }
 if(kind==='transfers'&&next==='Approved'){const s=db.students.find(s=>s.name===r.name&&s.branch===r.branch);if(s){s.status='Transferred';const b=db.branches.find(b=>b.id===r.branch);if(b)b.students=Math.max(0,b.students-1)}}
 notify((r.name||r.type)+' · '+next,['owner','principal','teacher','office',...(next==='Published'||kind==='leave'||kind==='marks'?['parent','student']:[])],kind==='marks'?'exams':kind,r.branch,r.student,r.class);
 persist();closeModal(true);render();toast('Status updated: '+next+'.');openDetail(kind,id);
}
function branchForm(id=''){
 if(role!=='owner')return toast('Only the owner can manage branches.');
 const b=db.branches.find(b=>b.id===id)||{};
 modal(id?'Edit campus':'A new place to grow.',`<form id="branch-form" data-record="${id}"><div class="form-grid">${formField('name','Campus name','text',b.name||'')}${formField('school','School name','text',b.school||db.settings.school)}${formField('city','City','text',b.city||'')}${formField('address','Campus address','text',b.address||'')}${formField('phone','School contact','tel',b.phone||'')}<div class="form-field"><label for="f-principal">Assign principal</label><select name="principal" id="f-principal" class="field"><option value="">Unassigned</option>${db.users.filter(u=>u.role==='principal'&&u.status!=='Inactive').map(u=>`<option value="${u.id}" ${u.name===b.principal?'selected':''}>${u.name}</option>`).join('')}</select><small>Assignment adds this branch to the principal’s design record; fixed demo accounts remain scoped to their seeded branch.</small></div></div><div class="error-text" id="form-error"></div><div class="form-actions">${button('Cancel','close')}${button(id?'Save campus':'Create & configure access','submit','','primary','plus','type="submit"')}</div></form>`,'Greenwood school network · Owner administrative context');
}
function branchDetail(id){
 const b=scope(db.branches).find(b=>b.id===id);if(!b)return toast('Campus outside your scope.');
 modal(esc(b.name),`${status(b.status)}<div class="detail-grid">${['school','city','principal','address','phone'].map(k=>`<div class="detail-item"><small>${k}</small><b>${esc(b[k])}</b></div>`).join('')}</div><div class="stats" style="grid-template-columns:1fr 1fr">${stat('Students',b.students.toLocaleString('en-IN'),'','enrolled','users')}${stat('Staff',b.staff,'','active staff','briefcase')}</div><h3>Branch operations</h3><div class="check-list">${button('Open branch workspace','openBranch',id,'full','school')}${button('Branch reports','branchReports',id,'full','chart')}${button('Branch settings','branchSettings',id,'full','settings')}${button('Configure permission scope','branchPermissions',id,'full','shield')}</div><div class="form-actions">${button('Edit campus','editBranch',id,'','edit')}${button(b.status==='Active'?'Deactivate':'Reactivate','toggleBranch',id,b.status==='Active'?'danger':'','shield')}</div>`,'Active school and branch always remain visible.','drawer');
}
function studentDetail(id){
 const s=scope(db.students,'students').find(s=>s.id===id);if(!s)return toast('Student outside your authorized scope.');
 modal(esc(s.name),`<div class="cell-person"><span class="avatar purple" style="width:55px;height:55px;font-size:18px">${initials(s.name)}</span><div><b>Class ${s.class} · Roll ${s.roll}</b><small>${branchName(s.branch)}</small></div>${status(s.status)}</div><div class="detail-grid">${[['Parent / guardian',s.parent],['Contact',s.phone||'Not added'],['Email',s.email||'Not added'],['Attendance',s.attendance+'%']].map(([k,v])=>`<div class="detail-item"><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div><h3>Published academic progress</h3>${table(['Assessment','Score','Status'],scope(db.marks,'marks').filter(m=>m.class===s.class&&m.status==='Approved').map(m=>`<tr><td>${esc(m.name)}</td><td>${m.scores[s.id]??'—'} / ${m.max}</td><td>${status(m.status)}</td></tr>`))}<h3>Supporting records</h3>${scope(db.documents,'documents').filter(d=>d.student===s.id).map(d=>`<div class="document">${icon('file')}<b>${d.name}</b>${button('Download','documentDownload',d.id,'small','download')}</div>`).join('')||'<p class="muted text-small">No additional documents.</p>'}${role==='teacher'&&db.settings.messaging?`<div class="form-actions">${button('Message parent','startConversation',s.id,'primary','message')}</div>`:''}`,'Student record · '+s.id,'drawer');
}
