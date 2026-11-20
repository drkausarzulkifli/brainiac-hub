const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const nodes=new Map(),listeners={};const node=key=>{if(!nodes.has(key))nodes.set(key,{innerHTML:'',textContent:'',value:'',style:{},classList:{remove(){},toggle(){return false}},setAttribute(){},showModal(){},close(){},focus(){}});return nodes.get(key)};
const context=vm.createContext({document:{querySelector:node,querySelectorAll:()=>[],addEventListener:(type,fn)=>(listeners[type]??=[]).push(fn)},window:{addEventListener(){}},location:{hash:'#dashboard'},localStorage:{getItem:()=>null,setItem(){}},structuredClone,Intl,Date,setTimeout:()=>0,clearTimeout(){},crypto:require('node:crypto').webcrypto});
for(const file of ['navigation.js','class-notes.js','planner.js','students.js','staff.js','assessment-ssp.js','assessment-ot.js','assessments.js','app.js'])vm.runInContext(fs.readFileSync('dist/'+file,'utf8').replace(/go\(\);\s*$/,''),context,{filename:file});
let failed=0;function test(name,code){try{vm.runInContext(code,context);console.log('PASS: '+name)}catch(e){failed++;console.error('FAIL: '+name+' — '+e.message)}}
context.assert=assert;
test('restoring a note selects its linked teaching plan',`activeNote=null;data.classNotes=[{...newClassNote(),planId:1}];selectedPlan=3;ensureNotes();assert.equal(selectedPlan,1);`);
test('new notes use the current Malaysia date',`assert.equal(newClassNote().date,malaysiaToday());`);
test('failed note saves remain visibly unsaved after render',`save=()=>false;activeNote=newClassNote();assert.equal(persistClassNote(),false);assert.match(noteEditor(activeNote),/Tidak dapat disimpan/);`);
test('legacy text is escaped when displaying assessments',`data.sessions[0].name='<img src=x onerror=alert(1)>';assessments();assert.equal(content.innerHTML.includes('<img src=x'),false);`);
context.clickHandlers=listeners.click;
test('failed attendance save does not report success',`let notices=[];notify=m=>notices.push(m);save=()=>false;for(const fn of clickHandlers)fn({target:{closest:()=>({hasAttribute:()=>false,dataset:{attend:'3',value:'Hadir'}})}});assert.equal(notices.includes('Kehadiran demo dikemas kini.'),false);`);
if(failed)process.exitCode=1;
