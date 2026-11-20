const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'public'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const [,url] of html.matchAll(/(?:src|href)="(\/[^"#]+)"/g)){assert.ok(fs.existsSync(path.join(root,url.split('?')[0])), 'Missing asset '+url)}
assert.ok(fs.readFileSync(path.join(root,'app.js'),'utf8').includes('brainiac-hub-empty-v1'));
console.log('Build verified: static assets ready in public; empty initial records.');
