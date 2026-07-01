# Tata Letak Geofence untuk Cycle Time yang Akurat

Dokumen ini menjelaskan cara menggambar dan mengonfigurasi geofence di halaman **Admin → Geofences** agar laporan **Cycle Time** (Reports & Export) menghasilkan data yang benar.

## 1. Bagaimana sistem menghitung satu cycle

Setiap titik GPS device dicocokkan terhadap semua geofence aktif (`is_active = true`) memakai algoritma *point-in-polygon* ([GeoHelper::pointInPolygon()](../app/Support/GeoHelper.php)). Titik-titik berurutan yang jatuh di zona yang sama digabung jadi satu *segment*, lalu `ReportService::cycleTimeData()` ([app/Services/ReportService.php](../app/Services/ReportService.php)) membaca urutan segment sebagai state machine:

```
loading  →  (haul)  →  dumping  →  (return)  →  loading  = 1 cycle selesai
```

- **Masuk zona `loading`** → mulai trip baru (mencatat `load_start`/`load_end`). Kalau ada trip yang belum tuntas (belum sempat dumping) lalu unit masuk `loading` lagi, trip lama dibuang dan diganti trip baru — hanya kunjungan `loading` **terakhir** sebelum dumping yang dihitung.
- **Masuk zona `dumping`** (setelah loading, dan baru pertama kali dumping di trip ini) → mencatat `dump_start`/`dump_end` dan `haul_duration_min` (loading → dumping).
- **Masuk zona `loading` lagi setelah dumping** → cycle dianggap selesai. Sistem mencatat `return_duration_min` (dumping → loading) dan `cycle_duration_min` (loading awal → loading berikutnya), lalu langsung mulai trip baru dari titik loading ini.

Zona dengan `zone_type = parking` **tidak** ikut dalam perhitungan cycle — hanya dipakai laporan Delay & Waiting untuk mengecualikan waktu parkir dari "delay".

## 2. Aturan menggambar polygon

### a. Satu polygon per fungsi zona, jangan tumpang tindih
- Setiap area loading/dumping/parking harus jadi **satu polygon terpisah** dengan `zone_type` yang benar.
- **Jangan biarkan polygon saling overlap**, terutama loading vs dumping. Pencocokan zona memakai geofence pertama yang cocok berdasarkan urutan data (bukan yang terkecil), jadi tumpang tindih membuat titik GPS bisa salah diklasifikasikan ke zona yang salah dan cycle jadi tidak terdeteksi atau salah hitung.
- Beri jarak (buffer) antara polygon loading dan dumping — jangan bersinggungan langsung — supaya GPS jitter di tepi zona tidak memicu transisi zona palsu.

### b. Ukuran polygon: cukup besar, tidak berlebihan
- Polygon harus **mencakup seluruh area kerja nyata** unit saat memuat/membongkar (termasuk sedikit ruang gerak unit), bukan hanya satu titik.
- Terlalu kecil → GPS jitter (akurasi GPS ±3–10 m) membuat unit "keluar-masuk" zona berkali-kali walau secara fisik diam di tempat, sehingga segment loading/dumping terpecah-pecah dan bisa membuat cycle tidak lengkap.
- Terlalu besar (misal satu polygon mencakup jalur hauling) → unit dianggap "masih di zona loading" padahal sudah dalam perjalanan, sehingga `haul_duration_min` jadi terlalu pendek atau nol.

### c. Loading dan dumping harus benar-benar terpisah secara fisik
Algoritma **tidak** mensyaratkan device melewati area "di luar semua zona" di antara loading dan dumping — yang penting urutan zona: loading lalu dumping lalu loading lagi. Tapi kalau kedua zona berdekatan/tumpang tindih, cycle time yang terekam akan meleset karena `haul_duration_min` dihitung dari waktu titik GPS terakhir yang masih tercatat "loading" sampai titik pertama "dumping".

### d. Minimal satu zona `loading` dan satu zona `dumping` harus aktif
Kalau tidak ada geofence dengan `zone_type` loading/dumping/parking yang `is_active = true`, laporan Cycle Time akan kosong dengan warning "No loading/dumping/parking zones configured."

## 3. Interval pengiriman GPS device

Deteksi cycle bergantung sepenuhnya pada rekaman `GpsLog` yang tersimpan (tidak ada interpolasi antar titik). Implikasinya:

- Interval kirim GPS device (misal tiap 10–30 detik) menentukan presisi waktu masuk/keluar zona. Interval terlalu jarang (>1 menit) bisa membuat unit "melompat" masuk-langsung-keluar zona kecil tanpa sempat tercatat di dalamnya.
- Pastikan device tetap mengirim data secara konsisten saat berada di area loading/dumping (bukan hanya saat bergerak), karena titik-titik saat diam itulah yang membentuk segment `loading`/`dumping`.

## 4. Checklist sebelum mengandalkan laporan Cycle Time

1. Geofence loading dan dumping sudah digambar sebagai polygon terpisah, tidak overlap, dengan buffer jarak yang wajar.
2. `zone_type` masing-masing sudah diset benar (`loading` / `dumping`, dan `parking` untuk area tunggu jika ada) — lihat [GeofenceFormFields](../resources/js/pages/admin/geofences/index.tsx) di halaman Admin → Geofences.
3. Status `Active` menyala untuk semua zona yang harus ikut dihitung.
4. Ukuran polygon mencakup seluruh area kerja riil unit, tidak terlalu sempit maupun terlalu luas.
5. Uji di lapangan: jalankan satu unit lewat siklus penuh (loading → haul → dumping → return → loading), lalu cek halaman **Reports & Export → Cycle Time** untuk memastikan satu trip tercatat dengan `haul_duration_min` dan `cycle_duration_min` yang masuk akal.
