const assert=require('node:assert/strict'),crypto=require('node:crypto');
const base='http://127.0.0.1:8789/api.php?action=';
class Client{
 cookie='';csrf='';
 async request(action,data,expected=200,headers={}){
  const r=await fetch(base+action,{method:data===undefined?'GET':'POST',headers:{Cookie:this.cookie,...(data===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':this.csrf}),...headers},body:data===undefined?undefined:JSON.stringify(data)});
  const cookies=r.headers.getSetCookie();if(cookies.length)this.cookie=cookies.map(x=>x.split(';')[0]).join(';');
  const body=await r.json();assert.equal(r.status,expected,action+': '+JSON.stringify(body));if(body.csrf)this.csrf=body.csrf;return body;
 }
 async login(email,password='Test-password-123!'){await this.request('session');return this.request('login',{email,password})}
}
(async()=>{
 const admin=new Client(),teacher=new Client(),therapist=new Client(),anon=new Client();
 await anon.request('state',undefined,401);await anon.request('session');await anon.request('users',{},403,{'X-CSRF-Token':'wrong'});
 await admin.request('session');await admin.request('setup',{token:'wrong',name:'Admin',email:'admin@example.test',password:'Test-password-123!'},403);
 await admin.request('setup',{token:'local-test-only-'+'x'.repeat(40),name:'Admin Test',email:'admin@example.test',password:'Test-password-123!'});
 await admin.request('setup',{token:'local-test-only-'+'x'.repeat(40),name:'Hijack',email:'another@example.test',password:'Test-password-123!'},409);
 await admin.login('admin@example.test');
 const empty=await admin.request('state');assert(Object.values(empty.data).every(a=>Array.isArray(a)&&a.length===0));
 for(const role of ['teacher','therapist'])await admin.request('users',{name:role,email:role+'@example.test',role,password:'Test-password-123!',active:true});
 await teacher.login('teacher@example.test');await teacher.request('state',undefined,403);await teacher.request('password',{current:'Test-password-123!',password:'Changed-password-123!'});
 await therapist.login('therapist@example.test');await therapist.request('password',{current:'Test-password-123!',password:'Changed-password-123!'});
 await teacher.request('users',undefined,403);await therapist.request('users',undefined,403);
 await teacher.request('users',{name:'bad',email:'bad@example.test',role:'admin',password:'Test-password-123!',active:true},403);
 let state=await teacher.request('state');state.data.studentProfiles.push({id:'student-test',name:'Test only',programs:['eip','speech']});state.data.classNotes.push({id:'note-test',studentNotes:{},students:[],title:'Draft',status:'Draf'});
 const write={...state,requestId:crypto.randomUUID()};const first=await teacher.request('state',write);assert.equal(first.revision,1);
 const duplicate=await teacher.request('state',write);assert.equal(duplicate.revision,1);
 await therapist.request('state',{...state,requestId:crypto.randomUUID()},409);
 state=await therapist.request('state');assert.equal(state.data.studentProfiles[0].name,'Test only');assert(!Array.isArray(state.data.classNotes[0].studentNotes));
 const forbidden=structuredClone(state);forbidden.data.classNotes[0].title='forbidden';await therapist.request('state',{...forbidden,requestId:crypto.randomUUID()},403);
 state.data.assessments.push({id:'assessment-test',studentId:'student-test',type:'speech',status:'Draf'});state.data.therapyNotes.push({id:'therapy-test',studentId:'student-test',status:'Draf'});await therapist.request('state',{...state,requestId:crypto.randomUUID()});
 state=await teacher.request('state');assert.equal(state.data.assessments.length,1);assert.equal(state.data.therapyNotes.length,1);
 state.data.assessments[0].status='Lengkap';await teacher.request('state',{...state,requestId:crypto.randomUUID()},403);
 state=await teacher.request('state');state.data.staffProfiles.push({id:'staff-test',name:'Blocked'});await teacher.request('state',{...state,requestId:crypto.randomUUID()},403);
 // Concurrent 2-user optimistic merge tests:
 // 1. Therapist saves assessment while Teacher (at stale revision with base) saves Class Note -> both preserved.
 const tBase=await teacher.request('state');const thBase=await therapist.request('state');
 const thNext=structuredClone(thBase.data);thNext.assessments.push({id:'assessment-concurrent',studentId:'student-test',type:'ot',status:'Draf'});
 const thSaved=await therapist.request('state',{data:thNext,base:thBase.data,revision:thBase.revision,requestId:crypto.randomUUID()});
 const tNext=structuredClone(tBase.data);tNext.classNotes.unshift({id:'note-concurrent',studentNotes:{},students:[],title:'Nota Cikgu B',status:'Draf',actual:'Aktiviti 1'});
 const tMerged=await teacher.request('state',{data:tNext,base:tBase.data,revision:tBase.revision,requestId:crypto.randomUUID()});
 assert.equal(tMerged.revision,thSaved.revision+1);assert.equal(tMerged.merged,true);
 assert(tMerged.data.assessments.some(a=>a.id==='assessment-concurrent'));
 assert(tMerged.data.classNotes.some(n=>n.id==='note-concurrent'));
 // 2. Same collection (classNotes), different record IDs -> both preserved.
 const aBase2=await admin.request('state');const tBase2=await teacher.request('state');
 const aNext2=structuredClone(aBase2.data);aNext2.classNotes.unshift({id:'note-admin-other',studentNotes:{},students:[],title:'Nota Admin',status:'Draf',actual:'Lain'});
 await admin.request('state',{data:aNext2,base:aBase2.data,revision:aBase2.revision,requestId:crypto.randomUUID()});
 const tNext2=structuredClone(tBase2.data);tNext2.classNotes.find(n=>n.id==='note-concurrent').actual='Aktiviti 2';
 const tMerged2=await teacher.request('state',{data:tNext2,base:tBase2.data,revision:tBase2.revision,requestId:crypto.randomUUID()});
 assert(tMerged2.data.classNotes.some(n=>n.id==='note-admin-other'));
 assert.equal(tMerged2.data.classNotes.find(n=>n.id==='note-concurrent').actual,'Aktiviti 2');
 // 3. Same studentProfile record, different fields (guardianPhone vs sessionLedger) -> both preserved.
 const aBase3=await admin.request('state');const tBase3=await teacher.request('state');
 const aNext3=structuredClone(aBase3.data);aNext3.studentProfiles[0].guardianPhone='0199999999';
 await admin.request('state',{data:aNext3,base:aBase3.data,revision:aBase3.revision,requestId:crypto.randomUUID()});
 const tNext3=structuredClone(tBase3.data);tNext3.studentProfiles[0].sessionLedger=[{id:'led-1',sourceKey:'note:note-concurrent',programme:'eip',date:'2026-11-25'}];
 const tMerged3=await teacher.request('state',{data:tNext3,base:tBase3.data,revision:tBase3.revision,requestId:crypto.randomUUID()});
 assert.equal(tMerged3.data.studentProfiles[0].guardianPhone,'0199999999');
 assert.equal(tMerged3.data.studentProfiles[0].sessionLedger.length,1);
 // 4. True same-record, same-field conflict -> 409.
 const aBase4=await admin.request('state');const tBase4=await teacher.request('state');
 const aNext4=structuredClone(aBase4.data);aNext4.classNotes.find(n=>n.id==='note-concurrent').actual='Suntingan Admin';
 await admin.request('state',{data:aNext4,base:aBase4.data,revision:aBase4.revision,requestId:crypto.randomUUID()});
 const tNext4=structuredClone(tBase4.data);tNext4.classNotes.find(n=>n.id==='note-concurrent').actual='Suntingan Cikgu';
 await teacher.request('state',{data:tNext4,base:tBase4.data,revision:tBase4.revision,requestId:crypto.randomUUID()},409);
 // 5. Role check enforced during merge -> 403 if therapist tries to edit classNotes at stale revision.
 const thBase5=await therapist.request('state');const aNext5=structuredClone(thBase5.data);aNext5.assessments.push({id:'assessment-seq',studentId:'student-test',type:'speech',status:'Draf'});
 await admin.request('state',{data:aNext5,base:thBase5.data,revision:thBase5.revision,requestId:crypto.randomUUID()});
 const thBad5=structuredClone(thBase5.data);thBad5.classNotes[0].title='Forbidden merge';
 await therapist.request('state',{data:thBad5,base:thBase5.data,revision:thBase5.revision,requestId:crypto.randomUUID()},403);
 await admin.request('users',{id:(await admin.request('users')).users.find(u=>u.role==='admin').id,name:'Admin Test',email:'admin@example.test',role:'teacher',active:true},422);
 const teacherUser=(await admin.request('users')).users.find(u=>u.role==='teacher');await admin.request('users',{...teacherUser,active:false});await teacher.request('state',undefined,401);
 await admin.request('state',state,403,{'Origin':'https://attacker.example'});
 await therapist.request('logout',{});await therapist.request('state',undefined,401);
 const brute=new Client();await brute.request('session');for(let i=0;i<8;i++)await brute.request('login',{email:'missing@example.test',password:'incorrect'},401);await brute.request('login',{email:'missing@example.test',password:'incorrect'},429);
 console.log('PASS: empty start, setup lock, sessions, CSRF/origin, role writes, shared history, concurrent 3-way merge, true conflict, idempotency, object round-trip, password rotation, account revocation, last-admin protection, logout, rate limiting.');
})().catch(e=>{console.error(e);process.exitCode=1});
