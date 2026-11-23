// Brainiac Hub — Leave Management, Medical Claims & Payroll Modules
// Permanent Staff: Admin & Teachers (Therapists excluded)

let myLeaveData={balance:null,leaves:[]};
let adminLeaveData={leaves:[],balances:[],users:[]};
let leaveActiveTab='my_leaves';

let myClaimData={allowance:null,claims:[]};
let adminClaimData={claims:[],allowances:[],users:[]};
let claimActiveTab='my_claims';

let adminPayrollDataState={users:[],profiles:[],runs:[],payslips:[],approvedClaims:[],settings:null};
let myPayslipsData=[];
let payrollActiveTab='runs';
let selectedPayrollMonth='';

function formatRM(num){
  const n=Number(num)||0;
  return 'RM '+n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
}

function formatMyMonthYear(ym){
  if(!ym)return '';
  const parts=ym.split('-');
  if(parts.length!==2)return ym;
  const mIndex=parseInt(parts[1],10)-1;
  const mName=(typeof myMonths!=='undefined'&&myMonths[mIndex])?myMonths[mIndex]:parts[1];
  return `${mName} ${parts[0]}`;
}

function fileToBase64(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=err=>reject(err);
    reader.onload=()=>{
      const raw=reader.result;
      if(!file.type||!file.type.startsWith('image/')){resolve(raw);return}
      const img=new Image();
      img.onerror=()=>resolve(raw);
      img.onload=()=>{
        try{
          const maxDim=1280;
          let w=img.width,h=img.height;
          if(w>maxDim||h>maxDim){
            if(w>h){h=Math.round(h*(maxDim/w));w=maxDim}
            else{w=Math.round(w*(maxDim/h));h=maxDim}
          }
          const canvas=document.createElement('canvas');
          canvas.width=w;canvas.height=h;
          const ctx=canvas.getContext('2d');
          ctx.fillStyle='#ffffff';
          ctx.fillRect(0,0,w,h);
          ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg',0.78));
        }catch{resolve(raw)}
      };
      img.src=raw;
    };
    reader.readAsDataURL(file);
  });
}

function showImageLightbox(title,src){
  open(title,`
    <div style="text-align:center;padding:10px 0">
      <img src="${esc(src)}" alt="${esc(title)}" style="max-width:100%;max-height:75vh;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.15)">
      <div style="margin-top:14px">
        <a href="${esc(src)}" download="${esc(title.toLowerCase().replace(/[^a-z0-9]/g,'_'))}.jpg" class="primary button" style="display:inline-block;text-decoration:none;padding:8px 18px">
          ${icon('clipboard')} Muat Turun Dokumen
        </a>
      </div>
    </div>
  `);
}

function downloadCsvFile(filename,headers,rows){
  const cell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const csvContent='\uFEFF'+[headers.map(cell).join(','),...rows.map(r=>r.map(cell).join(','))].join('\r\n');
  const blob=new Blob([csvContent],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function downloadExcelFile(filename,sheetName,docTitle,metaItems,headers,rows){
  const metaHtml=metaItems.map(m=>`<td style="padding:6px 12px"><strong>${esc(m[0])}:</strong> ${esc(m[1])}</td>`).join('');
  const thHtml=headers.map(h=>`<th>${esc(h)}</th>`).join('');
  const trHtml=rows.map((r,i)=>{
    const bg=i%2===0?'#ffffff':'#f9fbfc';
    return `<tr style="background:${bg}">${r.map(c=>`<td style="border:1px solid #d5dde0;padding:8px">${esc(c??'')}</td>`).join('')}</tr>`;
  }).join('');
  const htmlDoc=`<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><style>body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1d3339}table{border-collapse:collapse;width:100%}th{background:#00203f;color:#ffffff;border:1px solid #001a33;padding:10px 8px;font-size:11px}</style></head><body><h2 style="color:#00203f;margin-bottom:4px">BERUNTUNG BRAINIAC — ${esc(docTitle)}</h2><p style="margin:2px 0 12px;color:#62757a">Pusat Terapi Perkembangan Kanak-Kanak · No. SSM: 202503030392 (003694359-M)</p><table style="margin-bottom:14px;background:#f0f7f5;border:1px solid #cce3dc"><tr>${metaHtml}</tr></table><table><thead><tr>${thHtml}</tr></thead><tbody>${trHtml}</tbody></table></body></html>`;
  const blob=new Blob([htmlDoc],{type:'application/vnd.ms-excel;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}

async function generateTablePdfReport(filename,titleBM,titleEN,summaryText,cols,rowsData){
  const [fonts,logo]=await Promise.all([loadProgressFonts(),loadBrandLogo()]);
  const PDF=window.jspdf.jsPDF;
  const doc=new PDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
  doc.addFileToVFS('NotoSans-Regular.ttf',fonts.regular);
  doc.addFont('NotoSans-Regular.ttf','NotoSans','normal');
  doc.addFileToVFS('NotoSans-Bold.ttf',fonts.bold);
  doc.addFont('NotoSans-Bold.ttf','NotoSans','bold');
  doc.setFont('NotoSans','normal');

  const pageW=297,pageH=210,margin=15;
  let y=15;

  function renderHeader(){
    if(logo){
      const info=doc.getImageProperties(logo);
      const w=45,h=w*info.height/info.width;
      doc.addImage(logo,'PNG',margin,y,w,h);
    }else{
      doc.setFont('NotoSans','bold');doc.setFontSize(14);doc.setTextColor(0,32,63);
      doc.text('BERUNTUNG BRAINIAC',margin,y+6);
    }
    doc.setFont('NotoSans','bold');doc.setFontSize(14);doc.setTextColor(0,32,63);
    doc.text(titleBM,pageW-margin,y+5,{align:'right'});
    doc.setFont('NotoSans','normal');doc.setFontSize(9);doc.setTextColor(90,105,120);
    doc.text(titleEN,pageW-margin,y+10,{align:'right'});
    doc.setFontSize(8);
    doc.text('Beruntung Brainiac Enterprise · SSM: 202503030392 (003694359-M)',pageW-margin,y+15,{align:'right'});
    doc.setDrawColor(255,210,0);doc.setLineWidth(1);
    doc.line(margin,y+20,pageW-margin,y+20);doc.setLineWidth(.2);
  }

  function drawHeaderRow(){
    doc.setFillColor(0,32,63);
    doc.rect(margin,y,pageW-margin*2,8,'F');
    doc.setFont('NotoSans','bold');doc.setFontSize(8);doc.setTextColor(255,255,255);
    let curX=margin;
    cols.forEach(c=>{
      const tx=c.align==='center'?curX+c.w/2:c.align==='right'?curX+c.w-2:curX+2;
      doc.text(c.title,tx,y+5.5,{align:c.align});
      curX+=c.w;
    });
    y+=8;
  }

  renderHeader();y+=26;
  doc.setFillColor(240,247,245);
  doc.roundedRect(margin,y,pageW-margin*2,11,2,2,'F');
  doc.setFont('NotoSans','normal');doc.setFontSize(8.5);doc.setTextColor(0,32,63);
  doc.text(summaryText,margin+6,y+7);
  doc.text(`Tarikh Cetakan: ${formatMyDate(getTodayMyStr())}`,pageW-margin-6,y+7,{align:'right'});
  y+=16;

  drawHeaderRow();
  doc.setFont('NotoSans','normal');doc.setFontSize(8);
  const rowH=7;

  rowsData.forEach((vals,i)=>{
    if(y+rowH>pageH-22){
      doc.addPage();y=15;renderHeader();y+=26;drawHeaderRow();
      doc.setFont('NotoSans','normal');doc.setFontSize(8);
    }
    if(i%2===1){doc.setFillColor(248,250,251);doc.rect(margin,y,pageW-margin*2,rowH,'F')}
    doc.setDrawColor(230,235,238);doc.line(margin,y+rowH,pageW-margin,y+rowH);
    doc.setTextColor(29,51,57);
    let curX=margin;
    cols.forEach((c,idx)=>{
      const val=String(vals[idx]??'');
      const tx=c.align==='center'?curX+c.w/2:c.align==='right'?curX+c.w-2:curX+2;
      doc.text(doc.splitTextToSize(val,c.w-3)[0]||'',tx,y+4.8,{align:c.align});
      curX+=c.w;
    });
    y+=rowH;
  });

  const totalPages=doc.getNumberOfPages();
  for(let p=1;p<=totalPages;p++){
    doc.setPage(p);doc.setFont('NotoSans','normal');doc.setFontSize(7);doc.setTextColor(120,135,145);
    doc.text('Beruntung Brainiac Enterprise · SSM 202503030392 · DOKUMEN SULIT',margin,pageH-8);
    doc.text(`Muka surat ${p} / ${totalPages}`,pageW-margin,pageH-8,{align:'right'});
  }
  doc.save(filename);
}

// ==========================================
// 1. LEAVE MANAGEMENT WORKSPACE
// ==========================================
async function leavesWorkspace(){
  if(currentUser?.role==='therapist'){
    notify('Pengurusan Cuti hanya untuk staf tetap (Guru & Admin).');
    location.hash='dashboard';
    return;
  }

  content.innerHTML=`<div class="auth-loading" role="status">Memuatkan maklumat cuti…</div>`;
  const isAdm=currentUser?.role==='admin';

  try{
    const r=await api('my_leaves');
    myLeaveData=r;
    if(isAdm){
      const admR=await api('admin_leaves');
      adminLeaveData=admR;
    }
  }catch(err){
    notify('Ralat memuatkan cuti: '+err.message);
  }

  const subNav=`
    <div class="hr-subtabs">
      <button class="hr-tab-btn ${leaveActiveTab==='my_leaves'?'active':''}" id="leave-tab-my" type="button">
        ${icon('calendar')} Cuti Saya
      </button>
      ${isAdm?`
        <button class="hr-tab-btn ${leaveActiveTab==='admin_leaves'?'active':''}" id="leave-tab-admin" type="button">
          ${icon('clipboard')} Kelulusan & Laporan Cuti/MC (${adminLeaveData.leaves.filter(l=>l.status==='Pending').length})
        </button>
        <button class="hr-tab-btn ${leaveActiveTab==='admin_quota'?'active':''}" id="leave-tab-quota" type="button">
          ${icon('users')} Kuota & Baki Cuti Staf
        </button>
      `:''}
    </div>
  `;

  if(leaveActiveTab==='admin_leaves' && isAdm){
    content.innerHTML=subNav+renderAdminLeavesSection();
  }else if(leaveActiveTab==='admin_quota' && isAdm){
    content.innerHTML=subNav+renderAdminQuotaSection();
  }else{
    content.innerHTML=subNav+renderMyLeavesSection();
  }
}

function renderMyLeavesSection(){
  const b=myLeaveData.balance||{
    annual_total:12,annual_used:0,annual_carry_forward:0,
    medical_total:14,medical_used:0,
    hospitalisation_total:60,hospitalisation_used:0,
    maternity_total:98,maternity_used:0
  };

  const annTotal=Number(b.annual_total)+Number(b.annual_carry_forward);
  const annRem=Math.max(0,annTotal-Number(b.annual_used));
  const medRem=Math.max(0,Number(b.medical_total)-Number(b.medical_used));
  const hospRem=Math.max(0,Number(b.hospitalisation_total)-Number(b.hospitalisation_used));
  const matRem=Math.max(0,Number(b.maternity_total)-Number(b.maternity_used));

  const rows=myLeaveData.leaves.map((l,i)=>{
    const stBadge=l.status==='Approved'?'<span class="status-chip approved">✓ Diluluskan</span>':l.status==='Rejected'?'<span class="status-chip rejected">✕ Ditolak</span>':'<span class="status-chip pending">Menunggu Semakan</span>';
    const typeLabel={annual:'Cuti Tahunan',medical:'Cuti Sakit (MC)',hospitalisation:'Hospitalisasi',maternity:'Cuti Bersalin'}[l.leave_type]||l.leave_type;
    const attachBtn=l.attachment_url?`<button class="secondary mini-btn" type="button" data-view-mc="${esc(l.id)}">${icon('clipboard')} Lihat MC</button>`:'-';
    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${formatMyDate(l.created_at)}</b></td>
        <td><b>${typeLabel}</b></td>
        <td>${formatMyDate(l.start_date)} – ${formatMyDate(l.end_date)}</td>
        <td><b>${l.days_count} hari</b></td>
        <td>${esc(l.reason)}</td>
        <td>${attachBtn}</td>
        <td>${stBadge}</td>
        <td><small>${esc(l.admin_notes||'-')}</small></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="hr-hero-stats">
      <div class="hr-stat-card">
        <div class="hr-stat-label">Cuti Tahunan ${icon('calendar')}</div>
        <div class="hr-stat-num">${annRem} <small style="font-size:14px;color:var(--muted)">/ ${annTotal} hari</small></div>
        <div class="hr-stat-sub">${b.annual_carry_forward>0?`Termasuk ${b.annual_carry_forward} hari bawa ke hadapan`:'Kelayakan tahunan staf tetap'}</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Cuti Sakit (MC) ${icon('heart')}</div>
        <div class="hr-stat-num">${medRem} <small style="font-size:14px;color:var(--muted)">/ ${b.medical_total} hari</small></div>
        <div class="hr-stat-sub">Wajib lampirkan sijil MC klinik</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Hospitalisasi ${icon('building')}</div>
        <div class="hr-stat-num">${hospRem} <small style="font-size:14px;color:var(--muted)">/ ${b.hospitalisation_total} hari</small></div>
        <div class="hr-stat-sub">Kemasukan wad hospital</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Cuti Bersalin ${icon('users')}</div>
        <div class="hr-stat-num">${matRem} <small style="font-size:14px;color:var(--muted)">/ ${b.maternity_total} hari</small></div>
        <div class="hr-stat-sub">Kelayakan bersalin</div>
      </div>
    </div>

    <div class="att-actions-bar" style="margin-bottom:16px">
      <div></div>
      <button class="primary" id="btn-apply-leave" type="button">${icon('plus')} Mohon Cuti Baharu</button>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Sejarah Permohonan Cuti Saya</h2>
          <p>Rekod permohonan cuti dan status kelulusan pihak pentadbir.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tarikh Mohon</th>
              <th>Jenis Cuti</th>
              <th>Tempoh Cuti</th>
              <th>Bil. Hari</th>
              <th>Sebab Cuti</th>
              <th>Sijil MC</th>
              <th>Status</th>
              <th>Catatan Admin</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="9" class="empty">Belum ada permohonan cuti. Klik butang "Mohon Cuti Baharu" untuk memohon.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminLeavesSection(){
  const pendingCount=adminLeaveData.leaves.filter(l=>l.status==='Pending').length;
  const rows=adminLeaveData.leaves.map((l,i)=>{
    const stBadge=l.status==='Approved'?'<span class="status-chip approved">✓ Diluluskan</span>':l.status==='Rejected'?'<span class="status-chip rejected">✕ Ditolak</span>':'<span class="status-chip pending">Menunggu Semakan</span>';
    const typeLabel={annual:'Cuti Tahunan',medical:'Cuti Sakit (MC)',hospitalisation:'Hospitalisasi',maternity:'Cuti Bersalin'}[l.leave_type]||l.leave_type;
    const attachBtn=l.attachment_url?`<button class="secondary mini-btn" type="button" data-view-mc="${esc(l.id)}">${icon('clipboard')} Lihat MC</button>`:'-';
    
    let actions='-';
    if(l.status==='Pending'){
      actions=`
        <div style="display:flex;gap:6px">
          <button class="primary mini-btn" type="button" style="background:#0d6955" data-leave-action="Approved" data-leave-id="${esc(l.id)}">Luluskan</button>
          <button class="secondary mini-btn" type="button" style="color:var(--red);border-color:#f5c2c2" data-leave-action="Rejected" data-leave-id="${esc(l.id)}">Tolak</button>
        </div>
      `;
    }

    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${esc(l.user_name)}</b></td>
        <td><b>${typeLabel}</b></td>
        <td>${formatMyDate(l.start_date)} – ${formatMyDate(l.end_date)}</td>
        <td><b>${l.days_count} hari</b></td>
        <td>${esc(l.reason)}</td>
        <td>${attachBtn}</td>
        <td>${stBadge}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="att-actions-bar" style="margin-bottom:16px">
      <div class="att-export-group">
        <button class="export-btn csv" id="btn-export-leaves-csv" type="button">${icon('clipboard')} Eksport CSV Cuti & MC</button>
        <button class="export-btn excel" id="btn-export-leaves-excel" type="button">${icon('chart')} Eksport Excel Cuti & MC</button>
        <button class="export-btn pdf" id="btn-export-leaves-pdf" type="button">${icon('book')} Jana Laporan PDF Cuti & MC</button>
      </div>
      <div><span class="mini-tag">${pendingCount} menunggu kelulusan</span></div>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Senarai Permohonan Cuti & MC Staf (${adminLeaveData.leaves.length} rekod)</h2>
          <p>Semak, luluskan permohonan cuti dan muat turun laporan cuti/MC kakitangan Beruntung Brainiac.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Staf</th>
              <th>Jenis Cuti</th>
              <th>Tempoh Cuti</th>
              <th>Bil. Hari</th>
              <th>Sebab Permohonan</th>
              <th>Sijil MC</th>
              <th>Status</th>
              <th>Tindakan Pentadbir</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="9" class="empty">Tiada rekod permohonan cuti staf.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function exportLeavesReport(format){
  const list=adminLeaveData.leaves||[];
  if(!list.length){notify('Tiada rekod cuti untuk dieksport.');return}
  const typeMap={annual:'Cuti Tahunan',medical:'Cuti Sakit (MC)',hospitalisation:'Hospitalisasi',maternity:'Cuti Bersalin'};
  const headers=['Bil','Tarikh Mohon','Nama Staf','Jenis Cuti','Tarikh Mula','Tarikh Akhir','Bil. Hari','Sebab','Lampiran MC','Status','Catatan Admin'];
  const rows=list.map((l,i)=>[
    i+1,
    formatMyDate(l.created_at),
    l.user_name,
    typeMap[l.leave_type]||l.leave_type,
    formatMyDate(l.start_date),
    formatMyDate(l.end_date),
    `${l.days_count} hari`,
    l.reason||'-',
    l.attachment_url?'Ada Sijil MC':'Tiada',
    l.status==='Approved'?'Diluluskan':l.status==='Rejected'?'Ditolak':'Menunggu',
    l.admin_notes||'-'
  ]);
  const dt=getTodayMyStr();
  if(format==='csv'){
    downloadCsvFile(`laporan-cuti-mc-brainiac-${dt}.csv`,headers,rows);
    notify('Fail CSV Cuti & MC berjaya dimuat turun.');
  }else if(format==='excel'){
    downloadExcelFile(`laporan-cuti-mc-brainiac-${dt}.xls`,'Cuti & MC','LAPORAN CUTI & SIJIL SAKIT (MC) STAF',[['Jumlah Permohonan',list.length],['Diluluskan',list.filter(x=>x.status==='Approved').length],['Tarikh Dijana',formatMyDate(dt)]],headers,rows);
    notify('Fail Excel Cuti & MC berjaya dimuat turun.');
  }else if(format==='pdf'){
    const cols=[
      {title:'Bil',w:10,align:'center'},
      {title:'Tarikh',w:24,align:'left'},
      {title:'Nama Staf',w:48,align:'left'},
      {title:'Jenis Cuti',w:34,align:'left'},
      {title:'Tempoh Cuti',w:46,align:'center'},
      {title:'Hari',w:18,align:'center'},
      {title:'Sebab Permohonan',w:47,align:'left'},
      {title:'Sijil MC',w:20,align:'center'},
      {title:'Status',w:20,align:'center'}
    ];
    const pdfRows=list.map((l,i)=>[
      i+1,
      formatMyDate(l.created_at),
      l.user_name,
      typeMap[l.leave_type]||l.leave_type,
      `${formatMyDate(l.start_date)} - ${formatMyDate(l.end_date)}`,
      `${l.days_count}`,
      l.reason||'-',
      l.attachment_url?'Ada':'-',
      l.status==='Approved'?'Lulus':l.status==='Rejected'?'Ditolak':'Menunggu'
    ]);
    generateTablePdfReport(`laporan-cuti-mc-brainiac-${dt}.pdf`,'LAPORAN CUTI & SIJIL SAKIT (MC) KAKITANGAN','STAFF LEAVE & MEDICAL CERTIFICATE REPORT',`Jumlah Rekod: ${list.length} permohonan · Diluluskan: ${list.filter(x=>x.status==='Approved').length}`,cols,pdfRows).then(()=>notify('Laporan PDF Cuti & MC berjaya dijana.')).catch(e=>notify('Gagal menjana PDF: '+e.message));
  }
}

function renderAdminQuotaSection(){
  const rows=adminLeaveData.balances.map((b,i)=>{
    const annTotal=Number(b.annual_total)+Number(b.annual_carry_forward);
    const annRem=Math.max(0,annTotal-Number(b.annual_used));
    const medRem=Math.max(0,Number(b.medical_total)-Number(b.medical_used));
    return `
      <tr>
        <td>${i+1}</td>
        <td><div class="person"><span class="avatar">${esc(b.user_name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><div><b>${esc(b.user_name)}</b><small>${esc(demoRoles[b.user_role]||b.user_role)}</small></div></div></td>
        <td><b>${annRem}</b> / ${annTotal} hari <small style="display:block;color:var(--muted)">Guna: ${b.annual_used} | Carry: ${b.annual_carry_forward}</small></td>
        <td><b>${medRem}</b> / ${b.medical_total} hari <small style="display:block;color:var(--muted)">Guna: ${b.medical_used}</small></td>
        <td><b>${Math.max(0,Number(b.hospitalisation_total)-Number(b.hospitalisation_used))}</b> / ${b.hospitalisation_total} hari</td>
        <td><b>${Math.max(0,Number(b.maternity_total)-Number(b.maternity_used))}</b> / ${b.maternity_total} hari</td>
        <td>
          <button class="secondary mini-btn" type="button" data-edit-quota="${esc(b.user_id)}">${icon('clipboard')} Ubah Kuota</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="att-actions-bar" style="margin-bottom:16px">
      <div><p style="margin:0;font-size:13px;color:var(--muted)">Tahun Semasa: <strong>${new Date().getFullYear()}</strong>. Baki cuti tahunan yang tidak digunakan dibawa ke tahun hadapan secara automatik (sehingga had maksimum carry forward).</p></div>
      <button class="primary" id="btn-add-staff-quota" type="button">${icon('plus')} Laras Kuota Staf</button>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Ringkasan Kuota & Baki Cuti Staf</h2>
          <p>Kawal had cuti tahunan, cuti sakit, hospitalisasi, dan kelayakan bawa ke hadapan (carry forward).</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Staf</th>
              <th>Baki Cuti Tahunan</th>
              <th>Baki Cuti Sakit (MC)</th>
              <th>Baki Hospitalisasi</th>
              <th>Baki Cuti Bersalin</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="7" class="empty">Tiada rekod kuota cuti staf.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function openApplyLeaveDialog(){
  const today=getTodayMyStr();
  open('Borang Permohonan Cuti',`
    <form id="apply-leave-form">
      <label class="field">Jenis Cuti
        <select name="leave_type" id="apply-leave-type" required>
          <option value="annual">Cuti Tahunan (Annual Leave)</option>
          <option value="medical">Cuti Sakit / MC (Medical Leave - Wajib Foto MC)</option>
          <option value="hospitalisation">Cuti Hospitalisasi (Hospitalisation Leave)</option>
          <option value="maternity">Cuti Bersalin (Maternity Leave)</option>
        </select>
      </label>
      <div class="form-grid">
        <label class="field">Tarikh Mula Cuti
          <input type="date" name="start_date" id="apply-leave-start" required value="${today}">
        </label>
        <label class="field">Tarikh Akhir Cuti
          <input type="date" name="end_date" id="apply-leave-end" required value="${today}">
        </label>
      </div>
      <label class="field">Bilangan Hari Cuti
        <input type="number" name="days_count" id="apply-leave-days" step="0.5" min="0.5" max="98" value="1" required>
      </label>
      <label class="field">Sebab Permohonan Cuti <span style="color:var(--red)">*</span>
        <textarea name="reason" rows="2" maxlength="300" required placeholder="Nyatakan sebab bercuti atau urusan..."></textarea>
      </label>

      <!-- MC Photo Upload Box (visible when medical leave) -->
      <div id="mc-upload-container" style="display:none;margin-top:10px;padding:14px;border:1px dashed var(--teal);border-radius:8px;background:var(--soft)">
        <label class="field" style="margin:0">
          <strong style="color:var(--teal)">${icon('heart')} Muat Naik Foto Sijil Cuti Sakit (MC) <span style="color:var(--red)">*</span></strong>
          <p style="font-size:11px;color:var(--muted);margin:4px 0 8px">Ambil gambar sijil MC menggunakan kamera telefon atau pilih foto dari galeri peranti anda.</p>
          <input type="file" id="mc-file-input" accept="image/*" capture="environment">
        </label>
        <div id="mc-preview-box" class="attachment-preview-box" style="display:none">
          <img id="mc-preview-img" class="attachment-thumb" src="" alt="Pratonton MC">
          <div class="attachment-info">
            <b id="mc-file-name">mc_dokumen.jpg</b>
            <span style="display:block;color:var(--teal);margin-top:2px">✓ Foto MC dimampatkan & sedia dimuat naik</span>
          </div>
        </div>
      </div>

      <p id="apply-leave-error" role="alert" style="color:var(--red);font-size:12px;margin:10px 0 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit">${icon('check')} Hantar Permohonan</button>
      </div>
    </form>
  `);

  const typeSel=document.querySelector('#apply-leave-type');
  const mcBox=document.querySelector('#mc-upload-container');
  const startIn=document.querySelector('#apply-leave-start');
  const endIn=document.querySelector('#apply-leave-end');
  const daysIn=document.querySelector('#apply-leave-days');

  typeSel.addEventListener('change',()=>{
    mcBox.style.display=typeSel.value==='medical'?'block':'none';
  });

  function autoCalcDays(){
    if(startIn.value && endIn.value){
      const d1=new Date(startIn.value);
      const d2=new Date(endIn.value);
      if(d2>=d1){
        const diff=Math.round((d2-d1)/(1000*60*60*24))+1;
        daysIn.value=diff;
      }
    }
  }
  startIn.addEventListener('change',()=>{
    if(!endIn.value||endIn.value<startIn.value)endIn.value=startIn.value;
    autoCalcDays();
  });
  endIn.addEventListener('change',autoCalcDays);

  const fileIn=document.querySelector('#mc-file-input');
  fileIn.addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    const base64=await fileToBase64(file);
    document.querySelector('#mc-preview-img').src=base64;
    document.querySelector('#mc-file-name').textContent=file.name;
    document.querySelector('#mc-preview-box').style.display='flex';
  });
}

function openEditQuotaDialog(userId=''){
  const users=adminLeaveData.users;
  const selectedId=userId||users[0]?.id||'';
  const existing=adminLeaveData.balances.find(b=>b.user_id===selectedId);
  const targetUser=users.find(u=>u.id===selectedId);
  const curYear=new Date().getFullYear();

  const b=existing||{
    annual_total:12,annual_carry_forward:0,carry_forward_max:5,
    medical_total:14,hospitalisation_total:60,maternity_total:98
  };

  open(userId?`Ubah Kuota Cuti — ${esc(targetUser?.name||'')}`:'Laras Kuota Cuti Staf',`
    <form id="admin-quota-form">
      <label class="field">Pilih Staf
        <select name="user_id" id="quota-user-select" required>
          ${users.map(u=>`<option value="${esc(u.id)}" ${u.id===selectedId?'selected':''}>${esc(u.name)} (${esc(demoRoles[u.role]||u.role)})</option>`).join('')}
        </select>
      </label>
      <label class="field">Tahun
        <input type="number" name="year" value="${curYear}" required>
      </label>
      <div class="form-grid">
        <label class="field">Had Cuti Tahunan (Hari)
          <input type="number" name="annual_total" id="q-ann" step="0.5" value="${b.annual_total}" required>
        </label>
        <label class="field">Bawa Ke Hadapan (Carry Forward)
          <input type="number" name="annual_carry_forward" id="q-carry" step="0.5" value="${b.annual_carry_forward}">
        </label>
      </div>
      <div class="form-grid">
        <label class="field">Had Maksimum Bawa Ke Hadapan
          <input type="number" name="carry_forward_max" id="q-max" step="0.5" value="${b.carry_forward_max||5}">
        </label>
        <label class="field">Had Cuti Sakit / MC (Hari)
          <input type="number" name="medical_total" id="q-med" step="0.5" value="${b.medical_total}" required>
        </label>
      </div>
      <div class="form-grid">
        <label class="field">Had Hospitalisasi (Hari)
          <input type="number" name="hospitalisation_total" id="q-hosp" step="0.5" value="${b.hospitalisation_total}" required>
        </label>
        <label class="field">Had Cuti Bersalin (Hari)
          <input type="number" name="maternity_total" id="q-mat" step="0.5" value="${b.maternity_total}" required>
        </label>
      </div>
      <p id="admin-quota-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit">${icon('check')} Simpan Kuota</button>
      </div>
    </form>
  `);

  document.querySelector('#quota-user-select')?.addEventListener('change',e=>{
    const bal=adminLeaveData.balances.find(x=>x.user_id===e.target.value);
    if(bal){
      document.querySelector('#q-ann').value=bal.annual_total;
      document.querySelector('#q-carry').value=bal.annual_carry_forward;
      document.querySelector('#q-max').value=bal.carry_forward_max||5;
      document.querySelector('#q-med').value=bal.medical_total;
      document.querySelector('#q-hosp').value=bal.hospitalisation_total;
      document.querySelector('#q-mat').value=bal.maternity_total;
    }
  });
}

function openReviewActionDialog(kind,recordId,actionType){
  const isLeave=kind==='leave';
  const rec=isLeave?adminLeaveData.leaves.find(l=>l.id===recordId):adminClaimData.claims.find(c=>c.id===recordId);
  const approve=actionType==='Approved';
  const title=`${approve?'Luluskan':'Tolak'} ${isLeave?'Permohonan Cuti':'Tuntutan Perubatan'}`;
  const summary=isLeave
    ? `<strong>${esc(rec?.user_name||'Staf')}</strong> · ${formatMyDate(rec?.start_date)} – ${formatMyDate(rec?.end_date)} (${rec?.days_count||1} hari)`
    : `<strong>${esc(rec?.user_name||'Staf')}</strong> · ${esc(rec?.clinic_name||'')} (${formatRM(rec?.amount)})`;

  open(title,`
    <form id="admin-review-action-form" data-kind="${esc(kind)}" data-id="${esc(recordId)}" data-action="${esc(actionType)}">
      <p class="dialog-copy">${summary}</p>
      <label class="field">Catatan Pentadbir ${approve?'(pilihan)':'<span style="color:var(--red)">*</span>'}
        <textarea name="admin_notes" rows="2" maxlength="300" ${approve?'':'required'} placeholder="${approve?'Catatan kelulusan (pilihan)...':'Nyatakan sebab penolakan...'}"></textarea>
      </label>
      <p id="review-action-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit" style="background:${approve?'#0d6955':'var(--red)'}">${icon('check')} Sahkan ${approve?'Kelulusan':'Penolakan'}</button>
      </div>
    </form>
  `);
}

// ==========================================
// 2. MEDICAL CLAIMS WORKSPACE
// ==========================================
async function claimsWorkspace(){
  if(currentUser?.role==='therapist'){
    notify('Tuntutan Perubatan hanya untuk staf tetap (Guru & Admin).');
    location.hash='dashboard';
    return;
  }

  content.innerHTML=`<div class="auth-loading" role="status">Memuatkan maklumat tuntutan perubatan…</div>`;
  const isAdm=currentUser?.role==='admin';

  try{
    const r=await api('my_claims');
    myClaimData=r;
    if(isAdm){
      const admR=await api('admin_claims');
      adminClaimData=admR;
    }
  }catch(err){
    notify('Ralat memuatkan tuntutan perubatan: '+err.message);
  }

  const subNav=`
    <div class="hr-subtabs">
      <button class="hr-tab-btn ${claimActiveTab==='my_claims'?'active':''}" id="claim-tab-my" type="button">
        ${icon('heart')} Tuntutan Saya
      </button>
      ${isAdm?`
        <button class="hr-tab-btn ${claimActiveTab==='admin_claims'?'active':''}" id="claim-tab-admin" type="button">
          ${icon('clipboard')} Kelulusan & Laporan Tuntutan (${adminClaimData.claims.filter(c=>c.status==='Pending').length})
        </button>
        <button class="hr-tab-btn ${claimActiveTab==='admin_allowances'?'active':''}" id="claim-tab-allowances" type="button">
          ${icon('users')} Had Elaun Perubatan Staf
        </button>
      `:''}
    </div>
  `;

  if(claimActiveTab==='admin_claims' && isAdm){
    content.innerHTML=subNav+renderAdminClaimsSection();
  }else if(claimActiveTab==='admin_allowances' && isAdm){
    content.innerHTML=subNav+renderAdminAllowancesSection();
  }else{
    content.innerHTML=subNav+renderMyClaimsSection();
  }
}

function renderMyClaimsSection(){
  const al=myClaimData.allowance||{annual_limit:500.00,amount_used:0.00,balance:500.00};
  const curLimit=Number(al.annual_limit);
  const curUsed=Number(al.amount_used);
  const curBal=Number(al.balance);

  const rows=myClaimData.claims.map((c,i)=>{
    const stBadge=c.status==='Approved'?(Number(c.paid_via_payroll)?'<span class="status-chip approved">✓ Telah Masuk Slip Gaji</span>':'<span class="status-chip approved">✓ Diluluskan (Menunggu Slip)</span>'):c.status==='Rejected'?'<span class="status-chip rejected">✕ Ditolak</span>':'<span class="status-chip pending">Menunggu Kelulusan</span>';
    const viewReceipt=c.receipt_url?`<button class="secondary mini-btn" type="button" data-view-receipt="${esc(c.id)}">${icon('clipboard')} Lihat Resit</button>`:'-';
    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${formatMyDate(c.treatment_date)}</b></td>
        <td><b>${esc(c.clinic_name)}</b></td>
        <td><b style="color:var(--teal)">${formatRM(c.amount)}</b></td>
        <td>${esc(c.notes||'-')}</td>
        <td>${viewReceipt}</td>
        <td>${stBadge}</td>
        <td><small>${esc(c.admin_notes||'-')}</small></td>
      </tr>
    `;
  }).join('');

  return `
    <div class="hr-hero-stats" style="grid-template-columns:repeat(3,1fr)">
      <div class="hr-stat-card">
        <div class="hr-stat-label">Had Siling Elaun Perubatan Tahunan ${icon('shield')}</div>
        <div class="hr-stat-num">${formatRM(curLimit)}</div>
        <div class="hr-stat-sub">Reset automatik pada 1hb Januari setiap tahun</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Jumlah Telah Dituntut / Digunakan ${icon('clipboard')}</div>
        <div class="hr-stat-num" style="color:#94631a">${formatRM(curUsed)}</div>
        <div class="hr-stat-sub">Tuntutan yang telah diluluskan oleh Admin</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Baki Semasa Boleh Dituntut ${icon('heart')}</div>
        <div class="hr-stat-num" style="color:var(--teal)">${formatRM(curBal)}</div>
        <div class="hr-stat-sub">Dipindahkan ke slip gaji bulanan (27hb)</div>
      </div>
    </div>

    <div class="att-actions-bar" style="margin-bottom:16px">
      <div><p style="margin:0;font-size:12px;color:var(--muted)">Nota: Tuntutan yang diluluskan akan dimasukkan ke dalam Slip Gaji bulanan anda pada 27hb sebagai bayaran balik (reimbursement).</p></div>
      <button class="primary" id="btn-apply-claim" type="button">${icon('plus')} Hantar Tuntutan Rawatan</button>
    </div>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Rekod Tuntutan Perubatan Saya</h2>
          <p>Senarai tuntutan bil rawatan klinik yang telah dihantar.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tarikh Rawatan</th>
              <th>Klinik / Hospital</th>
              <th>Jumlah Dituntut</th>
              <th>Catatan Rawatan</th>
              <th>Resit Bayaran</th>
              <th>Status</th>
              <th>Catatan Admin</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="8" class="empty">Belum ada sebarang tuntutan perubatan difailkan.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminClaimsSection(){
  const pendingCount=adminClaimData.claims.filter(c=>c.status==='Pending').length;
  const rows=adminClaimData.claims.map((c,i)=>{
    const stBadge=c.status==='Approved'?(Number(c.paid_via_payroll)?'<span class="status-chip approved">✓ Telah Masuk Slip Gaji</span>':'<span class="status-chip approved">✓ Diluluskan (Menunggu Slip)</span>'):c.status==='Rejected'?'<span class="status-chip rejected">✕ Ditolak</span>':'<span class="status-chip pending">Menunggu Kelulusan</span>';
    const viewReceipt=c.receipt_url?`<button class="secondary mini-btn" type="button" data-view-receipt="${esc(c.id)}">${icon('clipboard')} Lihat Resit</button>`:'-';
    
    let actions='-';
    if(c.status==='Pending'){
      actions=`
        <div style="display:flex;gap:6px">
          <button class="primary mini-btn" type="button" style="background:#0d6955" data-claim-action="Approved" data-claim-id="${esc(c.id)}">Luluskan</button>
          <button class="secondary mini-btn" type="button" style="color:var(--red);border-color:#f5c2c2" data-claim-action="Rejected" data-claim-id="${esc(c.id)}">Tolak</button>
        </div>
      `;
    }

    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${esc(c.user_name)}</b></td>
        <td>${formatMyDate(c.treatment_date)}</td>
        <td><b>${esc(c.clinic_name)}</b></td>
        <td><b style="color:var(--teal)">${formatRM(c.amount)}</b></td>
        <td>${esc(c.notes||'-')}</td>
        <td>${viewReceipt}</td>
        <td>${stBadge}</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');

  return `
    <div class="att-actions-bar" style="margin-bottom:16px">
      <div class="att-export-group">
        <button class="export-btn csv" id="btn-export-claims-csv" type="button">${icon('clipboard')} Eksport CSV Tuntutan</button>
        <button class="export-btn excel" id="btn-export-claims-excel" type="button">${icon('chart')} Eksport Excel Tuntutan</button>
        <button class="export-btn pdf" id="btn-export-claims-pdf" type="button">${icon('book')} Jana Laporan PDF Tuntutan</button>
      </div>
      <div><span class="mini-tag">${pendingCount} menunggu kelulusan</span></div>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Senarai Tuntutan Perubatan Staf (${adminClaimData.claims.length} rekod)</h2>
          <p>Semak resit klinik, sahkan kelulusan elaun perubatan dan eksport laporan tuntutan staf.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Staf</th>
              <th>Tarikh Rawatan</th>
              <th>Klinik / Hospital</th>
              <th>Jumlah</th>
              <th>Catatan Rawatan</th>
              <th>Resit</th>
              <th>Status</th>
              <th>Tindakan Pentadbir</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="9" class="empty">Tiada rekod tuntutan perubatan staf.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function exportClaimsReport(format){
  const list=adminClaimData.claims||[];
  if(!list.length){notify('Tiada rekod tuntutan perubatan untuk dieksport.');return}
  const totApproved=list.filter(c=>c.status==='Approved').reduce((s,c)=>s+Number(c.amount||0),0);
  const headers=['Bil','Tarikh Rawatan','Nama Staf','Klinik / Hospital','Jumlah (RM)','Catatan','Status Kelulusan','Status Bayaran Slip','Catatan Admin'];
  const rows=list.map((c,i)=>[
    i+1,
    formatMyDate(c.treatment_date),
    c.user_name,
    c.clinic_name,
    Number(c.amount||0).toFixed(2),
    c.notes||'-',
    c.status==='Approved'?'Diluluskan':c.status==='Rejected'?'Ditolak':'Menunggu',
    Number(c.paid_via_payroll)?`Slip Gaji (${c.payroll_month||''})`:'Belum Dibayar',
    c.admin_notes||'-'
  ]);
  const dt=getTodayMyStr();
  if(format==='csv'){
    downloadCsvFile(`laporan-tuntutan-perubatan-brainiac-${dt}.csv`,headers,rows);
    notify('Fail CSV Tuntutan Perubatan berjaya dimuat turun.');
  }else if(format==='excel'){
    downloadExcelFile(`laporan-tuntutan-perubatan-brainiac-${dt}.xls`,'Tuntutan Perubatan','LAPORAN TUNTUTAN PERUBATAN STAF',[['Jumlah Rekod',list.length],['Jumlah Diluluskan',formatRM(totApproved)],['Tarikh Dijana',formatMyDate(dt)]],headers,rows);
    notify('Fail Excel Tuntutan Perubatan berjaya dimuat turun.');
  }else if(format==='pdf'){
    const cols=[
      {title:'Bil',w:12,align:'center'},
      {title:'Tarikh Rawatan',w:28,align:'left'},
      {title:'Nama Staf',w:52,align:'left'},
      {title:'Klinik / Hospital',w:54,align:'left'},
      {title:'Amaun (RM)',w:26,align:'right'},
      {title:'Catatan Rawatan',w:50,align:'left'},
      {title:'Status',w:22,align:'center'},
      {title:'Slip Gaji',w:23,align:'center'}
    ];
    const pdfRows=list.map((c,i)=>[
      i+1,
      formatMyDate(c.treatment_date),
      c.user_name,
      c.clinic_name,
      formatRM(c.amount),
      c.notes||'-',
      c.status==='Approved'?'Lulus':c.status==='Rejected'?'Ditolak':'Menunggu',
      Number(c.paid_via_payroll)?(c.payroll_month||'Dibayar'):'-'
    ]);
    generateTablePdfReport(`laporan-tuntutan-perubatan-brainiac-${dt}.pdf`,'LAPORAN TUNTUTAN PERUBATAN KAKITANGAN','STAFF MEDICAL CLAIMS REPORT',`Jumlah Tuntutan: ${list.length} rekod · Jumlah Diluluskan: ${formatRM(totApproved)}`,cols,pdfRows).then(()=>notify('Laporan PDF Tuntutan Perubatan berjaya dijana.')).catch(e=>notify('Gagal menjana PDF: '+e.message));
  }
}

function renderAdminAllowancesSection(){
  const rows=adminClaimData.allowances.map((a,i)=>{
    return `
      <tr>
        <td>${i+1}</td>
        <td><div class="person"><span class="avatar">${esc(a.user_name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><div><b>${esc(a.user_name)}</b><small>${esc(demoRoles[a.user_role]||a.user_role)}</small></div></div></td>
        <td><b>${formatRM(a.annual_limit)}</b></td>
        <td style="color:#94631a"><b>${formatRM(a.amount_used)}</b></td>
        <td style="color:var(--teal)"><b>${formatRM(a.balance)}</b></td>
        <td>
          <button class="secondary mini-btn" type="button" data-edit-claim-limit="${esc(a.user_id)}">${icon('clipboard')} Ubah Had</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="att-actions-bar" style="margin-bottom:16px">
      <div><p style="margin:0;font-size:13px;color:var(--muted)">Had siling elaun perubatan tahunan default adalah RM500.00 dan direset pada 1hb Januari setiap tahun.</p></div>
      <button class="primary" id="btn-add-claim-limit" type="button">${icon('plus')} Tetapkan Had Staf</button>
    </div>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Had Siling & Baki Elaun Perubatan Staf</h2>
          <p>Kawal had siling maksimum perubatan yang boleh dituntut oleh setiap staf.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Staf</th>
              <th>Had Siling Tahunan</th>
              <th>Jumlah Telah Dituntut</th>
              <th>Baki Semasa</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="6" class="empty">Tiada rekod elaun perubatan.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function openApplyClaimDialog(){
  const today=getTodayMyStr();
  const bal=myClaimData.allowance?.balance||500.00;

  open('Borang Tuntutan Perubatan (Klinik)',`
    <form id="apply-claim-form">
      <div style="background:var(--soft);padding:10px 14px;border-radius:8px;margin-bottom:14px;border:1px solid #cce3dc">
        <span style="font-size:12px;color:var(--muted)">Baki Elaun Perubatan Semasa Anda:</span>
        <strong style="display:block;font-size:18px;color:var(--teal)">${formatRM(bal)}</strong>
      </div>
      <label class="field">Tarikh Rawatan <span style="color:var(--red)">*</span>
        <input type="date" name="treatment_date" max="${today}" value="${today}" required>
      </label>
      <label class="field">Nama Klinik / Hospital <span style="color:var(--red)">*</span>
        <input type="text" name="clinic_name" maxlength="150" required placeholder="Contoh: Klinik Mediviron / Hospital Selayang">
      </label>
      <label class="field">Jumlah Tuntutan (RM) <span style="color:var(--red)">*</span>
        <input type="number" name="amount" step="0.01" min="0.01" max="${bal}" required placeholder="0.00">
      </label>
      <label class="field">Catatan Rawatan <small style="color:var(--muted)">(pilihan)</small>
        <textarea name="notes" rows="2" maxlength="300" placeholder="Contoh: Konsultasi doktor, rawatan demam & ubat antibiotik"></textarea>
      </label>

      <!-- Receipt Upload Box -->
      <div style="margin-top:10px;padding:14px;border:1px dashed var(--teal);border-radius:8px;background:var(--bg)">
        <label class="field" style="margin:0">
          <strong style="color:var(--teal)">${icon('clipboard')} Muat Naik Foto Resit Pembayaran Klinik <span style="color:var(--red)">*</span></strong>
          <p style="font-size:11px;color:var(--muted);margin:4px 0 8px">Ambil gambar resit rasmi klinik yang jelas berserta nombor resit & amaun.</p>
          <input type="file" id="claim-file-input" accept="image/*" capture="environment" required>
        </label>
        <div id="claim-preview-box" class="attachment-preview-box" style="display:none">
          <img id="claim-preview-img" class="attachment-thumb" src="" alt="Pratonton Resit">
          <div class="attachment-info">
            <b id="claim-file-name">resit_rawatan.jpg</b>
            <span style="display:block;color:var(--teal);margin-top:2px">✓ Foto resit dimampatkan & sedia dihantar</span>
          </div>
        </div>
      </div>

      <p id="apply-claim-error" role="alert" style="color:var(--red);font-size:12px;margin:10px 0 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit">${icon('check')} Hantar Tuntutan</button>
      </div>
    </form>
  `);

  const fileIn=document.querySelector('#claim-file-input');
  fileIn.addEventListener('change',async e=>{
    const file=e.target.files?.[0];
    if(!file)return;
    const base64=await fileToBase64(file);
    document.querySelector('#claim-preview-img').src=base64;
    document.querySelector('#claim-file-name').textContent=file.name;
    document.querySelector('#claim-preview-box').style.display='flex';
  });
}

function openEditClaimLimitDialog(userId=''){
  const users=adminClaimData.users;
  const selectedId=userId||users[0]?.id||'';
  const existing=adminClaimData.allowances.find(a=>a.user_id===selectedId);
  const targetUser=users.find(u=>u.id===selectedId);
  const curYear=new Date().getFullYear();

  open(userId?`Ubah Had Elaun — ${esc(targetUser?.name||'')}`:'Tetapkan Had Elaun Perubatan',`
    <form id="admin-claim-limit-form">
      <label class="field">Pilih Staf
        <select name="user_id" id="claim-limit-user-select" required>
          ${users.map(u=>`<option value="${esc(u.id)}" ${u.id===selectedId?'selected':''}>${esc(u.name)} (${esc(demoRoles[u.role]||u.role)})</option>`).join('')}
        </select>
      </label>
      <label class="field">Tahun
        <input type="number" name="year" value="${curYear}" required>
      </label>
      <label class="field">Had Siling Elaun Perubatan Tahunan (RM)
        <input type="number" name="annual_limit" id="claim-limit-amount" step="10" min="0" value="${existing?existing.annual_limit:500.00}" required>
      </label>
      <p style="font-size:11px;color:var(--muted)">Elaun ini direset pada 1hb Januari setiap tahun. Sebarang tuntutan yang diluluskan akan memotong baki ini dan dibayar dalam slip gaji 27hb.</p>
      <p id="admin-claim-limit-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit">${icon('check')} Simpan Had Elaun</button>
      </div>
    </form>
  `);

  document.querySelector('#claim-limit-user-select')?.addEventListener('change',e=>{
    const al=adminClaimData.allowances.find(x=>x.user_id===e.target.value);
    if(al)document.querySelector('#claim-limit-amount').value=al.annual_limit;
  });
}

// ==========================================
// 3. PAYROLL & DIGITAL PAYSLIP WORKSPACE
// ==========================================
async function payrollWorkspace(){
  if(currentUser?.role==='therapist'){
    notify('Modul Penggajian hanya untuk staf tetap (Guru & Admin).');
    location.hash='dashboard';
    return;
  }

  content.innerHTML=`<div class="auth-loading" role="status">Memuatkan data penggajian & slip…</div>`;
  const isAdm=currentUser?.role==='admin';

  if(!selectedPayrollMonth){
    const now=new Date();
    selectedPayrollMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }

  try{
    const mySlipsR=await api('my_payslips');
    myPayslipsData=mySlipsR.payslips||[];
    if(isAdm){
      const admR=await api('admin_payroll_data');
      adminPayrollDataState=admR;
    }
  }catch(err){
    notify('Ralat memuatkan penggajian: '+err.message);
  }

  const subNav=`
    <div class="hr-subtabs">
      <button class="hr-tab-btn ${payrollActiveTab==='my_slips'?'active':''}" id="payroll-tab-my" type="button">
        ${icon('clipboard')} Slip Gaji Saya (${myPayslipsData.length})
      </button>
      ${isAdm?`
        <button class="hr-tab-btn ${payrollActiveTab==='runs'?'active':''}" id="payroll-tab-runs" type="button">
          ${icon('building')} Penggajian & Slip Staf
        </button>
        <button class="hr-tab-btn ${payrollActiveTab==='profiles'?'active':''}" id="payroll-tab-profiles" type="button">
          ${icon('users')} Profil Gaji & Caruman Staf
        </button>
      `:''}
    </div>
  `;

  if(payrollActiveTab==='runs' && isAdm){
    content.innerHTML=subNav+renderAdminPayrollRunsSection();
  }else if(payrollActiveTab==='profiles' && isAdm){
    content.innerHTML=subNav+renderAdminPayrollProfilesSection();
  }else{
    content.innerHTML=subNav+renderMyPayslipsSection();
  }
}

function renderMyPayslipsSection(){
  const rows=myPayslipsData.map((s,i)=>{
    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${formatMyMonthYear(s.year_month)}</b></td>
        <td>${formatMyDate(s.pay_date)}</td>
        <td>${formatRM(s.basic_salary)}</td>
        <td>${formatRM(s.fixed_allowance)}</td>
        <td style="color:var(--teal)"><b>${formatRM(s.medical_claims)}</b></td>
        <td style="color:var(--red)">-${formatRM(s.total_deductions)}</td>
        <td><b style="font-size:14px;color:var(--teal)">${formatRM(s.net_salary)}</b></td>
        <td>
          <button class="primary mini-btn" type="button" data-view-payslip="${esc(s.id)}" style="background:#0d6955">
            ${icon('clipboard')} Papar / PDF Slip
          </button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Slip Gaji Digital Saya</h2>
          <p>Paparan peribadi slip gaji bulanan anda di Beruntung Brainiac berserta caruman statutori KWSP, PERKESO, SIP dan elaun rawatan.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Bulan Gaji</th>
              <th>Tarikh Bayaran</th>
              <th>Gaji Asas</th>
              <th>Elaun Tetap</th>
              <th>Tuntutan Perubatan</th>
              <th>Jumlah Potongan</th>
              <th>Gaji Bersih (Net)</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="9" class="empty">Tiada rekod slip gaji dijana lagi untuk akaun anda.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAdminPayrollRunsSection(){
  const runs=adminPayrollDataState.runs||[];
  const allSlips=adminPayrollDataState.payslips||[];
  const monthSlips=allSlips.filter(s=>s.year_month===selectedPayrollMonth);
  const pendingClaims=adminPayrollDataState.approvedClaims||[];
  const curRun=runs.find(r=>r.year_month===selectedPayrollMonth);

  const totGross=curRun?Number(curRun.total_gross):0;
  const totEpf=curRun?(Number(curRun.total_epf_employee)+Number(curRun.total_epf_employer)):0;
  const totSocsoEis=curRun?(Number(curRun.total_socso_employee)+Number(curRun.total_socso_employer)+Number(curRun.total_eis_employee)+Number(curRun.total_eis_employer)):0;
  const totNet=curRun?Number(curRun.total_net):0;

  const staffSlipRows=monthSlips.map((s,i)=>`
    <tr>
      <td>${i+1}</td>
      <td><b>${esc(s.user_name)}</b><small style="display:block;color:var(--muted)">${esc(demoRoles[s.user_role]||s.user_role)}</small></td>
      <td>${formatRM(s.basic_salary)}</td>
      <td>${formatRM(s.fixed_allowance)}</td>
      <td style="color:var(--teal)"><b>${formatRM(s.medical_claims)}</b></td>
      <td>${formatRM(s.epf_employee)} / ${formatRM(s.epf_employer)}</td>
      <td style="color:var(--red)">-${formatRM(s.total_deductions)}</td>
      <td><b style="color:var(--teal)">${formatRM(s.net_salary)}</b></td>
      <td>
        <button class="primary mini-btn" type="button" data-view-payslip="${esc(s.id)}" style="background:#0d6955">
          ${icon('clipboard')} Semak Slip
        </button>
      </td>
    </tr>
  `).join('');

  const runRows=runs.map((r,i)=>{
    return `
      <tr>
        <td>${i+1}</td>
        <td><b>${formatMyMonthYear(r.year_month)}</b></td>
        <td>${formatMyDate(r.pay_date)}</td>
        <td>${formatRM(r.total_gross)}</td>
        <td>${formatRM(r.total_claims)}</td>
        <td>${formatRM(Number(r.total_epf_employee)+Number(r.total_epf_employer))}</td>
        <td><b style="color:var(--teal)">${formatRM(r.total_net)}</b></td>
        <td><span class="status-chip approved">✓ Diproses</span></td>
        <td>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            <button class="secondary mini-btn" type="button" data-select-payroll-month="${esc(r.year_month)}">${icon('users')} Lihat Slip Staf</button>
            <button class="secondary mini-btn" type="button" data-export-kwsp="${esc(r.year_month)}">${icon('clipboard')} Borang A KWSP</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!-- Top Summary Banner -->
    <div class="hr-hero-stats">
      <div class="hr-stat-card">
        <div class="hr-stat-label">Jumlah Gaji Kasar (Gross) ${icon('chart')}</div>
        <div class="hr-stat-num">${formatRM(totGross)}</div>
        <div class="hr-stat-sub">Bulan ${formatMyMonthYear(selectedPayrollMonth)}</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Caruman KWSP Majikan + Pekerja ${icon('building')}</div>
        <div class="hr-stat-num">${formatRM(totEpf)}</div>
        <div class="hr-stat-sub">Jadual Ketiga Akta KWSP</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Caruman PERKESO & SIP ${icon('shield')}</div>
        <div class="hr-stat-num">${formatRM(totSocsoEis)}</div>
        <div class="hr-stat-sub">Akta Keselamatan Sosial Pekerja</div>
      </div>
      <div class="hr-stat-card">
        <div class="hr-stat-label">Jumlah Gaji Bersih Dibayar ${icon('check')}</div>
        <div class="hr-stat-num" style="color:var(--teal)">${formatRM(totNet)}</div>
        <div class="hr-stat-sub">Tarikh bayaran rasmi 27hb</div>
      </div>
    </div>

    <!-- Payroll Control Bar -->
    <div class="att-actions-bar" style="margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <label style="font-size:13px;font-weight:600">Pilih Bulan Gaji:
          <input type="month" id="payroll-month-select" value="${selectedPayrollMonth}" style="margin-left:6px;padding:6px 10px;border-radius:6px;border:1px solid var(--line)">
        </label>
        ${pendingClaims.length>0?`<span class="mini-tag" style="background:#fff3dd;color:#94631a">${pendingClaims.length} tuntutan perubatan sedia dipindahkan</span>`:''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="primary" id="btn-process-payroll" type="button" style="background:#0d6955">${icon('refresh')} Proses Penggajian (27hb)</button>
        ${curRun?`
          <button class="secondary" type="button" data-export-kwsp="${esc(selectedPayrollMonth)}">
            ${icon('clipboard')} Fail KWSP Borang A (i-Akaun)
          </button>
        `:''}
      </div>
    </div>

    <!-- Per-staff Payslips for Selected Month -->
    <section class="panel" style="margin-bottom:20px">
      <div class="panel-head">
        <div>
          <h2>Senarai Slip Gaji Staf — ${formatMyMonthYear(selectedPayrollMonth)} (${monthSlips.length} staf)</h2>
          <p>Klik "Semak Slip" untuk melihat penyata penuh atau memuat turun PDF slip gaji mana-mana staf.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Staf</th>
              <th>Gaji Asas</th>
              <th>Elaun Tetap</th>
              <th>Tuntutan Perubatan</th>
              <th>KWSP (Pekerja / Majikan)</th>
              <th>Jumlah Potongan</th>
              <th>Gaji Bersih</th>
              <th>Slip Gaji</th>
            </tr>
          </thead>
          <tbody>
            ${staffSlipRows||`<tr><td colspan="9" class="empty">Tiada slip gaji bagi bulan ${formatMyMonthYear(selectedPayrollMonth)}. Klik "Proses Penggajian (27hb)" di atas untuk menjana slip semua staf.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Sejarah Kitaran Penggajian Bulanan Pusat</h2>
          <p>Kitaran gaji bulanan (1hb hingga akhir bulan) dengan bayaran rasmi pada 27hb setiap bulan.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Bulan Gaji</th>
              <th>Tarikh Bayar</th>
              <th>Jumlah Kasar</th>
              <th>Tuntutan Elaun</th>
              <th>Caruman KWSP</th>
              <th>Jumlah Gaji Bersih</th>
              <th>Status</th>
              <th>Tindakan & Borang A</th>
            </tr>
          </thead>
          <tbody>
            ${runRows||'<tr><td colspan="9" class="empty">Belum ada kitaran gaji yang diproses.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

async function downloadKwspBorangA(yearMonth){
  try{
    const res=await fetch('/api.php?action=admin_payroll_export_kwsp&year_month='+encodeURIComponent(yearMonth),{credentials:'same-origin'});
    if(!res.ok){
      let msg='Gagal memuat turun Borang A.';
      try{const j=await res.json();msg=j.error||msg}catch{}
      notify(msg);
      return;
    }
    const blob=await res.blob();
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`KWSP_BorangA_${yearMonth}.csv`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    notify('Fail CSV Borang A KWSP berjaya dimuat turun.');
  }catch(e){
    notify('Ralat memuat turun Borang A: '+e.message);
  }
}

function parseOtherDeductions(raw){
  if(Array.isArray(raw))return raw;
  try{
    const parsed=JSON.parse(raw||'[]');
    return Array.isArray(parsed)?parsed:[];
  }catch{return [];}
}

function renderOtherDeductionRow(item={}){
  const amt=Number(item.amount||0);
  return `
    <div class="other-deduction-row">
      <label class="field other-ded-desc-wrap">Penerangan Potongan <span style="color:var(--red)">*</span>
        <input type="text" class="other-ded-desc" maxlength="150" placeholder="Contoh: Pendahuluan gaji / Pinjaman / Zakat" value="${esc(item.description||'')}" required>
      </label>
      <label class="field">Jumlah (RM) <span style="color:var(--red)">*</span>
        <input type="number" class="other-ded-amt" step="0.01" min="0.01" placeholder="0.00" value="${amt>0?amt.toFixed(2):''}" required>
      </label>
      <button class="secondary mini-btn btn-remove-other-ded" type="button" title="Buang potongan ini" aria-label="Buang potongan ini">${icon('x')}</button>
    </div>
  `;
}

function renderAdminPayrollProfilesSection(){
  const users=adminPayrollDataState.users;
  const profiles=adminPayrollDataState.profiles;

  const rows=users.map((u,i)=>{
    const prof=profiles.find(p=>p.user_id===u.id)||{};
    const basic=Number(prof.basic_salary||0);
    const allow=Number(prof.fixed_allowance||0);
    const otherList=parseOtherDeductions(prof.other_deductions_json).filter(d=>Number(d.amount)>0);
    const otherTot=otherList.reduce((acc,d)=>acc+Number(d.amount||0),0);
    return `
      <tr>
        <td>${i+1}</td>
        <td><div class="person"><span class="avatar">${esc(u.name.split(' ').map(n=>n[0]).slice(0,2).join(''))}</span><div><b>${esc(u.name)}</b><small>${esc(demoRoles[u.role]||u.role)}</small></div></div></td>
        <td>${esc(prof.ic_no||'-')}</td>
        <td>${esc(prof.epf_no||'-')}</td>
        <td>${esc(prof.bank_name||'-')} ${prof.bank_acc_no?`<small style="display:block;color:var(--muted)">${esc(prof.bank_acc_no)}</small>`:''}</td>
        <td><b>${formatRM(basic)}</b></td>
        <td>${formatRM(allow)}</td>
        <td>
          <b>${formatRM(basic+allow)}</b>
          ${otherTot>0?`<small style="display:block;color:var(--red)">Potongan lain: -${formatRM(otherTot)} (${otherList.length})</small>`:''}
        </td>
        <td>
          <button class="secondary mini-btn" type="button" data-edit-payroll-prof="${esc(u.id)}">${icon('clipboard')} Kemas Kini</button>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>Profil Gaji & Butiran Caruman Staf</h2>
          <p>Konfigurasi gaji asas, elaun tetap, potongan bukan statutori, nombor akaun bank, dan nombor statutori (KWSP, PERKESO, LHDN) bagi setiap cikgu dan admin.</p>
        </div>
      </div>
      <div class="att-table-wrap">
        <table class="att-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Nama Staf</th>
              <th>No. Kad Pengenalan</th>
              <th>No. KWSP</th>
              <th>Bank & No. Akaun</th>
              <th>Gaji Asas</th>
              <th>Elaun Tetap</th>
              <th>Gaji Kasar Anggaran</th>
              <th>Tindakan</th>
            </tr>
          </thead>
          <tbody>
            ${rows||'<tr><td colspan="9" class="empty">Tiada staf ditemui.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function openEditPayrollProfileDialog(userId){
  const users=adminPayrollDataState.users;
  const targetUser=users.find(u=>u.id===userId);
  const existing=adminPayrollDataState.profiles.find(p=>p.user_id===userId)||{};
  const otherList=parseOtherDeductions(existing.other_deductions_json);

  open(`Profil Gaji — ${esc(targetUser?.name||'')}`,`
    <form id="admin-payroll-profile-form">
      <input type="hidden" name="user_id" value="${esc(userId)}">
      
      <div class="form-grid">
        <label class="field">No. Kad Pengenalan (IC) <span style="color:var(--red)">*</span>
          <input type="text" name="ic_no" maxlength="16" placeholder="Contoh: 950812-10-5432" value="${esc(existing.ic_no||'')}">
        </label>
        <label class="field">No. Ahli KWSP (EPF)
          <input type="text" name="epf_no" maxlength="20" placeholder="Contoh: 21345678" value="${esc(existing.epf_no||'')}">
        </label>
      </div>

      <div class="form-grid">
        <label class="field">No. Keselamatan Sosial (PERKESO)
          <input type="text" name="socso_no" maxlength="20" placeholder="No IC atau No PERKESO" value="${esc(existing.socso_no||'')}">
        </label>
        <label class="field">No. Cukai Pendapatan (LHDN)
          <input type="text" name="income_tax_no" maxlength="20" placeholder="Contoh: SG 12345678" value="${esc(existing.income_tax_no||'')}">
        </label>
      </div>

      <div class="form-grid">
        <label class="field">Nama Bank
          <select name="bank_name">
            <option value="Maybank" ${existing.bank_name==='Maybank'?'selected':''}>Maybank</option>
            <option value="CIMB Bank" ${existing.bank_name==='CIMB Bank'?'selected':''}>CIMB Bank</option>
            <option value="Bank Islam" ${existing.bank_name==='Bank Islam'?'selected':''}>Bank Islam</option>
            <option value="Public Bank" ${existing.bank_name==='Public Bank'?'selected':''}>Public Bank</option>
            <option value="RHB Bank" ${existing.bank_name==='RHB Bank'?'selected':''}>RHB Bank</option>
            <option value="Hong Leong Bank" ${existing.bank_name==='Hong Leong Bank'?'selected':''}>Hong Leong Bank</option>
            <option value="AmBank" ${existing.bank_name==='AmBank'?'selected':''}>AmBank</option>
            <option value="Bank Rakyat" ${existing.bank_name==='Bank Rakyat'?'selected':''}>Bank Rakyat</option>
            <option value="BSN" ${existing.bank_name==='BSN'?'selected':''}>BSN</option>
            <option value="Lain-lain" ${existing.bank_name==='Lain-lain'?'selected':''}>Lain-lain Bank</option>
          </select>
        </label>
        <label class="field">No. Akaun Bank
          <input type="text" name="bank_acc_no" maxlength="30" placeholder="Contoh: 164012345678" value="${esc(existing.bank_acc_no||'')}">
        </label>
      </div>

      <div class="form-grid">
        <label class="field">Gaji Asas Bulanan (RM) <span style="color:var(--red)">*</span>
          <input type="number" name="basic_salary" step="10" min="0" required placeholder="0.00" value="${existing.basic_salary||''}">
        </label>
        <label class="field">Elaun Tetap Bulanan (RM)
          <input type="number" name="fixed_allowance" step="10" min="0" placeholder="0.00" value="${existing.fixed_allowance||'0.00'}">
        </label>
      </div>

      <div class="form-grid">
        <label class="field">Kadar KWSP Pekerja (%)
          <input type="number" name="epf_employee_rate" step="0.5" value="${existing.epf_employee_rate||11.0}">
        </label>
        <label class="field">Kadar KWSP Majikan (%)
          <input type="number" name="epf_employer_rate" step="0.5" value="${existing.epf_employer_rate||13.0}">
        </label>
      </div>

      <div class="form-grid">
        <label class="field">Kategori PERKESO (SOCSO)
          <select name="socso_category">
            <option value="cat1" ${existing.socso_category==='cat1'?'selected':''}>Kategori 1 (Bencana Pekerjaan & Keilatan)</option>
            <option value="cat2" ${existing.socso_category==='cat2'?'selected':''}>Kategori 2 (Bencana Pekerjaan Sahaja - Staf 60+)</option>
          </select>
        </label>
        <label class="field">Potongan Cukai Bulanan (PCB)
          <input type="number" name="monthly_pcb" step="1" min="0" placeholder="0.00" value="${existing.monthly_pcb||'0.00'}">
        </label>
      </div>

      <label class="field" style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <input type="checkbox" name="eis_active" value="1" ${(Number(existing.eis_active??1)!==0)?'checked':''}>
        <span>Caruman Sistem Insurans Pekerjaan (SIP / EIS) Aktif (0.2% Pekerja / 0.2% Majikan)</span>
      </label>

      <label class="field" style="display:flex;align-items:center;gap:8px;margin-top:6px">
        <input type="checkbox" name="skbbk_active" value="1" ${(Number(existing.skbbk_active??1)!==0)?'checked':''}>
        <span>Caruman LINDUNG 24 Jam / SKBBK PERKESO Aktif (0.75% Pekerja mengikut jadual)</span>
      </label>

      <div class="other-deductions-box">
        <div class="other-deductions-head">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--ink)">Potongan Lain-lain (Bukan Statutori)</div>
            <small style="font-size:11px;color:var(--muted)">Contoh: pendahuluan gaji, pinjaman staf, cuti tanpa gaji, zakat atau yuran koperasi.</small>
          </div>
          <button class="secondary mini-btn" type="button" id="btn-add-other-deduction">${icon('plus')} Potongan Lain-lain</button>
        </div>
        <div class="other-deductions-list" id="other-deductions-list">
          ${otherList.length?otherList.map(renderOtherDeductionRow).join(''):'<p id="other-ded-empty" style="margin:0;font-size:11px;color:var(--muted)">Tiada potongan lain-lain ditetapkan.</p>'}
        </div>
      </div>

      <p id="admin-payroll-prof-error" role="alert" style="color:var(--red);font-size:12px;margin:8px 0"></p>
      <div class="dialog-actions">
        <button class="secondary" type="button" data-cancel>Batal</button>
        <button class="primary" type="submit">${icon('check')} Simpan Profil Gaji</button>
      </div>
    </form>
  `);
}

function findPayslipById(slipId){
  return myPayslipsData.find(s=>s.id===slipId)||(adminPayrollDataState.payslips||[]).find(s=>s.id===slipId);
}

async function downloadPayslipPdf(slip){
  try{
    const [fonts,logo]=await Promise.all([loadProgressFonts(),loadBrandLogo()]);
    const PDF=window.jspdf.jsPDF;
    const doc=new PDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
    doc.addFileToVFS('NotoSans-Regular.ttf',fonts.regular);
    doc.addFont('NotoSans-Regular.ttf','NotoSans','normal');
    doc.addFileToVFS('NotoSans-Bold.ttf',fonts.bold);
    doc.addFont('NotoSans-Bold.ttf','NotoSans','bold');

    let details={};try{details=JSON.parse(slip.details_json||'{}')}catch{}
    const prof=details.profile||{};
    const eeRate=(prof.epf_employee_rate!==undefined&&prof.epf_employee_rate!==null)?Number(prof.epf_employee_rate):11;
    const rawErRate=(prof.epf_employer_rate!==undefined&&prof.epf_employer_rate!==null)?Number(prof.epf_employer_rate):13;
    const erRate=(Number(slip.gross_salary)>5000&&rawErRate===13)?12:rawErRate;

    const pageW=210,margin=16;
    let y=16;

    if(logo){
      const info=doc.getImageProperties(logo);
      const w=42,h=w*info.height/info.width;
      doc.addImage(logo,'PNG',margin,y,w,h);
    }
    doc.setFont('NotoSans','bold');doc.setFontSize(13);doc.setTextColor(0,32,63);
    doc.text('PUSAT PERKEMBANGAN KANAK-KANAK BERUNTUNG BRAINIAC',pageW-margin,y+5,{align:'right'});
    doc.setFont('NotoSans','normal');doc.setFontSize(8.5);doc.setTextColor(90,105,120);
    doc.text('No. SSM: 202503030392 (003694359-M) · Bukit Beruntung, Rawang, Selangor',pageW-margin,y+10,{align:'right'});
    doc.setFont('NotoSans','bold');doc.setFontSize(11);doc.setTextColor(13,105,85);
    doc.text(`PENYATA GAJI BULANAN — ${formatMyMonthYear(slip.year_month).toUpperCase()}`,pageW-margin,y+16,{align:'right'});

    y+=24;
    doc.setDrawColor(13,105,85);doc.setLineWidth(0.6);
    doc.line(margin,y,pageW-margin,y);
    y+=6;

    // Staff metadata box
    doc.setFillColor(246,249,248);
    doc.roundedRect(margin,y,pageW-margin*2,24,2,2,'F');
    doc.setFont('NotoSans','normal');doc.setFontSize(8.5);doc.setTextColor(29,51,57);
    doc.text(`Nama Kakitangan: ${slip.user_name}`,margin+5,y+7);
    doc.text(`Jawatan: ${demoRoles[slip.user_role]||slip.user_role}`,margin+5,y+13);
    doc.text(`No. Kad Pengenalan: ${prof.ic_no||'-'}`,margin+5,y+19);

    doc.text(`Tarikh Bayaran: ${formatMyDate(slip.pay_date)}`,margin+98,y+7);
    doc.text(`No. KWSP / PERKESO: ${prof.epf_no||'-'} / ${prof.socso_no||'-'}`,margin+98,y+13);
    doc.text(`Bank / No. Akaun: ${prof.bank_name||'-'} ${prof.bank_acc_no||''}`,margin+98,y+19);
    y+=30;

    // Two columns: Earnings & Deductions
    const colW=(pageW-margin*2-8)/2;
    const leftX=margin,rightX=margin+colW+8;

    doc.setFillColor(0,32,63);
    doc.rect(leftX,y,colW,7,'F');
    doc.rect(rightX,y,colW,7,'F');
    doc.setFont('NotoSans','bold');doc.setFontSize(8.5);doc.setTextColor(255,255,255);
    doc.text('PENDAPATAN (EARNINGS)',leftX+4,y+5);
    doc.text('POTONGAN (DEDUCTIONS)',rightX+4,y+5);
    y+=12;

    doc.setFont('NotoSans','normal');doc.setFontSize(8.5);doc.setTextColor(29,51,57);
    let yLeft=y,yRight=y;

    function rowLine(x,yy,label,val){
      doc.setFont('NotoSans','normal');doc.text(label,x+2,yy);
      doc.setFont('NotoSans','bold');doc.text(val,x+colW-2,yy,{align:'right'});
    }

    rowLine(leftX,yLeft,'Gaji Asas (Basic Salary)',formatRM(slip.basic_salary));yLeft+=6;
    if(Number(slip.fixed_allowance)>0){rowLine(leftX,yLeft,'Elaun Tetap',formatRM(slip.fixed_allowance));yLeft+=6;}
    if(Number(slip.medical_claims)>0){rowLine(leftX,yLeft,'Bayaran Balik Tuntutan Perubatan',formatRM(slip.medical_claims));yLeft+=6;}

    rowLine(rightX,yRight,`Caruman KWSP Pekerja (${eeRate}%)`,formatRM(slip.epf_employee));yRight+=6;
    const pdfSocsoLabel=Number(details.calculation?.socso_skbbk_employee||0)>0?'Caruman PERKESO Pekerja (+ SKBBK)':'Caruman PERKESO Pekerja';
    rowLine(rightX,yRight,pdfSocsoLabel,formatRM(slip.socso_employee));yRight+=6;
    rowLine(rightX,yRight,'Caruman SIP (EIS) Pekerja',formatRM(slip.eis_employee));yRight+=6;
    if(Number(slip.pcb_amount)>0){rowLine(rightX,yRight,'Potongan Cukai Bulanan (PCB)',formatRM(slip.pcb_amount));yRight+=6;}
    const otherDeds=parseOtherDeductions(details.other_deductions);
    if(otherDeds.length){
      for(const od of otherDeds){
        doc.setFont('NotoSans','normal');
        const lines=doc.splitTextToSize(String(od.description||'Potongan Lain-lain'),colW-28);
        doc.text(lines,rightX+2,yRight);
        doc.setFont('NotoSans','bold');
        doc.text(formatRM(od.amount),rightX+colW-2,yRight,{align:'right'});
        yRight+=Math.max(1,lines.length)*4.5+1.5;
      }
    }else if(Number(slip.other_deductions)>0){
      rowLine(rightX,yRight,'Potongan Lain-lain',formatRM(slip.other_deductions));yRight+=6;
    }

    y=Math.max(yLeft,yRight)+4;
    doc.setDrawColor(210,220,224);doc.setLineWidth(0.3);
    doc.line(leftX,y,leftX+colW,y);
    doc.line(rightX,y,rightX+colW,y);
    y+=6;

    rowLine(leftX,y,'Jumlah Pendapatan Kasar',formatRM(Number(slip.gross_salary)+Number(slip.medical_claims)));
    rowLine(rightX,y,'Jumlah Potongan','-' + formatRM(slip.total_deductions));
    y+=10;

    // Employer statutory box
    doc.setFillColor(248,250,251);
    doc.roundedRect(margin,y,pageW-margin*2,14,2,2,'F');
    doc.setFont('NotoSans','bold');doc.setFontSize(8);doc.setTextColor(90,105,120);
    doc.text('CARUMAN STATUTORI MAJIKAN:',margin+4,y+5.5);
    doc.setFont('NotoSans','normal');
    doc.text(`KWSP Majikan (${erRate}%): ${formatRM(slip.epf_employer)}   |   PERKESO Majikan: ${formatRM(slip.socso_employer)}   |   SIP Majikan: ${formatRM(slip.eis_employer)}`,margin+4,y+11);
    y+=20;

    // Net Salary highlight
    doc.setFillColor(228,242,236);
    doc.roundedRect(margin,y,pageW-margin*2,16,2,2,'F');
    doc.setFont('NotoSans','bold');doc.setFontSize(10);doc.setTextColor(13,105,85);
    doc.text('GAJI BERSIH DITERIMA (NET PAY)',margin+5,y+7);
    doc.setFont('NotoSans','normal');doc.setFontSize(8);
    doc.text(`Dikreditkan ke akaun bank pada ${formatMyDate(slip.pay_date)}`,margin+5,y+12.5);
    doc.setFont('NotoSans','bold');doc.setFontSize(14);
    doc.text(formatRM(slip.net_salary),pageW-margin-5,y+10.5,{align:'right'});
    y+=24;

    doc.setFont('NotoSans','normal');doc.setFontSize(7.5);doc.setTextColor(130,140,150);
    doc.text('Penyata gaji ini dijana secara elektronik oleh Sistem Brainiac Hub. Tandatangan tidak diperlukan.',pageW/2,y,{align:'center'});

    const safeName=String(slip.user_name||'staf').toLowerCase().replace(/[^a-z0-9]+/g,'-');
    doc.save(`slip-gaji-${safeName}-${slip.year_month}.pdf`);
    notify('PDF Slip Gaji berjaya dimuat turun.');
  }catch(e){
    notify('Gagal menjana PDF slip gaji: '+e.message);
  }
}

function openPayslipModal(slipId){
  const slip=findPayslipById(slipId);
  if(!slip)return;

  let details={};
  try{
    details=JSON.parse(slip.details_json||'{}');
  }catch{details={}}

  const prof=details.profile||{};
  const eeRate=(prof.epf_employee_rate!==undefined&&prof.epf_employee_rate!==null)?Number(prof.epf_employee_rate):11;
  const rawErRate=(prof.epf_employer_rate!==undefined&&prof.epf_employer_rate!==null)?Number(prof.epf_employer_rate):13;
  const erRate=(Number(slip.gross_salary)>5000&&rawErRate===13)?12:rawErRate;

  const contentHtml=`
    <div class="payslip-card" id="payslip-print-area">
      <div class="payslip-header">
        <div>
          <div class="payslip-title">PUSAT PERKEMBANGAN KANAK-KANAK BERUNTUNG BRAINIAC</div>
          <p style="margin:2px 0;font-size:11px;color:var(--muted)">No. SSM: 202503030392 (003694359-M) · Pusat Jagaan & Terapi Perkembangan</p>
          <div style="font-size:13px;font-weight:700;color:var(--teal);margin-top:6px">PENYATA GAJI & PENDAPATAN (PAYSLIP)</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:14px;font-weight:700">${formatMyMonthYear(slip.year_month)}</div>
          <small style="color:var(--muted)">Tarikh Bayaran: ${formatMyDate(slip.pay_date)}</small>
        </div>
      </div>

      <!-- Staff Info Grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;background:var(--bg);padding:12px 14px;border-radius:8px;margin-bottom:18px;font-size:11px">
        <div>
          <div>Nama Staf: <strong>${esc(slip.user_name)}</strong></div>
          <div style="margin-top:4px">Jawatan: <strong>${esc(demoRoles[slip.user_role]||slip.user_role)}</strong></div>
          <div style="margin-top:4px">No. Kad Pengenalan: <strong>${esc(prof.ic_no||'-')}</strong></div>
        </div>
        <div>
          <div>No. Ahli KWSP: <strong>${esc(prof.epf_no||'-')}</strong></div>
          <div style="margin-top:4px">No. PERKESO: <strong>${esc(prof.socso_no||'-')}</strong></div>
          <div style="margin-top:4px">Bank / No. Akaun: <strong>${esc(prof.bank_name||'-')} ${esc(prof.bank_acc_no||'')}</strong></div>
        </div>
      </div>

      <!-- 2-Column Earnings & Deductions -->
      <div class="payslip-grid">
        <!-- Column 1: Earnings -->
        <div class="payslip-section">
          <h4>Pendapatan (Earnings)</h4>
          <div class="payslip-row">
            <span>Gaji Asas</span>
            <b>${formatRM(slip.basic_salary)}</b>
          </div>
          ${Number(slip.fixed_allowance)>0?`
            <div class="payslip-row">
              <span>Elaun Tetap</span>
              <b>${formatRM(slip.fixed_allowance)}</b>
            </div>
          `:''}
          ${Number(slip.medical_claims)>0?`
            <div class="payslip-row" style="color:var(--teal)">
              <span>Tuntutan Perubatan (Reimbursement)</span>
              <b>+${formatRM(slip.medical_claims)}</b>
            </div>
          `:''}
          <div class="payslip-total-row">
            <span>Jumlah Pendapatan Kasar</span>
            <span>${formatRM(Number(slip.gross_salary)+Number(slip.medical_claims))}</span>
          </div>
        </div>

        <!-- Column 2: Deductions -->
        <div class="payslip-section">
          <h4>Potongan (Deductions)</h4>
          <div class="payslip-row">
            <span>Caruman KWSP Pekerja (${eeRate}%)</span>
            <b>${formatRM(slip.epf_employee)}</b>
          </div>
          <div class="payslip-row">
            <span>Caruman PERKESO Pekerja${(()=>{const c=details.calculation||{};const sk=Number(c.socso_skbbk_employee||0);const inv=Number(c.socso_invalidity_employee||0);return sk>0?`<small style="display:block;font-size:10px;color:var(--muted)">${inv>0?`Keilatan ${formatRM(inv)} + SKBBK ${formatRM(sk)}`:`LINDUNG 24 Jam / SKBBK ${formatRM(sk)}`}</small>`:'';})()}</span>
            <b>${formatRM(slip.socso_employee)}</b>
          </div>
          <div class="payslip-row">
            <span>Caruman SIP (EIS) Pekerja</span>
            <b>${formatRM(slip.eis_employee)}</b>
          </div>
          ${Number(slip.pcb_amount)>0?`
            <div class="payslip-row">
              <span>Potongan Cukai PCB</span>
              <b>${formatRM(slip.pcb_amount)}</b>
            </div>
          `:''}
          ${(()=>{const otherDeds=parseOtherDeductions(details.other_deductions);return otherDeds.length?otherDeds.map(od=>`
            <div class="payslip-row">
              <span>${esc(od.description||'Potongan Lain-lain')}</span>
              <b>${formatRM(od.amount)}</b>
            </div>`).join(''):(Number(slip.other_deductions)>0?`
            <div class="payslip-row">
              <span>Potongan Lain-lain</span>
              <b>${formatRM(slip.other_deductions)}</b>
            </div>`:'');})()}
          <div class="payslip-total-row" style="color:var(--red)">
            <span>Jumlah Potongan</span>
            <span>-${formatRM(slip.total_deductions)}</span>
          </div>
        </div>
      </div>

      <!-- Employer Statutory Contributions (Informational) -->
      <div style="background:#f8faf9;border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:11px">
        <strong style="color:var(--muted);display:block;margin-bottom:4px">Caruman Majikan (Beruntung Brainiac):</strong>
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span>KWSP Majikan (${erRate}%): <b>${formatRM(slip.epf_employer)}</b></span>
          <span>PERKESO Majikan: <b>${formatRM(slip.socso_employer)}</b></span>
          <span>SIP (EIS) Majikan: <b>${formatRM(slip.eis_employer)}</b></span>
          <span>Jumlah Caruman Majikan: <b>${formatRM(Number(slip.epf_employer)+Number(slip.socso_employer)+Number(slip.eis_employer))}</b></span>
        </div>
      </div>

      <!-- Net Salary Box -->
      <div class="payslip-net-box">
        <div>
          <span style="font-size:12px;color:var(--muted);text-transform:uppercase;font-weight:700">Gaji Bersih Diterima (Net Pay):</span>
          <p style="margin:2px 0 0;font-size:11px;color:var(--muted)">Dipindahkan ke akaun bank pada ${formatMyDate(slip.pay_date)}</p>
        </div>
        <div class="payslip-net-val">${formatRM(slip.net_salary)}</div>
      </div>

      <div style="margin-top:20px;text-align:center;font-size:10px;color:var(--muted)">
        Penyata ini dijana secara komputer oleh Sistem Brainiac Hub. Tiada tandatangan diperlukan.
      </div>
    </div>

    <div class="dialog-actions">
      <button class="secondary" type="button" data-cancel>Tutup</button>
      <button class="secondary" type="button" id="btn-print-payslip">${icon('clipboard')} Cetak</button>
      <button class="primary" type="button" id="btn-pdf-payslip">${icon('book')} Muat Turun PDF</button>
    </div>
  `;

  open(`Slip Gaji — ${esc(slip.user_name)} (${formatMyMonthYear(slip.year_month)})`,contentHtml);

  document.querySelector('#btn-print-payslip')?.addEventListener('click',()=>{
    window.print();
  });
  document.querySelector('#btn-pdf-payslip')?.addEventListener('click',()=>{
    downloadPayslipPdf(slip);
  });
}

function openProcessPayrollDialog(){
  const ym=selectedPayrollMonth;
  const pendingClaims=adminPayrollDataState.approvedClaims||[];
  open(`Proses Penggajian — ${formatMyMonthYear(ym)}`,`
    <p class="dialog-copy">Sistem akan menjana slip gaji bagi semua staf tetap aktif (Guru & Admin) untuk bulan <strong>${formatMyMonthYear(ym)}</strong>:</p>
    <ul style="font-size:12px;color:var(--ink);line-height:1.6;margin:0 0 14px;padding-left:18px">
      <li>Mengira Gaji Asas, Elaun Tetap serta potongan Jadual Ketiga KWSP, PERKESO (+ LINDUNG 24 Jam), SIP (EIS), PCB &amp; potongan lain-lain.</li>
      <li>Memasukkan <strong>${pendingClaims.length} tuntutan perubatan</strong> yang telah diluluskan ke dalam slip gaji 27hb.</li>
      <li>Jika bulan ini pernah diproses, slip akan dikemas kini tanpa menghilangkan tuntutan perubatan bulan tersebut.</li>
    </ul>
    <div class="dialog-actions">
      <button class="secondary" type="button" data-cancel>Batal</button>
      <button class="primary" type="button" id="btn-confirm-process-payroll" style="background:#0d6955">${icon('check')} Sahkan & Jana Slip Gaji</button>
    </div>
  `);
}

// ==========================================
// 4. EVENT LISTENERS FOR LEAVE, CLAIMS & PAYROLL
// ==========================================
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');
  if(!b)return;

  // Leave tab buttons
  if(b.id==='leave-tab-my'){
    leaveActiveTab='my_leaves';
    await leavesWorkspace();
  }
  if(b.id==='leave-tab-admin'){
    leaveActiveTab='admin_leaves';
    await leavesWorkspace();
  }
  if(b.id==='leave-tab-quota'){
    leaveActiveTab='admin_quota';
    await leavesWorkspace();
  }
  if(b.id==='btn-apply-leave'){
    openApplyLeaveDialog();
  }
  if(b.id==='btn-add-staff-quota'){
    openEditQuotaDialog('');
  }
  if(b.dataset.editQuota){
    openEditQuotaDialog(b.dataset.editQuota);
  }
  if(b.id==='btn-export-leaves-csv')exportLeavesReport('csv');
  if(b.id==='btn-export-leaves-excel')exportLeavesReport('excel');
  if(b.id==='btn-export-leaves-pdf')exportLeavesReport('pdf');

  if(b.dataset.viewMc){
    const l=myLeaveData.leaves.find(x=>x.id===b.dataset.viewMc)||adminLeaveData.leaves.find(x=>x.id===b.dataset.viewMc);
    if(l?.attachment_url){
      showImageLightbox('Sijil Cuti Sakit (MC) — '+l.user_name,l.attachment_url);
    }
  }
  if(b.dataset.leaveAction){
    openReviewActionDialog('leave',b.dataset.leaveId,b.dataset.leaveAction);
  }

  // Claim tab buttons
  if(b.id==='claim-tab-my'){
    claimActiveTab='my_claims';
    await claimsWorkspace();
  }
  if(b.id==='claim-tab-admin'){
    claimActiveTab='admin_claims';
    await claimsWorkspace();
  }
  if(b.id==='claim-tab-allowances'){
    claimActiveTab='admin_allowances';
    await claimsWorkspace();
  }
  if(b.id==='btn-apply-claim'){
    openApplyClaimDialog();
  }
  if(b.id==='btn-add-claim-limit'){
    openEditClaimLimitDialog('');
  }
  if(b.dataset.editClaimLimit){
    openEditClaimLimitDialog(b.dataset.editClaimLimit);
  }
  if(b.id==='btn-export-claims-csv')exportClaimsReport('csv');
  if(b.id==='btn-export-claims-excel')exportClaimsReport('excel');
  if(b.id==='btn-export-claims-pdf')exportClaimsReport('pdf');

  if(b.dataset.viewReceipt){
    const c=myClaimData.claims.find(x=>x.id===b.dataset.viewReceipt)||adminClaimData.claims.find(x=>x.id===b.dataset.viewReceipt);
    if(c?.receipt_url){
      showImageLightbox('Resit Rawatan Klinik — '+c.clinic_name,c.receipt_url);
    }
  }
  if(b.dataset.claimAction){
    openReviewActionDialog('claim',b.dataset.claimId,b.dataset.claimAction);
  }

  // Payroll tab buttons
  if(b.id==='payroll-tab-my'){
    payrollActiveTab='my_slips';
    await payrollWorkspace();
  }
  if(b.id==='payroll-tab-runs'){
    payrollActiveTab='runs';
    await payrollWorkspace();
  }
  if(b.id==='payroll-tab-profiles'){
    payrollActiveTab='profiles';
    await payrollWorkspace();
  }
  if(b.id==='btn-process-payroll'){
    openProcessPayrollDialog();
  }
  if(b.id==='btn-confirm-process-payroll'){
    b.disabled=true;
    try{
      const res=await api('admin_payroll_run_process',{year_month:selectedPayrollMonth});
      dialog.close();
      notify(res.message||'Penggajian berjaya diproses.');
      await payrollWorkspace();
    }catch(err){
      notify('Gagal memproses gaji: '+err.message);
    }finally{
      b.disabled=false;
    }
  }
  if(b.dataset.selectPayrollMonth){
    selectedPayrollMonth=b.dataset.selectPayrollMonth;
    await payrollWorkspace();
  }
  if(b.dataset.exportKwsp){
    await downloadKwspBorangA(b.dataset.exportKwsp);
  }
  if(b.dataset.editPayrollProf){
    openEditPayrollProfileDialog(b.dataset.editPayrollProf);
  }
  if(b.id==='btn-add-other-deduction'){
    const list=document.querySelector('#other-deductions-list');
    if(list){
      if(list.querySelectorAll('.other-deduction-row').length>=20){
        notify('Maksimum 20 potongan lain-lain dibenarkan.');
        return;
      }
      document.querySelector('#other-ded-empty')?.remove();
      list.insertAdjacentHTML('beforeend',renderOtherDeductionRow());
      list.querySelector('.other-deduction-row:last-child .other-ded-desc')?.focus();
    }
  }
  if(b.classList.contains('btn-remove-other-ded')){
    const list=document.querySelector('#other-deductions-list');
    b.closest('.other-deduction-row')?.remove();
    if(list&&!list.querySelector('.other-deduction-row')){
      list.innerHTML='<p id="other-ded-empty" style="margin:0;font-size:11px;color:var(--muted)">Tiada potongan lain-lain ditetapkan.</p>';
    }
  }
  if(b.dataset.viewPayslip){
    openPayslipModal(b.dataset.viewPayslip);
  }
});

document.addEventListener('change',async e=>{
  if(e.target.id==='payroll-month-select'){
    selectedPayrollMonth=e.target.value;
    await payrollWorkspace();
  }
});

document.addEventListener('submit',async e=>{
  if(e.target.id==='admin-review-action-form'){
    e.preventDefault();
    const form=e.target;
    const btn=form.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#review-action-error');
    if(errEl)errEl.textContent='';
    try{
      const f=new FormData(form);
      const kind=form.dataset.kind;
      const id=form.dataset.id;
      const actionType=form.dataset.action;
      const note=f.get('admin_notes')||'';
      if(kind==='leave'){
        await api('admin_leave_action',{id,action_type:actionType,admin_notes:note});
        dialog.close();
        notify('Permohonan cuti telah berjaya '+(actionType==='Approved'?'diluluskan':'ditolak')+'.');
        await leavesWorkspace();
      }else{
        await api('admin_claim_action',{id,action_type:actionType,admin_notes:note});
        dialog.close();
        notify('Tuntutan perubatan berjaya '+(actionType==='Approved'?'diluluskan':'ditolak')+'.');
        await claimsWorkspace();
      }
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(e.target.id==='apply-leave-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#apply-leave-error');
    if(errEl)errEl.textContent='';

    try{
      const f=new FormData(e.target);
      const fileIn=document.querySelector('#mc-file-input');
      let attachmentUrl='';
      let attachmentName='';

      if(f.get('leave_type')==='medical'){
        const file=fileIn?.files?.[0];
        if(!file){
          throw new Error('Wajib memuat naik foto dokumen sijil cuti sakit (MC).');
        }
        attachmentUrl=await fileToBase64(file);
        attachmentName=file.name;
      }

      await api('apply_leave',{
        leave_type:f.get('leave_type'),
        start_date:f.get('start_date'),
        end_date:f.get('end_date'),
        days_count:f.get('days_count'),
        reason:f.get('reason'),
        attachment_url:attachmentUrl,
        attachment_name:attachmentName
      });

      dialog.close();
      notify('Permohonan cuti berjaya dihantar.');
      await leavesWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(e.target.id==='admin-quota-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#admin-quota-error');
    if(errEl)errEl.textContent='';

    try{
      const f=new FormData(e.target);
      await api('admin_leave_balance_save',{
        user_id:f.get('user_id'),
        year:f.get('year'),
        annual_total:f.get('annual_total'),
        annual_carry_forward:f.get('annual_carry_forward'),
        carry_forward_max:f.get('carry_forward_max'),
        medical_total:f.get('medical_total'),
        hospitalisation_total:f.get('hospitalisation_total'),
        maternity_total:f.get('maternity_total')
      });

      dialog.close();
      notify('Kuota cuti staf berjaya disimpan.');
      await leavesWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(e.target.id==='apply-claim-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#apply-claim-error');
    if(errEl)errEl.textContent='';

    try{
      const f=new FormData(e.target);
      const fileIn=document.querySelector('#claim-file-input');
      const file=fileIn?.files?.[0];
      if(!file){
        throw new Error('Wajib memuat naik foto resit bil klinik.');
      }
      const receiptUrl=await fileToBase64(file);

      await api('apply_claim',{
        treatment_date:f.get('treatment_date'),
        clinic_name:f.get('clinic_name'),
        amount:f.get('amount'),
        notes:f.get('notes'),
        receipt_url:receiptUrl,
        receipt_name:file.name
      });

      dialog.close();
      notify('Tuntutan perubatan berjaya dihantar untuk semakan Admin.');
      await claimsWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(e.target.id==='admin-claim-limit-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#admin-claim-limit-error');
    if(errEl)errEl.textContent='';

    try{
      const f=new FormData(e.target);
      await api('admin_claim_balance_save',{
        user_id:f.get('user_id'),
        year:f.get('year'),
        annual_limit:f.get('annual_limit')
      });

      dialog.close();
      notify('Had elaun perubatan staf berjaya disimpan.');
      await claimsWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }

  if(e.target.id==='admin-payroll-profile-form'){
    e.preventDefault();
    const btn=e.target.querySelector('button[type="submit"]');
    btn.disabled=true;
    const errEl=document.querySelector('#admin-payroll-prof-error');
    if(errEl)errEl.textContent='';

    try{
      const f=new FormData(e.target);
      const otherDeductions=[];
      for(const row of e.target.querySelectorAll('.other-deduction-row')){
        const desc=(row.querySelector('.other-ded-desc')?.value||'').trim();
        const amtRaw=(row.querySelector('.other-ded-amt')?.value||'').trim();
        if(!desc&&!amtRaw)continue;
        const amt=Number(amtRaw);
        if(!desc)throw new Error('Sila masukkan penerangan bagi setiap potongan lain-lain.');
        if(desc.length>150)throw new Error('Penerangan potongan lain-lain maksimum 150 aksara.');
        if(!Number.isFinite(amt)||amt<=0)throw new Error('Jumlah potongan lain-lain mestilah melebihi RM 0.00.');
        otherDeductions.push({description:desc,amount:Number(amt.toFixed(2))});
      }
      if(otherDeductions.length>20)throw new Error('Maksimum 20 potongan lain-lain dibenarkan.');

      await api('admin_payroll_profile_save',{
        user_id:f.get('user_id'),
        ic_no:f.get('ic_no'),
        epf_no:f.get('epf_no'),
        socso_no:f.get('socso_no'),
        income_tax_no:f.get('income_tax_no'),
        bank_name:f.get('bank_name'),
        bank_acc_no:f.get('bank_acc_no'),
        basic_salary:f.get('basic_salary'),
        fixed_allowance:f.get('fixed_allowance'),
        epf_employee_rate:f.get('epf_employee_rate'),
        epf_employer_rate:f.get('epf_employer_rate'),
        socso_category:f.get('socso_category'),
        eis_active:f.get('eis_active')?1:0,
        skbbk_active:f.get('skbbk_active')?1:0,
        monthly_pcb:f.get('monthly_pcb'),
        other_deductions:otherDeductions
      });

      dialog.close();
      notify('Profil gaji staf berjaya disimpan.');
      await payrollWorkspace();
    }catch(err){
      if(errEl)errEl.textContent=err.message;
    }finally{
      btn.disabled=false;
    }
  }
});
