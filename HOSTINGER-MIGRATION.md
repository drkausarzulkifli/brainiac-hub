# Pemindahan demo EHR ke Hostinger

Status 17 November 2026: pakej siap; belum dimuat naik, belum menukar DNS dan belum memindahkan rekod browser. Jenis pelan, domain sasaran dan akses hosting menunggu maklumat pemilik.

Pakej: beruntung-brainiac-hostinger-demo-2026-11-17.zip
Sumber: brainiac-dashboard/dist, commit 461097b8c3a577865d17ac408a0fde75c9904777.
Disahkan: index.html di root ZIP, 30 entri, semua 24 rujukan aset dan 17 skrip lulus pemeriksaan.

## Skop

Pakej ini mengandungi kod aplikasi, logo, font dan pustaka PDF. Ia tidak mengandungi rekod yang pengguna masukkan dalam browser. Tiada build Node.js atau import pangkalan data diperlukan untuk versi demo statik ini.

Gunakan document root sebuah domain/subdomain khusus. Aset aplikasi menggunakan laluan bermula `/`; pemasangan di subfolder memerlukan penyesuaian sebelum deployment.

## Langkah selepas akaun sasaran dikenal pasti

1. Sahkan jenis pelan dan laman PHP/HTML yang menerima fail tersuai. Jangan menggantikan laman sedia ada tanpa menyemak dan menyandarkannya dahulu.
2. Sediakan staging dengan akses terhad. Laman asal owner-private; pemindahan tidak sepatutnya secara senyap membuka akses umum. Simulasi peranan bukan pengganti login atau perlindungan hosting.
3. Eksport data `brainiac-demo-v1` daripada browser/domain asal sebelum cutover. Sediakan dan uji kemudahan eksport/import jika rekod demo hendak dikekalkan. Jangan letakkan fail sandaran rekod di folder web awam.
4. Muat naik ZIP dan ekstrak kandungannya ke document root yang dipilih, lazimnya public_html. Pastikan index.html, assets, vendor dan fail JS/CSS berada bersama di aras utama.
5. Aktifkan HTTPS dan uji pada hostname akhir yang akan digunakan; localStorage berbeza mengikut origin/protokol/hostname.
6. Uji dashboard, peranan, pendaftaran pelajar/DOB, kalendar, nota EIP, SOAP, assessment, progress report dan PDF.
7. Import data pada origin baharu dan semak bilangan serta beberapa rekod sebelum menganggap data berjaya dipindahkan. Browser atau peranti berbeza mempunyai data berbeza.
8. Tukar DNS hanya selepas semakan dan konfigurasi akses siap. Kekalkan laman asal sementara ujian perbandingan dan pemulihan diperlukan.

## Had versi demo yang dikekalkan

Data masih disimpan dalam localStorage pada setiap browser. Hosting fail sahaja tidak menjadikannya pangkalan data bersama. Semua orang yang boleh membuka aplikasi boleh menukar peranan simulasi. Login sebenar, peranan berasaskan akaun dan pangkalan data berkongsi ialah kerja berasingan sebelum penggunaan operasi sebenar.

Rujukan rasmi:
- https://www.hostinger.com/support/how-to-migrate-an-internal-website-manually-at-hostinger/
- https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/
