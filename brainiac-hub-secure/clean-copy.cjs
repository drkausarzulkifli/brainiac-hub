const fs=require('fs'),path=require('path');
const index=path.join(__dirname,'public/index.html');
fs.writeFileSync(index,fs.readFileSync(index,'utf8').replace('Simpan kata laluan</button></form>','Simpan kata laluan</button><button class="secondary" id="password-cancel" type="button">Kembali</button></form>'));
const substitutions=[
 ['Semua rekod demo adalah rekaan','Rekod pelajar berdaftar'],['Gunakan data rekaan sahaja. Profil disimpan dalam browser ini.','Profil disimpan pada server dan boleh dicapai oleh pasukan.'],
 ['Demo sahaja: gunakan maklumat rekaan. ',''],['Rekod demo · Maklumat rekaan','Profil pelajar'],['Pelajar demo sedia ada','Pelajar sedia ada'],
 ['Direktori pasukan demo','Direktori pasukan'],['Semua rekod rekaan. Staf disimpan pada server.','Staf tersedia dalam pilihan jadual sesi.'],['Gunakan maklumat rekaan untuk demo ini.','Akaun login diurus melalui Akaun pengguna.'],
 ['Gunakan maklumat rekaan sahaja. Simpanan masih pada browser ini.','Assessment disimpan pada server.'],['pengesahan dalam demo, bukan tandatangan digital','pengesahan rekod, bukan tandatangan digital'],
 ['Gunakan maklumat rekaan sahaja. Laporan disimpan pada browser ini.','Laporan disimpan pada server.'],['Demo • Perubahan disimpan pada server','Brainiac Hub • Rekod pasukan'],['Demo · Disimpan pada server sahaja.','Disimpan pada server.'],['Murid demo','Murid berdaftar'],['<span>Rekaan</span>',''],
 ['<b>Demo untuk mencuba</b>','<b>Nota kelas pasukan</b>'],['Gunakan data rekaan sahaja. Nota disimpan pada browser ini,','Nota disimpan sebagai draf pada server,'],['Contoh rekaan:','Contoh:'],
 ['Terokai aliran kerja Brainiac menggunakan rekod rekaan.','Urus rekod dan sesi Beruntung Brainiac.']
];
for(const name of fs.readdirSync(path.join(__dirname,'public')).filter(n=>n.endsWith('.js'))){const p=path.join(__dirname,'public',name);let s=fs.readFileSync(p,'utf8');for(const [a,b] of substitutions)s=s.replaceAll(a,b);s=s.replaceAll("api('logout')","api('logout',{})");if(name==='planner.js')s=s.replace(/<details class="legacy-sessions"><summary>Lihat rekod hari contoh lama[\s\S]*?\$\{schedule\(\)\}<\/details>/,'');if(name==='demo-access.js')s=s.replace('// Demo presentation policy only. No authenticated identity or server enforcement.','// UI mirrors the authenticated server role. api.php independently enforces every write.');fs.writeFileSync(p,s)}
const clinical=path.join(__dirname,'tests/clinical.cjs');if(fs.existsSync(clinical))fs.writeFileSync(clinical,fs.readFileSync(clinical,'utf8').replaceAll("api('logout')","api('logout',{})"));
