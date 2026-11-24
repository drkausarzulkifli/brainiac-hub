// Student session packages & idempotent attendance-based balance deduction.
(function(global){
const PACKAGE_CATALOG={
 eip_2d:{
  id:'eip_2d',
  label:'EIP 2 Hari / Minggu',
  description:'8 kelas EIP + 1 Speech + 1 OT setiap bulan (pembaharuan bulanan)',
  billingCycle:'monthly',
  quotas:{eip:8,ot:1,speech:1}
 },
 eip_3d:{
  id:'eip_3d',
  label:'EIP 3 Hari / Minggu',
  description:'12 kelas EIP + 1 Speech + 1 OT setiap bulan (pembaharuan bulanan)',
  billingCycle:'monthly',
  quotas:{eip:12,ot:1,speech:1}
 },
 alacarte_ot:{
  id:'alacarte_ot',
  label:'Ala Carte Occupational Therapy',
  description:'1 sesi Occupational Therapy',
  billingCycle:'one_off',
  quotas:{eip:0,ot:1,speech:0}
 },
 alacarte_speech:{
  id:'alacarte_speech',
  label:'Ala Carte Speech Therapy',
  description:'1 sesi Speech Therapy',
  billingCycle:'one_off',
  quotas:{eip:0,ot:0,speech:1}
 },
 combo_ot_speech:{
  id:'combo_ot_speech',
  label:'Kombinasi OT & Speech',
  description:'3 sesi Occupational Therapy + 2 sesi Speech Therapy',
  billingCycle:'one_off',
  quotas:{eip:0,ot:3,speech:2}
 },
 custom:{
  id:'custom',
  label:'Pakej Tersuai',
  description:'Tetapkan bilangan sesi EIP, OT atau Speech secara manual',
  billingCycle:'one_off',
  quotas:{eip:0,ot:0,speech:0}
 }
};

const PROG_LABELS={eip:'EIP',ot:'OT',speech:'Speech'};

function currentMonthMY(){
 if(typeof malaysiaToday==='function')return malaysiaToday().slice(0,7);
 return new Date().toISOString().slice(0,7);
}

function monthFromDate(dateStr){
 if(typeof dateStr==='string'&&/^\d{4}-\d{2}/.test(dateStr))return dateStr.slice(0,7);
 return currentMonthMY();
}

function normalizeQuotas(q){
 return {
  eip:Math.max(0,Number(q?.eip)||0),
  ot:Math.max(0,Number(q?.ot)||0),
  speech:Math.max(0,Number(q?.speech)||0)
 };
}

function createPackageFromTemplate(templateId,opts={}){
 const tpl=PACKAGE_CATALOG[templateId]||PACKAGE_CATALOG.custom;
 const quotas=templateId==='custom'?normalizeQuotas(opts.quotas):normalizeQuotas(tpl.quotas);
 const billingCycle=opts.billingCycle||tpl.billingCycle||'one_off';
 const startMonth=opts.startMonth||currentMonthMY();
 return {
  id:opts.id||('pkg-'+(global.crypto?.randomUUID?global.crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2,7))),
  templateId:tpl.id,
  label:String(opts.label||tpl.label).trim(),
  billingCycle,
  quotas,
  startMonth,
  stoppedMonth:null,
  status:'active',
  createdAt:new Date().toISOString()
 };
}

function monthsInclusive(startYm,endYm){
 if(!startYm||!endYm||!/^\d{4}-\d{2}$/.test(startYm)||!/^\d{4}-\d{2}$/.test(endYm))return 1;
 const [sy,sm]=startYm.split('-').map(Number),[ey,em]=endYm.split('-').map(Number);
 const diff=(ey-sy)*12+(em-sm)+1;
 return Math.max(0,diff);
}

function getMonthlyAccruedCount(pkg,ym){
 if(!pkg||pkg.billingCycle!=='monthly')return 0;
 const start=pkg.startMonth||ym;
 if(ym<start)return 0;
 const capMonth=(pkg.status==='stopped'&&pkg.stoppedMonth&&pkg.stoppedMonth<ym)?pkg.stoppedMonth:ym;
 return monthsInclusive(start,capMonth);
}

function isPackageActiveForMonth(pkg,ym,ledger=[]){
 if(!pkg)return false;
 if(pkg.billingCycle==='monthly'){
  if(pkg.startMonth&&ym<pkg.startMonth)return false;
  if(pkg.status==='stopped'){
   if(pkg.stoppedMonth&&ym<=pkg.stoppedMonth)return true;
   // Carryover remains active after stoppedMonth until all accrued sessions are completed
   return ['eip','ot','speech'].some(prog=>getPackageRemainingForMonth(pkg,ledger,prog,ym).remaining>0);
  }
  return pkg.status==='active';
 }
 return pkg.status!=='stopped';
}

function getPackageRemainingForMonth(pkg,ledger,programme,ym){
 const quota=Number(pkg?.quotas?.[programme])||0;
 if(quota<=0)return {total:0,used:0,remaining:0,carryover:0};
 const entries=(Array.isArray(ledger)?ledger:[]).filter(e=>e.packageId===pkg.id&&e.programme===programme);
 if(pkg.billingCycle==='monthly'){
  const monthsActive=getMonthlyAccruedCount(pkg,ym);
  if(monthsActive<=0)return {total:0,used:0,remaining:0,carryover:0};
  const total=monthsActive*quota;
  const used=entries.filter(e=>!e.month||e.month<=ym).length;
  const remaining=Math.max(0,total-used);
  const usedBeforeMonth=entries.filter(e=>e.month&&e.month<ym).length;
  const isPostStop=pkg.status==='stopped'&&pkg.stoppedMonth&&ym>pkg.stoppedMonth;
  const accruedBeforeMonth=(isPostStop?monthsActive:monthsActive-1)*quota;
  const carryover=Math.max(0,accruedBeforeMonth-usedBeforeMonth);
  return {total,used,remaining,carryover};
 }
 const used=entries.length;
 const remaining=Math.max(0,quota-used);
 return {total:quota,used,remaining,carryover:remaining};
}

function getStudentBalanceSummary(student,ym=currentMonthMY()){
 const packages=Array.isArray(student?.packages)?student.packages:[];
 const ledger=Array.isArray(student?.sessionLedger)?student.sessionLedger:[];
 const summary={
  eip:{total:0,used:0,remaining:0,overQuota:0},
  ot:{total:0,used:0,remaining:0,overQuota:0},
  speech:{total:0,used:0,remaining:0,overQuota:0},
  activePackages:[]
 };

 for(const pkg of packages){
  if(!isPackageActiveForMonth(pkg,ym,ledger))continue;
  const pkgStats={pkg,byProgramme:{}};
  let hasAny=false;
  for(const prog of ['eip','ot','speech']){
   const st=getPackageRemainingForMonth(pkg,ledger,prog,ym);
   if(st.total>0){
    hasAny=true;
    summary[prog].total+=st.total;
    summary[prog].used+=st.used;
    summary[prog].remaining+=st.remaining;
    pkgStats.byProgramme[prog]=st;
   }
  }
  if(hasAny)summary.activePackages.push(pkgStats);
 }

 for(const prog of ['eip','ot','speech']){
  summary[prog].overQuota=ledger.filter(e=>e.programme===prog&&e.overQuota&&(e.month===ym||!e.month)).length;
 }

 return summary;
}

function findDeductiblePackage(student,programme,ym){
 const packages=Array.isArray(student?.packages)?student.packages:[];
 const ledger=Array.isArray(student?.sessionLedger)?student.sessionLedger:[];
 // Priority 1: active monthly package for this month with remaining > 0
 for(const pkg of packages){
  if(pkg.billingCycle!=='monthly'||!isPackageActiveForMonth(pkg,ym,ledger))continue;
  const st=getPackageRemainingForMonth(pkg,ledger,programme,ym);
  if(st.remaining>0)return pkg;
 }
 // Priority 2: active one-off package with remaining > 0
 for(const pkg of packages){
  if(pkg.billingCycle==='monthly'||!isPackageActiveForMonth(pkg,ym,ledger))continue;
  const st=getPackageRemainingForMonth(pkg,ledger,programme,ym);
  if(st.remaining>0)return pkg;
 }
 return null;
}

function ensureStudentProfileForAttendance(studentId,fallbackName=''){
 if(typeof data==='undefined'||!Array.isArray(data.studentProfiles))return null;
 let profile=data.studentProfiles.find(s=>s.id===studentId);
 if(!profile&&studentId){
  // Promote legacy seed student if needed so package/ledger can be stored cleanly.
  const seed=(data.sessions||[]).find(s=>s.name===studentId||String(s.id)===String(studentId));
  if(seed||fallbackName){
   profile={
    id:studentId,
    name:fallbackName||seed?.name||studentId,
    programs:seed?[seed.programme==='EIP'?'eip':seed.programme?.includes('Pertuturan')?'speech':'ot']:[],
    packages:[],
    sessionLedger:[]
   };
   data.studentProfiles.push(profile);
  }
 }
 if(profile){
  if(!Array.isArray(profile.packages))profile.packages=[];
  if(!Array.isArray(profile.sessionLedger))profile.sessionLedger=[];
 }
 return profile;
}

function syncStudentSessionAttendance(studentId,opts={}){
 const {sourceKey,programme,date,attendance,staff='',time='',title='',studentName=''}=opts;
 if(!studentId||!sourceKey||!['eip','ot','speech'].includes(programme))return {changed:false,action:'ignored'};
 const student=ensureStudentProfileForAttendance(studentId,studentName);
 if(!student)return {changed:false,action:'no_student'};

 const ym=monthFromDate(date);
 const existingIdx=student.sessionLedger.findIndex(e=>e.sourceKey===sourceKey&&e.programme===programme);

 if(attendance==='Hadir'){
  if(existingIdx>=0){
   const prev=student.sessionLedger[existingIdx];
   if(prev.date!==date||prev.staff!==staff||prev.title!==title){
    student.sessionLedger[existingIdx]={...prev,date:date||prev.date,month:ym,staff:staff||prev.staff,time:time||prev.time,title:title||prev.title};
    return {changed:true,action:'updated',entry:student.sessionLedger[existingIdx]};
   }
   return {changed:false,action:'already_deducted',entry:prev};
  }
  const pkg=findDeductiblePackage(student,programme,ym);
  const entry={
   id:'led-'+(global.crypto?.randomUUID?global.crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2,7)),
   sourceKey,
   programme,
   date:date||(typeof malaysiaToday==='function'?malaysiaToday():new Date().toISOString().slice(0,10)),
   month:ym,
   staff,
   time,
   title,
   packageId:pkg?pkg.id:null,
   packageLabel:pkg?pkg.label:'Tiada pakej aktif',
   overQuota:!pkg,
   createdAt:new Date().toISOString()
  };
  student.sessionLedger.unshift(entry);
  return {changed:true,action:'deducted',entry};
 }

 // Reverse deduction if marked Tidak hadir or Belum ditanda
 if(existingIdx>=0){
  const [removed]=student.sessionLedger.splice(existingIdx,1);
  return {changed:true,action:'reversed',removed};
 }
 return {changed:false,action:'noop'};
}

function formatBalancePillsHtml(student,ym=currentMonthMY()){
 const bal=getStudentBalanceSummary(student,ym);
 const pills=[];
 for(const prog of ['eip','ot','speech']){
  const b=bal[prog];
  if(b.total>0||b.overQuota>0){
   const cls=b.remaining===0?'amber':'green';
   pills.push(`<span class="badge ${cls}" title="Baki bulan ${ym}">${PROG_LABELS[prog]}: ${b.remaining}/${b.total}${b.overQuota?` (+${b.overQuota} lebih kuota)`:''}</span>`);
  }
 }
 return pills.length?pills.join(' '):'<span class="badge">Tiada pakej aktif</span>';
}

function renderPackageManagerFieldset(student){
 const pkgs=Array.isArray(student?.packages)?student.packages:[];
 const ledger=Array.isArray(student?.sessionLedger)?student.sessionLedger:[];
 const ym=currentMonthMY();
 const escFn=typeof esc==='function'?esc:(s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])));
 return `
  <fieldset class="student-fieldset" id="student-packages-fieldset">
   <legend>Pakej &amp; Kuota Sesi (${escFn(ym)})</legend>
   <p class="field-hint">Pakej bulanan diperbaharui secara automatik setiap bulan sehingga dihentikan. Kehadiran <b>Hadir</b> akan menolak baki secara automatik.</p>
   <div class="pkg-active-list" id="pkg-active-list">
    ${pkgs.length?pkgs.map(p=>{
     const parts=['eip','ot','speech'].filter(k=>(p.quotas?.[k]||0)>0).map(k=>{
      const st=getPackageRemainingForMonth(p,ledger,k,ym);
      return `${PROG_LABELS[k]}: <b>${st.remaining}/${st.total}</b>`;
     }).join(' · ');
     const isStopped=p.status==='stopped';
     return `<div class="pkg-item ${isStopped?'pkg-stopped':''}" data-pkg-id="${escFn(p.id)}">
      <div>
       <strong>${escFn(p.label)}</strong>
       <small>${p.billingCycle==='monthly'?'Pembaharuan bulanan':'Pakej sekali'} · ${isStopped?'Dihentikan':'Aktif'}</small>
       <div class="pkg-quotas">${parts||'Tiada kuota'}</div>
      </div>
      <div class="record-actions">
       <button type="button" class="secondary" data-pkg-toggle="${escFn(p.id)}">${isStopped?'Aktifkan':'Hentikan'}</button>
       <button type="button" class="text-btn" data-pkg-remove="${escFn(p.id)}">Buang</button>
      </div>
     </div>`;
    }).join(''):'<p class="empty">Belum ada pakej didaftarkan untuk murid ini.</p>'}
   </div>
   <div class="pkg-add-controls">
    <label class="field">Tambah pakej baharu
     <select id="pkg-template-select">
      <option value="">-- Pilih pakej --</option>
      ${Object.values(PACKAGE_CATALOG).map(t=>`<option value="${t.id}">${escFn(t.label)} — ${escFn(t.description)}</option>`).join('')}
     </select>
    </label>
    <div id="pkg-custom-fields" hidden>
     <div class="form-grid">
      <label class="field">Nama pakej<input type="text" id="pkg-custom-label" placeholder="Contoh: Pakej 5 Sesi OT" maxlength="80"></label>
      <label class="field">Kitaran
       <select id="pkg-custom-cycle">
        <option value="one_off">Pakej sekali (sehingga habis)</option>
        <option value="monthly">Bulanan (diperbaharui setiap bulan)</option>
       </select>
      </label>
     </div>
     <div class="form-grid" style="grid-template-columns:repeat(3,1fr)">
      <label class="field">Kuota EIP<input type="number" id="pkg-custom-eip" min="0" max="60" value="0"></label>
      <label class="field">Kuota OT<input type="number" id="pkg-custom-ot" min="0" max="60" value="0"></label>
      <label class="field">Kuota Speech<input type="number" id="pkg-custom-speech" min="0" max="60" value="0"></label>
     </div>
    </div>
    <button type="button" class="secondary" id="pkg-add-btn">+ Tambah Pakej ke Profil</button>
   </div>
  </fieldset>`;
}

global.StudentPackages={
 PACKAGE_CATALOG,
 PROG_LABELS,
 currentMonthMY,
 monthFromDate,
 createPackageFromTemplate,
 isPackageActiveForMonth,
 getPackageRemainingForMonth,
 getStudentBalanceSummary,
 findDeductiblePackage,
 syncStudentSessionAttendance,
 formatBalancePillsHtml,
 renderPackageManagerFieldset
};
})(typeof window!=='undefined'?window:globalThis);
