// Brainiac Hub — Staff Attendance, Clock In/Out & Attendance Reporting Module
let todayClockStatus={today:'',currentTime:'',record:null,status:'not_clocked_in'};
let adminAttendanceRecords=[];
let adminAttendanceUsers=[];
let myAttendanceRecords=[];
let attendanceActiveTab='staff';
let attendanceFilter={preset:'this_month',from:'',to:'',userId:'all',role:'all'};
let clockTickerTimer=null;

const myDays=['Ahad','Isnin','Selasa','Rabu','Khamis','Jumaat','Sabtu'];
const myMonths=['Jan','Feb','Mac','Apr','Mei','Jun','Jul','Ogo','Sep','Okt','Nov','Dis'];

function formatMyDate(str){
  if(!str)return '-';
  const parts=str.slice(0,10).split('-');
  if(parts.length===3)return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return str;
}

function formatMyDay(str){
  if(!str)return '';
  const d=new Date(str.slice(0,10)+'T00:00:00');
  return isNaN(d.getDay())?'':myDays[d.getDay()];
}

function formatMyTime(str){
  if(!str)return '-';
  try{
    const d=new Date(str);
    if(isNaN(d.getTime()))return str.slice(11,16)||str;
    let h=d.getHours(),m=d.getMinutes();
    const ampm=h>=12?'PM':'AM';
    h=h%12;if(h===0)h=12;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ampm}`;
  }catch{return str.slice(11,16)||str}
}

function formatDurationMins(mins){
  if(!mins||mins<=0)return '-';
  const h=Math.floor(mins/60),m=mins%60;
  if(h>0&&m>0)return `${h} jam ${m} min`;
  if(h>0)return `${h} jam`;
  return `${m} min`;
}

function getTodayMyStr(){
  const now=new Date();
  const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');
  return `${y}-${m}-${d}`;
}

function isMobileDevice(){
  const ua=navigator.userAgent||navigator.vendor||window.opera||'';
  const mobileRegex=/android|avantgo|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od|ad)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
  const touchCapable=('ontouchstart' in window)||(navigator.maxTouchPoints>0);
  return mobileRegex.test(ua)||(touchCapable&&window.innerWidth<=1024);
}

function getGpsCoordinates(){
  return new Promise((resolve,reject)=>{
    if(!navigator.geolocation){
      reject(new Error('Pelayar anda tidak menyokong Geolocation / GPS. Sila gunakan pelayar telefon pintar seperti Chrome atau Safari.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos=>resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy
      }),
      err=>{
        let msg='Gagal mengesan lokasi GPS.';
        if(err.code===1)msg='Akses GPS tidak dibenarkan. Sila benarkan akses lokasi pada telefon anda.';
        else if(err.code===2)msg='Lokasi GPS tidak dapat dikesan. Sila hidupkan GPS telefon pintar anda.';
        else if(err.code===3)msg='Masa mengesan lokasi GPS tamat. Sila cuba lagi.';
        reject(new Error(msg));
      },
      { enableHighAccuracy:true, timeout:15000, maximumAge:0 }
    );
  });
}

function calcDistanceMeters(lat1, lon1, lat2, lon2){
  const R=6371000;
  const phi1=lat1*Math.PI/180;
  const phi2=lat2*Math.PI/180;
  const deltaPhi=(lat2-lat1)*Math.PI/180;
  const deltaLambda=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(deltaPhi/2)**2 + Math.cos(phi1)*Math.cos(phi2)*(Math.sin(deltaLambda/2)**2);
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
}


async function fetchClockStatus(){
  if(!currentUser||currentUser.role==='therapist'){
    renderHeaderClockWidget();
    renderDashboardClockCard();
    return;
  }
  try{
    const res=await api('clock_status');
    todayClockStatus=res;
    renderHeaderClockWidget();
    renderDashboardClockCard();
  }catch(err){
    console.warn('Clock status unavailable:',err.message);
  }
}

function renderHeaderClockWidget(){
  const container=document.querySelector('#header-clock-widget');
  if(!container)return;
  if(!currentUser||currentUser.role==='therapist'){container.innerHTML='';return}
  const st=todayClockStatus.status;
  if(st==='clocked_in'){
    const inTime=formatMyTime(todayClockStatus.record?.clock_in);
    container.innerHTML=`<button class="clock-btn clock-out-btn active" id="quick-clock-btn" type="button" title="Waktu masuk: ${inTime}. Klik untuk Clock Out"><span class="pulse-dot"></span> <span>${inTime}</span> <span style="margin-left:4px;color:var(--teal)">Clock Out</span></button>`;
  }else if(st==='clocked_out'){
    const dur=formatDurationMins(todayClockStatus.record?.duration_minutes);
    container.innerHTML=`<button class="clock-btn clock-done-btn" id="quick-clock-btn" type="button" title="Syif hari ini telah selesai (${dur})">${icon('check')} <span>Selesai (${dur})</span></button>`;
  }else{
    container.innerHTML=`<button class="clock-btn clock-in-btn" id="quick-clock-btn" type="button" title="Rakam kehadiran hari ini">${icon('clock')} <span>Clock In</span></button>`;
  }
}

function renderDashboardClockCard(){
  const target=document.querySelector('#dashboard-attendance-card');
  if(!target)return;
  if(!currentUser||currentUser.role==='therapist'){target.innerHTML='';return}
  const now=new Date();
  const dayName=myDays[now.getDay()];
  const dateStr=`${now.getDate()} ${myMonths[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
  
  const st=todayClockStatus.status;
  let statusBadge='',actionBtn='';
  if(st==='clocked_in'){
    const inTime=formatMyTime(todayClockStatus.record?.clock_in);
    statusBadge=`<span class="clock-status-chip in"><span class="pulse-dot"></span> Sedang Bertugas (Sejak ${inTime})</span>`;
    actionBtn=`<button class="primary clock-action-big" id="dash-clock-btn" type="button" style="background:#0d6955">${icon('clock')} Clock Out Sekarang</button>`;
  }else if(st==='clocked_out'){
    const dur=formatDurationMins(todayClockStatus.record?.duration_minutes);
    statusBadge=`<span class="clock-status-chip out">${icon('check')} Syif Selesai (${dur})</span>`;
    actionBtn=`<button class="secondary clock-action-big" id="dash-view-att-btn" type="button">${icon('clipboard')} Lihat Rekod Kehadiran</button>`;
  }else{
    statusBadge=`<span class="clock-status-chip none">${icon('clock')} Belum Clock In Hari Ini</span>`;
    actionBtn=`<button class="primary clock-action-big" id="dash-clock-btn" type="button">${icon('clock')} Clock In Sekarang</button>`;
  }

  target.innerHTML=`
    <div class="dashboard-clock-card">
      <div class="clock-hero-left">
        <div class="clock-live-icon">${icon('clock')}</div>
        <div>
          <h2 class="clock-hero-title">Kehadiran Staf Hari Ini · ${dayName}, ${dateStr}</h2>
          <p class="clock-hero-meta">Waktu semasa: <strong id="dash-live-time" style="color:var(--teal)">${timeStr}</strong> · Lokasi: <strong>${esc(todayClockStatus.record?.work_location||'Beruntung Brainiac')}</strong></p>
        </div>
      </div>
      <div class="clock-hero-right">
        ${statusBadge}
        ${actionBtn}
      </div>
    </div>
  `;
}

function startClockTicker(){
  if(clockTickerTimer)clearInterval(clockTickerTimer);
  clockTickerTimer=setInterval(()=>{
    const el=document.querySelector('#dash-live-time');
    if(el){
      const now=new Date();
      el.textContent=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true});
    }
  },1000);
}

function openClockInDialog(){
  const now=new Date();
  const dayName=myDays[now.getDay()];
  const dateStr=`${now.getDate()} ${myMonths[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
  const isMobile=isMobileDevice();
  const isAdm=currentUser?.role==='admin';

  open('Clock In — Kehadiran Bertugas',`
    <div class="clock-dialog-clock">
      <div class="clock-digital-time">${timeStr}</div>
      <div class="clock-digital-date">${dayName}, ${dateStr}</div>
      <p style="margin:6px 0 0;font-size:12px;color:var(--muted)">Pengguna: <strong>${esc(currentUser?.name)}</strong> (${esc(demoRoles[currentUser?.role]||currentUser?.role)})</p>
    </div>

    ${(!isMobile && !isAdm)?`
      <div style="background:#fff3dd;border:1px solid #ffd085;padding:12px 14px;border-radius:8px;margin-bottom:14px;font-size:12px;color:#94631a">
        <strong style="display:flex;align-items:center;gap:6px">${icon('shield')} Komputer Pejabat / Desktop PC Dikesan</strong>
        <p style="margin:6px 0 0">Bagi memastikan ketepatan geofencing 100m, sistem mewajibkan Clock In melalui <strong>telefon pintar staf</strong> dengan perkakasan GPS sebenar. Sila buka sistem di pelayar telefon bimbit anda untuk Clock In.</p>
      </div>
    `:''}

    <form id="clock-in-form">
      <input type="hidden" name="latitude" id="clock-lat" value="">
      <input type="hidden" name="longitude" id="clock-lon" value="">
      <input type="hidden" name="is_mobile" value="${isMobile?1:0}">

      <!-- Geofence GPS Status Card -->
      <div id="gps-verification-box" style="margin-bottom:14px;padding:12px 14px;border-radius:8px;background:var(--bg);border:1px dashed var(--line);font-size:12px">
        <div id="gps-status-content" style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="pulse-dot"></span>
            <span id="gps-status-text">Sedang mengesan lokasi GPS telefon anda…</span>
          </div>
          <button type="button" class="secondary mini-btn" id="btn-refresh-gps">${icon('refresh')} Semak Semula</button>
        </div>
      </div>

      <label class="field">Lokasi Bertugas
        <div class="clock-location-options">
          <label class="location-radio">
            <input type="radio" name="location" value="Pusat" checked>
            ${icon('building')}
            <span>Di Pusat</span>
          </label>
          <label class="location-radio">
            <input type="radio" name="location" value="Outreach">
            ${icon('users')}
            <span>Outreach / Luar</span>
          </label>
          <label class="location-radio">
            <input type="radio" name="location" value="WFH">
            ${icon('clipboard')}
            <span>WFH / Draf</span>
          </label>
        </div>
      </label>

      <label class="field">Catatan Bertugas <small style="color:var(--muted);font-weight:400">(pilihan)</small>
        <textarea name="note" rows="2" maxlength="300" placeholder="Contoh: Sesi EIP pagi dan pengurusan aktiviti pelajar"></textarea>
      </label>
      <p id="clock-in-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" id="btn-submit-clock-in" type="submit" ${(!isMobile && !isAdm)?'disabled':''}>${icon('check')} Sahkan Clock In</button>
      </div>
    </form>
  `);

  async function checkGpsDistance(){
    const textEl=document.querySelector('#gps-status-text');
    const submitBtn=document.querySelector('#btn-submit-clock-in');
    if(!textEl)return;

    textEl.innerHTML='<span class="pulse-dot"></span> Sedang mengesan koordinat GPS telefon…';
    try{
      const pos=await getGpsCoordinates();
      const lat=pos.latitude;
      const lon=pos.longitude;
      const latEl=document.querySelector('#clock-lat');
      const lonEl=document.querySelector('#clock-lon');
      if(latEl)latEl.value=lat;
      if(lonEl)lonEl.value=lon;

      const s=todayClockStatus.settings||{};
      const cLat=Number(s.latitude||3.36965100);
      const cLon=Number(s.longitude||101.57162700);
      const allowedRadius=Number(s.geofence_radius_meters||100);
      const dist=calcDistanceMeters(lat,lon,cLat,cLon);

      if(dist<=allowedRadius){
        textEl.innerHTML=`<span style="color:var(--teal);font-weight:700">✓ Lokasi Disahkan: ${dist}m dari Beruntung Brainiac</span> <small style="display:block;color:var(--muted)">Dalam zon dibenarkan (${allowedRadius}m)</small>`;
        if(submitBtn)submitBtn.disabled=false;
      }else{
        textEl.innerHTML=`<span style="color:var(--red);font-weight:700">⚠ Di Luar Zon Pusat: ${dist}m dari premis</span> <small style="display:block;color:var(--muted)">Had dibenarkan: ${allowedRadius}m${isAdm?' (Mod Admin: Boleh teruskan)':''}</small>`;
        if(!isAdm && submitBtn)submitBtn.disabled=true;
      }
    }catch(err){
      textEl.innerHTML=`<span style="color:var(--red)">⚠ ${esc(err.message)}</span>`;
      if(!isAdm && submitBtn)submitBtn.disabled=true;
    }
  }

  document.querySelector('#btn-refresh-gps')?.addEventListener('click',checkGpsDistance);
  if(isMobile||isAdm){
    checkGpsDistance();
  }
}

function openClockOutDialog(){
  const now=new Date();
  const timeStr=now.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true});
  const inTime=formatMyTime(todayClockStatus.record?.clock_in);
  
  let estDuration='';
  if(todayClockStatus.record?.clock_in){
    const start=new Date(todayClockStatus.record.clock_in).getTime();
    const diffMins=Math.max(1,Math.round((now.getTime()-start)/60000));
    estDuration=formatDurationMins(diffMins);
  }

  open('Clock Out — Tamat Syif Bertugas',`
    <div class="clock-dialog-clock">
      <div class="clock-digital-time">${timeStr}</div>
      <div class="clock-digital-date">Waktu mula masuk: <strong>${inTime}</strong> (${estDuration} berkhidmat)</div>
    </div>
    <form id="clock-out-form">
      <label class="field">Catatan Penutup / Tugasan Hari Ini <small style="color:var(--muted);font-weight:400">(pilihan)</small>
        <textarea name="note" rows="3" maxlength="500" placeholder="Contoh: Semua nota sesi EIP dan terapi selesai dikemas kini."></textarea>
      </label>
      <p id="clock-out-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit" style="background:#0d6955">${icon('check')} Sahkan Clock Out</button>
      </div>
    </form>
  `);
}

async function handleClockActionClick(){
  if(todayClockStatus.status==='clocked_in'){
    openClockOutDialog();
  }else if(todayClockStatus.status==='clocked_out'){
    const dur=formatDurationMins(todayClockStatus.record?.duration_minutes);
    notify(`Syif hari ini telah selesai (${dur}). Terima kasih!`);
  }else{
    openClockInDialog();
  }
}

function isOnTimeStatus(st){
  const s=String(st||'Tepat masa').toLowerCase();
  return !s.includes('lewat') && !s.includes('kurang');
}

function renderAttendanceStatusBadge(st){
  const s=String(st||'Tepat masa');
  const sl=s.toLowerCase();
  if(sl.includes('cuti'))return `<span class="att-badge cuti">${esc(s)}</span>`;
  if(sl.includes('lewat')||sl.includes('kurang'))return `<span class="att-badge lewat">${esc(s)}</span>`;
  return `<span class="att-badge tepat">${esc(s)}</span>`;
}

// 1. STUDENT ATTENDANCE WORKSPACE (#attendance — Dedicated for students, accessible by Admin, Teacher, Therapist)
function studentAttendanceWorkspace(){
  content.innerHTML=renderStudentAttendanceSection();
}

// 2. STAFF ATTENDANCE WORKSPACE (#staff-attendance — Dedicated for permanent staff: Admin & Teacher)
async function staffAttendanceWorkspace(){
  if(currentUser?.role==='therapist'){
    notify('Kehadiran Staf hanya untuk staf tetap (Guru & Admin).');
    location.hash='attendance';
    return;
  }
  content.innerHTML=`<div class="auth-loading" role="status">Memuatkan kehadiran staf…</div>`;
  await fetchClockStatus();
  
  const isAdm=currentUser?.role==='admin';
  if(isAdm){
    await loadAdminAttendanceData();
    content.innerHTML=renderAdminAttendanceSection();
    renderDashboardClockCard();
  }else{
    await loadMyAttendanceData();
    content.innerHTML=renderStaffAttendanceSection();
    renderDashboardClockCard();
  }
}

// Backward-compatible alias
async function attendanceWorkspace(){
  if(page==='attendance')return studentAttendanceWorkspace();
  return staffAttendanceWorkspace();
}

let studentAttendanceDate='';
function getStudentAttendanceDate(){if(!studentAttendanceDate)studentAttendanceDate=typeof malaysiaToday==='function'?malaysiaToday():new Date().toISOString().slice(0,10);return studentAttendanceDate;}
function studentBalanceBadgeForProg(studentId,programme,dateStr){
  if(typeof StudentPackages==='undefined'||typeof studentRoster!=='function')return '';
  const st=studentRoster().find(x=>x.id===studentId||x.name===studentId);
  if(!st)return '';
  const ym=StudentPackages.monthFromDate(dateStr);
  const sum=StudentPackages.getStudentBalanceSummary(st,ym);
  const b=sum[programme];
  if(!b)return '';
  if(b.total===0&&b.overQuota===0)return `<span class="badge">Tiada pakej ${StudentPackages.PROG_LABELS[programme]}</span>`;
  return `<span class="badge ${b.remaining===0?'amber':'green'}">Baki ${StudentPackages.PROG_LABELS[programme]}: ${b.remaining}/${b.total}${b.overQuota?` (+${b.overQuota} lebih)`:''}</span>`;
}
function renderStudentAttendanceSection(){
  const selDate=getStudentAttendanceDate();
  const bookings=(typeof plannerBookings==='function'?plannerBookings():[]).filter(b=>b.date===selDate&&b.students?.length);
  const bookingItems=[];
  for(const b of bookings){
    for(const sid of b.students){
      const stName=typeof plannerStudentName==='function'?plannerStudentName(sid):sid;
      const att=b.attendance?.[sid]||'Belum ditanda';
      bookingItems.push({key:b.key,studentId:sid,studentName:stName,mode:b.mode,time:typeof slotLabel==='function'?slotLabel(b.mode,b.time):b.time,staff:b.staff,att,programmeLabel:typeof plannerPrograms!=='undefined'?plannerPrograms[b.mode]:b.mode});
    }
  }
  const legacyItems=data.sessions.map(s=>({id:s.id,studentId:s.name,studentName:s.name,mode:s.programme==='EIP'?'eip':s.programme?.includes('Pertuturan')?'speech':'ot',time:s.time,staff:s.staff,att:s.attendance||(s.status==='Selesai'?'Hadir':'Belum ditanda'),programmeLabel:s.programme,replacement:s.replacement}));

  const allItems=[...bookingItems,...legacyItems];
  const total=allItems.length;
  const present=allItems.filter(x=>x.att==='Hadir').length;
  const absent=allItems.filter(x=>x.att==='Tidak hadir').length;
  const pending=Math.max(0,total-present-absent);

  return `
    <div class="attendance-stats" style="grid-template-columns:repeat(3,1fr)">
      <div class="att-stat-card">
        <div class="att-stat-label">Jumlah Sesi Pelajar ${icon('calendar')}</div>
        <div class="att-stat-num">${total}</div>
        <div class="att-stat-sub">Sesi kelas EIP & terapi (${esc(selDate)})</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Hadir / Selesai ${icon('check')}</div>
        <div class="att-stat-num" style="color:var(--teal)">${present}</div>
        <div class="att-stat-sub">${pending} sesi belum ditanda</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Tidak Hadir / Perlu Ganti ${icon('refresh')}</div>
        <div class="att-stat-num" style="color:#94631a">${absent}</div>
        <div class="att-stat-sub">Tiada tolakan baki</div>
      </div>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Kehadiran Sesi Pelajar</h2>
          <p>Klik <b>Hadir</b> untuk menolak baki sesi pelajar secara automatik.</p>
        </div>
        <div class="record-actions">
          <label class="field" style="margin:0"><input type="date" id="student-att-date" value="${esc(selDate)}" aria-label="Tarikh kehadiran pelajar"></label>
          <button class="secondary" type="button" data-go="sessions">${icon('calendar')} Buka Jadual Sesi</button>
        </div>
      </div>
      <div class="records">
        ${bookingItems.map(item=>`
          <div class="record">
            <div>
              <h3>${esc(item.studentName)}</h3>
              <p>${esc(item.time)} • ${esc(item.programmeLabel)} • ${esc(item.staff)}</p>
              <div class="pkg-balance-row">${badge(item.att)} ${studentBalanceBadgeForProg(item.studentId,item.mode,selDate)}</div>
            </div>
            <div class="record-actions">
              <button class="${item.att==='Hadir'?'primary':'secondary'}" data-attend-booking="${esc(item.key)}" data-student-id="${esc(item.studentId)}" data-value="Hadir">Hadir</button>
              <button class="${item.att==='Tidak hadir'?'primary':'secondary'}" data-attend-booking="${esc(item.key)}" data-student-id="${esc(item.studentId)}" data-value="Tidak hadir">Tidak hadir</button>
            </div>
          </div>
        `).join('')}
        ${legacyItems.map(item=>`
          <div class="record">
            <div>
              <h3>${esc(item.studentName)}</h3>
              <p>${esc(item.time)} • ${esc(item.programmeLabel)} • ${esc(item.staff)}</p>
              <div class="pkg-balance-row">${badge(item.att)}${item.replacement?' <span class="badge amber">Perlu sesi ganti</span>':''} ${studentBalanceBadgeForProg(item.studentId,item.mode,selDate)}</div>
            </div>
            <div class="record-actions">
              <button class="${item.att==='Hadir'?'primary':'secondary'}" data-attend="${item.id}" data-value="Hadir">Hadir</button>
              <button class="${item.att==='Tidak hadir'?'primary':'secondary'}" data-attend="${item.id}" data-value="Tidak hadir">Tidak hadir</button>
            </div>
          </div>
        `).join('')}
        ${!allItems.length?'<p class="empty">Tiada sesi pelajar dijadualkan pada tarikh ini. Gunakan Jadual Sesi untuk menambah slot pelajar.</p>':''}
      </div>
    </section>`;
}

async function loadMyAttendanceData(){
  try{
    const r=await api('my_attendance');
    myAttendanceRecords=r.records||[];
  }catch(e){
    notify('Gagal memuatkan rekod kehadiran: '+e.message);
  }
}

function renderStaffAttendanceSection(){
  const totalDays=myAttendanceRecords.length;
  const totalMins=myAttendanceRecords.reduce((sum,r)=>sum+Number(r.duration_minutes||0),0);
  const totalHours=(totalMins/60).toFixed(1);
  const avgHours=totalDays>0?(totalMins/totalDays/60).toFixed(1):'0';

  const rows=myAttendanceRecords.map((r,i)=>{
    const inTime=formatMyTime(r.clock_in);
    const outTime=r.clock_out?formatMyTime(r.clock_out):'<span style="color:var(--amber)">Sedang Bertugas</span>';
    const dur=r.duration_minutes?formatDurationMins(r.duration_minutes):'-';
    const stBadge=renderAttendanceStatusBadge(r.status);
    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${formatMyDate(r.work_date)}</b><small>${formatMyDay(r.work_date)}</small></td>
        <td>${inTime}</td>
        <td>${outTime}</td>
        <td><b>${dur}</b></td>
        <td><span class="badge">${esc(r.work_location||'Pusat')}</span></td>
        <td>${stBadge}</td>
        <td><small>${esc(r.note||'-')}</small></td>
      </tr>
    `;
  }).join('');

  return `
    <div id="dashboard-attendance-card"></div>
    <div class="attendance-stats">
      <div class="att-stat-card">
        <div class="att-stat-label">Jumlah Hari Bertugas ${icon('calendar')}</div>
        <div class="att-stat-num">${totalDays}</div>
        <div class="att-stat-sub">Rekod terkini</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Jumlah Jam Bekerja ${icon('clock')}</div>
        <div class="att-stat-num">${totalHours} <small style="font-size:14px">jam</small></div>
        <div class="att-stat-sub">Berdasarkan rekod clock out</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Purata Jam / Hari ${icon('chart')}</div>
        <div class="att-stat-num">${avgHours} <small style="font-size:14px">jam</small></div>
        <div class="att-stat-sub">Setiap syif bekerja</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Status Semasa ${icon('check')}</div>
        <div class="att-stat-num" style="font-size:18px;margin-top:12px">${todayClockStatus.status==='clocked_in'?'<span style="color:var(--teal)">Bertugas</span>':todayClockStatus.status==='clocked_out'?'<span style="color:var(--muted)">Selesai</span>':'<span style="color:var(--amber)">Belum Masuk</span>'}</div>
        <div class="att-stat-sub">Hari ini</div>
      </div>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Rekod Kehadiran Saya</h2>
          <p>Senarai rekod masa masuk dan keluar anda di Beruntung Brainiac.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tarikh</th>
              <th>Masa Masuk</th>
              <th>Masa Keluar</th>
              <th>Tempoh</th>
              <th>Lokasi</th>
              <th>Status</th>
              <th>Catatan</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="8" class="empty">Belum ada rekod kehadiran. Sila Clock In untuk memulakan syif anda.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// ADMIN CONSOLE
async function loadAdminAttendanceData(){
  try{
    if(!attendanceFilter.from&&!attendanceFilter.to&&attendanceFilter.preset==='this_month'){
      applyDatePreset('this_month');
    }
    const p=new URLSearchParams();
    if(attendanceFilter.from)p.set('from',attendanceFilter.from);
    if(attendanceFilter.to)p.set('to',attendanceFilter.to);
    if(attendanceFilter.userId&&attendanceFilter.userId!=='all')p.set('user_id',attendanceFilter.userId);
    if(attendanceFilter.role&&attendanceFilter.role!=='all')p.set('role',attendanceFilter.role);
    
    const qs=p.toString();
    const r=await api(qs?'admin_attendance&'+qs:'admin_attendance');
    adminAttendanceRecords=r.records||[];
    adminAttendanceUsers=r.users||[];
  }catch(e){
    notify('Ralat memuatkan rekod pentadbir: '+e.message);
  }
}

function applyDatePreset(preset){
  attendanceFilter.preset=preset;
  const now=new Date();
  const pad=n=>String(n).padStart(2,'0');
  const fmt=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

  if(preset==='today'){
    attendanceFilter.from=fmt(now);
    attendanceFilter.to=fmt(now);
  }else if(preset==='last_7'){
    const past=new Date(now.getTime()-6*86400000);
    attendanceFilter.from=fmt(past);
    attendanceFilter.to=fmt(now);
  }else if(preset==='this_month'){
    attendanceFilter.from=`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`;
    const lastDay=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
    attendanceFilter.to=`${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(lastDay)}`;
  }else if(preset==='last_month'){
    const prevM=new Date(now.getFullYear(),now.getMonth()-1,1);
    attendanceFilter.from=`${prevM.getFullYear()}-${pad(prevM.getMonth()+1)}-01`;
    const lastDay=new Date(prevM.getFullYear(),prevM.getMonth()+1,0).getDate();
    attendanceFilter.to=`${prevM.getFullYear()}-${pad(prevM.getMonth()+1)}-${pad(lastDay)}`;
  }else if(preset==='all'){
    attendanceFilter.from='';
    attendanceFilter.to='';
  }
}

function renderAdminAttendanceSection(){
  const recs=adminAttendanceRecords;
  const totalDays=recs.length;
  const totalMins=recs.reduce((sum,r)=>sum+Number(r.duration_minutes||0),0);
  const totalHours=(totalMins/60).toFixed(1);
  const todayStr=getTodayMyStr();
  const onDutyToday=recs.filter(r=>r.work_date===todayStr&&!r.clock_out).length;
  const onTimeCount=recs.filter(r=>isOnTimeStatus(r.status)).length;
  const onTimePct=totalDays>0?Math.round((onTimeCount/totalDays)*100):100;

  const rows=recs.map((r,i)=>{
    const inTime=formatMyTime(r.clock_in);
    const outTime=r.clock_out?formatMyTime(r.clock_out):'<span style="color:var(--amber);font-weight:600">Sedang Bertugas</span>';
    const dur=r.duration_minutes?formatDurationMins(r.duration_minutes):'-';
    const stBadge=renderAttendanceStatusBadge(r.status);
    const roleLabel=demoRoles[r.user_role]||r.user_role;
    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${formatMyDate(r.work_date)}</b><small>${formatMyDay(r.work_date)}</small></td>
        <td><div class="person"><span class="avatar">${esc(r.user_name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><div><b>${esc(r.user_name)}</b><small>${esc(roleLabel)}</small></div></div></td>
        <td>${inTime}</td>
        <td>${outTime}</td>
        <td><b>${dur}</b></td>
        <td><span class="badge">${esc(r.work_location||'Pusat')}</span></td>
        <td>${stBadge}</td>
        <td><small>${esc(r.note||'-')}</small></td>
        <td>
          <div class="att-row-actions">
            <button class="att-icon-btn" type="button" title="Sunting rekod" data-att-edit="${esc(r.id)}">${icon('clipboard')}</button>
            <button class="att-icon-btn delete" type="button" title="Padam rekod" data-att-delete="${esc(r.id)}">${icon('x')}</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div id="dashboard-attendance-card"></div>
    <div class="attendance-stats">
      <div class="att-stat-card">
        <div class="att-stat-label">Jumlah Rekod Kehadiran ${icon('calendar')}</div>
        <div class="att-stat-num">${totalDays}</div>
        <div class="att-stat-sub">Bagi tempoh yang dipilih</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Jumlah Jam Bekerja ${icon('clock')}</div>
        <div class="att-stat-num">${totalHours} <small style="font-size:14px">jam</small></div>
        <div class="att-stat-sub">Terkumpul oleh semua staf</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Staf Sedang Bertugas ${icon('users')}</div>
        <div class="att-stat-num" style="color:var(--teal)">${onDutyToday}</div>
        <div class="att-stat-sub">Hari ini (belum clock out)</div>
      </div>
      <div class="att-stat-card">
        <div class="att-stat-label">Kadar Tepat Masa ${icon('chart')}</div>
        <div class="att-stat-num">${onTimePct}%</div>
        <div class="att-stat-sub">${onTimeCount} daripada ${totalDays} rekod</div>
      </div>
    </div>

    <!-- Filter Toolbar -->
    <div class="att-toolbar">
      <div class="att-presets">
        <button class="att-preset-btn ${attendanceFilter.preset==='today'?'active':''}" data-preset="today" type="button">Hari Ini</button>
        <button class="att-preset-btn ${attendanceFilter.preset==='last_7'?'active':''}" data-preset="last_7" type="button">7 Hari Lepas</button>
        <button class="att-preset-btn ${attendanceFilter.preset==='this_month'?'active':''}" data-preset="this_month" type="button">Bulan Ini</button>
        <button class="att-preset-btn ${attendanceFilter.preset==='last_month'?'active':''}" data-preset="last_month" type="button">Bulan Lepas</button>
        <button class="att-preset-btn ${attendanceFilter.preset==='all'?'active':''}" data-preset="all" type="button">Semua Rekod</button>
      </div>
      <form id="att-filter-form" class="att-filters-row">
        <label class="att-field">Dari Tarikh
          <input type="date" name="from" value="${esc(attendanceFilter.from)}">
        </label>
        <label class="att-field">Hingga Tarikh
          <input type="date" name="to" value="${esc(attendanceFilter.to)}">
        </label>
        <label class="att-field">Tapis Staf
          <select name="user_id">
            <option value="all">Semua Staf (${adminAttendanceUsers.length})</option>
            ${adminAttendanceUsers.map(u=>`<option value="${esc(u.id)}" ${attendanceFilter.userId===u.id?'selected':''}>${esc(u.name)} (${esc(demoRoles[u.role]||u.role)})</option>`).join('')}
          </select>
        </label>
        <label class="att-field">Peranan
          <select name="role">
            <option value="all">Semua Peranan</option>
            <option value="teacher" ${attendanceFilter.role==='teacher'?'selected':''}>Cikgu</option>
            <option value="admin" ${attendanceFilter.role==='admin'?'selected':''}>Admin</option>
          </select>
        </label>
        <button class="primary" type="submit" style="min-height:38px;padding:6px 16px">${icon('search')} Tapis</button>
      </form>
    </div>

    <!-- Export Action Bar -->
    <div class="att-actions-bar">
      <div class="att-export-group">
        <button class="export-btn csv" id="btn-export-csv" type="button" title="Eksport rekod ke format CSV">${icon('clipboard')} Muat Turun CSV</button>
        <button class="export-btn excel" id="btn-export-excel" type="button" title="Eksport lembaran kerja format Excel (.xls)">${icon('chart')} Muat Turun Excel</button>
        <button class="export-btn pdf" id="btn-export-pdf" type="button" title="Cetak atau simpan laporan rasmi PDF">${icon('book')} Jana Laporan PDF</button>
      </div>
      <div style="display:flex;gap:8px">
        <button class="secondary" id="btn-hr-settings" type="button" title="Tetapan Geofencing GPS & Majikan KWSP">${icon('building')} Tetapan HR & GPS</button>
        <button class="primary" id="btn-manual-attendance" type="button">${icon('plus')} Pelarasan Manual</button>
      </div>
    </div>

    <!-- Main Attendance Table -->
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Senarai Kehadiran Staf (${recs.length} rekod)</h2>
          <p>Tempoh: ${attendanceFilter.from?formatMyDate(attendanceFilter.from):'Awal'} hingga ${attendanceFilter.to?formatMyDate(attendanceFilter.to):'Kini'}</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tarikh</th>
              <th>Nama Staf</th>
              <th>Masa Masuk</th>
              <th>Masa Keluar</th>
              <th>Tempoh</th>
              <th>Lokasi</th>
              <th>Status</th>
              <th>Catatan</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="10" class="empty">Tiada rekod kehadiran ditemui bagi tapisan ini.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

// REPORT EXPORTS: CSV, EXCEL, PDF
function exportAttendanceCsv(){
  const recs=adminAttendanceRecords;
  if(!recs.length){notify('Tiada rekod untuk dieksport.');return}
  
  const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const headers=['Bil','Tarikh','Hari','Nama Staf','Peranan','Emel','Masa Masuk','Masa Keluar','Tempoh (Jam & Min)','Jumlah Jam (Perpuluhan)','Lokasi Bertugas','Status','Catatan'];
  
  const userMap=new Map(adminAttendanceUsers.map(u=>[u.id,u]));
  const rows=recs.map((r,i)=>{
    const u=userMap.get(r.user_id);
    const dur=r.duration_minutes?formatDurationMins(r.duration_minutes):'-';
    const decHours=r.duration_minutes?(r.duration_minutes/60).toFixed(2):'0.00';
    return [
      i+1,
      r.work_date,
      formatMyDay(r.work_date),
      r.user_name,
      demoRoles[r.user_role]||r.user_role,
      u?.email||'-',
      formatMyTime(r.clock_in),
      r.clock_out?formatMyTime(r.clock_out):'Sedang Bertugas',
      dur,
      decHours,
      r.work_location||'Pusat',
      r.status||'Hadir',
      r.note||''
    ].map(cell).join(',');
  });

  const csvContent='\uFEFF'+[headers.map(cell).join(','),...rows].join('\r\n');
  const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const dateTag=attendanceFilter.from?`${attendanceFilter.from}-hingga-${attendanceFilter.to}`:getTodayMyStr();
  a.href=url;
  a.download=`laporan-kehadiran-brainiac-${dateTag}.csv`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  notify('Fail CSV berjaya dimuat turun.');
}

function exportAttendanceExcel(){
  const recs=adminAttendanceRecords;
  if(!recs.length){notify('Tiada rekod untuk dieksport.');return}
  
  const userMap=new Map(adminAttendanceUsers.map(u=>[u.id,u]));
  const totalMins=recs.reduce((sum,r)=>sum+Number(r.duration_minutes||0),0);
  const totalHours=(totalMins/60).toFixed(2);
  const dateTag=attendanceFilter.from?`${formatMyDate(attendanceFilter.from)} hingga ${formatMyDate(attendanceFilter.to)}`:'Semua Rekod';

  let tableRows=recs.map((r,i)=>{
    const u=userMap.get(r.user_id);
    const inTime=formatMyTime(r.clock_in);
    const outTime=r.clock_out?formatMyTime(r.clock_out):'Sedang Bertugas';
    const dur=r.duration_minutes?formatDurationMins(r.duration_minutes):'-';
    const decHours=r.duration_minutes?(r.duration_minutes/60).toFixed(2):'0.00';
    const bg=i%2===0?'#ffffff':'#f9fbfc';
    return `
      <tr style="background:${bg}">
        <td style="border:1px solid #d5dde0;padding:8px;text-align:center">${i+1}</td>
        <td style="border:1px solid #d5dde0;padding:8px">${formatMyDate(r.work_date)}</td>
        <td style="border:1px solid #d5dde0;padding:8px">${formatMyDay(r.work_date)}</td>
        <td style="border:1px solid #d5dde0;padding:8px"><strong>${esc(r.user_name)}</strong></td>
        <td style="border:1px solid #d5dde0;padding:8px">${esc(demoRoles[r.user_role]||r.user_role)}</td>
        <td style="border:1px solid #d5dde0;padding:8px">${esc(u?.email||'-')}</td>
        <td style="border:1px solid #d5dde0;padding:8px;text-align:center">${inTime}</td>
        <td style="border:1px solid #d5dde0;padding:8px;text-align:center">${outTime}</td>
        <td style="border:1px solid #d5dde0;padding:8px;text-align:center">${dur}</td>
        <td style="border:1px solid #d5dde0;padding:8px;text-align:right">${decHours}</td>
        <td style="border:1px solid #d5dde0;padding:8px">${esc(r.work_location||'Pusat')}</td>
        <td style="border:1px solid #d5dde0;padding:8px;text-align:center">${esc(r.status||'Hadir')}</td>
        <td style="border:1px solid #d5dde0;padding:8px">${esc(r.note||'-')}</td>
      </tr>
    `;
  }).join('');

  const htmlDoc=`
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <!--[if gte mso 9]>
      <xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Kehadiran Staf</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml>
      <![endif]-->
      <style>
        body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1d3339}
        table{border-collapse:collapse;width:100%}
        th{background:#00203f;color:#ffffff;border:1px solid #001a33;padding:10px 8px;font-size:11px}
      </style>
    </head>
    <body>
      <h2 style="color:#00203f;margin-bottom:4px">BERUNTUNG BRAINIAC — LAPORAN KEHADIRAN STAF</h2>
      <p style="margin:2px 0 12px;color:#62757a">Pusat Terapi Perkembangan Kanak-Kanak · No. SSM: 202503030392 (003694359-M)</p>
      <table style="margin-bottom:14px;background:#f0f7f5;border:1px solid #cce3dc">
        <tr>
          <td style="padding:6px 12px"><strong>Tempoh Rekod:</strong> ${dateTag}</td>
          <td style="padding:6px 12px"><strong>Tarikh Dijana:</strong> ${formatMyDate(getTodayMyStr())}</td>
          <td style="padding:6px 12px"><strong>Jumlah Rekod:</strong> ${recs.length}</td>
          <td style="padding:6px 12px"><strong>Jumlah Jam Bekerja:</strong> ${totalHours} jam</td>
        </tr>
      </table>
      <table>
        <thead>
          <tr>
            <th>Bil</th>
            <th>Tarikh</th>
            <th>Hari</th>
            <th>Nama Staf</th>
            <th>Peranan</th>
            <th>Emel</th>
            <th>Clock In</th>
            <th>Clock Out</th>
            <th>Tempoh</th>
            <th>Jam (Perpuluhan)</th>
            <th>Lokasi</th>
            <th>Status</th>
            <th>Catatan</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
          <tr style="background:#e6f2ee;font-weight:bold">
            <td colspan="9" style="border:1px solid #b8dece;padding:10px;text-align:right">JUMLAH KESELURUHAN:</td>
            <td style="border:1px solid #b8dece;padding:10px;text-align:right">${totalHours} jam</td>
            <td colspan="3" style="border:1px solid #b8dece"></td>
          </tr>
        </tbody>
      </table>
      <br><br>
      <p style="font-size:10px;color:#8899a6">Dokumen ini dijana secara automatik melalui sistem Brainiac Hub.</p>
    </body>
    </html>
  `;

  const blob=new Blob([htmlDoc],{type:'application/vnd.ms-excel;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const fileDate=attendanceFilter.from?`${attendanceFilter.from}-to-${attendanceFilter.to}`:getTodayMyStr();
  a.href=url;
  a.download=`laporan-kehadiran-brainiac-${fileDate}.xls`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  notify('Fail Excel berjaya dimuat turun.');
}

async function exportAttendancePdf(){
  const recs=adminAttendanceRecords;
  if(!recs.length){notify('Tiada rekod untuk dijana ke PDF.');return}
  
  const btn=document.querySelector('#btn-export-pdf');
  if(btn){btn.disabled=true;btn.textContent='Menjana PDF…'}

  try{
    const [fonts,logo]=await Promise.all([loadProgressFonts(),loadBrandLogo()]);
    const PDF=window.jspdf.jsPDF;
    // Use Landscape A4 for wide table presentation
    const doc=new PDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
    
    doc.addFileToVFS('NotoSans-Regular.ttf',fonts.regular);
    doc.addFont('NotoSans-Regular.ttf','NotoSans','normal');
    doc.addFileToVFS('NotoSans-Bold.ttf',fonts.bold);
    doc.addFont('NotoSans-Bold.ttf','NotoSans','bold');
    doc.setFont('NotoSans','normal');

    const totalMins=recs.reduce((sum,r)=>sum+Number(r.duration_minutes||0),0);
    const totalHours=(totalMins/60).toFixed(1);
    const pageW=297,pageH=210,margin=15;
    let y=15;

    function renderPdfHeader(){
      if(logo){
        const info=doc.getImageProperties(logo);
        const w=45,h=w*info.height/info.width;
        doc.addImage(logo,'PNG',margin,y,w,h);
      }else{
        doc.setFont('NotoSans','bold');
        doc.setFontSize(14);
        doc.setTextColor(0,32,63);
        doc.text('BERUNTUNG BRAINIAC',margin,y+6);
      }
      doc.setFont('NotoSans','bold');
      doc.setFontSize(14);
      doc.setTextColor(0,32,63);
      doc.text('LAPORAN KEHADIRAN KAKITANGAN',pageW-margin,y+5,{align:'right'});
      doc.setFont('NotoSans','normal');
      doc.setFontSize(9);
      doc.setTextColor(90,105,120);
      doc.text('STAFF ATTENDANCE REPORT',pageW-margin,y+10,{align:'right'});
      doc.setFontSize(8);
      doc.text('Beruntung Brainiac Enterprise · SSM: 202503030392 (003694359-M)',pageW-margin,y+15,{align:'right'});
      doc.setDrawColor(255,210,0);
      doc.setLineWidth(1);
      doc.line(margin,y+20,pageW-margin,y+20);
      doc.setLineWidth(.2);
    }

    renderPdfHeader();
    y+=26;

    // Metadata Bar
    doc.setFillColor(240,247,245);
    doc.roundedRect(margin,y,pageW-margin*2,12,2,2,'F');
    doc.setFont('NotoSans','normal');
    doc.setFontSize(8.5);
    doc.setTextColor(0,32,63);
    const dateRangeLabel=attendanceFilter.from?`${formatMyDate(attendanceFilter.from)} hingga ${formatMyDate(attendanceFilter.to)}`:'Semua Rekod Tersimpan';
    doc.text(`Tempoh: ${dateRangeLabel}`,margin+6,y+7.5);
    doc.text(`Tarikh Cetakan: ${formatMyDate(getTodayMyStr())}`,margin+85,y+7.5);
    doc.text(`Jumlah Rekod: ${recs.length} hari bekerja`,margin+155,y+7.5);
    doc.text(`Jumlah Jam Bekerja: ${totalHours} jam`,margin+215,y+7.5);
    y+=18;

    // Table Header
    const cols=[
      {title:'Bil',w:10,align:'center'},
      {title:'Tarikh',w:26,align:'left'},
      {title:'Hari',w:22,align:'left'},
      {title:'Nama Staf',w:55,align:'left'},
      {title:'Jawatan',w:32,align:'left'},
      {title:'Clock In',w:24,align:'center'},
      {title:'Clock Out',w:24,align:'center'},
      {title:'Tempoh',w:24,align:'center'},
      {title:'Lokasi',w:22,align:'center'},
      {title:'Status',w:28,align:'center'}
    ];

    function drawTableHeader(){
      doc.setFillColor(0,32,63);
      doc.rect(margin,y,pageW-margin*2,8,'F');
      doc.setFont('NotoSans','bold');
      doc.setFontSize(8);
      doc.setTextColor(255,255,255);
      let curX=margin;
      cols.forEach(c=>{
        const tx=c.align==='center'?curX+c.w/2:c.align==='right'?curX+c.w-2:curX+2;
        doc.text(c.title,tx,y+5.5,{align:c.align});
        curX+=c.w;
      });
      y+=8;
    }

    drawTableHeader();

    // Table Rows
    doc.setFont('NotoSans','normal');
    doc.setFontSize(8);
    const rowH=7;

    recs.forEach((r,i)=>{
      if(y+rowH>pageH-25){
        doc.addPage();
        y=15;
        renderPdfHeader();
        y+=26;
        drawTableHeader();
        doc.setFont('NotoSans','normal');
        doc.setFontSize(8);
      }

      if(i%2===1){
        doc.setFillColor(248,250,251);
        doc.rect(margin,y,pageW-margin*2,rowH,'F');
      }

      doc.setDrawColor(230,235,238);
      doc.line(margin,y+rowH,pageW-margin,y+rowH);

      doc.setTextColor(29,51,57);
      let curX=margin;
      const dur=r.duration_minutes?formatDurationMins(r.duration_minutes):'-';
      const inTime=formatMyTime(r.clock_in);
      const outTime=r.clock_out?formatMyTime(r.clock_out):'Bertugas';
      const roleStr=demoRoles[r.user_role]||r.user_role;

      const vals=[
        String(i+1),
        formatMyDate(r.work_date),
        formatMyDay(r.work_date),
        r.user_name,
        roleStr,
        inTime,
        outTime,
        dur,
        r.work_location||'Pusat',
        r.status||'Hadir'
      ];

      cols.forEach((c,idx)=>{
        const val=vals[idx];
        const tx=c.align==='center'?curX+c.w/2:c.align==='right'?curX+c.w-2:curX+2;
        doc.text(doc.splitTextToSize(val,c.w-3)[0]||'',tx,y+4.8,{align:c.align});
        curX+=c.w;
      });

      y+=rowH;
    });

    // Verification Sign-off Box at bottom
    if(y+35>pageH-15){
      doc.addPage();
      y=25;
    }else{
      y+=8;
    }

    doc.setFont('NotoSans','normal');
    doc.setFontSize(8);
    doc.setTextColor(80,95,105);
    doc.text('Disediakan oleh:',margin+10,y);
    doc.text('Disahkan oleh (Pengarah / Pengurusan):',pageW-margin-80,y);
    y+=16;
    doc.setFont('NotoSans','bold');
    doc.setTextColor(0,32,63);
    doc.text(esc(currentUser?.name||'Pentadbir'),margin+10,y);
    doc.text('_____________________________________',pageW-margin-80,y);
    doc.setFont('NotoSans','normal');
    doc.setFontSize(7.5);
    doc.text('Pusat Terapi Perkembangan Kanak-Kanak Beruntung Brainiac',pageW-margin-80,y+5);

    // Page numbers
    const totalPages=doc.getNumberOfPages();
    for(let p=1;p<=totalPages;p++){
      doc.setPage(p);
      doc.setFont('NotoSans','normal');
      doc.setFontSize(7);
      doc.setTextColor(120,135,145);
      doc.text('Beruntung Brainiac Enterprise · SSM 202503030392 · DOKUMEN SULIT',margin,pageH-8);
      doc.text(`Muka surat ${p} / ${totalPages}`,pageW-margin,pageH-8,{align:'right'});
    }

    const fileDate=attendanceFilter.from?`${attendanceFilter.from}-to-${attendanceFilter.to}`:getTodayMyStr();
    doc.save(`laporan-kehadiran-brainiac-${fileDate}.pdf`);
    notify('Laporan PDF kehadiran berjaya dijana.');
  }catch(err){
    console.error(err);
    notify('Gagal menjana PDF: '+err.message);
  }finally{
    if(btn){btn.disabled=false;btn.textContent='Jana Laporan PDF'}
  }
}

// Admin Add / Edit Dialog (Manual Adjustment with Mandatory Audit Reason)
function openAdminAttendanceDialog(recordId=null){
  const rec=adminAttendanceRecords.find(r=>r.id===recordId)||{
    id:'',
    user_id:adminAttendanceUsers[0]?.id||'',
    work_date:getTodayMyStr(),
    clock_in:'',
    clock_out:'',
    work_location:'Pusat',
    status:'Tepat masa',
    adjustment_reason:'',
    note:''
  };

  const isEdit=!!rec.id;
  const inVal=rec.clock_in?rec.clock_in.slice(11,16):'08:30';
  const outVal=rec.clock_out?rec.clock_out.slice(11,16):'17:00';

  open(isEdit?'Sunting Rekod Kehadiran (Audit Pelarasan)':'Tambah Rekod Kehadiran Manual',`
    <form id="admin-attendance-form">
      <input type="hidden" name="record_id" value="${esc(rec.id)}">
      <label class="field">Pilih Staf
        <select name="user_id" required>
          ${adminAttendanceUsers.map(u=>`<option value="${esc(u.id)}" ${rec.user_id===u.id?'selected':''}>${esc(u.name)} (${esc(demoRoles[u.role]||u.role)})</option>`).join('')}
        </select>
      </label>
      <div class="form-grid">
        <label class="field">Tarikh Bertugas
          <input type="date" name="work_date" required value="${esc(rec.work_date||getTodayMyStr())}">
        </label>
        <label class="field">Lokasi Bertugas
          <select name="work_location">
            <option value="Pusat" ${rec.work_location==='Pusat'?'selected':''}>Pusat</option>
            <option value="Outreach" ${rec.work_location==='Outreach'?'selected':''}>Outreach</option>
            <option value="WFH" ${rec.work_location==='WFH'?'selected':''}>WFH</option>
            <option value="Lain-lain" ${rec.work_location==='Lain-lain'?'selected':''}>Lain-lain</option>
          </select>
        </label>
      </div>
      <div class="form-grid">
        <label class="field">Masa Masuk (Clock In)
          <input type="time" name="time_in" required value="${inVal}">
        </label>
        <label class="field">Masa Keluar (Clock Out)
          <input type="time" name="time_out" value="${outVal}">
        </label>
      </div>
      <label class="field">Status Kehadiran
        <select name="status">
          <option value="Tepat masa" ${rec.status==='Tepat masa'||rec.status==='Tepat Masa'?'selected':''}>Tepat Masa</option>
          <option value="Cukup Syif" ${rec.status==='Cukup Syif'?'selected':''}>Cukup Syif (8.5 Jam)</option>
          <option value="Lewat" ${rec.status==='Lewat'||rec.status==='Lewat (Cukup Syif)'?'selected':''}>Lewat</option>
          <option value="Kurang Jam" ${rec.status==='Kurang Jam'||rec.status==='Lewat (Kurang Jam)'?'selected':''}>Kurang Jam</option>
          <option value="Separuh Hari" ${rec.status==='Separuh Hari'?'selected':''}>Separuh Hari</option>
          <option value="Cuti" ${rec.status==='Cuti'?'selected':''}>Cuti</option>
        </select>
      </label>
      <label class="field">Sebab Pelarasan Manual <span style="color:var(--red)">* (Wajib untuk audit trail)</span>
        <textarea name="adjustment_reason" rows="2" maxlength="300" required placeholder="Nyatakan sebab pelarasan manual (cth: staf terlupa clock out balik / bateri telefon habis / urusan luar rasmi)...">${esc(rec.adjustment_reason||'')}</textarea>
      </label>
      <label class="field">Catatan Tambahan Pentadbir
        <textarea name="note" rows="2" maxlength="300" placeholder="Catatan tambahan (pilihan)...">${esc(rec.note||'')}</textarea>
      </label>
      <p id="admin-att-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit">${isEdit?'Kemas Kini Rekod':'Simpan Rekod'}</button>
      </div>
    </form>
  `);
}

async function handleAdminAttendanceSave(e){
  e.preventDefault();
  const form=e.target;
  const btn=form.querySelector('button[type="submit"]');
  btn.disabled=true;
  const errEl=document.querySelector('#admin-att-error');
  if(errEl)errEl.textContent='';

  try{
    const f=new FormData(form);
    const id=f.get('record_id')||f.get('id')||'';
    const userId=f.get('user_id');
    const workDate=f.get('work_date');
    const timeIn=f.get('time_in');
    const timeOut=f.get('time_out');
    const loc=f.get('work_location');
    const status=f.get('status');
    const reason=f.get('adjustment_reason');
    const note=f.get('note');

    const clockInIso=`${workDate}T${timeIn}:00+08:00`;
    const clockOutIso=timeOut?`${workDate}T${timeOut}:00+08:00`:null;

    await api('admin_attendance_save',{
      id,
      user_id:userId,
      work_date:workDate,
      clock_in:clockInIso,
      clock_out:clockOutIso,
      work_location:loc,
      status,
      adjustment_reason:reason,
      note
    });

    dialog.close();
    notify('Rekod kehadiran berjaya diselaraskan.');
    await staffAttendanceWorkspace();
  }catch(err){
    if(errEl)errEl.textContent=err.message;
  }finally{
    btn.disabled=false;
  }
}

async function openHrSettingsDialog(){
  let s=todayClockStatus.settings||{};
  try{
    const st=await api('clock_status');
    if(st.settings)s=st.settings;
  }catch{}

  open('Tetapan Geofencing GPS & HR',`
    <form id="hr-settings-form">
      <div class="form-grid">
        <label class="field">Nama Pusat / Syarikat
          <input type="text" name="center_name" value="${esc(s.center_name||'Beruntung Brainiac')}" required>
        </label>
        <label class="field">No. Pendaftaran SSM
          <input type="text" name="center_ssm" value="${esc(s.center_ssm||'202503030392 (003694359-M)')}" required>
        </label>
      </div>

      <div class="form-grid">
        <label class="field">No. Rujukan Majikan KWSP (Borang A) <span style="color:var(--red)">*</span>
          <input type="text" name="epf_employer_no" value="${esc(s.epf_employer_no||'')}" placeholder="Contoh: 12345678">
        </label>
        <label class="field">No. Majikan PERKESO
          <input type="text" name="socso_employer_no" value="${esc(s.socso_employer_no||'')}" placeholder="Contoh: A12345678">
        </label>
      </div>

      <div style="background:var(--soft);border:1px solid #cce3dc;padding:12px 14px;border-radius:8px;margin-bottom:12px">
        <strong style="color:var(--teal);display:block;margin-bottom:6px">${icon('building')} Lokasi GPS Rasmi Premis (Geofencing)</strong>
        <p style="margin:0 0 10px;font-size:11px;color:var(--muted)">Koordinat GPS rasmi Beruntung Brainiac (Bukit Beruntung). Staf wajib berada dalam lingkungan 100m dari koordinat ini semasa Clock In.</p>
        
        <div class="form-grid">
          <label class="field" style="margin:0">Latitude
            <input type="number" step="0.00000001" name="latitude" id="set-gps-lat" value="${s.latitude||3.36965100}" required>
          </label>
          <label class="field" style="margin:0">Longitude
            <input type="number" step="0.00000001" name="longitude" id="set-gps-lon" value="${s.longitude||101.57162700}" required>
          </label>
        </div>

        <div style="margin-top:10px">
          <button class="secondary mini-btn" type="button" id="btn-get-current-gps">
            ${icon('refresh')} Ambil Lokasi GPS Terkini (Admin di Pusat)
          </button>
          <span id="admin-gps-detect-status" style="margin-left:8px;font-size:11px;color:var(--teal)"></span>
        </div>
      </div>

      <div class="form-grid">
        <label class="field">Radius Geofence (Meter)
          <input type="number" name="geofence_radius_meters" value="${s.geofence_radius_meters||100}" min="10" max="1000" required>
        </label>
        <label class="field">Tempoh Syif Harian (Jam Flexi)
          <input type="number" name="shift_hours" step="0.5" value="${s.shift_hours||8.5}" min="4" max="14" required>
        </label>
      </div>

      <label class="field">Hari Pembayaran Gaji Bulanan (Tarikh)
        <input type="number" name="pay_day" value="${s.pay_day||27}" min="1" max="31" required>
      </label>

      <p id="hr-settings-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit">${icon('check')} Simpan Tetapan HR</button>
      </div>
    </form>
  `);

  document.querySelector('#btn-get-current-gps')?.addEventListener('click',async()=>{
    const statusEl=document.querySelector('#admin-gps-detect-status');
    if(statusEl)statusEl.textContent='Sedang mengesan koordinat…';
    try{
      const pos=await getGpsCoordinates();
      document.querySelector('#set-gps-lat').value=pos.latitude.toFixed(8);
      document.querySelector('#set-gps-lon').value=pos.longitude.toFixed(8);
      if(statusEl)statusEl.textContent='✓ Lokasi dikesan (Ketepatan: '+Math.round(pos.accuracy)+'m)';
    }catch(err){
      if(statusEl)statusEl.textContent='✕ '+err.message;
    }
  });
}

function handleAdminAttendanceDelete(id){
  const rec=adminAttendanceRecords.find(r=>r.id===id);
  open('Padam Rekod Kehadiran?',`
    <p class="dialog-copy">Adakah anda pasti ingin memadamkan rekod kehadiran <strong>${esc(rec?.user_name||'staf')}</strong> pada <strong>${formatMyDate(rec?.work_date)}</strong>?</p>
    <div class="dialog-actions">
      <button class="secondary" type="button" data-cancel>Batal</button>
      <button class="primary" type="button" id="btn-confirm-att-delete" data-id="${esc(id)}" style="background:var(--red)">Padam Rekod</button>
    </div>
  `);
}

// Global Event Listeners for Attendance
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');
  if(!b)return;

  if(b.id==='quick-clock-btn'||b.id==='dash-clock-btn'){
    await handleClockActionClick();
  }
  if(b.id==='dash-view-att-btn'){
    location.hash='staff-attendance';
  }
  if(b.dataset.preset){
    applyDatePreset(b.dataset.preset);
    await staffAttendanceWorkspace();
  }
  if(b.id==='btn-export-csv'){
    exportAttendanceCsv();
  }
  if(b.id==='btn-export-excel'){
    exportAttendanceExcel();
  }
  if(b.id==='btn-export-pdf'){
    await exportAttendancePdf();
  }
  if(b.id==='btn-manual-attendance'){
    openAdminAttendanceDialog();
  }
  if(b.id==='btn-hr-settings'){
    openHrSettingsDialog();
  }
  if(b.dataset.attEdit){
    openAdminAttendanceDialog(b.dataset.attEdit);
  }
  if(b.dataset.attDelete){
    handleAdminAttendanceDelete(b.dataset.attDelete);
  }
  if(b.id==='btn-confirm-att-delete'){
    b.disabled=true;
    try{
      await api('admin_attendance_delete',{id:b.dataset.id});
      dialog.close();
      notify('Rekod kehadiran dipadamkan.');
      await staffAttendanceWorkspace();
    }catch(err){
      notify('Gagal memadam: '+err.message);
    }finally{
      b.disabled=false;
    }
  }
  if(b.dataset.attendBooking){
    const key=b.dataset.attendBooking,sid=b.dataset.studentId,val=b.dataset.value;
    const before=structuredClone(data);
    const booking=(data.datedBookings||[]).find(x=>x.key===key);
    if(!booking)return;
    if(!booking.attendance||typeof booking.attendance!=='object')booking.attendance={};
    booking.attendance[sid]=val;
    if(typeof StudentPackages!=='undefined'){
      const stName=typeof plannerStudentName==='function'?plannerStudentName(sid):sid;
      StudentPackages.syncStudentSessionAttendance(sid,{
        sourceKey:booking.key,
        programme:booking.mode,
        date:booking.date,
        attendance:val,
        staff:booking.staff||'',
        time:booking.time||'',
        title:(typeof plannerPrograms!=='undefined'?plannerPrograms[booking.mode]:booking.mode)||'',
        studentName:stName
      });
    }
    if(!(await save())){data=before;return;}
    render();
    notify(val==='Hadir'?'Kehadiran ditandakan Hadir dan baki sesi ditolak.':'Kehadiran ditandakan Tidak hadir (baki sesi dikekalkan).');
  }
});

document.addEventListener('change',e=>{
  if(e.target.id==='student-att-date'&&e.target.value){
    studentAttendanceDate=e.target.value;
    if(page==='attendance')studentAttendanceWorkspace();
  }
});

document.addEventListener('submit',async e=>{
  const formId=e.target.getAttribute?.('id')||'';
  if(formId==='clock-in-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#clock-in-error');
    if(errEl)errEl.textContent='';
    try{
      const f=new FormData(e.target);
      const res=await api('clock_in',{
        location:f.get('location')||'Pusat',
        note:f.get('note')||'',
        latitude:f.get('latitude')||'',
        longitude:f.get('longitude')||'',
        is_mobile:Number(f.get('is_mobile'))||0
      });
      dialog.close();
      notify(res.message||'Clock In berjaya direkodkan.');
      await fetchClockStatus();
      if(page==='staff-attendance')await staffAttendanceWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(formId==='clock-out-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#clock-out-error');
    if(errEl)errEl.textContent='';
    try{
      const f=new FormData(e.target);
      const res=await api('clock_out',{
        note:f.get('note')||''
      });
      dialog.close();
      notify(res.message||'Clock Out berjaya direkodkan.');
      await fetchClockStatus();
      if(page==='staff-attendance')await staffAttendanceWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(formId==='hr-settings-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#hr-settings-error');
    if(errEl)errEl.textContent='';
    try{
      const f=new FormData(e.target);
      await api('hr_settings_save',{
        center_name:f.get('center_name'),
        center_ssm:f.get('center_ssm'),
        epf_employer_no:f.get('epf_employer_no'),
        socso_employer_no:f.get('socso_employer_no'),
        latitude:f.get('latitude'),
        longitude:f.get('longitude'),
        geofence_radius_meters:f.get('geofence_radius_meters'),
        shift_hours:f.get('shift_hours'),
        pay_day:f.get('pay_day')
      });
      dialog.close();
      notify('Tetapan HR & Geofencing berjaya dikemas kini.');
      await fetchClockStatus();
      if(page==='staff-attendance')await staffAttendanceWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(formId==='att-filter-form'){
    e.preventDefault();
    const f=new FormData(e.target);
    attendanceFilter.from=f.get('from')||'';
    attendanceFilter.to=f.get('to')||'';
    attendanceFilter.userId=f.get('user_id')||'all';
    attendanceFilter.role=f.get('role')||'all';
    attendanceFilter.preset='custom';
    await staffAttendanceWorkspace();
  }

  if(formId==='admin-attendance-form'){
    await handleAdminAttendanceSave(e);
  }
});

// Initialization
startClockTicker();
