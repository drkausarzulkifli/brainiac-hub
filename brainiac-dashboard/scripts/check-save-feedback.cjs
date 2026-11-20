const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const nodes=new Map(),timers=[];let writesFail=false;
function node(key){if(!nodes.has(key))nodes.set(key,{textContent:'',dataset:{},open:false,focus(){},showModal(){this.open=true},close(){this.open=false}});return nodes.get(key)}
const context=vm.createContext({document:{querySelector:node,addEventListener(){},activeElement:null},setTimeout:fn=>timers.push(fn)});
vm.runInContext(fs.readFileSync('dist/save-feedback.js','utf8'),context);
const run=s=>vm.runInContext(s,context),flush=()=>{while(timers.length)timers.shift()()};
run(`recordSaveResult(true)`);assert.equal(timers.length,0); // Autosave creates no dialog.
run(`beginSaveFeedback(null);recordSaveResult(true)`);assert.equal(node('#save-result-dialog').open,false);flush();assert.equal(node('#save-result-dialog').dataset.result,'success');assert.equal(node('#save-result-title').textContent,'Rekod berjaya disimpan');
run(`closeSaveFeedback();beginSaveFeedback(null);recordSaveResult(false);recordSaveResult(true)`);flush();assert.equal(node('#save-result-dialog').dataset.result,'error');assert.match(node('#save-result-copy').textContent,/Kandungan borang dikekalkan/);
context.form={querySelector:()=>({textContent:'Isi aktiviti sebenar dahulu.'})};run(`closeSaveFeedback();beginSaveFeedback(form)`);flush();assert.equal(node('#save-result-copy').textContent,'Isi aktiviti sebenar dahulu.');
run(`closeSaveFeedback();beginSaveFeedback(form);beginSaveFeedback(form);recordSaveResult(true)`);assert.equal(timers.length,1);flush();assert.equal(node('#save-result-dialog').dataset.result,'success');
// Exercise the actual persistence function with denied storage, not a fabricated success toast.
context.localStorage={setItem(){if(writesFail)throw Error('quota')}};context.data={};context.notify=()=>{};
const source=fs.readFileSync('dist/app.js','utf8');vm.runInContext(source.slice(source.indexOf('function save(){'),source.indexOf('function notify(')),context);
writesFail=true;run(`closeSaveFeedback();beginSaveFeedback(form);save()`);flush();assert.equal(node('#save-result-dialog').dataset.result,'error');
writesFail=false;run(`closeSaveFeedback();beginSaveFeedback(form);save()`);flush();assert.equal(node('#save-result-dialog').dataset.result,'success');
console.log('PASS explicit success, actual storage failure and retry, validation message, failure precedence, one dialog per action and silent autosave');
