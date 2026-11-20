const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const listeners=[],data={sessions:[],studentProfiles:[{id:'a',name:'A',ic:'200229-10-1234'},{id:'b',name:'B',dob:'2019-05-06'},{id:'c',name:'C'}]};
const ctx=vm.createContext({assert,data,Date,Intl,document:{addEventListener:(type,fn,capture)=>listeners.push({type,fn,capture})}});
for(const file of ['students','planner'])vm.runInContext(fs.readFileSync('dist/'+file+'.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`
assert.equal(birthDateFromIc('200229-10-1234','2026-11-17'),'2020-02-29');
assert.equal(birthDateFromIc('990101101234','2026-11-17'),'1999-01-01');
assert.equal(birthDateFromIc('261231101234','2026-11-17'),'');
for(const ic of ['230229101234','201331101234','200000101234','200229','abcdef101234'])assert.equal(birthDateFromIc(ic,'2026-11-17'),'');
assert.equal(studentBirthDate(data.studentProfiles[0]),'2020-02-29');assert.equal(studentBirthDate(data.studentProfiles[1]),'2019-05-06');
assert.equal(studentBirthDate({...data.studentProfiles[0],dob:'1920-02-29'}),'1920-02-29');
assert.equal(birthAge('2020-11-18','2026-11-17'),'5 tahun 11 bulan');assert.equal(birthAge('2020-11-18','2026-11-18'),'6 tahun 0 bulan');
assert.equal(birthAge('2020-02-29','2024-02-29'),'4 tahun 0 bulan');assert.equal(birthAge('2023-02-29','2026-11-17'),'');assert.equal(birthAge('2026-11-18','2026-11-17'),'');
assert.ok(validateStudentProfile({name:'A',dob:'2099-01-01'},[],null));
var assessmentActive={studentId:'a',dob:'2020-02-29'},progressActive={studentId:'a',dob:'2020-02-29'};
`);
const prefill=listeners.find(l=>l.type==='input'&&l.capture).fn;
for(const id of ['assessment-form','progress-form']){const form={id,elements:{dob:{value:'2020-02-29'}}};prefill({target:{name:'studentId',value:'b',closest:()=>form}});assert.equal(form.elements.dob.value,'2019-05-06');prefill({target:{name:'studentId',value:'c',closest:()=>form}});assert.equal(form.elements.dob.value,'');form.elements.dob.value='2018-01-01';prefill({target:{name:'studentId',value:'a',closest:()=>form}});assert.equal(form.elements.dob.value,'2018-01-01');}
const age={textContent:''},hint={textContent:''};const form={elements:{dob:{value:'',dataset:{autoDob:'true'}},ic:{value:'200229101234'}},querySelector:s=>s==='#student-birth-age'?age:hint};ctx.form=form;
run(`updateStudentBirth(form,true);`);assert.equal(form.elements.dob.value,'2020-02-29');assert.ok(age.textContent.includes('tahun'));
form.elements.dob.value='1920-02-29';form.elements.dob.dataset.autoDob='false';form.elements.ic.value='210101101234';run(`updateStudentBirth(form,true);`);assert.equal(form.elements.dob.value,'1920-02-29');run(`updateStudentBirth(form,true,true);`);assert.equal(form.elements.dob.value,'2021-01-01');
console.log('PASS IC dates/centuries/leap years, manual override, chronological age, invalid/future DOB, assessment/progress prefill and clearing stale DOB on student switch');
