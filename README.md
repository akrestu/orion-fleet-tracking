# ORION — Mine Operations Intelligence

ORION adalah sistem Fleet Management berbasis LoRaWAN GPS tracker untuk memantau armada hauler di operasional tambang batubara secara real-time.

## Fitur Utama

- **Live Tracking** — pemantauan posisi armada hauler secara real-time di peta (Leaflet).
- **Realtime Update** — data device dipush via WebSocket (Laravel Reverb), tanpa perlu refresh halaman.
- **Integrasi LoRaWAN** — menerima data uplink device langsung dari ChirpStack v4 melalui MQTT broker.
- **Geofence & Alert** — deteksi pelanggaran area kerja serta ambang batas sensor (kecepatan, dsb).
- **Manajemen Device & Grup** — pengelolaan device, grup device, dan riwayat lokasi (GPS log).
- **Audit Log** — pencatatan aktivitas pengguna pada sistem.
- **Dashboard Admin** — panel pengaturan sistem dan API token untuk integrasi eksternal.

## Tech Stack

| Layer       | Teknologi |
|-------------|-----------|
| Backend     | Laravel 13 (PHP 8.4) |
| Frontend    | React 19 + Inertia.js v3 + TypeScript |
| Styling     | Tailwind CSS v4 |
| Database    | MySQL 8.0 |
| Realtime    | Laravel Reverb (WebSocket) |
| Queue       | Laravel Queue (database driver) |
| MQTT Client | php-mqtt/laravel-client (subscribe ChirpStack broker) |
| Map         | Leaflet.js + react-leaflet |
| Charts      | Recharts |
| Process     | Supervisor (VPS Ubuntu) |

## Arsitektur Singkat

Data lokasi & sensor armada hauler dikirim oleh device LoRaWAN ke **ChirpStack v4 Network Server**, yang kemudian mempublikasikan payload uplink via **MQTT**. ORION berlangganan topik MQTT tersebut, memproses payload, menyimpannya ke database, lalu mendorong update real-time ke dashboard melalui **Laravel Reverb**.

## Instalasi

### Prasyarat

- PHP 8.4
- Composer
- Node.js & npm/pnpm
- MySQL 8.0
- Akses broker MQTT (ChirpStack)

### Langkah

```bash
# clone repository
git clone <repo-url> orion
cd orion

# install dependency
composer install
npm install

# konfigurasi environment
cp .env.example .env
php artisan key:generate
# sesuaikan kredensial database & MQTT broker di .env

# migrasi database
php artisan migrate --seed

# build frontend
npm run build
```

### Menjalankan Aplikasi (Development)

```bash
composer run dev
```

Perintah di atas menjalankan server Laravel, queue worker, Reverb, dan Vite secara bersamaan.

## Testing

```bash
php artisan test --compact
```

## Code Style

```bash
vendor/bin/pint --format agent
npm run lint
npm run format
```

## Lisensi

Lihat berkas [LICENSE](LICENSE).
