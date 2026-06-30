<?php

namespace App\Services;

use App\Events\ChirpstackUplinkReceived;
use App\Jobs\CheckGeofences;
use App\Models\Device;
use App\Models\GpsLog;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GpsIngestionService
{
    /**
     * Simpan data GPS dari payload yang sudah diparsing.
     *
     * @param  array<string, mixed>  $parsedData  Output dari MqttPayloadParser::parse()
     */
    public function ingest(array $parsedData): GpsLog
    {
        // Wrap upsert + log creation in a transaction so they succeed or fail together.
        [$device, $gpsLog] = DB::transaction(function () use ($parsedData) {
            $device = $this->upsertDevice($parsedData);

            // Use firstOrCreate to silently discard MQTT re-deliveries with the same
            // (dev_eui, recorded_at) — identical timestamp = same physical uplink.
            $gpsLog = GpsLog::firstOrCreate(
                [
                    'dev_eui' => $parsedData['dev_eui'],
                    'recorded_at' => $parsedData['recorded_at'],
                ],
                [
                    'latitude' => $parsedData['latitude'],
                    'longitude' => $parsedData['longitude'],
                    'speed_kmh' => $parsedData['speed_kmh'],
                    'heading_deg' => $parsedData['heading_deg'],
                    'hdop' => $parsedData['hdop'],
                    'satellites' => $parsedData['satellites'],
                    'rssi' => $parsedData['rssi'],
                    'snr' => $parsedData['snr'],
                    'gateway_id' => $parsedData['gateway_id'],
                    'raw_payload' => $parsedData['raw_payload'],
                    'created_at' => now(),
                ]
            );

            return [$device, $gpsLog];
        });

        // Duplicate re-delivery: device upsert still runs (last_seen_at updated),
        // but skip broadcast and geofence — the uplink was already processed.
        if (! $gpsLog->wasRecentlyCreated) {
            return $gpsLog;
        }

        // Side-effects outside the transaction: broadcast and geofence checks are
        // best-effort — a failure here should NOT roll back the persisted GPS log.
        event(new ChirpstackUplinkReceived($gpsLog, $device));

        CheckGeofences::dispatch($gpsLog);

        Log::info(sprintf(
            '[MQTT] Ingested: %s [%s] @ %.6f,%.6f %.1fkm/h',
            $parsedData['device_name'],
            $parsedData['dev_eui'],
            $parsedData['latitude'],
            $parsedData['longitude'],
            $parsedData['speed_kmh'],
        ));

        return $gpsLog;
    }

    /**
     * Buat atau update device di tabel devices berdasarkan data payload.
     */
    private function upsertDevice(array $parsedData): Device
    {
        // Atomic upsert to avoid race conditions under burst ingestion.
        DB::table('devices')->upsert(
            [
                'dev_eui' => $parsedData['dev_eui'],
                'application_id' => $parsedData['application_id'],
                'device_name' => $parsedData['device_name'],
                'last_seen_at' => now(),
            ],
            uniqueBy: ['dev_eui'],
            // On duplicate: update name/app_id/last_seen_at but preserve manually-set fields.
            update: ['application_id', 'device_name', 'last_seen_at'],
        );

        return Device::where('dev_eui', $parsedData['dev_eui'])->firstOrFail();
    }
}
