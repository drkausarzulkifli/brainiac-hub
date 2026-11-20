const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=path.resolve('dist'),output=path.resolve('../hostinger-brainiac-hub-empty');
fs.mkdirSync(output,{recursive:true});fs.cpSync(source,output,{recursive:true});
function edit(file,fn){const p=path.join(output,file);fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8')))}
const blank={sessions:[],plans:[],enquiries:[],studentProfiles:[],staffProfiles:[],datedBookings:[],weeklyBookings:[],classNotes:[],assessments:[],therapyNotes:[],progressReports:[]};
edit('app.js',s=>s.replace(/^const initial=.*;$/m,'const initial='+JSON.stringify(blank)+';').replaceAll('brainiac-demo-v1','brainiac-hub-empty-v1').replace(/^function chart\(\).*$/m,'function chart(){return `<section class="panel"><div class="panel-head"><h2>Kehadiran</h2></div><p class="empty">Belum ada data kehadiran. Daftar pelajar dan staf, kemudian atur sesi.</p></section>`}').replace('Demo kembali kepada data asal.','Semua rekod dikosongkan.').replace('akan diganti dengan data contoh asal.','akan dikosongkan. Tindakan ini membuang rekod pada browser ini.'));
edit('staff.js',s=>s.replace(/^const seedStaff=.*;$/m,'const seedStaff=[];'));
edit('class-notes.js',s=>s.replace(/const planDetails=\{[\s\S]*?\n\};/,'const planDetails={};').replace('selectedPlan=3','selectedPlan=0'));
edit('planner.js',s=>s.replaceAll("b.staff||'Cikgu Hana'","b.staff||''").replaceAll("staff||'Cikgu Hana'","staff||staffForProgramme('eip')[0]||''").replace("staff=mode==='eip'?","if(!staffForProgramme(mode).length){notify('Daftar staf bagi program ini dahulu.');return}staff=mode==='eip'?"));
edit('index.html',s=>s.replace('brainiac-demo-role','brainiac-hub-empty-role').replace(/\?v=[^" ]+/g,'?v=hostinger-empty-1').replace('Tetapkan semula demo','Kosongkan rekod').replace('Rabu, 11 November 2026','Ringkasan sesi').replace('Paparan hari contoh','Simpanan browser'));
edit('demo-access.js',s=>s.replaceAll('brainiac-demo-role','brainiac-hub-empty-role'));
// Verify an empty first launch, and that later launches preserve entered records.
const storage=new Map(),nodes=new Map();
const node=k=>{if(!nodes.has(k))nodes.set(k,{innerHTML:'',textContent:'',style:{},classList:{remove(){},toggle(){}},setAttribute(){},focus(){},append(){},insertAdjacentHTML(){},close(){},showModal(){}});return nodes.get(k)};
function boot(){const ctx=vm.createContext({structuredClone,Date,Intl,crypto:require('node:crypto').webcrypto,setTimeout:()=>0,clearTimeout(){},location:{hash:'#dashboard'},history:{replaceState(){}},window:{addEventListener(){}},document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},createElement:()=>({})},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}});const html=fs.readFileSync(path.join(output,'index.html'),'utf8');for(const match of html.matchAll(/<script[^>]*src="\/([^"?]+)[^"]*"/g)){if(match[1].startsWith('vendor/'))continue;vm.runInContext(fs.readFileSync(path.join(output,match[1]),'utf8'),ctx)}return ctx}
// Old demo data must not seed the clean deployment.
storage.set('brainiac-demo-v1',JSON.stringify({sessions:[{name:'Old demo'}],plans:[],enquiries:[]}));
const first=boot();for(const key of Object.keys(blank))assert.equal(vm.runInContext('data.'+key+'.length',first),0,key);
assert.equal(vm.runInContext('staffRoster().length',first),0);assert.equal(vm.runInContext('studentRoster().length',first),0);
vm.runInContext("data.studentProfiles.push({id:'qa',name:'Persistence test'});save()",first);
const second=boot();assert.equal(vm.runInContext('data.studentProfiles[0].id',second),'qa');
assert.ok(!fs.readFileSync(path.join(output,'app.js'),'utf8').includes('90%'));
console.log('PASS empty first launch, no fallback staff/students/plans, old demo isolation, and records preserved after reload.');
console.log(output);
