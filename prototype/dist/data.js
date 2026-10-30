const VERSION='school-v2-demo-5';
const TODAY='2026-10-28';
const ROLE_NAMES={owner:'Owner / Super Admin',principal:'Principal',teacher:'Teacher',parent:'Parent',student:'Student',office:'Office / Accountant'};
const ACCOUNTS={
 owner:{name:'Vikram Mehta',initials:'VM',title:'Super Admin',branch:'all',icon:'shield'},
 principal:{name:'Dr. Ananya Sharma',initials:'AS',title:'Principal',branch:'b1',icon:'school'},
 teacher:{name:'Priya Nair',initials:'PN',title:'Science teacher',branch:'b1',classes:['9 A','9 B'],icon:'book'},
 parent:{name:'Rajesh Kumar',initials:'RK',title:'Parent · 2 children',branch:'b1',children:['s1','s2'],icon:'users'},
 student:{name:'Aarav Kumar',initials:'AK',title:'Student · Class 9 A',branch:'b1',children:['s1'],icon:'graduation'},
 office:{name:'Neha Gupta',initials:'NG',title:'Accountant',branch:'b1',icon:'wallet'}
};
const NAV={
 owner:[['dashboard','Overview','grid'],['branches','Schools & branches','school'],['users','People & access','users'],['approvals','Approvals','check'],['finance','Finance','wallet'],['reports','Reports & insights','chart'],['communication','Communication','message'],['calendar','Calendar','calendar'],['settings','System settings','settings'],['audit','Audit trail','history']],
 principal:[['dashboard','Overview','grid'],['approvals','Approvals','check'],['students','Students','users'],['attendance','Attendance','checkSquare'],['academics','Academic review','book'],['complaints','Parent relations','message'],['announcements','Announcements','megaphone'],['leave','Leave requests','calendar'],['reports','Reports','chart'],['communication','Communication','message']],
 teacher:[['dashboard','Overview','grid'],['classes','My classes','users'],['attendance','Attendance','checkSquare'],['homework','Homework & classwork','book'],['marks','Marks & progress','chart'],['materials','Study materials','folder'],['lessonplans','Lesson plans','file'],['timetable','My timetable','calendar'],['communication','Communication','message'],['leave','My leave','clock']],
 parent:[['dashboard','Overview','grid'],['attendance','Attendance & leave','checkSquare'],['homework','Homework','book'],['exams','Exams & results','chart'],['fees','Fees & payments','wallet'],['timetable','Timetable','calendar'],['calendar','Holidays & events','sun'],['communication','Teacher messages','message'],['documents','Documents','folder'],['profile','Profile & preferences','settings']],
 student:[['dashboard','Overview','grid'],['attendance','My attendance','checkSquare'],['homework','My assignments','book'],['exams','Exams & results','chart'],['fees','Fee statement','wallet'],['timetable','Timetable','calendar'],['materials','Study materials','folder'],['calendar','Events & notices','sun'],['documents','My documents','folder'],['profile','My profile','settings']],
 office:[['dashboard','Overview','grid'],['admissions','Admissions','users'],['fees','Fee collection','wallet'],['finance','Finance & expenses','chart'],['feeStructures','Fee structures','layers'],['discounts','Concessions & fines','percent'],['payroll','Payroll','briefcase'],['documents','Certificates & receipts','file'],['reports','Financial reports','chart'],['communication','Fee reminders','message']]
};
const EXTRA={
 owner:['roles','students','admissions','transfers','attendance','homework','marks','materials','lessonplans','timetable','exams','fees','feeStructures','discounts','expenses','vendors','payroll','documents','announcements','leave','discipline','complaints','meetings','senders','templates','design'],
 principal:['admissions','transfers','marks','lessonplans','timetable','exams','discipline','meetings','users','calendar','design'],
 teacher:['announcements','students','documents','calendar','design'],
 parent:['leave','announcements','complaints','meetings','design'], student:['leave','announcements','design'],office:['expenses','vendors','students','leave','calendar','design']
};
const TITLES={dashboard:'Overview',branches:'Schools & branches',users:'People & access',roles:'Roles & permissions',approvals:'Approval centre',finance:'Financial overview',reports:'Reports & insights',communication:'Communication centre',calendar:'School calendar',settings:'System settings',audit:'Audit trail',students:'Student directory',attendance:'Attendance',academics:'Academic review',complaints:'Parent complaints',announcements:'Announcements',leave:'Leave requests',classes:'My classes',homework:'Homework & classwork',marks:'Marks & progress',materials:'Study materials',lessonplans:'Lesson plans',timetables:'Timetable proposals',timetable:'Weekly timetable',exams:'Exams & results',fees:'Fees & payments',documents:'Documents & certificates',profile:'Profile & preferences',admissions:'Admissions',transfers:'Student transfers',feeStructures:'Fee structures',discounts:'Concessions & fines',payroll:'Staff payroll',expenses:'Expenses & invoices',vendors:'Vendor directory',discipline:'Discipline & wellbeing',meetings:'Parent meetings',senders:'WhatsApp senders',templates:'Message templates',design:'Product design reference',notifications:'Notifications',denied:'Access denied',more:'All modules'};
const SEED={
 branches:[
 {id:'b1',name:'Greenwood · Main Campus',school:'Greenwood International School',city:'New Delhi',principal:'Dr. Ananya Sharma',students:1248,staff:86,attendance:96.4,collected:1842500,status:'Active',address:'Sector 14, Dwarka, New Delhi',phone:'+91 11 4000 2000'},
 {id:'b2',name:'Greenwood · North Campus',school:'Greenwood International School',city:'Gurugram',principal:'Dr. Rohan Kapoor',students:856,staff:61,attendance:94.8,collected:1320000,status:'Active',address:'Sector 46, Gurugram',phone:'+91 124 400 3000'},
 {id:'b3',name:'Greenwood · East Campus',school:'Greenwood International School',city:'Noida',principal:'Meera Joshi',students:672,staff:48,attendance:95.2,collected:985000,status:'Active',address:'Sector 62, Noida',phone:'+91 120 400 1000'}],
 students:[
 {id:'s1',name:'Aarav Kumar',class:'9 A',roll:'01',branch:'b1',parent:'Rajesh Kumar',email:'aarav@example.test',phone:'+91 90000 10001',attendance:96.4,status:'Active'},
 {id:'s2',name:'Ananya Kumar',class:'6 B',roll:'02',branch:'b1',parent:'Rajesh Kumar',email:'ananya@example.test',phone:'+91 90000 10001',attendance:98.1,status:'Active'},
 {id:'s3',name:'Diya Sharma',class:'9 A',roll:'03',branch:'b1',parent:'Sunita Sharma',email:'diya@example.test',phone:'+91 90000 10002',attendance:97.2,status:'Active'},
 {id:'s4',name:'Arjun Patel',class:'9 A',roll:'04',branch:'b1',parent:'Rakesh Patel',email:'arjun@example.test',phone:'+91 90000 10003',attendance:91.2,status:'Active'},
 {id:'s5',name:'Ishaan Verma',class:'9 A',roll:'05',branch:'b1',parent:'Kavita Verma',email:'ishaan@example.test',phone:'+91 90000 10004',attendance:95.8,status:'Active'},
 {id:'s6',name:'Saanvi Singh',class:'9 B',roll:'06',branch:'b1',parent:'Amit Singh',email:'saanvi@example.test',phone:'+91 90000 10005',attendance:98.3,status:'Active'},
 {id:'s7',name:'Kabir Sethi',class:'8 A',roll:'07',branch:'b2',parent:'Pooja Sethi',email:'kabir@example.test',phone:'+91 90000 10006',attendance:94.8,status:'Active'},
 {id:'s8',name:'Myra Kapoor',class:'7 A',roll:'08',branch:'b3',parent:'Sahil Kapoor',email:'myra@example.test',phone:'+91 90000 10007',attendance:95.2,status:'Active'}],
 users:[
 {id:'u1',name:'Dr. Ananya Sharma',role:'principal',branch:'b1',email:'ananya.sharma@example.test',status:'Active'},
 {id:'u2',name:'Priya Nair',role:'teacher',branch:'b1',class:'9 A, 9 B',email:'priya.nair@example.test',status:'Active'},
 {id:'u3',name:'Neha Gupta',role:'office',branch:'b1',email:'neha.gupta@example.test',status:'Active'},
 {id:'u4',name:'Rajesh Kumar',role:'parent',branch:'b1',email:'rajesh.kumar@example.test',status:'Active'},
 {id:'u5',name:'Dr. Rohan Kapoor',role:'principal',branch:'b2',email:'rohan.kapoor@example.test',status:'Active'},
 {id:'u6',name:'Meera Joshi',role:'principal',branch:'b3',email:'meera.joshi@example.test',status:'Active'}],
 admissions:[
 {id:'ad1',name:'Riya Malhotra',class:'8 A',branch:'b1',parent:'Sunil Malhotra',email:'sunil@example.test',phone:'+91 90000 10008',dob:'2013-04-12',status:'Pending approval',submitted:'2026-10-27',notes:'Transfer from Delhi Public School. All documents verified by the office.',attachments:[{name:'Transfer certificate.pdf',sample:true},{name:'Birth certificate.pdf',sample:true}],history:[{who:'Neha Gupta',action:'Submitted for approval',date:'27 Oct 2026, 02:15 PM'}]},
 {id:'ad2',name:'Vivaan Desai',class:'6 B',branch:'b1',parent:'Manisha Desai',email:'manisha@example.test',phone:'+91 90000 10009',status:'Draft',submitted:'2026-10-28',notes:'Awaiting address verification.',history:[]},
 {id:'ad3',name:'Aditi Rao',class:'7 A',branch:'b2',parent:'Sanjay Rao',email:'sanjay@example.test',status:'Pending approval',submitted:'2026-10-26',notes:'Entrance assessment completed.',history:[]}],
 transfers:[{id:'tr1',name:'Dev Khanna',class:'9 A',branch:'b1',destination:'St. Xavier’s School, Jaipur',status:'Pending approval',notes:'Family relocation. No outstanding library dues.',history:[],attachments:[{name:'Parent request.pdf',sample:true}]}],
 attendance:[],
 homework:[
 {id:'hw1',name:'Motion in everyday life',class:'9 A',branch:'b1',subject:'Science',teacher:'Priya Nair',deadline:'2026-10-30',status:'Published',notes:'Observe three examples of motion around you. Describe the type of motion and calculate the speed of one object. Submit a one-page report.',attachments:[{name:'Motion worksheet.pdf',sample:true}],submissions:[],published:'2026-10-27'},
 {id:'hw2',name:'Linear equations · Practice 4.2',class:'9 A',branch:'b1',subject:'Mathematics',teacher:'Rahul Saxena',deadline:'2026-10-29',status:'Published',notes:'Complete questions 1–8 from exercise 4.2. Show every step.',submissions:[]},
 {id:'hw3',name:'The water cycle',class:'6 B',branch:'b1',subject:'Science',teacher:'Ritu Menon',deadline:'2026-10-31',status:'Published',notes:'Draw and label the stages of the water cycle.',submissions:[]},
 {id:'hw4',name:'Cell structure · classwork',class:'9 B',branch:'b1',subject:'Science',teacher:'Priya Nair',deadline:'2026-10-30',status:'Draft',notes:'Label a plant cell and an animal cell.',submissions:[]}],
 marks:[{id:'mk1',name:'Science · Unit test 2',branch:'b1',class:'9 A',subject:'Science',max:50,status:'Pending approval',scores:{s1:44,s3:47,s4:35,s5:42},feedback:'Good understanding of core concepts. Practise numericals.',history:[{who:'Priya Nair',action:'Submitted marks for review',date:'27 Oct 2026, 04:00 PM'}]},
 {id:'mk2',name:'Mathematics · Unit test 1',branch:'b1',class:'9 A',subject:'Mathematics',max:50,status:'Approved',scores:{s1:46,s3:48,s4:38,s5:43},feedback:'Steady progress.',history:[]}],
 leave:[
 {id:'lv1',name:'Priya Nair',branch:'b1',type:'Casual leave',from:'2026-11-02',to:'2026-11-03',notes:'Family commitment. Lesson plan and substitution notes attached.',status:'Pending approval',history:[]},
 {id:'lv2',name:'Aarav Kumar',student:'s1',class:'9 A',branch:'b1',type:'Medical leave',from:'2026-10-20',to:'2026-10-21',notes:'Recovering from seasonal fever.',status:'Approved',history:[{who:'Dr. Ananya Sharma',action:'Approved · Take care and recover well.',date:'19 Oct 2026, 11:00 AM'}]}],
 fees:[
 {id:'fe1',student:'s1',branch:'b1',name:'Tuition fee · November',category:'Tuition',amount:6500,due:'2026-11-05',status:'Unpaid'},
 {id:'fe2',student:'s1',branch:'b1',name:'Transport fee · November',category:'Transport',amount:1800,due:'2026-11-05',status:'Unpaid'},
 {id:'fe3',student:'s2',branch:'b1',name:'Tuition fee · November',category:'Tuition',amount:5200,due:'2026-11-05',status:'Unpaid'},
 {id:'fe4',student:'s3',branch:'b1',name:'Tuition fee · October',category:'Tuition',amount:6500,due:'2026-10-05',status:'Overdue'},
 {id:'fe5',student:'s1',branch:'b1',name:'Tuition fee · October',category:'Tuition',amount:6500,due:'2026-10-05',status:'Paid'},
 {id:'fe6',student:'s7',branch:'b2',name:'Tuition fee · November',category:'Tuition',amount:6000,due:'2026-11-05',status:'Unpaid'}],
 payments:[{id:'RC-2026-1008',name:'October fee payment',student:'s1',branch:'b1',amount:6500,date:'2026-10-04',method:'UPI',status:'Confirmed',feeIds:['fe5'],reference:'DEMO-UPI-1008'}],
 feeStructures:[{id:'fs1',name:'Classes 9–10 · 2026–27',branch:'b1',class:'9 A',amount:6500,frequency:'Monthly',due:'2026-11-05',status:'Active',notes:'Tuition only. Transport billed separately.'}],
 discounts:[{id:'dc1',name:'Merit scholarship',student:'s3',branch:'b1',type:'Scholarship',amount:1000,notes:'Term 2 merit award, approved by the principal.',status:'Approved'}],
 expenses:[{id:'ex1',name:'Science laboratory supplies',branch:'b1',vendor:'EduLab Supplies',category:'Supplies',amount:18500,date:'2026-10-27',status:'Recorded',notes:'Invoice ELS-1042; equipment received.',attachments:[{name:'Invoice ELS-1042.pdf',sample:true}]},{id:'ex2',name:'Campus maintenance',branch:'b1',vendor:'Care Facilities',category:'Maintenance',amount:24000,date:'2026-10-26',status:'Pending reconciliation',notes:'Bank statement confirmation required.'},{id:'ex3',name:'Library books',branch:'b2',vendor:'BookNest',category:'Library',amount:12500,date:'2026-10-25',status:'Recorded',notes:'New academic collection.'}],
 vendors:[{id:'ve1',name:'EduLab Supplies',branch:'b1',email:'accounts@edulab.example.test',phone:'+91 90000 10101',category:'Supplies',status:'Active',notes:'GST invoice required for every purchase.'},{id:'ve2',name:'Care Facilities',branch:'b1',email:'care@example.test',phone:'+91 90000 10102',category:'Maintenance',status:'Active'}],
 payroll:[{id:'pr1',name:'Priya Nair',branch:'b1',role:'Teacher',month:'October 2026',amount:48000,status:'Draft',notes:'No deductions.'},{id:'pr2',name:'Neha Gupta',branch:'b1',role:'Accountant',month:'October 2026',amount:42000,status:'Approved',notes:'Ready for payment recording.'}],
 documents:[{id:'doc1',name:'Bonafide certificate',student:'s1',branch:'b1',type:'Certificate',date:'2026-10-21',status:'Available',notes:'For educational purposes.'},{id:'doc2',name:'Student identity document',student:'s1',branch:'b1',type:'Identity',date:'2026-04-01',status:'Available'},{id:'doc3',name:'Term 1 progress summary',student:'s2',branch:'b1',type:'Report',date:'2026-10-15',status:'Available'}],
 materials:[{id:'ma1',name:'Motion · revision notes',branch:'b1',class:'9 A',subject:'Science',teacher:'Priya Nair',status:'Published',notes:'Key formulas, worked examples, and practice questions.',attachments:[{name:'Motion revision.pdf',sample:true}]}],
 lessonplans:[{id:'lp1',name:'Week 28 · Force and laws of motion',branch:'b1',class:'9 A',subject:'Science',teacher:'Priya Nair',date:'2026-11-02',status:'Pending approval',notes:'Learning objective: relate force, mass, and acceleration. Activity: trolley experiment. Assessment: five-question exit ticket.',history:[]}],
 complaints:[{id:'co1',name:'School bus arrival time',branch:'b1',student:'s1',parent:'Rajesh Kumar',category:'Transport',status:'Open',date:'2026-10-27',notes:'Route 12 has arrived 15 minutes late this week. Please review the timing.',history:[]}],
 meetings:[{id:'me1',name:'Term 1 parent meeting',branch:'b1',student:'s1',teacher:'Priya Nair',date:'2026-11-07',time:'10:30',status:'Scheduled',notes:'Review Aarav’s science progress.'}],
 discipline:[{id:'di1',name:'Classroom participation support',student:'s4',class:'9 A',branch:'b1',date:'2026-10-27',category:'Wellbeing',status:'Open',notes:'Arrange a supportive check-in with class teacher. Record is restricted to authorized school staff.',history:[]}],
 announcements:[{id:'an1',name:'Parent–teacher meeting',branch:'b1',audience:'All',date:'2026-10-28',status:'Published',notes:'Our next parent–teacher meeting is on Saturday, 07 Nov, from 9:00 AM to 12:30 PM. Please book your slot with your class teacher.'},{id:'an2',name:'Diwali break · campus schedule',branch:'all',audience:'All',date:'2026-10-27',status:'Published',notes:'Campus will be closed from 06 to 10 Nov. Classes resume on 11 Nov. Wishing every family a joyful festive break.'}],
 timetables:[{id:'tt1',name:'Class 9 A · Term 2 timetable',branch:'b1',class:'9 A',status:'Pending approval',notes:'Science lab moved to Wednesday, period 3.',history:[]}],
 exams:[{id:'ee1',name:'Science · Unit test 3',branch:'b1',class:'9 A',subject:'Science',date:'2026-11-12',time:'09:00',max:50,status:'Approved',notes:'Duration: 90 minutes. Chapters: Motion and Force.',history:[]},{id:'ee2',name:'Mathematics · Unit test 3',branch:'b1',class:'9 A',subject:'Mathematics',date:'2026-11-13',time:'09:00',max:50,status:'Pending approval',notes:'Duration: 90 minutes.',history:[]}],
 calendar:[{id:'ca1',name:'Parent–teacher meeting',branch:'b1',date:'2026-11-07',type:'Meeting',status:'Scheduled',notes:'9:00 AM–12:30 PM · Main Campus'},{id:'ca2',name:'Diwali break',branch:'all',date:'2026-11-06',type:'Holiday',status:'Scheduled',notes:'06–10 Nov · All campuses'},{id:'ca3',name:'Annual sports day',branch:'b1',date:'2026-11-20',type:'Event',status:'Scheduled',notes:'School grounds · 8:30 AM'}],
 senders:[{id:'wa1',name:'Greenwood · Main office',branch:'b1',number:'+91 90000 20001',credential:'••••••••••••9x2a',status:'Disconnected',default:true,categories:['Fees','General','Attendance']},{id:'wa2',name:'Greenwood · Administration',branch:'all',number:'+91 90000 20002',credential:'••••••••••••6c1b',status:'Setup required',default:false,categories:['General']}],
 templates:[{id:'tm1',name:'Fee reminder',branch:'all',category:'Fees',status:'Demo template',notes:'Dear {{parent}}, a fee of {{amount}} for {{student}} is due on {{date}}. Please check your school portal. — Greenwood School'},{id:'tm2',name:'Attendance notice',branch:'all',category:'Attendance',status:'Demo template',notes:'Dear {{parent}}, {{student}} was marked {{status}} on {{date}}. Contact the school if this needs correction.'},{id:'tm3',name:'School update',branch:'all',category:'General',status:'Demo template',notes:'Dear {{parent}}, {{message}} — Greenwood School'}],
 messages:[{id:'ms1',name:'November fee reminder',branch:'b1',sender:'wa1',category:'Fees',audience:'Outstanding fees',recipients:['s1','s2','s3'],date:'2026-10-30',time:'09:00',status:'Scheduled (demo)',notes:'Dear parent, November fees are due on 05 Nov. Please check your school portal.',delivery:[]},{id:'ms2',name:'Attendance notice',branch:'b1',sender:'wa1',category:'Attendance',audience:'Class 9 A',recipients:['s4'],date:'2026-10-27',status:'Failed',notes:'Dear Rakesh Patel, Arjun Patel was marked absent on 27 Oct 2026.',delivery:[{student:'s4',status:'Failed',reason:'Sender disconnected · demo record'}]}],
 roles:[{id:'role1',name:'Branch administrator',branch:'b1',status:'Active',scope:'Assigned branch',permissions:['view','create','edit','export'],notes:'Office operations only. Academic edits excluded.'}],
 audit:[{id:'au1',name:'Approved October payroll',actor:'Dr. Ananya Sharma',branch:'b1',target:'Neha Gupta',date:'28 Oct 2026, 09:12 AM',before:'Draft',after:'Approved'},{id:'au2',name:'Submitted admission for review',actor:'Neha Gupta',branch:'b1',target:'Riya Malhotra',date:'27 Oct 2026, 02:15 PM',before:'Draft',after:'Pending approval'},{id:'au3',name:'Published homework',actor:'Priya Nair',branch:'b1',target:'Motion in everyday life',date:'27 Oct 2026, 11:40 AM',before:'Draft',after:'Published'}],
 notifications:[{id:'no1',name:'Riya Malhotra’s admission needs review',branch:'b1',roles:['owner','principal'],route:'approvals',date:'Today, 9:15 AM',read:false},{id:'no2',name:'Science marks submitted for approval',branch:'b1',roles:['owner','principal','teacher'],route:'marks',date:'Yesterday, 4:00 PM',read:false},{id:'no3',name:'Parent–teacher meeting announced',branch:'b1',roles:['owner','principal','teacher','parent','student','office'],route:'announcements',date:'Today, 8:45 AM',read:false}],
 conversations:[{id:'cv1',branch:'b1',student:'s1',teacher:'Priya Nair',messages:[{who:'Priya Nair',text:'Aarav has made good progress in science this term. Please encourage him to practise the numericals.',date:'27 Oct 2026, 3:30 PM'}]}],
 settings:{school:'Greenwood International School',tagline:'Smart • Secure • Connected',currency:'INR',timezone:'Asia/Kolkata',dateFormat:'DD MMM YYYY',academicYear:'2026–27',term:'Term 2',messaging:true,attendanceNotifications:true,privacy:'Restricted school records',modules:['Attendance','Academics','Finance','Communication'],notificationEmail:true,notificationWhatsapp:false,retention:'365 days',logo:'GW',twoFactor:true,sessionMinutes:30,weeklyReport:true},
 attendanceDraft:{}, academicYear:'2026–27'
};
let db;
try {db=JSON.parse(localStorage.getItem(VERSION))||structuredClone(SEED)}catch{db=structuredClone(SEED)}
let role=localStorage.getItem(VERSION+'-role')||'owner';
if(!ACCOUNTS[role])role='owner';
let branch=role==='owner'?'all':ACCOUNTS[role].branch;
let child='s1',route='dashboard',search='',filter='All',sort='newest',page=1,activeTab='',classFilter='9 A';
let overlayDirty=false,previousFocus=null,attendanceDraft={},pendingPayment=null;
const MODULES={
 admissions:{fields:[['name','Student full name','text'],['class','Applying for class','class'],['parent','Parent / guardian','text'],['email','Parent email','email'],['phone','Contact number','tel'],['dob','Date of birth','date'],['notes','Application notes','textarea'],['attachments','Supporting documents','file']],initial:'Draft',create:['owner','office'],edit:['owner','office'],approval:true,columns:['Student','Class','Submitted','Status']},
 transfers:{fields:[['name','Student full name','text'],['class','Current class','class'],['destination','Destination school','text'],['notes','Reason for transfer','textarea'],['attachments','Supporting documents','file']],initial:'Draft',create:['owner','office'],edit:['owner','office'],approval:true},
 users:{fields:[['name','Full name','text'],['email','Email address','email'],['role','Account role','role'],['class','Assigned classes (teachers)','text',true],['notes','Access notes','textarea',true]],initial:'Invited (demo)',create:['owner'],edit:['owner']},
 homework:{fields:[['name','Assignment title','text'],['class','Assign to class','class'],['subject','Subject','text'],['deadline','Due date','date'],['notes','Instructions','textarea'],['attachments','Attachments','file'],['schedule','Publish on (optional)','datetime-local',true]],initial:'Draft',create:['owner','teacher'],edit:['owner','teacher']},
 materials:{fields:[['name','Material title','text'],['class','Class','class'],['subject','Subject','text'],['notes','Description','textarea'],['attachments','Files','file']],initial:'Draft',create:['owner','teacher'],edit:['owner','teacher']},
 lessonplans:{fields:[['name','Lesson plan title','text'],['class','Class','class'],['subject','Subject','text'],['date','Week starting','date'],['notes','Objectives, activities & assessment','textarea'],['attachments','Supporting resources','file']],initial:'Draft',create:['owner','teacher'],edit:['owner','teacher'],approval:true},
 leave:{fields:[['type','Leave type','leaveType'],['from','From','date'],['to','To','date'],['notes','Reason and handover notes','textarea'],['attachments','Supporting documents','file']],initial:'Pending approval',create:['owner','principal','teacher','office','parent','student'],edit:['owner'],approval:true},
 expenses:{fields:[['name','Expense title','text'],['vendor','Vendor','text'],['category','Category','text'],['amount','Amount (INR)','number'],['date','Expense date','date'],['notes','Reason / invoice reference','textarea'],['attachments','Invoice','file']],initial:'Recorded',create:['owner','office'],edit:['owner','office']},
 vendors:{fields:[['name','Vendor name','text'],['email','Accounts email','email'],['phone','Contact number','tel'],['category','Category','text'],['notes','Notes','textarea',true]],initial:'Active',create:['owner','office'],edit:['owner','office']},
 payroll:{fields:[['name','Staff member','text'],['role','Position','text'],['month','Payroll month','text'],['amount','Net salary (INR)','number'],['notes','Deductions / adjustments','textarea']],initial:'Draft',create:['owner','office'],edit:['owner','office'],approval:true},
 feeStructures:{fields:[['name','Structure title','text'],['class','Class','class'],['amount','Fee amount (INR)','number'],['frequency','Collection frequency','frequency'],['due','Next due date','date'],['notes','Included services','textarea']],initial:'Active',create:['owner','office'],edit:['owner','office']},
 discounts:{fields:[['name','Concession title','text'],['student','Student','student'],['type','Adjustment type','discountType'],['amount','Amount (INR)','number'],['notes','Authorization and reason','textarea']],initial:'Approved',create:['owner','office'],edit:['owner','office']},
 documents:{fields:[['name','Document title','text'],['student','Student','student'],['type','Document type','documentType'],['notes','Purpose / notes','textarea'],['attachments','Document file (optional)','file']],initial:'Available',create:['owner','office'],edit:['owner','office']},
 announcements:{fields:[['name','Announcement title','text'],['audience','Audience','audience'],['notes','Announcement','textarea'],['date','Display date','date'],['attachments','Attachments','file']],initial:'Draft',create:['owner','principal','teacher'],edit:['owner','principal','teacher']},
 exams:{fields:[['name','Exam name','text'],['class','Class','class'],['subject','Subject','text'],['date','Exam date','date'],['time','Start time','time'],['max','Maximum marks','number'],['notes','Instructions','textarea']],initial:'Pending approval',create:['owner','principal'],edit:['owner','principal'],approval:true},
 timetables:{fields:[['name','Timetable title','text'],['class','Class','class'],['notes','Schedule change details','textarea'],['attachments','Timetable document','file']],initial:'Pending approval',create:['owner','principal'],edit:['owner','principal'],approval:true},
 discipline:{fields:[['name','Case title','text'],['student','Student','student'],['category','Category','text'],['date','Recorded date','date'],['notes','Observations and support plan','textarea']],initial:'Open',create:['owner','principal'],edit:['owner','principal']},
 complaints:{fields:[['name','Subject','text'],['student','Student','student'],['category','Category','text'],['notes','Describe the concern','textarea'],['attachments','Supporting documents','file']],initial:'Open',create:['owner','principal','parent'],edit:['owner','principal']},
 meetings:{fields:[['name','Meeting title','text'],['student','Student','student'],['teacher','Teacher','text'],['date','Meeting date','date'],['time','Meeting time','time'],['notes','Agenda','textarea']],initial:'Scheduled',create:['owner','principal','parent'],edit:['owner','principal']},
 calendar:{fields:[['name','Event name','text'],['type','Event type','eventType'],['date','Date','date'],['notes','Location and details','textarea']],initial:'Scheduled',create:['owner','principal'],edit:['owner','principal']},
 templates:{fields:[['name','Template name','text'],['category','Category','category'],['notes','Message body (use {{parent}}, {{student}}, {{amount}}, {{date}})','textarea']],initial:'Demo template',create:['owner'],edit:['owner']},
 roles:{fields:[['name','Role name','text'],['scope','Record scope','roleScope'],['notes','Description','textarea']],initial:'Active',create:['owner'],edit:['owner']}
};
function persist(){try{localStorage.setItem(VERSION,JSON.stringify(db));return true}catch{toast('Storage is full. Download a demo snapshot in Settings before adding more files.');return false}}
function account(){return ACCOUNTS[role]}
function accessActive(){return role==='owner'||!['Inactive','Archived'].includes(db.users.find(u=>u.name===account().name)?.status)}
function isPortal(){return ['parent','student'].includes(role)}
function branchName(id){return db.branches.find(x=>x.id===id)?.name||(id==='all'?'All campuses':'Unassigned')}
function studentName(id){if(String(id).startsWith('staff:'))return db.users.find(u=>u.id===String(id).slice(6))?.name||'Staff member';return db.students.find(x=>x.id===id)?.name||id||'—'}
function studentClass(){return db.students.find(x=>x.id===child)?.class||'9 A'}
function scope(rows,kind=''){if(rows===db.branches)kind='branches';return rows.filter(x=>{
 if(!accessActive())return false;
 if(role==='principal'&&!authorizedBranches().includes(branch))return false;
 if(kind==='branches')return role==='owner'?(branch==='all'||x.id===branch):x.id===branch;
 if(role==='owner')return branch==='all'||x.branch===branch||x.branch==='all';
 if(x.branch && ![branch,'all'].includes(x.branch))return false;
 if(isPortal()){
  if(x.student && x.student!==child)return false;
  if(kind==='students' && x.id!==child)return false;
  if(x.class && x.class!==studentClass())return false;
  if(['homework','materials','announcements','exams','marks','timetables'].includes(kind)&&!['Published','Approved','Available'].includes(x.status))return false;
  if(x.audience && !['All','Parents','Students',studentClass()].includes(x.audience))return false;
 }
 if(role==='teacher'){
  if(x.student){const student=db.students.find(s=>s.id===x.student);if(!student||!account().classes.includes(student.class))return false;}
  if(x.class&&!account().classes.includes(x.class))return false;
  if(kind==='leave'&&x.name!==account().name)return false;
  if(kind==='users'&&!['teacher','principal'].includes(x.role))return false;
 }
 if(kind==='leave'&&['parent','student'].includes(role)&&x.student!==child)return false;
 return true;
})}
function allowedRoute(r){if(!accessActive()&&!['profile','denied','design','more'].includes(r))return false;if(r==='timetables')return allowedRoute('timetable');if(r==='communication'&&isPortal()&&!db.settings.messaging)return false;return ['profile','notifications','denied','more','design'].includes(r)||NAV[role].some(x=>x[0]===r)||EXTRA[role].includes(r)||role==='owner'&&!!TITLES[r]||role==='principal'&&['materials','homework'].includes(r)}
function can(action,kind,record=null){
 if(!accessActive())return false;
 if(role==='principal'&&!authorizedBranches().includes(branch))return false;
 if(!allowedRoute(kind)&&kind!=='marks'&&kind!=='announcements')return false;
 if(record&&!scope([record],kind).length)return false;
 if(role==='owner')return true;
 if((db.overrides||[]).some(o=>o.role===role&&o.module===kind&&o.action===action&&!o.allowed))return false;
 if(action==='approve')return role==='principal'&&['admissions','transfers','marks','lessonplans','leave','exams','timetables','payroll'].includes(kind)&&record?.name!==account().name;
 if(action==='export')return !['student'].includes(role)&&!['users','roles','audit','settings'].includes(kind);
 if(action==='create'||action==='edit'){
  if(!MODULES[kind]?.[action]?.includes(role))return false;
  if(role==='teacher'&&record&&['homework','materials','lessonplans','announcements'].includes(kind)&&record.teacher!==account().name)return false;
  return true;
 }
 if(action==='archive')return ['office'].includes(role)&&['expenses','vendors','feeStructures','discounts','documents'].includes(kind);
 if(action==='pay')return ['parent','office'].includes(role);
 if(action==='mark')return role==='teacher';
 if(action==='publish')return ['principal'].includes(role)&&kind==='announcements'||role==='teacher'&&['homework','materials','announcements'].includes(kind)&&(!record||record.teacher===account().name);
 if(action==='message')return db.settings.messaging&&['principal','teacher','parent','office'].includes(role);
 return false;
}
function audit(action,target,before='',after='',recordBranch=branch){
 db.audit.unshift({id:uid('au'),name:action,actor:account().name,branch:recordBranch==='all'?'b1':recordBranch,target,date:now(),before,after});
}
function notify(name,roles,route,recordBranch=branch,student=null,cls=null){
 db.notifications.unshift({id:uid('no'),name,roles,route,branch:recordBranch==='all'?'b1':recordBranch,date:now(),student,class:cls,read:false});
}
function uid(prefix='r'){return prefix+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)}
function now(){return new Date().toLocaleString('en-IN',{timeZone:db.settings.timezone||'Asia/Kolkata',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
function date(v){if(!v)return '—';const d=new Date(v);return isNaN(+d)?v:d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'})}
function money(v){return new Intl.NumberFormat('en-IN',{style:'currency',currency:db.settings.currency||'INR',maximumFractionDigits:0}).format(+v||0)}
function esc(v=''){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function initials(v){return String(v).split(' ').slice(0,2).map(x=>x[0]).join('')}
function unread(){return scope(db.notifications).filter(x=>x.roles.includes(role)&&(!x.student||!isPortal()||x.student===child)&&!x.read).length}
