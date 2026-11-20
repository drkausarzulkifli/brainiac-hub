# Brainiac Hub — login dan pangkalan data Hostinger

Pakej ini menggantikan simulasi browser dengan PHP + MySQL. Pelajar, staf, jadual dan rekod klinikal bermula kosong pada **pangkalan data baharu**. Tiada data demo atau akaun ujian dihantar. Data localStorage demo tidak diimport.

## Status

- Kod dan ujian lokal disediakan. Laman brainiachub.io belum diubah oleh pakej ini.
- Ujian lokal menggunakan PHP 8.5 dan SQLite, dengan skema ujian yang sepadan. Sambungan MySQL/MariaDB sebenar, konfigurasi Apache/.htaccess dan HTTPS Hostinger perlu disahkan selepas pemasangan.
- Hosting memerlukan PHP 8.2 atau lebih baharu, PDO MySQL, HTTPS dan pangkalan data MySQL/MariaDB berasingan.
- Jangan masukkan rekod sebenar sehingga ujian pemasangan di bawah selesai.

## 1. Cipta pangkalan data

Dalam hPanel, buka **Websites → brainiachub.io → Dashboard → Databases → Management** (atau Database → Manage).

Cipta pangkalan data dan pengguna pangkalan data khusus untuk Brainiac Hub. Simpan nama pangkalan data penuh, nama pengguna penuh dan kata laluan secara peribadi. Host biasanya `localhost`.

Jangan hantar kata laluan database, hosting atau Admin melalui chat.

## 2. Letakkan fail di lokasi yang betul

Buat salinan sandaran fail laman sedia ada dahulu, di luar `public_html`. Muat naik ZIP **brainiac-hub-hostinger-LOGIN-DATABASE.zip** di folder induk `public_html`, kemudian extract. Kandungan ZIP:

```text
folder induk/
├── public_html/
│   ├── index.html
│   ├── api.php
│   ├── setup.html
│   ├── .htaccess
│   └── ... aset aplikasi
└── brainiac-private/
    ├── bootstrap.php
    ├── schema.sql
    ├── config.example.php
    └── .htaccess
```

**brainiac-private mesti berada di luar public_html**, sebagai folder bersebelahan. Jangan letak ZIP, SQL, konfigurasi atau sandaran dalam folder awam. Pakej sudah menyertakan `.htaccess`; pastikan fail tersembunyi turut dimuat naik.

Fail dalam `public_html` menggantikan fail demo dengan nama yang sama. Jangan extract menjadi `public_html/public_html`. Halaman login ialah `public_html/index.html`. `default.php` lama tidak diperlukan sebagai halaman utama.

## 3. Import skema

Buka phpMyAdmin untuk pangkalan data baharu → Import → pilih `brainiac-private/schema.sql` daripada pakej lokal. Ia mencipta 5 jadual `hub_*` dan satu dokumen kosong. Ia tidak mengosongkan jadual sedia ada.

## 4. Isi konfigurasi peribadi

Dalam File Manager, salin `brainiac-private/config.example.php` kepada `brainiac-private/config.php`. Isi:

- `dsn`: ganti `YOUR_DATABASE` dengan nama penuh database daripada hPanel.
- `db_user`: nama penuh pengguna database.
- `db_password`: kata laluan database.
- `origin`: kekalkan `https://brainiachub.io` jika domain ini digunakan.
- `setup_token`: rahsia rawak sekurang-kurangnya 32 aksara; simpan sementara untuk langkah 5. Ganti seluruh teks placeholder.
- `allow_http_local`: **kekalkan false** di Hostinger.

Gunakan nilai string PHP yang sah: jika kata laluan mengandungi `'` atau `\`, aksara tersebut perlu di-escape dalam string single-quoted. Jangan letakkan konfigurasi sebenar di Git atau di dalam ZIP awam. Hadkan permission fail konfigurasi kepada pemilik akaun hosting jika File Manager menyokongnya.

## 5. Cipta Admin pertama

Buka **https://brainiachub.io/setup.html**. Masukkan kod pemasangan, nama, emel dan kata laluan Admin (sekurang-kurangnya 12 aksara). Ini bukan kata laluan Hostinger.

Selepas berjaya, buka halaman utama dan log masuk. Setup menolak semua percubaan mencipta Admin tambahan selepas akaun pertama wujud. Boleh kosongkan `setup_token` dalam konfigurasi selepas selesai.

Admin kemudian boleh membuka **Akaun pengguna** untuk mencipta akaun Cikgu dan Terapis. Mereka wajib menukar kata laluan sementara semasa login pertama. Akaun boleh dinyahaktifkan; sesi lama akan ditolak pada permintaan berikutnya. Profil staf untuk jadual masih didaftarkan di **Staf**, berasingan daripada akaun login.

## 6. Ujian selepas pemasangan

1. Semak tiada pelajar, staf, jadual, nota, assessment atau laporan demo.
2. Login Admin, Cikgu dan Terapis; semak menu dan cubaan akses URL modul terhad.
3. Gunakan rekod ujian sahaja untuk menyimpan pelajar, staf dan slot. Semak dialog berjaya serta rekod selepas refresh/browser kedua.
4. Uji nota EIP tanpa plan, preload plan pilihan, SOAP tanpa assessment, assessment dan progress report/PDF.
5. Semak Cikgu dan Terapis boleh membaca sejarah penuh pelajar.
6. Cuba sunting dari dua browser. Jika versi telah berubah, simpanan kedua mesti ditolak tanpa kehilangan kandungan borang. Salin catatan belum disimpan sebelum refresh.
7. Log keluar dan semak API `https://brainiachub.io/api.php?action=state` menolak akses tanpa login. Semak URL `https://brainiachub.io/brainiac-private/config.php` tidak boleh memaparkan konfigurasi.
8. Pastikan sandaran database Hostinger aktif. Semak eksport/sandaran dan pemulihan dalam persekitaran ujian sebelum penggunaan sebenar.

Gunakan database ujian berasingan untuk langkah yang mencipta rekod. Untuk permulaan operasi yang bersih, cipta database kosong baharu, import schema, kemas kini config dan cipta Admin semula. Jangan padam database operasi untuk tujuan ujian.

## Perilaku dan batasan versi ini

- Admin: semua modul; Cikgu/Terapis: matriks akses yang diminta. Semakan write dilakukan semula pada server; menukar JavaScript tidak memberikan hak menulis modul lain.
- Semua pengguna berdaftar boleh membaca rekod pelajar dan sejarah klinikal penuh, seperti yang diminta.
- Session cookie HttpOnly, SameSite Strict, Secure pada HTTPS; had 30 minit tanpa permintaan dan maksimum 8 jam. Kata laluan di-hash. Ada CSRF, had percubaan login dan log audit server.
- Data dikongsi melalui MySQL sebagai dokumen JSON bagi mengekalkan struktur borang semasa. Ini belum sistem penyegerakan masa nyata: refresh untuk mendapatkan perubahan pengguna lain. Konflik versi menghalang overwrite senyap. Pada pusat dengan banyak pengguna serentak, simpanan per rekod/merge boleh dibina dalam fasa seterusnya.
- Tiada email reset automatik, MFA atau tandatangan digital kriptografi. Admin menetapkan kata laluan sementara melalui Akaun pengguna. Pengguna menukarnya sendiri.
- Log audit mencatat pelaku, masa dan koleksi yang berubah; ia bukan sejarah versi penuh setiap medan.
- Penilaian klinikal kekal menggunakan borang dan pengesahan sedia ada. Pemasangan login/database ini bukan pengesahan klinikal bagi instrumen penilaian.
- Tidak ada import automatik data browser lama. Tiada storan PHI baru dalam localStorage.

## Pemulihan

Jika pemasangan belum pernah menerima data sebenar, pulihkan sandaran fail demo untuk membatalkan deploy. Jika data sebenar sudah dimasukkan, jangan kembali ke demo: simpan database dan konfigurasi, pulihkan fail backend yang sesuai atau gunakan maintenance sementara. Jangan membuka akses awam kepada data bagi menyelesaikan masalah login.

Jika gagal: semak struktur folder, nama penuh database/user, PHP PDO MySQL, HTTPS, dan import skema. Mesej API tidak mendedahkan kata laluan atau butiran SQL; rujuk error log hosting untuk diagnosis oleh Admin.
