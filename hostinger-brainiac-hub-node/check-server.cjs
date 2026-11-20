const assert=require('node:assert/strict');
const fs=require('node:fs');
const app=require('./server');
const server=app.listen(0,'127.0.0.1',async()=>{
 try{
  const base='http://127.0.0.1:'+server.address().port;
  const home=await fetch(base+'/');assert.equal(home.status,200);
  const html=await home.text();assert.ok(html.includes('id="main"'));
  for(const [,asset] of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)){const response=await fetch(base+asset);assert.equal(response.status,200,asset)}
  for(const asset of ['/assets/brand/beruntung-brainiac-logo.png','/vendor/NotoSans-Regular.ttf','/vendor/NotoSans-Bold.ttf'])assert.equal((await fetch(base+asset)).status,200,asset);
  assert.equal((await fetch(base+'/health')).status,200);
  for(const asset of ['/package.json','/server.js','/.env','/missing-file.js'])assert.equal((await fetch(base+asset)).status,404,asset);
  const js=fs.readFileSync('public/app.js','utf8');const initial=JSON.parse(js.match(/^const initial=(.*);$/m)[1]);
  for(const [key,value] of Object.entries(initial))assert.deepEqual(value,[],key);
  assert.ok(fs.readFileSync('public/staff.js','utf8').includes('const seedStaff=[];'));
  assert.equal(home.headers.get('x-content-type-options'),'nosniff');
  console.log('PASS HTTP home, all referenced assets, PDF fonts/logo, health, private source denial and empty initial records.');
 }catch(error){console.error(error);process.exitCode=1}finally{server.close()}
});
