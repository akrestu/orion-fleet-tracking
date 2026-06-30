<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DevicePositionResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'dev_eui' => $this->dev_eui,
            'device_name' => $this->device_name,
            'unit_type' => $this->unit_type,
            'unit_model' => $this->unit_model,
            'is_active' => $this->is_active,
            'status' => $this->status,
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'position' => $this->whenLoaded('gpsLogs', function () {
                $latest = $this->gpsLogs->first();

                if (! $latest) {
                    return null;
                }

                return [
                    'latitude' => (float) $latest->latitude,
                    'longitude' => (float) $latest->longitude,
                    'speed_kmh' => (float) $latest->speed_kmh,
                    'heading_deg' => $latest->heading_deg,
                    'hdop' => $latest->hdop ? (float) $latest->hdop : null,
                    'rssi' => $latest->rssi,
                    'snr' => $latest->snr ? (float) $latest->snr : null,
                    'recorded_at' => $latest->recorded_at?->toIso8601String(),
                ];
            }),
        ];
    }
}
