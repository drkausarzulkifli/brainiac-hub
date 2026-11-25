// Identity and persistence come from the PHP server. No patient data is stored in localStorage.
let currentUser=null, csrfToken='', serverRevision=0, serverState=null, serverBusy=false, lastSaveError='', retryWrite=null, suspendedDialog=null, stateLoaded=false;
async function api(action, payload){
 const qIdx=action.indexOf('&');
 const url=qIdx===-1?'/api.php?action='+encodeURIComponent(action):'/api.php?action='+encodeURIComponent(action.slice(0,qIdx))+action.slice(qIdx);
 const response=await fetch(url,{method:payload===undefined?'GET':'POST',credentials:'same-origin',cache:'no-store',headers:payload===undefined?{}:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
 let result;try{result=await response.json()}catch{throw new Error('Server tidak memberikan jawapan yang sah. Simpanan belum dapat disahkan.')}
 if(!response.ok){const error=new Error(result.error||'Permintaan gagal.');error.status=response.status;throw error}return result;
}
function busy(value){serverBusy=value;const box=document.querySelector('#network-dialog');if(value){if(!box.open)box.showModal()}else if(box.open)box.close()}
function syncActiveNoteRef(){if(typeof activeNote!=='undefined'&&activeNote&&Array.isArray(data?.classNotes)){const found=data.classNotes.find(n=>n.id===activeNote.id);if(found)activeNote=found;}}
async function serverSave(){
 if(serverBusy){lastSaveError='Tunggu simpanan semasa selesai.';recordSaveResult(false);return false}
 const snapshot=JSON.stringify(data);
 // Resolve an unanswered write using its original ID before submitting any newer edits.
 let pending=retryWrite||{snapshot,base:serverState?JSON.stringify(serverState):null,requestId:crypto.randomUUID(),revision:serverRevision};
 busy(true);lastSaveError='';
 try{
  const bodyPayload={data:JSON.parse(pending.snapshot),revision:pending.revision,requestId:pending.requestId};
  if(pending.base)bodyPayload.base=JSON.parse(pending.base);
  let result=await api('state',bodyPayload);
  serverRevision=result.revision;
  if(result.data){
   serverState=structuredClone(result.data);
   if(pending.snapshot===snapshot){data=structuredClone(result.data);syncActiveNoteRef();}
  }else{
   serverState=JSON.parse(pending.snapshot);
  }
  retryWrite=null;
  if(pending.snapshot!==snapshot){
   pending={snapshot,base:serverState?JSON.stringify(serverState):null,requestId:crypto.randomUUID(),revision:serverRevision};
   const nextPayload={data:JSON.parse(snapshot),revision:pending.revision,requestId:pending.requestId};
   if(pending.base)nextPayload.base=JSON.parse(pending.base);
   result=await api('state',nextPayload);
   serverRevision=result.revision;
   if(result.data){
    serverState=structuredClone(result.data);
    data=structuredClone(result.data);
    syncActiveNoteRef();
   }else{
    serverState=JSON.parse(snapshot);
   }
  }
  recordSaveResult(true);return true;
 }catch(error){
  retryWrite=(!error.status||error.status>=500)?pending:null;
  lastSaveError=error.message;recordSaveResult(false);notify(lastSaveError);
  if(error.status===401)showLogin('Sesi tamat. Log masuk semula untuk menyambung borang.');
  if(error.status===403){try{const session=await api('session');csrfToken=session.csrf;if(!session.user)showLogin('Sesi tamat. Log masuk semula untuk menyambung borang.')}catch{}}
  return false;
 }finally{busy(false)}
}
function showLogin(message=''){
 suspendedDialog=document.querySelector('dialog[open]:not(#network-dialog)');
 document.querySelectorAll('dialog[open]:not(#network-dialog)').forEach(d=>d.close());
 document.body.dataset.auth='login';document.querySelector('#auth-message').textContent=message;
 document.querySelector('#auth-password').value='';document.querySelector('#auth-email').focus();
}
async function secureBoot(){
 try{const session=await api('session');csrfToken=session.csrf;if(!session.user){showLogin();return}await enterApp(session.user)}catch(e){showLogin(e.message)}
}
async function enterApp(user){
 const previous=currentUser;currentUser=user;demoRole=user.role;
 if(Number(user.must_change)){document.body.dataset.auth='password';document.querySelector('#password-cancel').textContent='Log keluar';document.querySelector('#password-current').focus();return}
 if(!stateLoaded||!previous){const state=await api('state');data=state.data;serverRevision=state.revision;serverState=structuredClone(state.data);stateLoaded=true}
 else if(previous.id!==user.id||previous.role!==user.role){location.reload();return}
 document.body.dataset.auth='ready';if(!previous||!document.querySelector('#nav').children.length)go();else {applyDemoAccess();if(suspendedDialog){suspendedDialog.showModal();suspendedDialog=null}}
 document.querySelector('.user b').textContent=user.name;
 document.querySelectorAll('.user .avatar,.header-right .avatar').forEach(el=>el.textContent=user.name.split(' ').map(n=>n[0]).slice(0,2).join(''));
 document.querySelector('#account-users').hidden=user.role!=='admin';
 const backupBtn=document.querySelector('#account-backup');if(backupBtn)backupBtn.hidden=user.role!=='admin';
 if(typeof fetchClockStatus==='function'&&user.role!=='therapist')fetchClockStatus();else{const w=document.querySelector('#header-clock-widget');if(w)w.innerHTML=''}
 resetIdleTimer();
}
document.addEventListener('submit',async e=>{
 const formId=e.target.getAttribute?.('id')||'';
 if(formId==='auth-form'){
  e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;button.textContent='Sedang log masuk…';
  try{const fresh=await api('session');csrfToken=fresh.csrf;const r=await api('login',{email:document.querySelector('#auth-email').value,password:document.querySelector('#auth-password').value});csrfToken=r.csrf;document.querySelector('#auth-password').value='';await enterApp(r.user)}catch(err){document.querySelector('#auth-message').textContent=err.message}finally{button.disabled=false;button.textContent='Log masuk'}
 }
 if(formId==='password-form'){
  e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;
  try{const f=new FormData(e.target);if(f.get('password')!==f.get('confirm'))throw Error('Pengesahan kata laluan tidak sepadan.');await api('password',{current:f.get('current'),password:f.get('password')});e.target.reset();currentUser=null;await secureBoot()}catch(err){document.querySelector('#password-message').textContent=err.message}finally{button.disabled=false}
 }
 if(formId==='account-form'){
  e.preventDefault();const button=e.target.querySelector('button[type="submit"]');const errEl=document.querySelector('#account-error');if(errEl)errEl.textContent='';button.disabled=true;
  try{const f=new FormData(e.target);const accountId=String(f.get('account_id')||'').trim();const pwd=String(f.get('password')||'');if(!accountId&&pwd.length<12)throw Error('Kata laluan sementara mesti sekurang-kurangnya 12 aksara.');if(accountId&&pwd!==''&&pwd.length<12)throw Error('Kata laluan baharu mesti sekurang-kurangnya 12 aksara.');await api('users',{id:accountId,name:String(f.get('name')||'').trim(),email:String(f.get('email')||'').trim(),role:String(f.get('role')||'teacher'),active:f.get('active')==='on',password:pwd});dialog.close();await accountUsers();showSaveFeedback(true,'Akaun pengguna berjaya disimpan.')}catch(err){if(errEl)errEl.textContent=err.message;else notify(err.message)}finally{button.disabled=false}
 }
});
let accountList=[];
async function accountUsers(){
 try{const r=await api('users');accountList=r.users;open('Akaun pengguna',`<p>Akaun login diurus berasingan daripada profil staf dalam jadual.</p><button class="primary" type="button" id="new-account">Tambah pengguna</button><div class="records">${r.users.map(u=>`<div class="record"><div><h3>${esc(u.name)}</h3><p>${esc(u.email)} · ${esc(demoRoles[u.role])} · ${Number(u.active)?'Aktif':'Tidak aktif'}</p></div><button class="secondary" type="button" data-account-edit="${esc(u.id)}">Ubah</button></div>`).join('')}</div>`)}catch(e){notify(e.message)}
}
function accountForm(id=''){
 const u=accountList.find(u=>u.id===id)||{id:'',name:'',email:'',role:'teacher',active:1};
 dialog.close();open(u.id?'Ubah akaun':'Tambah akaun',`<form id="account-form"><input type="hidden" name="account_id" value="${esc(u.id)}"><label class="field">Nama<input name="name" required maxlength="120" value="${esc(u.name)}"></label><label class="field">Emel login<input name="email" type="email" required maxlength="190" autocomplete="off" value="${esc(u.email)}"></label><label class="field">Peranan<select name="role">${Object.entries(demoRoles).map(([v,label])=>`<option value="${v}" ${u.role===v?'selected':''}>${label}</option>`).join('')}</select></label><label class="field">Kata laluan sementara${u.id?' (kosongkan untuk kekalkan)':' (minimum 12 aksara)'}<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" ${u.id?'':'required'} placeholder="Minimum 12 aksara"></label><p>Pengguna perlu menukar kata laluan sementara pada login pertama. Kongsikan melalui saluran peribadi.</p><label class="account-check"><input type="checkbox" name="active" ${Number(u.active)?'checked':''}> <span>Akaun aktif</span></label><p id="account-error" role="alert"></p><div class="dialog-actions"><button class="secondary" type="button" data-discard-dialog>Batal</button><button class="primary" type="submit">Simpan akaun</button></div></form>`);
}
async function loadBackupSummary(selector){
 const el=document.querySelector(selector);if(!el)return;
 try{
  const s=await api('admin_backup_summary');
  const current=document.querySelector(selector);if(!current)return;
  current.textContent=`${s.total_tables} jadual MySQL • ${s.total_rows} baris rekod keseluruhan • Versi EHR semakan ${s.state_revision}`;
 }catch(err){
  const current=document.querySelector(selector);if(current)current.textContent=err.message||'Ringkasan pangkalan data tidak tersedia.';
 }
}
function openBackupDialog(){
 open('Sandaran Penuh Pangkalan Data',`<p class="dialog-copy">Muat turun salinan lengkap kesemua 14 jadual pangkalan data MySQL (rekod klinikal EHR, akaun pengguna, kehadiran GPS, cuti &amp; MC, tuntutan perubatan, penggajian dan log audit).</p><p class="field-hint" id="dialog-backup-summary">Memuatkan ringkasan jadual pangkalan data…</p><div class="records"><div class="record"><div><h3>Sandaran Pemulihan Penuh (.sql)</h3><p>Format terbaik untuk pemulihan semula terus melalui phpMyAdmin → Import sekiranya berlaku kehilangan data.</p></div><button class="primary" type="button" data-backup-format="sql">Muat Turun (.sql)</button></div><div class="record"><div><h3>Arkib Data JSON (.json)</h3><p>Salinan berstruktur untuk rujukan atau arkib dalaman (kata laluan log masuk disunting keluar).</p></div><button class="secondary" type="button" data-backup-format="json">Muat Turun (.json)</button></div></div><p class="field-hint">Simpan fail sandaran secara peribadi dan sulit. Jangan muat naik fail ini ke folder awam pelayan.</p><div class="dialog-actions"><button class="secondary" type="button" data-cancel>Tutup</button></div>`);
 loadBackupSummary('#dialog-backup-summary');
}
async function downloadFullBackup(format,button){
 if(currentUser?.role!=='admin'){notify('Hanya Admin boleh memuat turun sandaran penuh.');return}
 const originalText=button?button.textContent:'';
 if(button){button.disabled=true;button.textContent='Menjana sandaran…'}
 try{
  const response=await fetch('/api.php?action=admin_backup_export',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},body:JSON.stringify({format}),signal:AbortSignal.timeout(120000)});
  if(!response.ok){
   let errMsg='Sandaran gagal dijana.';
   try{const j=await response.json();if(j?.error)errMsg=j.error}catch{}
   if(response.status===401)showLogin('Sesi tamat. Log masuk semula untuk meneruskan.');
   if(response.status===403){try{const session=await api('session');csrfToken=session.csrf;if(!session.user)showLogin('Sesi tamat. Log masuk semula.')}catch{}}
   throw Error(errMsg);
  }
  const cd=response.headers.get('Content-Disposition')||'';
  const match=cd.match(/filename="([^"]+)"/i);
  const filename=match?match[1]:('BrainiacHub_Backup.'+format);
  const blob=await response.blob();
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
  notify('Sandaran penuh berjaya dimuat turun: '+filename);
  if(page==='reports')loadBackupSummary('#reports-backup-summary');
  if(document.querySelector('#dialog-backup-summary'))loadBackupSummary('#dialog-backup-summary');
 }catch(err){
  notify(err.message||'Sandaran gagal dimuat turun.');
 }finally{
  if(button&&button.isConnected){button.disabled=false;button.textContent=originalText}
 }
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='account-users'){if(hasPageChanges()||dialogIsDirty()){notify('Simpan atau buang perubahan dahulu.');return}await accountUsers()}
 if(b.id==='account-backup'){if(hasPageChanges()||dialogIsDirty()){notify('Simpan atau buang perubahan dahulu.');return}openBackupDialog()}
 if(b.dataset.backupFormat){await downloadFullBackup(b.dataset.backupFormat,b)}
 if(b.id==='new-account'||b.dataset.accountEdit)accountForm(b.dataset.accountEdit||'');
 if(b.id==='account-password'){if(hasPageChanges()||dialogIsDirty()){notify('Simpan atau buang perubahan dahulu.');return}document.body.dataset.auth='password';document.querySelector('#password-cancel').textContent='Kembali';document.querySelector('#password-current').focus()}
 if(b.id==='password-cancel'){if(Number(currentUser?.must_change)){await api('logout',{});location.replace('/')}else{document.querySelector('#password-form').reset();document.body.dataset.auth='ready'}}
 if(b.id==='account-logout'){
  if(hasPageChanges()||dialogIsDirty()){notify('Simpan atau buang perubahan dahulu sebelum log keluar.');return}
  try{await api('logout',{});location.replace('/')}catch(err){notify(err.message)}
 }
});
document.addEventListener('cancel',e=>{if(e.target.id==='network-dialog')e.preventDefault()},true);
window.addEventListener('beforeunload',e=>{if(serverBusy||retryWrite||hasPageChanges()){e.preventDefault();e.returnValue=''}});
// Reject new edits while a server transaction is pending. The loading dialog supplies visible feedback.
for(const event of ['click','submit','input','change'])document.addEventListener(event,e=>{if(serverBusy){e.preventDefault();e.stopImmediatePropagation()}},true);
let idleTimer;
function resetIdleTimer(){clearTimeout(idleTimer);if(document.body.dataset.auth==='ready')idleTimer=setTimeout(async()=>{try{await api('logout',{})}catch{}showLogin('Sesi dikunci selepas 30 minit tanpa aktiviti. Log masuk semula untuk menyambung.');},1800000)}
for(const event of ['pointerdown','keydown'])document.addEventListener(event,resetIdleTimer,{passive:true});
