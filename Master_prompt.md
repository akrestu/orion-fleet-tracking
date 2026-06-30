# 🔭 ORION — Mine Operations Intelligence
# Fleet Management & Mine Operations Intelligence
# Kumpulan Prompt untuk Claude (Phase 1)

---

## 📌 CARA PAKAI

1. Mulai setiap sesi baru dengan paste **MASTER CONTEXT** terlebih dahulu
2. Lanjutkan dengan **Sub-Prompt** sesuai urutan task
3. Setiap sub-prompt berdiri sendiri, tapi selalu didahului Master Context

---

---

# ═══════════════════════════════════════════
# 🧠 MASTER CONTEXT — PASTE INI DI SETIAP SESI BARU
# ═══════════════════════════════════════════

```
Kamu adalah senior full-stack developer yang membantu saya membangun
aplikasi web bernama "ORION" (Mine Operations Intelligence) — sistem
Fleet Management berbasis LoRaWAN GPS tracker untuk armada hauler tambang batubara.

## IDENTITAS BRAND
- Nama Produk   : ORION
- Tagline       : Mine Operations Intelligence
- Visual Style  : Tech & modern — clean, futuristik, minimal, dark theme
- Warna Primer  : #38bdf8 (Sky Blue)
- Warna Aksen   : #f59e0b (Amber / Safety Yellow)
- Warna Sukses  : #22c55e (Green — status online)
- Warna Bahaya  : #ef4444 (Red — alert/offline)
- Background    : #060b14 (Near-black navy)
- Surface       : #0d1623 (Dark card/panel)
- Border        : #1e293b (Subtle divider)
- Tipografi UI  : system-ui / Inter (body & UI)
- Tipografi Data: 'Courier New', monospace (kode, EUI, nilai sensor)
- Tailwind mode : Dark mode default (class="dark" di root)

## TECH STACK (TIDAK BOLEH DIGANTI)
- Backend  : Laravel 12 (fresh install, React starter kit via Breeze)
- Frontend : React + Inertia.js + TypeScript
- Styling  : Tailwind CSS
- Database : MySQL 8.0
- Realtime : Laravel Reverb (WebSocket)
- Queue    : Laravel Queue (database driver)
- MQTT     : php-mqtt/client (subscribe ChirpStack broker)
- Map      : Leaflet.js + react-leaflet
- Charts   : Recharts
- Process  : Supervisor (di VPS Ubuntu)

## KONTEKS SISTEM
Sumber data adalah ChirpStack v4 LoRaWAN Network Server yang sudah
berjalan di VPS. Data device dikirim via MQTT dengan format payload
seperti berikut (contoh 1 uplink nyata dari device):

```json
{
  "deduplicationId": "4a3322cd-b4b9-4e77-8bce-a6c396448935",
  "time": "2026-06-27T03:47:23.776323479+00:00",
  "deviceInfo": {
    "tenantId": "8fe6a223-6073-4f51-8428-9691f69dd482",
    "tenantName": "ChirpStack",
    "applicationId": "7791e609-dbc6-4c9e-abc9-43e1c6c163d3",
    "applicationName": "Genesis-Eagle-Eye",
    "deviceProfileId": "c4a4fe03-0aac-4369-b4d8-814a89fcca17",
    "deviceProfileName": "Genesis25",
    "deviceName": "2026_Hauler_0001",
    "devEui": "9956efb31332a835",
    "deviceClassEnabled": "CLASS_A",
    "tags": {}
  },
  "devAddr": "011e2479",
  "adr": false,
  "dr": 5,
  "fCnt": 169,
  "fPort": 1,
  "confirmed": false,
  "data": "/8ZVaQYuBZ4ABQGrJg==",
  "object": {
    "speed_kmh": 0,
    "location": { "longitude": 103.67939, "latitude": -3.779223 },
    "latitude": -3.779223,
    "unit_id": 1,
    "satellites": 38,
    "hdop": 0.5,
    "longitude": 103.67939,
    "heading_deg": 342
  },
  "rxInfo": [{
    "gatewayId": "2cf7f11375000072",
    "uplinkId": 6675,
    "nsTime": "2026-06-27T03:47:23.569273679+00:00",
    "rssi": -55,
    "snr": 12.8,
    "location": {},
    "context": "IFS3OA==",
    "crcStatus": "CRC_OK"
  }],
  "txInfo": {
    "frequency": 923200000,
    "modulation": {
      "lora": {
        "bandwidth": 125000,
        "spreadingFactor": 7,
        "codeRate": "CR_4_5"
      }
    }
  },
  "regionConfigId": "as923"
}
```

MQTT topic pattern dari ChirpStack:
application/{applicationId}/device/{devEui}/event/up

## FIELD PENTING DARI PAYLOAD
Field yang wajib disimpan dari object.* dan metadata:
- devEui          → identitas device
- deviceName      → nama unit (ex: "2026_Hauler_0001")
- applicationId   → ID aplikasi ChirpStack
- time            → timestamp UTC dari ChirpStack
- object.latitude / object.longitude → koordinat GPS
- object.speed_kmh → kecepatan dalam km/h
- object.heading_deg → arah hadap (0–360 derajat)
- object.hdop     → akurasi GPS (semakin kecil semakin akurat)
- object.satellites → jumlah satelit terkunci
- rxInfo[0].rssi  → kekuatan sinyal gateway (dBm)
- rxInfo[0].snr   → signal-to-noise ratio (dB)
- rxInfo[0].gatewayId → ID gateway penerima

## ATURAN CODING
1. Semua code harus lengkap dan siap pakai (no placeholder, no "// TODO")
2. Gunakan PHP 8.2+ features (readonly, match, enum, named args)
3. Gunakan TypeScript untuk semua file React (.tsx)
4. Ikuti konvensi Laravel: Form Request, Resource, Service class
5. Setiap migration harus punya down() yang proper
6. Tambahkan komentar singkat pada logika yang tidak obvious
7. Error handling wajib ada di semua operasi MQTT dan DB
8. Jangan ubah file yang tidak diminta

## ATURAN BRANDING & UI
9. Selalu gunakan dark theme — background #060b14, surface #0d1623
10. Warna primary SELALU #38bdf8 (sky blue), JANGAN ganti ke warna lain
11. Accent/warning gunakan #f59e0b (amber), bukan kuning lain
12. Nama produk di UI ditulis "ORION" (kapital semua) dengan font monospace
13. Tagline: "Mine Operations Intelligence" — tulis persis seperti ini
14. Semua label data teknis (DEV EUI, RSSI, SNR, dll) gunakan font monospace
15. Status online = dot hijau #22c55e dengan glow effect
16. Status offline = dot abu #475569 tanpa glow
17. Tailwind: gunakan bg-[#060b14], text-sky-400, amber-500 — jangan slate default

## FASE DEVELOPMENT SAAT INI
Phase 1 — Core MVP:
✅ Task 1: Database Migration
✅ Task 2: Model & Relationship
⬜ Task 3: MQTT Subscriber Command
⬜ Task 4: Broadcasting Event (Reverb)
⬜ Task 5: API Endpoint (last position + history)
⬜ Task 6: React Real-time Map (Leaflet)
⬜ Task 7: Supervisor Config

Saat ini kami sedang mengerjakan Task: [GANTI DENGAN NOMOR TASK AKTIF]
```

---

---

# ═══════════════════════════════════════════
# 📋 SUB-PROMPT 1 — DATABASE MIGRATION & MODELS
# ═══════════════════════════════════════════

> **Cara pakai:** Paste Master Context dulu, lalu paste sub-prompt ini.

```
[MASTER CONTEXT DI ATAS SUDAH DI-PASTE]

Sekarang kerjakan Task 1 & 2: Database Migration dan Models.

## YANG PERLU DIBUAT

### Migrations (urut sesuai dependency):

**1. create_devices_table**
Kolom:
- id (bigint, PK)
- dev_eui (varchar 16, unique) → identifier utama dari LoRaWAN
- application_id (varchar 36) → UUID dari ChirpStack
- device_name (varchar 100) → nama unit, ex: "2026_Hauler_0001"
- unit_type (enum: 'hauler','dozer','excavator','grader','other') default 'hauler'
- is_active (boolean, default true)
- last_seen_at (timestamp, nullable) → diupdate setiap ada uplink
- timestamps

**2. create_gps_logs_table**
Ini tabel utama, akan sangat banyak row (jutaan).
Kolom:
- id (bigint, PK)
- dev_eui (varchar 16, FK ke devices.dev_eui, index)
- latitude (decimal 10,7)
- longitude (decimal 10,7)
- speed_kmh (decimal 5,2, default 0)
- heading_deg (smallint, nullable) → 0–360
- hdop (decimal 4,2, nullable) → GPS accuracy
- satellites (tinyint unsigned, nullable)
- rssi (smallint, nullable) → sinyal dBm
- snr (decimal 5,2, nullable)
- gateway_id (varchar 16, nullable)
- raw_payload (json, nullable) → simpan full payload untuk debugging
- recorded_at (timestamp) → dari field "time" payload ChirpStack, INI BUKAN created_at
- created_at (timestamp) → waktu data masuk ke sistem kita

Index yang wajib ada:
- INDEX pada (dev_eui, recorded_at) → untuk query history per device
- INDEX pada recorded_at → untuk query data terbaru semua device

**3. create_alerts_table** (siapkan untuk Phase 2, tapi buat sekarang)
Kolom:
- id (bigint, PK)
- dev_eui (varchar 16, FK)
- alert_type (enum: 'overspeed','geofence','offline','low_signal')
- triggered_at (timestamp)
- resolved_at (timestamp, nullable)
- meta (json, nullable) → data tambahan, ex: {speed: 85, limit: 60}
- timestamps

### Models:

**Device model:**
- Fillable yang sesuai
- Relationship: hasMany GpsLog
- Relationship: hasMany Alert
- Accessor: getStatusAttribute() → 'online' jika last_seen_at < 10 menit, else 'offline'
- Scope: scopeActive($query)

**GpsLog model:**
- Fillable yang sesuai
- Relationship: belongsTo Device (via dev_eui, bukan id)
- Cast: raw_payload → array, recorded_at → datetime
- Scope: scopeRecent($query, $minutes = 60)
- Scope: scopeForDevice($query, $devEui)

**Alert model:**
- Fillable yang sesuai
- Relationship: belongsTo Device
- Scope: scopeUnresolved($query)

### Seeder:
Buat DeviceSeeder dengan minimal 3 device contoh:
- dev_eui: "9956efb31332a835", device_name: "2026_Hauler_0001"
- dev_eui: "aabbccddeeff0011", device_name: "2026_Hauler_0002"  
- dev_eui: "1122334455667788", device_name: "2026_Dozer_0001", unit_type: dozer

## OUTPUT YANG DIHARAPKAN
Berikan semua file lengkap dengan path:
- database/migrations/xxxx_create_devices_table.php
- database/migrations/xxxx_create_gps_logs_table.php
- database/migrations/xxxx_create_alerts_table.php
- app/Models/Device.php
- app/Models/GpsLog.php
- app/Models/Alert.php
- database/seeders/DeviceSeeder.php
- database/seeders/DatabaseSeeder.php (update untuk call DeviceSeeder)
```

---

---

# ═══════════════════════════════════════════
# 📋 SUB-PROMPT 2 — MQTT SUBSCRIBER COMMAND
# ═══════════════════════════════════════════

> **Cara pakai:** Paste Master Context, lalu paste sub-prompt ini.
> **Prasyarat:** Task 1 & 2 sudah selesai.

```
[MASTER CONTEXT DI ATAS SUDAH DI-PASTE]

Sekarang kerjakan Task 3: MQTT Subscriber Artisan Command.

## YANG PERLU DIBUAT

### 1. Install package
Jelaskan command instalasi:
composer require php-mqtt/client

### 2. Konfigurasi .env
Tambahkan variabel baru (berikan contoh nilai):
MQTT_HOST=127.0.0.1
MQTT_PORT=1883
MQTT_CLIENT_ID=orion-subscriber
MQTT_USERNAME=
MQTT_PASSWORD=
CHIRPSTACK_APP_ID=7791e609-dbc6-4c9e-abc9-43e1c6c163d3

### 3. Config file: config/mqtt.php
Buat config file yang membaca dari .env di atas.

### 4. Service class: app/Services/MqttPayloadParser.php
Bertanggung jawab mem-parse raw JSON payload dari ChirpStack.
Method:
- parse(string $rawJson): ?array
  → Validasi field wajib ada (object.latitude, object.longitude, devEui, time)
  → Return array yang sudah dinormalisasi siap insert ke gps_logs
  → Return null jika payload tidak valid, log warning
- isValidCoordinate(float $lat, float $lng): bool
  → Lat harus antara -90 dan 90
  → Lng harus antara -180 dan 180
  → Keduanya tidak boleh 0,0 (artinya GPS belum fix)

### 5. Service class: app/Services/GpsIngestionService.php
Bertanggung jawab menyimpan data dan trigger broadcast.
Method:
- ingest(array $parsedData): GpsLog
  → Upsert device di tabel devices (buat jika belum ada)
  → Update device.last_seen_at
  → Insert ke gps_logs
  → Dispatch event ChirpstackUplinkReceived (untuk Reverb — akan dibuat Task 4)
  → Return GpsLog yang baru dibuat

### 6. Artisan Command: app/Console/Commands/MqttSubscribeCommand.php
Nama command: mqtt:subscribe
Deskripsi: Subscribe to ChirpStack MQTT broker and ingest GPS data

Behavior:
- Koneksi ke MQTT broker menggunakan config dari config/mqtt.php
- Subscribe ke topic: application/{CHIRPSTACK_APP_ID}/device/+/event/up
- Loop terus-menerus (infinite loop dengan reconnect jika disconnect)
- Setiap pesan masuk → panggil MqttPayloadParser → GpsIngestionService
- Log setiap uplink yang berhasil: "Ingested: {deviceName} [{devEui}] @ {lat},{lng} {speed}km/h"
- Log error tapi JANGAN crash/exit jika 1 pesan gagal parse
- Handle SIGTERM dengan graceful shutdown (hentikan loop, disconnect MQTT)
- Tampilkan info koneksi saat start: host, port, topic

## PENTING
- Jangan dispatch job ke queue untuk ingest — lakukan synchronous langsung
  di dalam callback MQTT agar latency rendah
- Jika device belum ada di tabel devices → auto-create dengan data minimal
  dari payload (dev_eui, device_name, application_id)
- Bungkus setiap ingest dalam try-catch, jika gagal log error dan lanjut
  ke pesan berikutnya

## OUTPUT YANG DIHARAPKAN
- config/mqtt.php
- app/Services/MqttPayloadParser.php
- app/Services/GpsIngestionService.php
- app/Console/Commands/MqttSubscribeCommand.php
- Snippet tambahan untuk .env.example
```

---

---

# ═══════════════════════════════════════════
# 📋 SUB-PROMPT 3 — BROADCASTING EVENT (REVERB)
# ═══════════════════════════════════════════

> **Cara pakai:** Paste Master Context, lalu paste sub-prompt ini.
> **Prasyarat:** Task 1, 2, 3 sudah selesai.

```
[MASTER CONTEXT DI ATAS SUDAH DI-PASTE]

Sekarang kerjakan Task 4: Broadcasting Event via Laravel Reverb.

## YANG PERLU DIBUAT

### 1. Setup Reverb
Jelaskan command:
php artisan install:broadcasting
(pilih Reverb saat ditanya)

Tambahkan ke .env:
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=orion
REVERB_APP_KEY=orion-key
REVERB_APP_SECRET=orion-secret-ganti-ini
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=http

### 2. Event: app/Events/ChirpstackUplinkReceived.php
Implements: ShouldBroadcast
Channel: public channel bernama "fleet-tracking"
Event name saat broadcast: "device.position.updated"

Data yang di-broadcast (harus ringkas, hanya yang dibutuhkan map):
```json
{
  "dev_eui": "9956efb31332a835",
  "device_name": "2026_Hauler_0001",
  "unit_type": "hauler",
  "latitude": -3.779223,
  "longitude": 103.67939,
  "speed_kmh": 0,
  "heading_deg": 342,
  "hdop": 0.5,
  "rssi": -55,
  "recorded_at": "2026-06-27T03:47:23.000000Z"
}
```

Constructor menerima GpsLog $gpsLog dan Device $device.

### 3. Update GpsIngestionService
Tambahkan dispatch event ChirpstackUplinkReceived setelah insert GpsLog.
(Update file yang sudah dibuat di Task 3)

### 4. React Hook: resources/js/hooks/useFleetTracking.ts
Custom hook untuk subscribe ke Reverb dari sisi frontend.
- Subscribe ke channel "fleet-tracking"
- Listen event "device.position.updated"
- Maintain state: Map<string, DevicePosition> (key = dev_eui)
- Update posisi device saat event masuk
- Return { positions, isConnected, lastUpdated }

Type DevicePosition:
```typescript
interface DevicePosition {
  dev_eui: string;
  device_name: string;
  unit_type: 'hauler' | 'dozer' | 'excavator' | 'grader' | 'other';
  latitude: number;
  longitude: number;
  speed_kmh: number;
  heading_deg: number;
  hdop: number;
  rssi: number;
  recorded_at: string;
}
```

### 5. Install Laravel Echo di frontend
Berikan command dan konfigurasi bootstrap/echo.ts

## OUTPUT YANG DIHARAPKAN
- app/Events/ChirpstackUplinkReceived.php
- app/Services/GpsIngestionService.php (updated)
- resources/js/hooks/useFleetTracking.ts
- resources/js/bootstrap.ts atau echo.ts (konfigurasi Echo + Reverb)
- Snippet .env.example untuk Reverb
```

---

---

# ═══════════════════════════════════════════
# 📋 SUB-PROMPT 4 — API ENDPOINTS
# ═══════════════════════════════════════════

> **Cara pakai:** Paste Master Context, lalu paste sub-prompt ini.
> **Prasyarat:** Task 1–4 sudah selesai.

```
[MASTER CONTEXT DI ATAS SUDAH DI-PASTE]

Sekarang kerjakan Task 5: API Endpoints untuk data map.

## YANG PERLU DIBUAT

### Endpoint 1: GET /api/fleet/positions
Kembalikan posisi TERAKHIR semua device yang aktif.
Digunakan saat halaman map pertama kali load (initial state sebelum Reverb connect).

Response:
```json
{
  "data": [
    {
      "dev_eui": "9956efb31332a835",
      "device_name": "2026_Hauler_0001",
      "unit_type": "hauler",
      "status": "online",
      "latitude": -3.779223,
      "longitude": 103.67939,
      "speed_kmh": 0,
      "heading_deg": 342,
      "hdop": 0.5,
      "rssi": -55,
      "last_seen_at": "2026-06-27T03:47:23.000000Z",
      "recorded_at": "2026-06-27T03:47:23.000000Z"
    }
  ],
  "meta": {
    "total_devices": 3,
    "online": 2,
    "offline": 1,
    "generated_at": "2026-06-27T04:00:00.000000Z"
  }
}
```

Query logic:
- Ambil semua devices where is_active = true
- Untuk setiap device, ambil 1 gps_log terbaru (by recorded_at)
- Sertakan status online/offline (online = last_seen_at < 10 menit yang lalu)

### Endpoint 2: GET /api/fleet/devices/{devEui}/history
Route parameter: devEui
Query parameters:
- from (datetime, default: 8 jam lalu)
- to (datetime, default: sekarang)
- limit (integer, default: 500, max: 2000)

Response:
```json
{
  "data": {
    "device": {
      "dev_eui": "9956efb31332a835",
      "device_name": "2026_Hauler_0001",
      "unit_type": "hauler"
    },
    "track": [
      {
        "latitude": -3.779223,
        "longitude": 103.67939,
        "speed_kmh": 0,
        "heading_deg": 342,
        "recorded_at": "2026-06-27T03:47:23.000000Z"
      }
    ],
    "summary": {
      "total_points": 248,
      "from": "2026-06-26T20:00:00.000000Z",
      "to": "2026-06-27T04:00:00.000000Z",
      "max_speed_kmh": 42.5,
      "avg_speed_kmh": 18.3
    }
  }
}
```

### Endpoint 3: GET /api/fleet/devices
List semua device (untuk dropdown/filter di UI).
Response sederhana: id, dev_eui, device_name, unit_type, status, last_seen_at

### File yang perlu dibuat:
- app/Http/Controllers/Api/FleetController.php
- app/Http/Resources/DevicePositionResource.php
- app/Http/Resources/GpsLogResource.php
- routes/api.php (update, tambahkan route group /fleet)

### Catatan penting:
- Gunakan Eloquent query yang efisien, hindari N+1
- Validasi query parameter from/to dengan FormRequest
- Semua response harus JSON dengan struktur konsisten
- Tidak perlu auth middleware untuk Phase 1 (tambahkan nanti)
```

---

---

# ═══════════════════════════════════════════
# 📋 SUB-PROMPT 5 — REACT REAL-TIME MAP
# ═══════════════════════════════════════════

> **Cara pakai:** Paste Master Context, lalu paste sub-prompt ini.
> **Prasyarat:** Task 1–5 sudah selesai.

```
[MASTER CONTEXT DI ATAS SUDAH DI-PASTE]

Sekarang kerjakan Task 6: Halaman React Real-time Fleet Map.

## YANG PERLU DIBUAT

### 1. Install dependencies
Berikan command:
npm install react-leaflet leaflet
npm install -D @types/leaflet

### 2. Halaman Inertia: resources/js/Pages/Fleet/Map.tsx
Ini adalah halaman utama dashboard, tampilkan:

**Layout:**
- Sidebar kiri (lebar 280px): daftar semua unit dengan status indicator
- Area kanan: peta full-height

**Sidebar berisi (per unit):**
- Nama unit (device_name)
- Badge status: hijau "Online" / merah "Offline"
- Kecepatan saat ini (km/h)
- Sinyal RSSI (dBm)
- Waktu update terakhir (format: "2 menit lalu")
- Klik unit → map pan ke posisi unit tersebut

**Peta (Leaflet):**
- Base tile: OpenStreetMap (gratis, tidak perlu API key)
- Marker tiap unit dengan icon custom berbeda per unit_type:
  - hauler: warna kuning
  - dozer: warna oranye
  - excavator: warna merah
  - lainnya: warna abu-abu
- Marker menampilkan tooltip saat hover: nama unit + kecepatan
- Popup saat klik marker: semua info lengkap (nama, speed, heading, hdop, rssi, waktu)
- Marker bergerak smooth saat posisi update (animasi transisi)
- Indikator heading: marker rotate sesuai heading_deg
- Koneksi status Reverb: badge kecil di pojok peta ("🟢 Live" / "🔴 Reconnecting")

**Perilaku:**
- Saat pertama load → fetch GET /api/fleet/positions → render semua marker
- Setelah itu → update realtime via useFleetTracking hook (Reverb)
- Jika device offline > 10 menit → marker berubah menjadi semi-transparan (opacity 0.4)

### 3. Komponen: resources/js/Components/Fleet/DeviceMarker.tsx
Komponen Leaflet marker custom per device.
Props: DevicePosition, isSelected, onClick

### 4. Komponen: resources/js/Components/Fleet/DeviceSidebarItem.tsx
Props: DevicePosition, isSelected, onClick

### 5. Komponen: resources/js/Components/Fleet/ConnectionBadge.tsx
Tampilkan status koneksi Reverb WebSocket.
Props: isConnected: boolean, lastUpdated: Date | null

### 6. Tambahkan route di Laravel:
- GET /fleet/map → render Inertia page Fleet/Map
- Tambahkan ke routes/web.php

### DESAIN UI — WAJIB IKUTI BRANDING ORION
- Dark theme wajib — bg utama: #060b14, panel/card: #0d1623, border: #1e293b
- Primary/interactive: #38bdf8 (sky blue) — tombol, link aktif, highlight
- Accent: #f59e0b (amber) — badge speed, warning, warna marker hauler
- Navbar: tampilkan logo "ORION" font monospace + tagline "Mine Operations Intelligence"
- Sidebar unit list: bg #080f1a, item aktif bg #0f2035 dengan left-border #38bdf8
- Status online: dot #22c55e dengan CSS box-shadow glow
- Status offline: dot #475569, marker opacity 0.4
- Font UI: system-ui untuk label/body; 'Courier New' monospace untuk nilai sensor
- Peta: tetap terang (OpenStreetMap default) agar kontur tambang terlihat jelas
- Seluruh halaman menggunakan class="dark" di root layout Inertia
- Marker hauler: warna #f59e0b (amber), rotate sesuai heading_deg
- Marker dozer: warna #fb923c (orange)
- Marker excavator: warna #ef4444 (red)
- Marker lain: warna #64748b (slate)

### CATATAN TEKNIS
- Import CSS Leaflet di file yang tepat agar tidak error SSR Inertia
- Leaflet tidak support SSR, gunakan dynamic import atau useEffect
- Gunakan useRef untuk instance map agar tidak re-render berlebihan
- Semua tipe data harus TypeScript (tidak ada 'any')

## OUTPUT YANG DIHARAPKAN
- resources/js/Pages/Fleet/Map.tsx
- resources/js/Components/Fleet/DeviceMarker.tsx
- resources/js/Components/Fleet/DeviceSidebarItem.tsx
- resources/js/Components/Fleet/ConnectionBadge.tsx
- Update routes/web.php
- Snippet import Leaflet CSS (di mana harus ditambahkan)
```

---

---

# ═══════════════════════════════════════════
# 📋 SUB-PROMPT 6 — SUPERVISOR CONFIG & DEPLOYMENT
# ═══════════════════════════════════════════

> **Cara pakai:** Paste Master Context, lalu paste sub-prompt ini.
> **Prasyarat:** Semua Task Phase 1 sudah selesai dan tested di local.

```
[MASTER CONTEXT DI ATAS SUDAH DI-PASTE]

Sekarang kerjakan Task 7: Supervisor config dan deployment checklist.

## YANG PERLU DIBUAT

### 1. File Supervisor: /etc/supervisor/conf.d/orion.conf
Buat konfigurasi untuk 3 program:
a) orion-reverb  → php artisan reverb:start
b) orion-mqtt    → php artisan mqtt:subscribe
c) orion-worker  → php artisan queue:work (2 proses)

Gunakan:
- user=www-data
- autostart=true, autorestart=true
- stdout_logfile ke /var/www/orion/storage/logs/
- stopwaitsecs=30 agar graceful shutdown

### 2. Script deployment: deploy.sh
Bash script untuk update aplikasi di VPS via git pull:
- git pull origin main
- composer install --no-dev --optimize-autoloader
- npm ci && npm run build
- php artisan migrate --force
- php artisan config:cache && php artisan route:cache && php artisan view:cache
- supervisorctl restart orion-mqtt orion-reverb orion-worker:*
- echo status setiap langkah

### 3. Nginx config: /etc/nginx/sites-available/orion
Konfigurasi untuk:
- Laravel PHP-FPM di port 80
- Proxy WebSocket Reverb di path /app dan /apps
- Gzip compression
- Static assets caching

### 4. Checklist deployment lengkap
Buat checklist dalam format markdown, urut dari awal sampai bisa diakses
di browser, mulai dari:
- Clone repo
- Setup .env
- Install dependencies
- Setup database
- Konfigurasi Supervisor
- Konfigurasi Nginx
- Test MQTT connection
- Verifikasi data masuk

## OUTPUT YANG DIHARAPKAN
- /etc/supervisor/conf.d/orion.conf
- deploy.sh
- /etc/nginx/sites-available/orion
- DEPLOYMENT_CHECKLIST.md
```

---

---

## 📊 RINGKASAN PHASE 1 — ORION

| # | Sub-Prompt | Output Utama | Estimasi |
|---|---|---|---|
| 1 | Database Migration & Models | 3 migration, 3 model, 1 seeder | 1 sesi |
| 2 | MQTT Subscriber Command | Parser, Ingestion service, Artisan command | 1 sesi |
| 3 | Broadcasting Event (Reverb) | Event class, React hook, Echo config | 1 sesi |
| 4 | API Endpoints | Controller, Resources, Routes | 1 sesi |
| 5 | React Real-time Map | Halaman map + 3 komponen (branding ORION) | 1–2 sesi |
| 6 | Supervisor & Deployment | Config files + deploy script | 1 sesi |

**Setelah Phase 1 selesai → ORION sudah bisa:**
- Menerima data GPS dari semua hauler via LoRaWAN
- Menampilkan posisi real-time di peta interaktif dengan dark UI branding ORION
- Melihat status online/offline tiap unit
- Dasar yang solid untuk Phase 2 (geofencing, overspeed, route history)
