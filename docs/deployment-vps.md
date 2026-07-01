# Deployment ke VPS Ubuntu

Aplikasi ini punya 3 proses long-running yang wajib jalan terus di production, di luar web server (nginx + PHP-FPM):

1. **Reverb** — websocket server (`php artisan reverb:start`)
2. **MQTT Subscriber** — ingest data GPS dari broker ChirpStack (`php artisan mqtt:subscribe`)
3. **Queue Worker** — proses job antrian (`php artisan queue:work`)

Ketiganya dikelola pakai **Supervisor** supaya otomatis start saat reboot dan auto-restart kalau crash.

## Setup (cukup sekali di server baru)

1. Install Supervisor:

   ```bash
   sudo apt install supervisor
   ```

2. Copy config dari repo ke Supervisor:

   ```bash
   sudo cp /var/www/orion/deploy/supervisor/*.conf /etc/supervisor/conf.d/
   ```

   Sesuaikan path `/var/www/orion` di dalam file `*.conf` (key `command` dan `directory`) kalau lokasi deploy berbeda.

3. Load config dan start service:

   ```bash
   sudo supervisorctl reread
   sudo supervisorctl update
   sudo supervisorctl start all
   ```

File config yang tersedia di [deploy/supervisor/](../deploy/supervisor/):

| File | Proses | Catatan |
|---|---|---|
| `orion-reverb.conf` | `reverb:start --port=8080` | 1 instance |
| `orion-mqtt.conf` | `mqtt:subscribe` | 1 instance (jangan digandakan, single subscriber) |
| `orion-queue.conf` | `queue:work --sleep=3 --tries=3 --max-time=3600` | 2 instance paralel |

## Cek status service

```bash
sudo supervisorctl status
```

Contoh output:

```
orion-reverb                    RUNNING   pid 1234, uptime 2:15:00
orion-mqtt                      RUNNING   pid 1235, uptime 2:15:00
orion-queue:orion-queue_00      RUNNING   pid 1236, uptime 2:15:00
orion-queue:orion-queue_01      RUNNING   pid 1237, uptime 2:15:00
```

Kalau statusnya `FATAL`, `STOPPED`, atau `BACKOFF`, cek log:

```bash
tail -f /var/www/orion/storage/logs/reverb.log
tail -f /var/www/orion/storage/logs/mqtt.log
tail -f /var/www/orion/storage/logs/queue.log
```

## Perintah operasional lain

```bash
sudo supervisorctl restart orion-reverb      # restart 1 service
sudo supervisorctl stop orion-mqtt           # stop 1 service
sudo supervisorctl start orion-mqtt          # start lagi
sudo supervisorctl tail -f orion-mqtt        # live log via supervisorctl
```

## Setelah deploy update kode (git pull, dsb)

Worker queue perlu direstart supaya memakai kode terbaru (worker Laravel meng-cache kode di memori saat start):

```bash
sudo supervisorctl restart orion-queue:*
```

Reverb dan MQTT tidak wajib direstart kecuali ada perubahan yang berkaitan langsung dengan keduanya (mis. perubahan channel broadcasting atau parser MQTT).

## Referensi

- Untuk development lokal, semua proses (server, queue, vite, reverb, mqtt) dijalankan sekaligus lewat satu perintah:

  ```bash
  composer dev
  ```

  Lihat script `dev` di [composer.json](../composer.json).
