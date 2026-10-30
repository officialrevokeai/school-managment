function attendanceSave(submit=false,correction=''){
 if(!can('mark','attendance'))return toast('Only assigned teachers can record attendance.');
 if(attendanceDate>TODAY)return toast('Attendance cannot be submitted for a future date.');
 const key=attendanceKey(),roster=scope(db.students,'students').filter(s=>s.class===classFilter),entries=attendanceDraft[key]||{};
 if(!roster.length)return toast('Select a class with students in your scope.');
 if(submit&&roster.some(s=>!entries[s.id]))return toast('Mark every student before submitting. Use Save draft to continue later.');
 const b=branch==='all'?'b1':branch,old=db.attendance.find(a=>a.id===key);
 if(!submit){window.registerDirty=false;db.attendanceDraft[key]=entries;audit('Saved attendance draft',classFilter,'Draft',Object.keys(entries).length+' marked',b);persist();toast('Attendance draft saved.');return}
 if(old&&!correction){modal('Correct a submitted register',`<form id="attendance-correction">${formField('reason','Reason for correction','textarea','')}<div class="form-actions">${button('Cancel','close')}${button('Submit correction','submit','','primary','check','type="submit"')}</div></form>`,'Previous values are retained in the audit history.');return}
 const previousEntries=structuredClone(old?.entries||{});
 const before=old?JSON.stringify(previousEntries):'Not submitted';
 roster.forEach(s=>{const oldStatus=old?.entries[s.id];if(oldStatus!==entries[s.id]){const delta=(entries[s.id]==='Absent'?0:1)-(oldStatus?(oldStatus==='Absent'?0:1):s.attendance/100);s.attendance=Math.min(100,Math.max(0,Math.round((s.attendance+delta/1.21)*10)/10))}});
 const data={id:key,name:classFilter+' attendance',branch:b,class:classFilter,date:attendanceDate,entries:{...entries},teacher:account().name,status:'Submitted'};
 if(old)Object.assign(old,data);else db.attendance.unshift(data);
 delete db.attendanceDraft[key];window.registerDirty=false;
 audit(old?'Corrected attendance':'Submitted attendance',classFilter+' · '+date(attendanceDate),before,JSON.stringify(entries)+(correction?' · '+correction:''),b);
 notify('Attendance submitted for class '+classFilter,['owner','principal'],'attendance',b);
 roster.forEach(s=>{
  notify(s.name+' · '+entries[s.id]+' · '+date(attendanceDate),['parent','student'],'attendance',b,s.id);
  if(entries[s.id]==='Absent'&&db.settings.attendanceNotifications&&(!old||previousEntries[s.id]!=='Absent')){
   const sender=db.senders.find(x=>x.branch===b&&x.categories.includes('Attendance'));
   db.messages.unshift({id:uid('ms'),name:'Attendance · '+s.name,branch:b,sender:sender?.id,category:'Attendance',audience:'Individual',recipients:[s.id],date:attendanceDate,status:'Failed',notes:'Dear '+s.parent+', '+s.name+' was marked absent on '+date(attendanceDate)+'.',delivery:[{student:s.id,status:'Failed',reason:'WhatsApp service disconnected. No message sent.'}]});
  }
 });
 const branchObj=db.branches.find(x=>x.id===b);if(branchObj)branchObj.attendance=Math.round(roster.reduce((a,s)=>a+s.attendance,0)/roster.length*10)/10;
 persist();closeModal(true);render();toast('Attendance submitted. Scoped notifications and communication records updated.');
}
function enterMarks(id=''){
 if(!['owner','teacher'].includes(role))return toast('Marks entry is unavailable for this account.');
 const r=id?record('marks',id):null;if(id&&!r)return toast('Assessment outside your class scope.');
 const cls=r?.class||classFilter,roster=scope(db.students,'students').filter(s=>s.class===cls);
 modal('Marks entry · Class '+cls,`<form id="marks-form" data-record="${id}"><div class="form-grid">${formField('name','Assessment name','text',r?.name||'Science · Unit test 3')}${formField('subject','Subject','text',r?.subject||'Science')}${formField('class','Class','class',cls)}${formField('max','Maximum marks','number',r?.max||50)}</div><div class="mt">${table(['Student','Score'],roster.map(s=>`<tr><td>${person(s.name,s.class)}</td><td><label class="skip" for="score-${s.id}">Score for ${s.name}</label><input class="field score-input" id="score-${s.id}" name="score-${s.id}" type="number" min="0" max="${r?.max||50}" step=".5" value="${r?.scores?.[s.id]??''}" aria-label="Score for ${s.name}" style="width:110px"></td></tr>`))}</div><div class="mt">${formField('feedback','Assessment feedback','textarea',r?.feedback||'')}</div><div class="error-text" id="form-error" role="alert"></div><div class="form-actions">${button('Save draft','saveMarks','Draft','','file')}${button('Submit for approval','saveMarks','Pending approval','primary','send')}</div></form>`,'Scores are checked against the maximum. Only approved results reach student portals.','large');
}
function saveMarks(next){
 const f=document.getElementById('marks-form');if(!f.reportValidity())return;
 if(!['owner','teacher'].includes(role)||!can('mark','marks'))return formError('Marks entry is restricted.');
 const fd=new FormData(f),max=+fd.get('max'),cls=String(fd.get('class')),id=f.dataset.record;
 if(max<=0)return formError('Maximum marks must be greater than zero.');
 if(role==='teacher'&&!account().classes.includes(cls))return formError('Select an assigned class.');
 const students=scope(db.students,'students').filter(s=>s.class===cls),scores={};
 for(const s of students){let value=fd.get('score-'+s.id);if(value==null||value===''){if(next==='Pending approval')return formError('Enter a score for every student before submitting.');continue}let score=+value;if(score<0||score>max||!Number.isFinite(score))return formError('Every score must be between 0 and '+max+'.');scores[s.id]=score}
 const old=id?record('marks',id):null;if(id&&(!old||old.status==='Approved'))return formError('Approved marks are locked. Create a new assessment.');
 const obj={id:old?.id||uid('mk'),name:String(fd.get('name')),subject:String(fd.get('subject')),max,class:cls,branch:branch==='all'?'b1':branch,scores,feedback:String(fd.get('feedback')),status:next,teacher:account().name,history:[...(old?.history||[]),{who:account().name,action:next,date:now()}]};
 if(old)Object.assign(old,obj);else db.marks.unshift(obj);
 audit('Saved assessment',obj.name,old?.status||'New',next,obj.branch);
 if(next==='Pending approval')notify(obj.name+' needs approval',['owner','principal'],'approvals',obj.branch);
 persist();closeModal(true);render();toast(next==='Draft'?'Marks draft saved.':'Marks submitted for principal review.');
}
function submitWork(id){
 const h=record('homework',id);if(!h||!isPortal()||h.status!=='Published')return toast('Assignment unavailable.');
 const own=h.submissions?.find(s=>s.student===child);
 modal('Your work · '+esc(h.name),`<form id="submission-form" data-record="${id}">${formField('text','Answer / submission notes','textarea',own?.text||'')}${formField('attachments','Your work','file','',true)}<div class="error-text" id="form-error" role="alert"></div><div class="form-actions">${button('Cancel','close')}${button(own?'Update submission':'Submit assignment','submit','','primary','upload','type="submit"')}</div></form>`,'Due '+date(h.deadline)+' · '+studentName(child));
}
function receipt(id){
 const p=record('payments',id);if(!p||p.status!=='Confirmed')return toast('A receipt is available only after a confirmed payment.');
 modal('Payment receipt',`<div class="panel flat"><div class="eyebrow">GREENWOOD INTERNATIONAL SCHOOL</div><h2>${esc(p.id)}</h2><div class="stat-value">${money(p.amount)}</div>${status('Confirmed')}<div class="detail-grid">${[['Student',studentName(p.student)],['Paid on',date(p.date)],['Method',p.method],['Reference',p.reference||'Demo transaction'],['Campus',branchName(p.branch)],['Receipt type','Demonstration receipt']].map(([k,v])=>`<div class="detail-item"><small>${k}</small><b>${esc(v)}</b></div>`).join('')}</div><p class="muted text-small">Demo receipt · no real payment has been processed.</p></div><div class="form-actions">${button('Print','print','','','print')}${button('Download receipt','downloadReceipt',p.id,'primary','download')}</div>`,'Confirmed payments only');
}
function documentHTML(title,body){return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;margin:60px;color:#17181c;line-height:1.7}h1{font-size:28px}header{border-bottom:2px solid #17181c;padding-bottom:20px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px;border-bottom:1px solid #ddd}small{color:#626775}footer{margin-top:45px;border-top:1px solid #ddd;padding-top:15px}</style><header><b>${esc(db.settings.school)}</b><br><small>School Management System v2.0 · Demonstration document</small></header><h1>${esc(title)}</h1>${body}<footer><small>Generated ${esc(now())}. All records are fictional demo data. This is not an official school document.</small></footer></html>`}
function paymentChoose(feeId='',office=false){
 if(!can('pay','fees'))return toast('Payment actions are unavailable for this account.');
 const rows=scope(db.fees,'fees').filter(f=>f.status!=='Paid'&&(!feeId||f.id===feeId));
 const pendingIds=db.payments.filter(p=>['Processing','Pending verification'].includes(p.status)).flatMap(p=>p.feeIds);
 modal(office?'Record fee collection':'Review outstanding fees',`<form id="payment-review" data-office="${office}"><div class="check-list">${rows.map(f=>`<label class="check-row" style="justify-content:space-between;border-bottom:1px solid var(--line);padding:10px 0"><span style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="fee" value="${f.id}" ${pendingIds.includes(f.id)?'disabled':feeId?'checked':''}><span><b>${esc(f.name)}</b><small style="display:block;color:var(--muted)">${studentName(f.student)} · Due ${date(f.due)}${pendingIds.includes(f.id)?' · Payment pending verification':''}</small></span></span><b>${money(f.amount)}</b></label>`).join('')||empty('No outstanding fees','You’re all caught up.')}</div><div class="mt">${formField('method','Payment method',office?'recordMethod':'paymentMethod',office?'Cash':'UPI')}</div>${office?`<div class="mt">${formField('reference','Collection / bank reference','text','')}${formField('reason','Collection notes','textarea','')}</div>`:''}<div class="error-text" id="form-error" role="alert"></div><div class="form-actions">${button('Cancel','close')}${button('Review payment','submit','','primary','arrow','type="submit"')}</div></form>`,office?'Recorded payments require a confirmation or a pending-verification status.':'No money will be collected. This flow uses a demo payment gateway.');
}
function reviewPayment(form){
 if(!can('pay','fees'))return formError('Payment is not permitted.');
 const fd=new FormData(form),ids=fd.getAll('fee'),office=form.dataset.office==='true',rows=scope(db.fees,'fees').filter(f=>ids.includes(f.id)&&f.status!=='Paid');
 if(!rows.length)return formError('Select at least one outstanding fee.');
 if(new Set(rows.map(f=>f.student)).size>1)return formError('Record one student’s payment at a time.');
 if(db.payments.some(p=>['Processing','Pending verification'].includes(p.status)&&p.feeIds.some(id=>ids.includes(id))))return formError('A selected fee already has a payment awaiting verification.');
 pendingPayment={id:uid('PAY').toUpperCase(),name:'Fee payment',student:rows[0].student,branch:rows[0].branch,amount:rows.reduce((a,f)=>a+f.amount,0),feeIds:ids,method:String(fd.get('method')),reference:String(fd.get('reference')||'DEMO-GATEWAY'),notes:String(fd.get('reason')||''),date:TODAY,status:'Processing',office};
 modal('Everything look right?',`<div class="eyebrow">PAYMENT REVIEW</div><div class="stat-value">${money(pendingPayment.amount)}</div><p>${esc(studentName(pendingPayment.student))} · ${pendingPayment.method}</p>${rows.map(f=>`<div class="switch"><span>${esc(f.name)}</span><b>${money(f.amount)}</b></div>`).join('')}${alertBox(office?'Record a collection outcome':'Continue to the demo gateway',office?'Use Confirmed only after validating the collection. This prototype records a local demo confirmation.':'The next screen will show Processing. You then choose a demo outcome; no payment service is connected.')}<div class="form-actions">${button('Cancel','close')}${button(office?'Record outcome':'Continue to demo payment','startPayment','','primary','credit')}</div>`,'Review amount, student, and method before continuing.');
}
function startPayment(){
 if(!pendingPayment||!can('pay','fees'))return;
 db.payments.unshift(pendingPayment);audit('Started demo payment',pendingPayment.id,'Unpaid','Processing',pendingPayment.branch);persist();
 paymentStatus(pendingPayment.id);
}
function paymentStatus(id){
 const p=record('payments',id);if(!p)return toast('Payment outside your scope.');
 if(p.status==='Confirmed')return receipt(id);
 modal('Payment status',`<div class="stat-value">${money(p.amount)}</div><p>${studentName(p.student)} · ${p.method}</p>${status(p.status)}${alertBox(p.status==='Processing'?'Processing · awaiting a demo outcome':p.status,p.status==='Pending verification'?'No receipt is available yet. An accountant must verify the bank record.':'No payment provider has confirmed this transaction.')}${p.status==='Processing'||p.status==='Pending verification'&&['office','owner'].includes(role)?`<form id="payment-outcome" data-record="${id}">${formField('outcome','Choose demo outcome','outcome','Successful (demo)')}${['owner','office'].includes(role)?formField('verification','Bank / collection confirmation reference','text',p.reference||''):''}<div class="form-actions">${button('Apply demo outcome','submit','','primary','check','type="submit"')}</div></form>`:`<div class="form-actions">${button('Return to fee statement','paymentReturn','','primary','wallet')}</div>`}`,'Demo gateway · no real funds processed');
}
function applyPaymentOutcome(form){
 const p=record('payments',form.dataset.record);if(!p||!can('pay','fees'))return;
 if(p.status==='Pending verification'&&!['owner','office'].includes(role))return toast('Accountant verification required.');
 const fd=new FormData(form),outcome=fd.get('outcome'),next=outcome==='Successful (demo)'?'Confirmed':outcome;
 if(!['Confirmed','Failed','Cancelled','Pending verification'].includes(next))return;
 const before=p.status;p.status=next;
 if(fd.get('verification'))p.reference=String(fd.get('verification'));
 if(next==='Confirmed'){p.id='DEMO-RC-'+Date.now().toString().slice(-8);p.feeIds.forEach(id=>{const f=record('fees',id);if(f)f.status='Paid'})}
 audit('Recorded demo payment outcome',p.id,before,next,p.branch);notify('Payment '+next.toLowerCase()+' · '+money(p.amount),['owner','office','parent','student'],'fees',p.branch,p.student);
 persist();pendingPayment=null;render();paymentStatus(p.id);toast(next==='Confirmed'?'Demo payment confirmed. A demonstration receipt is available.':'Payment status recorded: '+next+'. No receipt issued.');
}
function recipientOptions(){return [...scope(db.students,'students'),...(['owner','principal'].includes(role)?scope(db.users,'users').filter(u=>['principal','teacher','office'].includes(u.role)&&u.status==='Active').map(u=>({id:'staff:'+u.id,name:u.name,parent:u.name,class:'Staff',branch:u.branch})):[])]}
function composeMessage(category=''){
 if(!can('message','communication'))return toast('Messaging is not enabled for this account.');
 if(isPortal()){activeTab='inbox';navigate('communication');return}
 const template=db.templates.find(t=>t.category===(category|| (role==='office'?'Fees':'General')))||db.templates[0];
 modal('A message that reaches the right people.',`<form id="compose-form"><div class="form-grid">${role==='owner'?formField('branch','School / branch','branch',branch==='all'?'b1':branch):''}${formField('name','Message title','text',category==='Fees'?'Upcoming fee reminder':'School update')}${formField('audience','Recipient group','messageAudience',role==='office'?'Outstanding fees':role==='teacher'?'9 A':'All parents')}<div class="form-field wide"><label for="recipient-search">Individual recipients / search</label><input id="recipient-search" class="field" placeholder="Search students or parents" type="search"><div class="check-list" id="recipient-options" style="max-height:150px;overflow:auto">${recipientOptions().map(s=>`<label class="check-row recipient-row" data-name="${esc(s.name+' '+s.parent)}"><input type="checkbox" name="individual" value="${s.id}"><span>${esc(s.name)} · ${esc(s.parent)} <small class="muted">(${s.class})</small></span></label>`).join('')}</div></div>${formField('template','Message template','template',template.id)}${formField('sender','Authorized sender','sender',scope(db.senders).find(s=>s.default)?.id||'')}${formField('parent','Parent variable','text','Parent / Guardian')}${formField('student','Student variable','text','your child')}${formField('amount','Amount variable','text','₹6,500')}${formField('date','Date variable','text','05 Nov 2026')}${formField('message','Update / custom variable','textarea','Please check the school portal for the latest update.')}${formField('schedule','Schedule (optional)','datetime-local','',true)}</div><div class="chart-note" id="recipient-count">Choose your audience, then preview the exact count.</div><div class="error-text" id="form-error" role="alert"></div><div class="form-actions">${button('Cancel','close')}${button('Preview & confirm','submit','','primary','eye','type="submit"')}</div></form>`,'No message leaves this prototype. Scheduled requests are saved locally.','large');
 updateRecipientCount();
}
function composeRecipients(form){
 const fd=new FormData(form),aud=String(fd.get('audience')),b=role==='owner'?String(fd.get('branch')):branch;
 const students=scope(db.students,'students'),staff=recipientOptions().filter(s=>s.class==='Staff');
 const source=aud==='Staff'?staff:aud==='Individual'?recipientOptions():students;
 return source.filter(s=>s.branch===b&&(aud==='Individual'?fd.getAll('individual').includes(s.id):aud==='Outstanding fees'?db.fees.some(f=>f.student===s.id&&f.status!=='Paid'):['All parents','All students','Staff'].includes(aud)?true:s.class===aud));
}
function updateRecipientCount(){const f=document.getElementById('compose-form');if(f)document.getElementById('recipient-count').innerHTML=icon('users')+composeRecipients(f).length+' recipients in the active branch.'}
let messageDraft=null;
function previewMessage(f){
 const fd=new FormData(f),recipients=composeRecipients(f),t=record('templates',String(fd.get('template'))),sender=scope(db.senders).find(s=>s.id===fd.get('sender')),b=role==='owner'?String(fd.get('branch')):branch;
 if(!recipients.length)return formError('Choose a group with recipients or select at least one individual.');
 if(!t||!sender)return formError('Select an available template and sender.');
 if(role==='teacher'&&t.category==='Fees'||role==='office'&&t.category!=='Fees')return formError('This template category is outside your messaging permissions.');
 if(![b,'all'].includes(sender.branch)||!sender.categories.includes(t.category))return formError('This sender is not authorized for that branch and message category.');
 const schedule=String(fd.get('schedule')||'');if(schedule&&schedule<=new Date(Date.now()+330*60000).toISOString().slice(0,16))return formError('Choose a future schedule in Asia/Kolkata time.');
 const vars={parent:fd.get('parent'),student:fd.get('student'),amount:fd.get('amount'),date:fd.get('date'),message:fd.get('message'),status:'absent'};
 const text=t.notes.replace(/\{\{(\w+)\}\}/g,(_,k)=>vars[k]||'');
 messageDraft={id:uid('ms'),name:String(fd.get('name')),branch:b,sender:sender.id,category:t.category,audience:String(fd.get('audience')),recipients:recipients.map(s=>s.id),notes:text,date:schedule?schedule.slice(0,10):TODAY,time:schedule?schedule.slice(11):'',status:schedule?'Scheduled (demo)':'Failed',delivery:schedule?[]:recipients.map(s=>({student:s.id,status:'Failed',reason:'Service disconnected. No message sent.'}))};
 modal('Review your message',`<div class="detail-grid"><div class="detail-item"><small>From</small><b>${esc(sender.number)}</b></div><div class="detail-item"><small>Audience</small><b>${recipients.length} recipients · ${esc(messageDraft.audience)}</b></div><div class="detail-item"><small>Schedule</small><b>${schedule?date(messageDraft.date)+' · '+messageDraft.time+' IST':'Now'}</b></div><div class="detail-item"><small>School / branch</small><b>${branchName(b)}</b></div></div><div class="panel flat"><p style="white-space:pre-wrap">${esc(text)}</p></div>${alertBox(schedule?'Local schedule only':'Sender disconnected',schedule?'A scheduled demo request will be recorded. This browser does not execute background sending.':'Confirming records a failed attempt with a clear reason. No recipient will be marked delivered or read.')}<div class="form-actions">${button('Cancel','close')}${button(schedule?'Confirm demo schedule':'Record send attempt','confirmMessage','','primary',schedule?'clock':'send')}</div>`,'Confirm audience, sender, content, and time.');
}
function messageDetail(id){
 const m=record('messages',id);if(!m)return toast('Message outside your scope.');
 if(role==='office'&&m.category!=='Fees'||role==='teacher'&&m.category==='Fees'||isPortal()&&!m.recipients.includes(child))return toast('Message outside your permissions.');
 modal(esc(m.name),`${status(m.status)}<div class="detail-grid"><div class="detail-item"><small>Sender</small><b>${esc(db.senders.find(s=>s.id===m.sender)?.number||'Not configured')}</b></div><div class="detail-item"><small>Audience / count</small><b>${esc(m.audience)} · ${m.recipients.length}</b></div><div class="detail-item"><small>Schedule</small><b>${date(m.date)} ${m.time||''} IST</b></div></div><div class="panel flat"><p style="white-space:pre-wrap">${esc(m.notes)}</p></div><h3>Recipient delivery details</h3>${table(['Recipient','Status','Reason'],m.recipients.filter(s=>!isPortal()||s===child).map(id=>{const d=m.delivery?.find(d=>d.student===id);return `<tr><td>${studentName(id)}</td><td>${status(d?.status|| (m.status==='Cancelled'?'Cancelled':'Not sent'))}</td><td style="white-space:normal">${esc(d?.reason||'Demo request only. No delivery or read confirmation.')}</td></tr>`}))}<div class="form-actions">${!isPortal()&&m.status.startsWith('Scheduled')?button('Cancel schedule','cancelMessage',m.id,'danger','close'):''}${!isPortal()&&m.delivery?.some(d=>d.status==='Failed')?button('Retry failed only','retryMessage',m.id,'','refresh'):''}${button('Close','close')}</div>`,branchName(m.branch),'drawer');
}
function conversation(id){
 if(!db.settings.messaging||!can('message','communication'))return toast('School messaging is disabled for this account.');
 const c=record('conversations',id);if(!c||isPortal()&&c.student!==child)return toast('Conversation outside your scope.');
 modal(isPortal()?esc(c.teacher):esc(studentName(c.student))+'’s family',`<div style="display:grid;gap:12px">${c.messages.map(m=>`<div class="panel flat"><b class="text-small">${esc(m.who)}</b><p style="font-size:12px;white-space:pre-wrap">${esc(m.text)}</p><small class="muted">${esc(m.date)}</small></div>`).join('')}</div><form id="conversation-form" data-record="${id}" class="mt">${formField('message','Reply','textarea','')}<div class="form-actions">${button('Send in-app demo reply','submit','','primary','send','type="submit"')}</div></form>`,'In-app demo conversation · browser-local history','drawer');
}
