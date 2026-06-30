<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GpsLogResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'dev_eui' => $this->dev_eui,
            'latitude' => (float) $this->latitude,
            'longitude' => (float) $this->longitude,
            'speed_kmh' => (float) $this->speed_kmh,
            'heading_deg' => $this->heading_deg,
            'hdop' => $this->hdop ? (float) $this->hdop : null,
            'satellites' => $this->satellites,
            'rssi' => $this->rssi,
            'snr' => $this->snr ? (float) $this->snr : null,
            'gateway_id' => $this->gateway_id,
            'recorded_at' => $this->recorded_at?->toIso8601String(),
        ];
    }
}
