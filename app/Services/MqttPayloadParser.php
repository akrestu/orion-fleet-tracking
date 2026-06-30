<?php

namespace App\Services;

use Carbon\Carbon;
use Illuminate\Support\Facades\Log;

class MqttPayloadParser
{
    /**
     * Parse dan validasi raw JSON payload dari ChirpStack.
     *
     * @return array<string, mixed>|null Array ternormalisasi siap insert, atau null jika payload invalid.
     */
    public function parse(string $rawJson): ?array
    {
        $payload = json_decode($rawJson, true);

        if (! is_array($payload)) {
            Log::warning('[MQTT] Failed to decode JSON payload', ['raw' => substr($rawJson, 0, 200)]);

            return null;
        }

        $devEui = $payload['deviceInfo']['devEui'] ?? null;
        $deviceName = $payload['deviceInfo']['deviceName'] ?? null;
        $applicationId = $payload['deviceInfo']['applicationId'] ?? null;
        $time = $payload['time'] ?? null;
        $object = $payload['object'] ?? [];
        $rxInfo = $payload['rxInfo'][0] ?? [];

        $lat = $object['latitude'] ?? null;
        $lng = $object['longitude'] ?? null;

        if (! $devEui || ! $deviceName || ! $applicationId || ! $time) {
            Log::warning('[MQTT] Missing required fields in payload', [
                'devEui' => $devEui,
                'deviceName' => $deviceName,
                'time' => $time,
            ]);

            return null;
        }

        if ($lat === null || $lng === null) {
            Log::warning('[MQTT] Missing GPS coordinates', ['devEui' => $devEui]);

            return null;
        }

        if (! $this->isValidCoordinate((float) $lat, (float) $lng)) {
            Log::warning('[MQTT] Invalid GPS coordinates', [
                'devEui' => $devEui,
                'lat' => $lat,
                'lng' => $lng,
            ]);

            return null;
        }

        try {
            $recordedAt = Carbon::parse($time)->utc();
        } catch (\Throwable $e) {
            Log::warning('[MQTT] Invalid time value in payload', ['devEui' => $devEui, 'time' => $time]);

            return null;
        }

        return [
            'dev_eui' => $devEui,
            'device_name' => $deviceName,
            'application_id' => $applicationId,
            'recorded_at' => $recordedAt,
            'latitude' => (float) $lat,
            'longitude' => (float) $lng,
            'speed_kmh' => (float) ($object['speed_kmh'] ?? 0),
            'heading_deg' => isset($object['heading_deg']) ? (int) $object['heading_deg'] : null,
            'hdop' => isset($object['hdop']) ? (float) $object['hdop'] : null,
            'satellites' => isset($object['satellites']) ? (int) $object['satellites'] : null,
            'rssi' => isset($rxInfo['rssi']) ? (int) $rxInfo['rssi'] : null,
            'snr' => isset($rxInfo['snr']) ? (float) $rxInfo['snr'] : null,
            'gateway_id' => $rxInfo['gatewayId'] ?? null,
            'raw_payload' => $payload,
        ];
    }

    /**
     * Validasi koordinat GPS.
     * Menolak (0, 0) karena menandakan GPS belum fix.
     */
    public function isValidCoordinate(float $lat, float $lng): bool
    {
        if ($lat < -90 || $lat > 90) {
            return false;
        }

        if ($lng < -180 || $lng > 180) {
            return false;
        }

        // Koordinat (0, 0) artinya GPS belum mendapat fix
        if ($lat === 0.0 && $lng === 0.0) {
            return false;
        }

        return true;
    }
}
