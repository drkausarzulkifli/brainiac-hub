const {chromium}=require('../../hostinger-package-tools/node_modules/playwright');
const assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1360,height:900}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 try{
 await page.goto('http://127.0.0.1:8789/setup.html');
 await page.locator('[name=token]').fill('local-test-only-'+'x'.repeat(40));await page.locator('[name=name]').fill('Admin Test');await page.locator('[name=email]').fill('admin@example.test');await page.locator('[name=password]').fill('Test-password-123!');await page.locator('[name=confirm]').fill('Test-password-123!');await page.locator('button').click();await page.getByText('Admin berjaya dicipta.',{exact:false}).waitFor();
 await page.goto('http://127.0.0.1:8789/');await page.locator('#auth-email').waitFor({state:'visible'});await page.screenshot({path:path.join(__dirname,'login-desktop.png')});
 await page.locator('#auth-email').fill('admin@example.test');await page.locator('#auth-password').fill('Test-password-123!');await page.locator('#auth-form button').click();await page.locator('body[data-auth=ready]').waitFor();assert.equal(await page.locator('#demo-role').count(),0);
 await page.screenshot({path:path.join(__dirname,'dashboard-desktop.png')});
 await page.locator('a[href="#staff"]').click();await page.locator('#add').click();await page.locator('#staff-form [name=name]').fill('Cikgu Test');await page.locator('#staff-form [name=role]').selectOption('Special Needs Teacher');await page.locator('#staff-form button[type=submit]').click();await page.locator('#save-result-dialog[data-result=success][open]').waitFor();await page.locator('#save-result-ok').click();
 await page.locator('a[href="#students"]').click();await page.locator('#add').click();await page.locator('#student-form [name=name]').fill('Murid Ujian');await page.locator('#student-form [name=ic]').fill('200229101234');await page.locator('#student-form [name=guardianName]').fill('Penjaga Ujian');await page.locator('#student-form [name=guardianPhone]').fill('0101234567');await page.locator('#student-form [name=programs][value=eip]').check();assert.equal(await page.locator('[name=dob]').inputValue(),'2020-02-29');await page.locator('#student-form button[type=submit]').click();await page.locator('#save-result-dialog[data-result=success][open]').waitFor();await page.locator('#save-result-ok').click();
 await page.reload();await page.locator('body[data-auth=ready]').waitFor();await page.getByRole('heading',{name:'Murid Ujian',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('brainiac-hub-empty-v1')),null);
 await page.locator('a[href="#sessions"]').click();await page.locator('#planner-date').fill('2026-11-16');await page.locator('[data-slot-time=pagi]').first().click();await page.locator('#slot-form [name=student]').first().check();await page.locator('#slot-form button[type=submit]').click();await page.locator('#save-result-dialog[data-result=success][open]').waitFor();await page.locator('#save-result-ok').click();
 // Open an EIP note without a study plan; dates and roster preload from the calendar.
 await page.locator('[data-booking-work]').first().click();await page.locator('#class-note-form').waitFor();assert.equal(await page.locator('#class-note-form [name=date]').inputValue(),'2026-11-16');
 await page.locator('#class-note-form [name=actual]').fill('Aktiviti ujian sahaja');await page.locator('#save-note-draft').click();await page.locator('#save-result-dialog[data-result=success][open]').waitFor();await page.locator('#save-result-ok').click();
 assert.equal(await page.evaluate(()=>data.classNotes[0].actual),'Aktiviti ujian sahaja');
 // A second browser session can read the persisted record.
 const other=await browser.newContext();const p2=await other.newPage();await p2.goto('http://127.0.0.1:8789/');await p2.locator('#auth-email').fill('admin@example.test');await p2.locator('#auth-password').fill('Test-password-123!');await p2.locator('#auth-form button').click();await p2.locator('body[data-auth=ready]').waitFor();assert.equal(await p2.evaluate(()=>data.classNotes[0].actual),'Aktiviti ujian sahaja');
 // Concurrent write to a different collection must merge cleanly and preserve both changes.
 await p2.evaluate(async()=>{data.studentProfiles[0].guardianName='Updated elsewhere';if(!await save())throw Error(lastSaveError)});
 await page.locator('#class-note-form [name=actual]').fill('Catatan serentak berjaya');await page.locator('#save-note-draft').click();await page.locator('#save-result-dialog[data-result=success][open]').waitFor();await page.locator('#save-result-ok').click();
 assert.equal(await page.evaluate(()=>data.studentProfiles[0].guardianName),'Updated elsewhere');
 assert.equal(await page.evaluate(()=>data.classNotes[0].actual),'Catatan serentak berjaya');
 // True same-record conflict must fail without discarding the form.
 await p2.evaluate(async()=>{const s=await api('state');data=s.data;serverRevision=s.revision;serverState=structuredClone(s.data);data.classNotes[0].actual='Suntingan p2';if(!await save())throw Error(lastSaveError)});
 await page.locator('#class-note-form [name=actual]').fill('Catatan belum disimpan');await page.locator('#save-note-draft').click();await page.locator('#save-result-dialog[data-result=error][open]').waitFor();assert.match(await page.locator('#save-result-copy').textContent(),/pengguna lain/);await page.locator('#save-result-ok').click();assert.equal(await page.locator('#class-note-form [name=actual]').inputValue(),'Catatan belum disimpan');
 await other.close();
 // Mobile login: no horizontal overflow, branding remains proportionate.
 const mobile=await browser.newContext({viewport:{width:390,height:844}});const mp=await mobile.newPage();await mp.goto('http://127.0.0.1:8789/');await mp.locator('#auth-email').waitFor({state:'visible'});assert(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mp.screenshot({path:path.join(__dirname,'login-mobile.png')});await mobile.close();
 assert.deepEqual(errors,[]);console.log('PASS browser: login, empty start, staff/student save dialogs, DOB from IC, reload persistence, calendar EIP without plan, server-backed notes, cross-browser read, conflict retains form, mobile layout; no JS errors.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
