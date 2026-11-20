const {chromium}=require('../../hostinger-package-tools/node_modules/playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});try{
 const page=await browser.newPage();await page.goto('http://127.0.0.1:8789/');await page.locator('#auth-email').fill('admin@example.test');await page.locator('#auth-password').fill('Test-password-123!');await page.locator('#auth-form button').click();await page.locator('body[data-auth=ready]').waitFor();
 let drop=true;await page.route('**/api.php?action=state',async route=>{if(drop&&route.request().method()==='POST'){drop=false;await route.fetch();await route.abort('failed')}else await route.continue()});
 const first=await page.evaluate(async()=>{data.studentProfiles[0].guardianName='First edit';return await save()});assert.equal(first,false);
 const second=await page.evaluate(async()=>{data.studentProfiles[0].guardianName='Newer edit after network loss';return await save()});assert.equal(second,true);
 assert.equal(await page.evaluate(async()=>(await api('state')).data.studentProfiles[0].guardianName),'Newer edit after network loss');
 // An expired session must hide an open patient form and permit reauthentication without losing it.
 await page.locator('a[href="#students"]').click();await page.locator('[data-edit-student]').first().click();await page.locator('#student-form [name=guardianName]').fill('Retained through login');await page.evaluate(async()=>{await api('logout',{})});
 await page.locator('#student-form button[type=submit]').click();await page.locator('body[data-auth=login]').waitFor();assert.equal(await page.locator('dialog[open]').count(),0);
 await page.locator('#auth-email').fill('admin@example.test');await page.locator('#auth-password').fill('Test-password-123!');await page.locator('#auth-form button').click();await page.locator('body[data-auth=ready]').waitFor();assert.equal(await page.locator('#student-form [name=guardianName]').inputValue(),'Retained through login');
 await page.locator('#student-form button[type=submit]').click();await page.locator('#save-result-dialog[data-result=success][open]').waitFor();console.log('PASS recovery: lost server response retries idempotently with newer edits; expired session hides patient form and retains fields through reauthentication.');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
