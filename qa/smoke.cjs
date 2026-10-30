const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const elements=new Map(),storage=new Map();
const blank={innerHTML:'',classList:{add(){},remove(){}},focus(){},querySelector(){return null},append(){}};
class DemoFormData{constructor(form){this.fields=form?.fields||{}}get(k){let v=this.fields[k];return Array.isArray(v)?v[0]??null:v??null}getAll(k){let v=this.fields[k];return v==null?[]:Array.isArray(v)?v:[v]}has(k){return this.get(k)!=null}}
const context={console,assert,structuredClone,Date,Math,Intl,JSON,URL,Blob,URLSearchParams,
 setTimeout(){},clearTimeout(){},confirm:()=>true,FormData:DemoFormData,FileReader:class{},
 localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 location:{hash:'#/dashboard',search:''},
 window:{scrollY:0,scrollTo(){},addEventListener(){}},
 document:{getElementById:id=>elements.get(id)||blank,querySelector(){return null},querySelectorAll(){return []},addEventListener(){},activeElement:null},elements};
vm.createContext(context);
for(const file of ['data','docs','app','screens','system','actions','workflows','focus','events'])vm.runInContext(fs.readFileSync('dist/'+file+'.js','utf8'),context,{filename:file+'.js'});
const spec=String.raw`
(async()=>{
let count=0;const check=(value,message)=>{assert.ok(value,message);count++};
function accountAs(r,b){role=r;branch=b||(r==='owner'?'all':ACCOUNTS[r].branch);child='s1';activeTab='';route='dashboard';search='';filter='All';page=1;overlayDirty=false;window.registerDirty=false}
function form(id,fields,dataset={}){return {id,fields,dataset,reportValidity:()=>true,querySelector:()=>({files:[]}),elements:{}}}
const downloads=[];download=(name,content,type)=>downloads.push({name,content,type});const notices=[];toast=msg=>notices.push(msg);
let rendered=0;
for(const r of Object.keys(ACCOUNTS)){
 accountAs(r);
 for(const dest of [...NAV[r].map(n=>n[0]),...EXTRA[r],'profile','notifications','denied','more']){
  route=dest;check(shell().includes('<main'),r+' '+dest+' renders');rendered++;
 }
}
accountAs('owner');
for(const [r,tabsToCheck] of Object.entries({settings:['identity','academic','security','notifications','backup'],design:['sitemap','permissions','system','flows','mobile','coverage'],communication:['history','scheduled','inbox','senders','templates'],fees:['dues','payments','allFees']})){
 route=r;for(const tab of tabsToCheck){activeTab=tab;check(shell().includes('<main'),r+' '+tab+' renders')}
}
check(COVERAGE.length===196,'196 requirements mapped');
accountAs('owner','b2');check(scope(db.branches).length===1&&scope(db.branches)[0].id==='b2','owner campus filter controls branch aggregates');
check(scope(db.students,'students').every(s=>s.branch==='b2'),'owner scoped roster');
accountAs('principal');check(scope(db.branches).length===1&&scope(db.branches)[0].id==='b1','principal has no cross-campus report totals');
check(!allowedRoute('settings')&&!allowedRoute('finance'),'principal restricted routes');
check(approvalRows().some(r=>r.kind==='timetables'),'timetable proposals are reviewable');
accountAs('teacher');check(!can('edit','expenses',db.expenses[0]),'teacher cannot edit financial records');
check(!scope(db.students,'students').some(s=>s.id==='s2'||s.id==='s7'),'teacher class and branch scope');
check(!can('edit','announcements',db.announcements[0]),'teacher cannot edit school announcements');
accountAs('parent');check(scope(db.students,'students').length===1&&scope(db.students,'students')[0].id==='s1','parent selected-child scope');
check(scope(db.fees,'fees').every(f=>f.student==='s1'),'parent fee scope');
child='s2';check(scope(db.fees,'fees').every(f=>f.student==='s2'),'parent linked-child switch');
accountAs('student');check(!can('pay','fees'),'student cannot collect or pay fees');
db.settings.messaging=false;accountAs('parent');check(!allowedRoute('communication')&&!shell().includes('Teacher messages'),'parent messaging hidden by school policy');db.settings.messaging=true;
// 1. Owner branch setup, principal assignment, explicit restrictions.
accountAs('owner');route='branches';
await handleSubmit(form('branch-form',{name:'West Campus',school:db.settings.school,city:'Jaipur',address:'Campus Road',phone:'+91 90000 10011',principal:'u1'}));
const newBranch=db.branches.at(-1);
check(newBranch.principal===ACCOUNTS.principal.name,'branch assigns principal');
accountAs('principal',newBranch.id);check(authorizedBranches().includes(newBranch.id)&&scope(db.branches)[0].id===newBranch.id,'assigned principal can select new branch');
accountAs('owner');await handleSubmit(form('override-form',{role:'teacher',module:'homework',action:'create',allowed:'false',reason:'QA restriction'}));
accountAs('teacher');check(!can('create','homework'),'explicit deny enforced in action policy');db.overrides=[];
// 2. Admission submit and approval updates a real demo student record.
accountAs('office');check(can('edit','admissions',db.admissions[1])&&!can('approve','admissions',db.admissions[0]),'office can prepare but cannot approve');
changeStatus('admissions','ad2','Pending approval','Ready for review');
accountAs('principal');const priorCount=db.students.length;check(can('approve','admissions',db.admissions[1]),'principal authorized to decide');
changeStatus('admissions','ad2','Approved','Verified documents');
check(db.students.length===priorCount+1&&db.students.some(s=>s.admission==='ad2'),'approval inserts student');
check(db.admissions[1].history.some(h=>h.action.includes('Verified documents')),'admission decision history retained');
// 3. Teacher attendance propagates and disconnected notifications never fake delivery.
accountAs('teacher');route='attendance';classFilter='9 A';attendanceDate=TODAY;
attendanceDraft[attendanceKey()]=Object.fromEntries(scope(db.students,'students').filter(s=>s.class===classFilter).map(s=>[s.id,s.id==='s4'?'Absent':'Present']));
attendanceSave(true);check(db.attendance.length===1,'submitted attendance retained');
check(db.messages.some(m=>m.recipients.includes('s4')&&m.status==='Failed'),'absence creates failed communication record');
check(!db.messages.some(m=>m.status==='Delivered'||m.status==='Read'),'no fabricated receipts');
accountAs('parent');route='attendance';check(scope(db.attendance).some(a=>a.entries.s1==='Present'),'parent can read own attendance');
await handleAction('attendanceExport','');check(!downloads.at(-1).content.includes('s3'),'parent attendance export excludes classmates');
// 4. Publish homework and submit through the portal.
accountAs('teacher');route='homework';
await saveRecord(form('record-form',{name:'QA motion assignment',class:'9 A',subject:'Science',deadline:'2026-10-30',notes:'Explain three examples of motion.'},{kind:'homework',record:''}));
const homework=db.homework[0];check(homework.status==='Draft','homework draft saved');
changeStatus('homework',homework.id,'Published','Published to class 9 A');
accountAs('student');check(scope(db.homework,'homework').some(h=>h.id===homework.id),'student sees published class work');
await handleSubmit(form('submission-form',{text:'A moving bus, a spinning fan, and a swinging pendulum.'},{record:homework.id}));
check(homework.submissions.some(s=>s.student==='s1'),'student submission saved');
accountAs('teacher');await handleSubmit(form('feedback-form',{feedback:'Clear examples. Add the type of motion.'},{homework:homework.id,index:'0'}));
accountAs('parent');check(record('homework',homework.id).submissions[0].feedback.includes('Clear examples'),'parent sees feedback');
// 5. Scores validated, submitted, approved, then exposed in report card.
accountAs('teacher');route='marks';
const markFields={name:'QA Science assessment',class:'9 A',subject:'Science',max:'50',feedback:'Good progress.',...Object.fromEntries(scope(db.students).filter(s=>s.class==='9 A').map(s=>['score-'+s.id,'44']))};
const markForm=form('marks-form',markFields,{record:''});elements.set('marks-form',markForm);saveMarks('Pending approval');
const mark=db.marks[0];check(mark.status==='Pending approval','marks await review');
accountAs('student');check(!scope(db.marks,'marks').some(m=>m.id===mark.id),'pending marks hidden from portal');
accountAs('principal');changeStatus('marks',mark.id,'Approved','Checked scores against assessment sheets');
accountAs('student');await handleAction('reportCard',mark.id);
check(downloads.at(-1).content.includes('QA Science assessment')&&!downloads.at(-1).content.includes('Diya Sharma'),'report card contains own approved scores');
// 6. Payment failed path, pending verification path, confirmed receipt gate.
accountAs('parent');route='fees';
const paymentForm=form('payment-review',{fee:['fe1'],method:'UPI'},{office:'false'});
reviewPayment(paymentForm);startPayment();let payment=db.payments[0];
check(payment.status==='Processing'&&db.fees.find(f=>f.id==='fe1').status==='Unpaid','start payment does not confirm payment');
const downloadBefore=downloads.length;await handleAction('downloadReceipt',payment.id);check(downloads.length===downloadBefore,'receipt unavailable during processing');
applyPaymentOutcome(form('payment-outcome',{outcome:'Failed'},{record:payment.id}));
check(payment.status==='Failed'&&db.fees.find(f=>f.id==='fe1').status==='Unpaid','failed payment leaves fees unpaid');
reviewPayment(paymentForm);startPayment();payment=db.payments[0];applyPaymentOutcome(form('payment-outcome',{outcome:'Pending verification'},{record:payment.id}));
check(payment.status==='Pending verification'&&db.fees.find(f=>f.id==='fe1').status==='Unpaid','verification state has no settlement');
accountAs('office');applyPaymentOutcome(form('payment-outcome',{outcome:'Successful (demo)',verification:'DEMO-BANK-QA-1'},{record:payment.id}));
check(payment.status==='Confirmed'&&db.fees.find(f=>f.id==='fe1').status==='Paid','verified demo confirmation settles fee');
accountAs('parent');await handleAction('downloadReceipt',payment.id);check(downloads.at(-1).content.includes('No real funds'),'confirmed receipt explicitly demo');
// 7. Announcement audience controls.
accountAs('principal');route='announcements';
await saveRecord(form('record-form',{name:'QA class notice',audience:'9 A',notes:'Science activity on Friday.',date:TODAY},{kind:'announcements',record:''}));
const notice=db.announcements[0];changeStatus('announcements',notice.id,'Published','Selected class 9 A');
accountAs('parent');check(scope(db.announcements,'announcements').some(a=>a.id===notice.id),'matching child sees published announcement');
child='s2';check(!scope(db.announcements,'announcements').some(a=>a.id===notice.id),'other linked child does not see unrelated class announcement');
// 8. Sender default + authorized scheduled fee reminder + failed-only retry.
accountAs('owner');route='senders';await handleAction('defaultSender','wa1');
check(db.senders.find(s=>s.id==='wa1').default,'default sender configured');
accountAs('office');route='communication';
previewMessage(form('compose-form',{name:'QA fee reminder',audience:'Outstanding fees',template:'tm1',sender:'wa1',parent:'Parent',student:'your child',amount:'₹6,500',date:'05 Nov 2026',message:'Fees due',schedule:'2099-11-01T09:00'}));
check(messageDraft.status==='Scheduled (demo)'&&messageDraft.recipients.length>0,'authorized reminder schedule previews real scoped recipient count');
await handleAction('confirmMessage','');const scheduled=db.messages[0];
check(scheduled.status==='Scheduled (demo)'&&scheduled.delivery.length===0,'local schedule has no invented delivery receipts');
scheduled.status='Failed';scheduled.delivery=[{student:'s1',status:'Delivered',reason:'Fixture only'},{student:'s3',status:'Failed',reason:'Disconnected'}];
await handleAction('retryMessage',scheduled.id);check(scheduled.delivery[0].reason==='Fixture only'&&scheduled.delivery[1].reason.includes('Retry blocked'),'retry touches failures only');
// 9. Staff leave request and recorded principal decision.
accountAs('teacher');route='leave';await saveRecord(form('record-form',{type:'Casual leave',from:'2026-11-15',to:'2026-11-16',notes:'Fictional QA request.'},{kind:'leave',record:''}));
const leave=db.leave[0];check(leave.name==='Priya Nair'&&leave.status==='Pending approval','staff leave submitted');
accountAs('principal');check(can('approve','leave',leave),'principal can review staff leave');changeStatus('leave',leave.id,'Approved','Cover arranged.');
accountAs('teacher');check(scope(db.leave,'leave').some(l=>l.id===leave.id&&l.history.some(h=>h.action.includes('Cover arranged'))),'requester sees decision comments');
// Reports and search obey scope.
accountAs('owner','b2');route='reports';generateReport(form('report-form',{reportType:'Financial reconciliation',from:'2026-10-01',to:TODAY}));
check(!downloads.at(-1).content.includes('Aarav Kumar')&&!downloads.at(-1).content.includes('Neha Gupta'),'branch financial export excludes other campuses');
accountAs('parent');workspaceSearch('Diya Sharma');check(!document.getElementById('overlays').innerHTML.includes('<b>Diya Sharma</b>'),'search does not reveal an unrelated student record');
check(db.audit.some(a=>a.actor==='Priya Nair'&&a.before&&a.after&&a.branch&&a.date),'audit includes actor, before, after, branch and time');
console.log(JSON.stringify({checks:count,renderedRoleRoutes:rendered,coreFlows:9,coverage:COVERAGE.length,status:'passed'}));
})()
`;
Promise.resolve(vm.runInContext(spec,context,{filename:'workflow-checks.js'})).catch(e=>{console.error(e);process.exitCode=1});
