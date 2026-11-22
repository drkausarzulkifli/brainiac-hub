// UI mirrors the authenticated server role. api.php independently enforces every write.
const demoRoles={admin:'Admin',teacher:'Cikgu',therapist:'Terapis'};
const demoAccess={admin:null,teacher:['dashboard','students','student-history','sessions','attendance','plans','class-notes','progress-reports','staff-attendance','leaves','claims','payroll'],therapist:['dashboard','students','student-history','sessions','attendance','assessments','therapy-sessions','progress-reports']};
let demoRole=null;
function demoCanAccess(module){return Object.hasOwn(demoRoles,demoRole)&&(demoRole==='admin'||demoAccess[demoRole].includes(module))}
function demoDeny(){notify('Modul ini tidak tersedia untuk peranan '+demoRoles[demoRole]+'.');return false}
function demoBookingModule(b){return b?.mode==='eip'?'class-notes':b?.purpose==='therapy'?'therapy-sessions':'assessments'}
const demoFormModules={'staff-form':'staff','study-plan-form':'plans','class-note-form':'class-notes','note-existing-session-form':'class-notes','note-start-session-form':'class-notes','assessment-form':'assessments','therapy-note-form':'therapy-sessions','therapy-soap-form':'therapy-sessions','progress-form':'progress-reports','student-form':'students','slot-form':'sessions','add-form':'sessions','clock-in-form':'staff-attendance','clock-out-form':'staff-attendance','admin-attendance-form':'staff-attendance','hr-settings-form':'staff-attendance','apply-leave-form':'leaves','admin-quota-form':'leaves','apply-claim-form':'claims','admin-claim-limit-form':'claims','admin-payroll-profile-form':'payroll'};
function demoActionModule(el){
 if(!el)return null;const d=el.dataset||{},id=el.id||'';
 if(d.go)return d.go;if(el.tagName==='A'&&el.getAttribute('href')?.startsWith('#'))return el.getAttribute('href').slice(1);
 if(d.bookingWork)return demoBookingModule(plannerBookings().find(b=>b.key===d.bookingWork));
 if(d.session||d.finish){const s=data.sessions.find(s=>s.id===Number(d.session||d.finish));return s?.programme==='EIP'?'class-notes':'therapy-sessions'}
 if(['reset','confirm-reset'].includes(id))return 'staff';
 if(id==='notifications')return 'plans';if(id==='export'||id==='account-backup'||d.backupFormat)return 'reports';
 if(d.viewStaff||d.editStaff)return 'staff';
 if(d.newStudy!==undefined||d.editStudy||d.plan)return 'plans';
 if(d.historyAssessment||d.slotAssessment||d.assessmentType||d.assessmentOpen||d.assessment||id.startsWith('assessment-'))return 'assessments';
 if(d.therapyOpen||d.therapyMode||d.therapyDay||id==='soap-add-target')return 'therapy-sessions';
 if(d.noteFromPlan||['new-class-note','preload-plan','confirm-preload','save-note-draft','no-study-plan'].includes(id))return 'class-notes';
 return null;
}
// Registered before application handlers so forbidden UI events cannot mutate records.
document.addEventListener('click',e=>{const el=e.target.closest('button,a'),module=demoActionModule(el);if(module&&!demoCanAccess(module)){e.preventDefault();e.stopImmediatePropagation();demoDeny()}},true);
document.addEventListener('submit',e=>{let module=demoFormModules[e.target.id];if(e.target.id==='note-form'){const s=data.sessions.find(s=>s.id===Number(e.target.dataset.id));module=s?.programme==='EIP'?'class-notes':'therapy-sessions'}if(module&&!demoCanAccess(module)){e.preventDefault();e.stopImmediatePropagation();demoDeny()}},true);
function applyDemoAccess(){
 const select=document.querySelector('#demo-role');if(select)select.value=demoRole;
 document.querySelectorAll('[data-access]').forEach(el=>el.hidden=!demoCanAccess(el.dataset.access));
 document.querySelectorAll('button[data-go],button[data-booking-work],button[data-history-assessment],button[data-therapy-open],button[data-session]').forEach(el=>{const module=demoActionModule(el);el.hidden=!!module&&!demoCanAccess(module)});
 document.querySelector('#dashboard-note-shortcut').hidden=page!=='dashboard'||!demoCanAccess('class-notes');
 document.querySelector('#notifications').hidden=!demoCanAccess('plans');document.querySelector('#reset').hidden=true;
 const label=document.querySelector('.user small');if(label)label.textContent=demoRoles[demoRole];
 if(page==='dashboard')document.querySelector('#subtitle').textContent='Selamat datang, '+currentUser.name+'. Rekod dikongsi bersama pasukan anda.';
}
function switchDemoRole(){return false}
document.addEventListener('change',e=>{if(e.target.id==='demo-role')switchDemoRole(e.target.value)});
function installDemoAccess(){
 const beforeRender=render;render=function(){if(!demoCanAccess(page)){page='dashboard';location.hash='dashboard'}beforeRender();applyDemoAccess()};
 // Student history is shared read access; editing actions retain module permissions.
 const beforeBooking=startBookingWork;startBookingWork=async key=>{const b=plannerBookings().find(b=>b.key===key);if(!b)return;if(!demoCanAccess(demoBookingModule(b)))return demoDeny();return (await beforeBooking(key))};
 const beforePlan=openStudyPlan;openStudyPlan=id=>demoCanAccess('plans')?beforePlan(id):demoDeny();
 const beforeTherapy=openTherapyNote;openTherapyNote=b=>demoCanAccess('therapy-sessions')?beforeTherapy(b):demoDeny();
 const beforeStaff=openStaffForm;openStaffForm=id=>demoCanAccess('staff')?beforeStaff(id):demoDeny();
 const beforeChooseAssessment=chooseAssessmentType;chooseAssessmentType=()=>demoCanAccess('assessments')?beforeChooseAssessment():demoDeny();
 const beforePdf=downloadAssessmentPdf;downloadAssessmentPdf=()=>demoCanAccess('assessments')?beforePdf():demoDeny();
 const beforeSlotFields=slotWorkflowFields;slotWorkflowFields=(b,mode)=>mode==='eip'&&!demoCanAccess('plans')?'<p class="field-hint">Study plan diurus oleh cikgu atau admin.</p>':beforeSlotFields(b,mode);
 const beforeCalendar=calendarPlanner;calendarPlanner=()=>{beforeCalendar();applyDemoAccess()};
 const beforeHistoryPage=historyPage;historyPage=()=>{beforeHistoryPage();applyDemoAccess()};
}
