const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const listeners=[];const nodes=new Map();const node=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',textContent:'',style:{},classList:{remove(){},toggle(){}},setAttribute(){},focus(){},append(){},insertAdjacentHTML(){},close(){},showModal(){}});return nodes.get(k)};
const ctx=vm.createContext({assert,structuredClone,Date,Intl,crypto:require('crypto').webcrypto,setTimeout:()=>0,clearTimeout(){},location:{hash:''},window:{addEventListener(){}},document:{querySelector:node,querySelectorAll:()=>[],addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture})},localStorage:{getItem:()=>null,setItem(){}},FormData:class{constructor(f){this.f=f}get(k){return this.f.values[k]??null}getAll(k){const v=this.get(k);return Array.isArray(v)?v:v?[v]:[]}}});
for(const f of ['navigation','class-notes','planner','students','staff','assessment-ssp','assessment-ot','assessments','progress-pdf','progress-reports','workflow','app'])vm.runInContext(fs.readFileSync('dist/'+f+'.js','utf8').replace(/go\(\);\s*$/,''),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`classNotes=()=>{};calendarPlanner=()=>{};assessmentWorkspace=()=>{};page='sessions';
data.studentProfiles=[{id:'a',name:'Same Name',programs:['eip','speech']},{id:'b',name:'Same Name',programs:['eip']}];
assert.deepEqual(enrolledPrograms(data.studentProfiles[0]),['eip','speech']);
const sharedPlan={id:99,title:'Reusable',teacher:'Cikgu Hana',status:'Draf',details:{objectives:'Original objective',activities:'Activity'}};data.plans.push(sharedPlan);
const first={mode:'eip',date:'2026-11-12',time:'pagi',staff:'Cikgu Hana',students:['a'],planId:99};first.key=slotKey(first.mode,first.date,first.time,first.staff);
const second={...first,date:'2026-11-13',students:['b']};second.key=slotKey(second.mode,second.date,second.time,second.staff);data.datedBookings=[first,second];
startBookingWork(first.key);preloadPlan();assert.equal(activeNote.students[0].id,'a');assert.equal(activeNote.date,first.date);assert.equal(activeNote.objectives,'Original objective');const note1=activeNote.id;noteCommit();
startBookingWork(second.key);preloadPlan();assert.equal(activeNote.students[0].id,'b');assert.notEqual(activeNote.id,note1);assert.equal(activeNote.date,second.date);sharedPlan.details.objectives='Updated plan';assert.equal(data.classNotes.find(n=>n.id===note1).objectives,'Original objective');assert.equal(activeNote.objectives,'Original objective');
assert.equal(studentTimeline('a').filter(x=>x.title.startsWith('EIP')).length,1);assert.equal(studentTimeline('b').filter(x=>x.title.startsWith('EIP')).length,1);assert.ok(bookingLocked(first.key));
data.assessments=[{id:'draft',studentId:'a',type:'speech',date:'2026-11-01',status:'Draf'},{id:'ot',studentId:'a',type:'ot-denver',date:'2026-11-01',status:'Lengkap'}];assert.equal(eligibleAssessment('a','speech','2026-11-14'),undefined);assert.equal(eligibleAssessment('a','ot','2026-11-14').id,'ot');data.assessments.push({id:'speech',studentId:'a',type:'speech',date:'2026-11-07',status:'Lengkap'});assert.equal(eligibleAssessment('a','speech','2026-11-07'),undefined);assert.equal(eligibleAssessment('a','speech','2026-11-14').id,'speech');assert.equal(eligibleAssessment('b','speech','2026-11-14'),undefined);
assessmentActive=structuredClone(data.assessments[2]);assessmentDirty=false;assert.ok(assessmentPdfReady());assessmentDirty=true;assert.equal(assessmentPdfReady(),false);
`);
const capture=listeners.find(l=>l.type==='submit'&&l.capture).fn;
function submit(id,values,value){let stopped=false,message='';const form={id,values,querySelector:()=>({set textContent(v){message=v}})};capture({target:form,submitter:{value},preventDefault(){},stopImmediatePropagation(){stopped=true}});return {stopped,message}}
assert.equal(submit('student-form',{programs:[]}).stopped,true);
run(`editingSlot={...data.datedBookings[0]};`);
assert.equal(submit('slot-form',{student:['missing'],planId:'99'}).stopped,true);
assert.equal(submit('slot-form',{student:['b'],planId:'99'}).stopped,true);
run(`activeNote=data.classNotes[0];activeNote.studentNotes={};`);
assert.equal(submit('class-note-form',{}).stopped,true);
assert.equal(submit('assessment-form',{date:'2099-01-01'},'Lengkap').stopped,true);
run(`
const unplanned={...data.datedBookings[0],date:'2026-10-01',planId:null};unplanned.key=slotKey(unplanned.mode,unplanned.date,unplanned.time,unplanned.staff);data.datedBookings.push(unplanned);
startBookingWork(unplanned.key);assert.equal(activeNote.planId,null);assert.equal(activeNote.students[0].id,'a');assert.equal(activeNote.date,'2026-10-01');assert.ok(activeNote.createdAt);assert.equal(activeNote.sessionAt,'2026-10-01T09:00:00+08:00');
activeNote.actual='Manual activity';activeNote.studentNotes.a={achievement:'Tercapai',note:'Keep observation'};activeNote.time='09:35';const entered=activeNote.createdAt;
`);
assert.equal(submit('class-note-form',{}).stopped,false);
const completeNote=listeners.find(l=>l.type==='submit'&&!l.capture&&String(l.fn).includes("e.target.id!=='class-note-form'")).fn;
completeNote({target:{id:'class-note-form',elements:{actual:{value:'Manual activity'}}},preventDefault(){}});
run(`assert.equal(activeNote.status,'Lengkap');assert.equal(activeNote.planId,null);assert.equal(activeNote.sessionAt,'2026-10-01T09:35:00+08:00');assert.equal(activeNote.createdAt,entered);
selectedPlan=99;preloadPlan();assert.equal(activeNote.planId,99);assert.equal(activeNote.time,'09:35');assert.equal(activeNote.studentNotes.a.note,'Keep observation');assert.equal(activeNote.actual,'Manual activity');assert.equal(plannerBookings().find(b=>b.key===unplanned.key).planId,null);
detachNotePlan();assert.equal(activeNote.planId,null);assert.equal(activeNote.studentNotes.a.note,'Keep observation');assert.equal(activeNote.actual,'Manual activity');assert.equal(activeNote.createdAt,entered);
assert.equal(sessionTimestamp('2026-02-30','10:00'),null);assert.equal(sessionTimestamp('2026-10-01','25:00'),null);assert.equal(recordTimestamps({updatedAt:'2026-01-01T00:00:00Z'}).createdAt,null);assert.equal(recordTimestamps({createdAt:entered}).createdAt,entered);
`);
console.log('PASS shared-plan reuse, stable student identity, slot-derived roster/date, historical plan snapshots, therapy assessment prerequisites, PDF gating, enrolment validation and record protection');
console.log('PASS backdated manual EIP completion without plan, plan selection without slot attachment, preserved observations, plan detachment and session/entry timestamps');

run(`
noteCommit();
const afternoon={...data.datedBookings[0],date:'2026-10-02',time:'petang',planId:null};afternoon.key=slotKey(afternoon.mode,afternoon.date,afternoon.time,afternoon.staff);data.datedBookings.push(afternoon);
noteCalendarDate=afternoon.date;assert.ok(noteSlotPicker().includes(afternoon.key));
assert.ok(!noteSlotPicker().includes('note-existing-slot'));
assert.ok(!noteSlotPicker().includes('value="'+data.datedBookings[0].key+'"'));
assert.equal((noteSlotPicker().match(/data-note-date=/g)||[]).length,31);
noteCalendarDate='2028-02-01';assert.equal((noteSlotPicker().match(/data-note-date=/g)||[]).length,29);
noteCalendarDate='2026-10-03';assert.ok(noteSlotPicker().includes('Tiada slot berjadual.'));noteCalendarDate=afternoon.date;
assert.ok(noteStartPanel().includes('note-existing-session-form'));
startBookingWork(afternoon.key);assert.equal(activeNote.time,'14:00');assert.equal(activeNote.teacher,afternoon.staff);assert.equal(activeNote.date,afternoon.date);assert.equal(activeNote.students[0].id,afternoon.students[0]);
for(const status of ['Menunggu semakan','Perlu pembetulan','Diluluskan','Draf','Disimpan']){sharedPlan.status=status;selectedPlan=99;preloadPlan(true);assert.equal(activeNote.planId,99);assert.equal(activeNote.time,'14:00');}
activeNote.actual='Keep existing notes';noteCommit();const countBefore=data.classNotes.length;const existingId=activeNote.id;startBookingWork(afternoon.key);assert.equal(data.classNotes.length,countBefore);assert.equal(activeNote.id,existingId);assert.equal(activeNote.actual,'Keep existing notes');
assert.ok(!stats().includes('semakan pengarah'));dashboard();assert.ok(!content.innerHTML.includes('untuk disemak'));reports();assert.ok(!content.innerHTML.includes('diluluskan'));
`);
const selectSlot=listeners.find(l=>l.type==='submit'&&String(l.fn).includes("form.id")===false&&String(l.fn).includes("note-existing-session-form")).fn;
run(`activeNote.actual='Unsaved edit';`);
selectSlot({target:{id:'note-existing-session-form',values:{}},submitter:{value:run('data.datedBookings[0].key')},preventDefault(){}});
run(`assert.equal(activeNote.id,existingId);assert.equal(activeNote.actual,'Unsaved edit');assert.ok(document.querySelector('#note-slot-error').textContent.includes('Simpan'));noteCommit();`);
selectSlot({target:{id:'note-existing-session-form',values:{bookingKey:run('data.datedBookings[0].key')}},preventDefault(){}});
run(`assert.equal(activeNote.bookingKey,data.datedBookings[0].key);`);
console.log('PASS morning/afternoon slot autofill, legacy plan statuses usable without approval, reopening existing notes and unsaved slot-switch protection');

