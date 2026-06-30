# Panduan Upload Peta Kustom — Fleet Map

Dokumen ini ditujukan untuk Tim Engineering yang ingin mengupload citra peta area tambang ke sistem Fleet Map.

---

## Konsep Dasar: Tile Map

Peta digital bekerja dengan cara memotong citra menjadi ribuan gambar kecil berukuran **256×256 piksel** (disebut **tile**). Setiap tile diberi nama berdasarkan 3 angka:

```
{z} = zoom level  → semakin besar = semakin detail
{x} = kolom
{y} = baris
```

Contoh: file `14/1234/5678.png` adalah tile pada zoom 14, kolom 1234, baris 5678.

---

## Persyaratan File Citra

| Hal | Keterangan |
|---|---|
| Format input | GeoTIFF (`.tif`), JPEG 2000, atau PNG georeferenced |
| Sistem koordinat | WGS 84 (EPSG:4326) atau Web Mercator (EPSG:3857) |
| Area minimal | Area operasional tambang + buffer 500m di setiap sisi |
| Resolusi | Minimal 0.5 m/piksel untuk zoom level 18 yang detail |
| Format output (tile) | PNG |
| Format upload | ZIP berisi struktur folder `{z}/{x}/{y}.png` |
| Ukuran ZIP maks | 500 MB |

---

## Struktur ZIP yang Dibutuhkan

ZIP harus berisi folder-folder dengan nama angka (zoom level), lalu di dalamnya kolom, lalu file PNG:

```
peta-tambang-q2-2025.zip
├── 12/
│   ├── 3201/
│   │   ├── 2048.png
│   │   └── 2049.png
│   └── 3202/
│       └── 2048.png
├── 13/
│   ├── 6402/
│   │   ├── 4096.png
│   │   └── 4097.png
│   └── 6403/
│       └── 4096.png
└── 14/
    ├── 12804/
    │   └── 8192.png
    └── ...
```

> **Penting:** Jangan bungkus dalam subfolder tambahan. Folder `12/`, `13/`, dst. harus langsung berada di root ZIP.

---

## Cara Membuat Tile dari Citra (3 Opsi)

### Opsi A — QGIS (Gratis, Direkomendasikan)

1. Download dan install **QGIS**: https://qgis.org
2. Buka QGIS → drag & drop file GeoTIFF ke canvas
3. Pastikan proyeksi sudah benar (lihat pojok kanan bawah, harus EPSG:4326 atau EPSG:3857)
4. Menu **Processing** → **Toolbox** → cari **"Generate XYZ tiles (Directory)"**
5. Isi parameter:
   - **Input Layer**: pilih file citra
   - **Zoom minimum**: `12`
   - **Zoom maximum**: `18` (sesuaikan kebutuhan — semakin tinggi semakin besar file)
   - **Output directory**: pilih folder kosong
   - **Tile format**: PNG
6. Klik **Run** → tunggu proses selesai
7. ZIP seluruh isi folder output (bukan foldernya, tapi isinya)
8. Upload ke Fleet Map

---

### Opsi B — gdal2tiles (Command Line)

Jika sudah familiar dengan terminal:

```bash
# Install GDAL terlebih dahulu
# Ubuntu/Debian:
sudo apt install gdal-bin python3-gdal

# macOS:
brew install gdal

# Jalankan konversi
gdal2tiles.py \
  --zoom=12-18 \
  --processes=4 \
  --webviewer=none \
  input-citra.tif \
  output-tiles/

# ZIP hasilnya
cd output-tiles
zip -r ../peta-tambang-q2-2025.zip .
```

---

### Opsi C — MapTiler (GUI, Lebih Mudah)

1. Download **MapTiler Desktop**: https://www.maptiler.com/desktop/
2. Buka aplikasi → **New Project** → **Raster Tiles**
3. Import file citra
4. Pilih zoom level (12–18)
5. Export → pilih format **"Tiles folder"**
6. ZIP hasilnya dan upload

> MapTiler versi gratis mendukung ekspor hingga zoom 14. Untuk zoom lebih tinggi perlu lisensi berbayar.

---

## Rekomendasi Zoom Level

| Zoom | Skala | Kegunaan | Ukuran file (perkiraan) |
|---|---|---|---|
| 12 | 1:150.000 | Overview keseluruhan site | Kecil |
| 14 | 1:35.000 | Navigasi area | Sedang |
| 16 | 1:9.000 | Monitoring jalur hauler | Besar |
| 18 | 1:2.000 | Inspeksi detail | Sangat besar |

**Saran**: Mulai dengan zoom **12–16** dulu. Jika butuh detail lebih, tambah zoom 17–18 (tapi file akan jauh lebih besar).

---

## Cara Upload ke Sistem

1. Buka **Fleet Map** di aplikasi
2. Klik tombol **"Peta Kustom"** di pojok kiri bawah peta
3. Isi **Nama Peta** (contoh: `Site Tambang Q2 2025`)
4. Pilih file ZIP
5. Klik **Upload Peta**
6. Setelah selesai, peta akan muncul di daftar layer (pojok kanan atas peta)

---

## Checklist Sebelum Upload

- [ ] File citra sudah dalam sistem koordinat WGS 84 atau Web Mercator
- [ ] Proses konversi tile sudah selesai tanpa error
- [ ] Struktur ZIP sudah benar: folder `12/`, `13/`, dst. langsung di root ZIP (bukan di dalam subfolder)
- [ ] Ukuran ZIP tidak melebihi 500 MB
- [ ] Nama peta sudah disiapkan (gunakan nama yang deskriptif + tanggal/periode)

---

## Troubleshooting

**Peta tidak muncul setelah upload**
- Pastikan ada tile untuk zoom level di sekitar koordinat tambang
- Cek apakah proyeksi citra sudah WGS 84 — jika tidak, konversi dulu dengan QGIS: *Raster → Projections → Warp (Reproject)*

**Peta terlihat hitam atau kosong**
- Kemungkinan alpha channel (transparansi) bermasalah. Di QGIS, sebelum export: klik kanan layer → Properties → Transparency → set "No data value" ke `0`

**File ZIP terlalu besar**
- Kurangi zoom maksimum (misal dari 18 ke 16)
- Atau potong area citra lebih ketat hanya ke area operasional

**Tile terpotong / tidak rata**
- Pastikan buffer area citra cukup. Tambah minimal 1 km di setiap sisi area operasional sebelum konversi

---

*Pertanyaan lebih lanjut hubungi tim pengembang sistem.*
