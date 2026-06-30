<?php

namespace App\Services;

use App\Enums\AlertType;
use App\Models\Alert;
use App\Models\Geofence;
use App\Models\GeofenceDeviceState;
use App\Models\GpsLog;
use App\Support\GeoHelper;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GeofenceService
{
    /**
     * Check a GPS log against all active geofences and fire alerts on enter/exit.
     */
    public function check(GpsLog $gpsLog): void
    {
        $geofences = Cache::remember('geofences.active', 60, fn () => Geofence::where('is_active', true)->get());

        foreach ($geofences as $geofence) {
            $isNowInside = GeoHelper::pointInPolygon(
                $gpsLog->latitude,
                $gpsLog->longitude,
                $geofence->polygon,
            );

            // Lock the state row for the duration of the read-update so concurrent
            // MQTT messages for the same device cannot both pass the transition check.
            DB::transaction(function () use ($gpsLog, $geofence, $isNowInside) {
                $state = GeofenceDeviceState::where([
                    'geofence_id' => $geofence->id,
                    'dev_eui' => $gpsLog->dev_eui,
                ])->lockForUpdate()->first();

                // Cast to bool explicitly — ->value() bypasses Eloquent casts.
                $previousState = $state !== null ? (bool) $state->is_inside : null;

                GeofenceDeviceState::updateOrCreate(
                    ['geofence_id' => $geofence->id, 'dev_eui' => $gpsLog->dev_eui],
                    ['is_inside' => $isNowInside, 'checked_at' => now()],
                );

                // Trigger alert on transition (null = first time seen, no alert needed).
                if ($previousState !== null && $previousState !== $isNowInside) {
                    $this->fireAlert($gpsLog, $geofence, $isNowInside);
                }
            });
        }
    }

    private function fireAlert(GpsLog $gpsLog, Geofence $geofence, bool $isEntering): void
    {
        Alert::create([
            'dev_eui' => $gpsLog->dev_eui,
            'alert_type' => AlertType::Geofence,
            'triggered_at' => now(),
            'meta' => [
                'geofence_id' => $geofence->id,
                'geofence_name' => $geofence->name,
                'event' => $isEntering ? 'enter' : 'exit',
                'latitude' => $gpsLog->latitude,
                'longitude' => $gpsLog->longitude,
            ],
        ]);

        Log::info(sprintf(
            '[Geofence] Device %s %s zone "%s"',
            $gpsLog->dev_eui,
            $isEntering ? 'entered' : 'exited',
            $geofence->name,
        ));
    }
}
