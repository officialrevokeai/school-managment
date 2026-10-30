const FOCUS_NAV={
 owner:['dashboard','approvals','branches','finance','communication'],
 principal:['dashboard','approvals','students','attendance','communication'],
 teacher:['dashboard','classes','attendance','homework','marks'],
 parent:['dashboard','attendance','homework','fees','communication'],
 student:['dashboard','homework','attendance','exams','timetable'],
 office:['dashboard','admissions','fees','finance','communication']
};
const SHORT_NAV={dashboard:'Home',branches:'Campuses',users:'People',approvals:'Approvals',finance:'Finance',communication:'Messages',students:'Students',attendance:'Attendance',classes:'My classes',homework:'Homework',marks:'Progress',fees:'Fees',admissions:'Admissions',exams:'Results',timetable:'Timetable'};
function focusNavigation(){
 const core=FOCUS_NAV[role].map(r=>NAV[role].find(x=>x[0]===r)).filter(Boolean).filter(x=>allowedRoute(x[0]));
 if(route!=='more'&&!core.some(x=>x[0]===route)&&NAV[role].some(x=>x[0]===route))core.push(NAV[role].find(x=>x[0]===route));
 return core.map(([r,t,i])=>[r,SHORT_NAV[r]||t,i]);
}
function focusActions(items){return `<div class="focus-actions" aria-label="Quick actions">${items.filter(([,action,id])=>action==='create'?can('create',id):action==='enterMarks'?can('mark','marks'):action==='compose'?can('message','communication'):action==='recordPayment'?can('pay','fees'):true).map(([label,action,id,ico],i)=>`<button class="focus-action tint-${i%4}" data-action="${action}" data-id="${id}"><span class="focus-action-icon">${icon(ico)}</span><span>${label}</span>${icon('arrow')}</button>`).join('')}</div>`}
function dashboard(){
 if(localStorage.getItem(VERSION+'-dashboard-'+role)==='detailed')return `<div class="view-control">${button('Back to simple view','dashboardView','simple','small','grid')}</div>`+dashboardDetailed();
 const name=account().name.replace('Dr. ','').split(' ')[0];
 const mainAction={owner:['Review approvals','go','approvals','check'],principal:['Review approvals','go','approvals','check'],teacher:['Take attendance','go','attendance','checkSquare'],office:['Record payment','recordPayment','','wallet'],parent:['View homework','go','homework','book'],student:['View homework','go','homework','book']}[role];
 const hero=`<section class="welcome-banner"><div class="welcome-content"><span class="welcome-pill">${icon('sun')} A little simpler. A lot more connected.</span><h1>Welcome back, <span>${esc(name)}.</span></h1><p>${{owner:'Your schools, people, and priorities — all in one place.',principal:'Everything you need to keep your school day moving.',teacher:'Your classes, your students, and your next small win.',office:'Admissions and accounts, without the extra noise.',parent:'A clear view of '+studentName(child).split(' ')[0]+'’s school day.',student:'Your learning, your progress, your next step.'}[role]}</p><div class="welcome-buttons">${button(mainAction[0],mainAction[1],mainAction[2],'primary',mainAction[3])}${button('More details','dashboardView','detailed','ghost','chart')}</div></div><div class="welcome-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-tile">${icon('book')}<i></i><i></i></div><div class="art-spark">${icon('check')}</div><span>Room to grow.</span></div></section>`;
 let stats='',actions=[],left='',right='';
 if(role==='owner'||role==='principal'){
  const branches=scope(db.branches),students=branches.reduce((a,b)=>a+b.students,0),att=branches.reduce((a,b)=>a+b.attendance,0)/Math.max(1,branches.length);
  stats=stat('Students',students.toLocaleString('en-IN'),'','enrolled this year','users')+stat('Attendance',att.toFixed(1)+'%','','current overview','checkSquare')+stat(role==='owner'?'Fees collected':'Teaching & staff',role==='owner'?money(branches.reduce((a,b)=>a+b.collected,0)):branches.reduce((a,b)=>a+b.staff,0),'',role==='owner'?'this month':'across your campus','wallet')+stat('Needs review',approvalRows().length,'','requests awaiting you','check');
  actions=role==='owner'?[['Add campus','createBranch','','school'],['Invite someone','create','users','users'],['Send a notice','compose','','message'],['View reports','go','reports','chart']]:[['Publish notice','create','announcements','megaphone'],['Review lessons','go','academics','book'],['Parent concerns','go','complaints','message'],['View reports','go','reports','chart']];
  left=panel('Needs your attention',approvalPreview(4),link('View all','approvals','small ghost'),'A short list of what matters next','focus-panel');
  right=panel('Attendance at a glance',attendanceRing(att,students),link('Open register','attendance','small ghost'),'A small overview of your school day','focus-panel');
 }else if(role==='teacher'){
  stats=stat('Classes today','4','','your teaching schedule','book')+stat('Attendance tasks','2','','classes 9 A & 9 B','checkSquare')+stat('Assignments',scope(db.homework,'homework').filter(h=>h.status==='Published').length,'','published to your classes','file')+stat('Pending results',scope(db.marks,'marks').filter(m=>m.status!=='Approved').length,'','awaiting review','chart');
  actions=[['Take attendance','go','attendance','checkSquare'],['Create homework','create','homework','book'],['Enter marks','enterMarks','','chart'],['Request leave','create','leave','calendar']];
  left=panel('Your day, at a glance',todayLessons(),link('Timetable','timetable','small ghost'),'One class at a time.','focus-panel');
  right=panel('Assignments to follow up',homeworkCards(2),link('View all','homework','small ghost'),'Your latest classwork and deadlines','focus-panel');
 }else if(isPortal()){
  const student=db.students.find(s=>s.id===child),balance=scope(db.fees,'fees').filter(f=>f.status!=='Paid').reduce((a,f)=>a+f.amount,0);
  stats=stat('Attendance',student.attendance+'%','','this academic year','checkSquare')+stat('Homework',scope(db.homework,'homework').length,'','published assignments','book')+stat('Next exam','12 Nov','','Science · 9:00 AM','calendar')+stat('Fee balance',money(balance),'','due 05 Nov','wallet');
  actions=[['Homework','go','homework','book'],['Timetable','go','timetable','calendar'],['Fees & receipts','go','fees','wallet'],['Request leave','create','leave','sun']];
  left=panel('Learning this week',homeworkCards(3),link('All homework','homework','small ghost'),esc(student.name)+' · Class '+student.class,'focus-panel');
  right=panel('From your school',announcementPreview(),link('All notices','announcements','small ghost'),'The updates you need to know','focus-panel');
 }else{
  const balance=scope(db.fees).filter(f=>f.status!=='Paid').reduce((a,f)=>a+f.amount,0),today=scope(db.payments).filter(p=>p.date===TODAY&&p.status==='Confirmed').reduce((a,p)=>a+p.amount,0);
  stats=stat('Collected today',money(today),'','confirmed payments','wallet')+stat('Outstanding fees',money(balance),'','your campus','clock')+stat('Admissions',scope(db.admissions).filter(a=>a.status==='Pending approval').length,'','awaiting review','users')+stat('To reconcile',scope(db.expenses).filter(e=>e.status==='Pending reconciliation').length,'','records to check','file');
  actions=[['New admission','create','admissions','users'],['Collect fees','recordPayment','','wallet'],['Add expense','create','expenses','plus'],['Fee reminder','compose','Fees','message']];
  left=panel('Recent collections',paymentsTable(),link('All payments','fees','small ghost'),'Clear records, confirmed amounts','focus-panel');
  right=panel('Admissions in progress',scope(db.admissions).slice(0,3).map(a=>`<div class="approval"><span class="avatar">${initials(a.name)}</span><div style="flex:1"><b>${esc(a.name)}</b><small>Class ${a.class}</small></div>${button('Open','detail','admissions:'+a.id,'small ghost','chevron')}</div>`).join('')||empty('All caught up'),link('View admissions','admissions','small ghost'),'Follow each student’s next step','focus-panel');
 }
 return `<div class="focus-dashboard">${hero}<div class="stats focus-stats">${stats}</div><div class="section-heading"><h2>What would you like to do?</h2><a href="#/more">Explore all tools ${icon('arrow')}</a></div>${focusActions(actions)}<div class="focus-grid">${left}${right}</div><div class="focus-more">${icon('layers')}<span>Need something else? All your school tools are still one tap away.</span>${link('All tools','more','small')}</div></div>`;
}
function moreScreen(){
 const available=[...new Set([...NAV[role].map(x=>x[0]),...EXTRA[role]])].filter(allowedRoute);
 const groups=[
 ['Everyday essentials','The tools you reach for most often.','dashboard attendance homework classes timetable announcements calendar communication leave profile notifications'.split(' ')],
 ['Students & learning','Admissions, academic work, and student support.','students admissions transfers marks exams materials lessonplans academics discipline complaints meetings'.split(' ')],
 ['Fees & office','Collections, records, and financial reporting.','finance fees feeStructures discounts expenses vendors payroll documents reports'.split(' ')],
 ['School & settings','Campus setup, access, and administration.','branches users roles settings audit senders templates design'.split(' ')]
 ];
 return heading('Find your next task.','Everything is here, neatly grouped for your role.',button('Switch demo account','roles','','ghost','users'))+`<div class="module-search searchfield">${icon('search')}<input id="module-search" class="field" type="search" placeholder="Find a tool, like attendance or fees…" aria-label="Find a tool"></div><div class="module-groups">${groups.map(([title,desc,items])=>{const links=items.filter(r=>available.includes(r));return links.length?`<section class="module-group"><div class="section-heading"><div><h2>${title}</h2><p>${desc}</p></div></div><div class="module-links">${links.map(r=>`<a class="module-entry" href="#/${r}" data-name="${esc(TITLES[r])}"><span class="module-icon">${icon(NAV[role].find(x=>x[0]===r)?.[2]||'folder')}</span><span>${TITLES[r]}</span>${icon('chevron')}</a>`).join('')}</div></section>`:''}).join('')}</div><p id="module-empty" class="muted" hidden>No matching tools. Try a shorter name.</p>`;
}
