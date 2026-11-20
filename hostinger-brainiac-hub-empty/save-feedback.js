// Report explicit save attempts only; keystroke autosave stays unobtrusive.
const saveFeedbackForms=new Set(['class-note-form','assessment-form','progress-form','student-form','staff-form','slot-form','study-plan-form','therapy-note-form','therapy-soap-form','note-form','add-form']);
let saveFeedbackAttempt=null,saveFeedbackFocus=null;
function recordSaveResult(ok){if(saveFeedbackAttempt)saveFeedbackAttempt.results.push(ok)}
function beginSaveFeedback(form){if(saveFeedbackAttempt)return;const attempt={form,results:[]};saveFeedbackAttempt=attempt;setTimeout(()=>finishSaveFeedback(attempt),0)}
function finishSaveFeedback(attempt){if(saveFeedbackAttempt!==attempt)return;saveFeedbackAttempt=null;const ok=attempt.results.length>0&&attempt.results.every(Boolean);const storageFailed=attempt.results.includes(false);const validation=attempt.form?.querySelector('[role="alert"]')?.textContent.trim()||attempt.form?.querySelector(':invalid')?.validationMessage;
 showSaveFeedback(ok,ok?'Rekod berjaya disimpan pada browser ini.':storageFailed?'Simpanan gagal. Kandungan borang dikekalkan. Tutup dialog ini dan cuba simpan semula; jangan tutup halaman.':validation||'Rekod belum disimpan. Semak medan wajib dan betulkan maklumat sebelum cuba semula.');}
function showSaveFeedback(ok,message){const box=document.querySelector('#save-result-dialog');saveFeedbackFocus=document.activeElement;document.querySelector('#save-result-title').textContent=ok?'Rekod berjaya disimpan':'Rekod tidak berjaya disimpan';document.querySelector('#save-result-copy').textContent=message;document.querySelector('#save-result-ok').textContent=ok?'OK':'Kembali ke borang';box.dataset.result=ok?'success':'error';if(!box.open)box.showModal();document.querySelector('#save-result-ok').focus()}
function closeSaveFeedback(){document.querySelector('#save-result-dialog').close();if(saveFeedbackFocus?.isConnected)saveFeedbackFocus.focus();saveFeedbackFocus=null}
document.addEventListener('submit',e=>{if(saveFeedbackForms.has(e.target.id))beginSaveFeedback(e.target)},true);
document.addEventListener('invalid',e=>{if(saveFeedbackForms.has(e.target.form?.id))beginSaveFeedback(e.target.form)},true);
document.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.id==='save-note-draft')beginSaveFeedback(document.querySelector('#class-note-form'));if(b?.id==='save-result-ok')closeSaveFeedback()},true);
document.addEventListener('cancel',e=>{if(e.target.id==='save-result-dialog'){e.preventDefault();closeSaveFeedback()}},true);

