<?php

namespace App\Services;

use App\Enums\AlertType;
use App\Events\DeviceZoneChanged;
use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\GeofenceDeviceState;
use App\Models\GpsLog;
use App\Support\GeoHelper;
use App\Support\UnitTypes;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class GeofenceService
{
    /**
     * Check a GPS log against all active geofences and fire alerts on enter/exit.
     */
    /** Zone types whose dwell time (loading time / dumping time) is tracked for haulers. */
    public const DWELL_ZONE_TYPES = ['loading', 'dumping'];

    public function check(GpsLog $gpsLog): void
    {
        $geofences = Cache::remember('geofences.active', 60, fn () => Geofence::where('is_active', true)->get());
        $dwellZoneChanged = false;

        foreach ($geofences as $geofence) {
            $isNowInside = GeoHelper::pointInPolygon(
                $gpsLog->latitude,
                $gpsLog->longitude,
                $geofence->polygon,
            );

            // Lock the state row for the duration of the read-update so concurrent
            // MQTT messages for the same device cannot both pass the transition check.
            $changed = DB::transaction(function () use ($gpsLog, $geofence, $isNowInside) {
                $state = GeofenceDeviceState::where([
                    'geofence_id' => $geofence->id,
                    'dev_eui' => $gpsLog->dev_eui,
                ])->lockForUpdate()->first();

                // Cast to bool explicitly — ->value() bypasses Eloquent casts.
                $previousState = $state !== null ? (bool) $state->is_inside : null;

                // Dwell starts at the first fix inside and ends at the first fix outside: a unit
                // parked/loading only sends a heartbeat every 120 s, but uplinks immediately once it moves.
                $enteredAt = match (true) {
                    ! $isNowInside => null,
                    $previousState === true => $state->entered_at ?? $gpsLog->recorded_at,
                    default => $gpsLog->recorded_at,
                };

                GeofenceDeviceState::updateOrCreate(
                    ['geofence_id' => $geofence->id, 'dev_eui' => $gpsLog->dev_eui],
                    ['is_inside' => $isNowInside, 'entered_at' => $enteredAt, 'checked_at' => now()],
                );

                // Trigger alert on transition (null = first time seen, no alert needed).
                if ($previousState !== null && $previousState !== $isNowInside) {
                    $this->fireAlert($gpsLog, $geofence, $isNowInside);
                }

                return $previousState !== $isNowInside && ($previousState !== null || $isNowInside);
            });

            if ($changed && in_array($geofence->zone_type, self::DWELL_ZONE_TYPES, true)) {
                $dwellZoneChanged = true;
            }
        }

        if ($dwellZoneChanged) {
            $this->broadcastDwellZone($gpsLog->dev_eui);
        }
    }

    /**
     * The loading/dumping zone each hauler is currently inside, keyed by dev_eui.
     *
     * @param  string[]  $devEuis
     * @return array<string, array{type: string, name: string, entered_at: string}>
     */
    public function currentDwellZones(array $devEuis): array
    {
        if ($devEuis === []) {
            return [];
        }

        return GeofenceDeviceState::query()
            ->join('geofences', 'geofences.id', '=', 'geofence_device_states.geofence_id')
            ->join('devices', 'devices.dev_eui', '=', 'geofence_device_states.dev_eui')
            ->whereIn('geofence_device_states.dev_eui', $devEuis)
            ->where('geofence_device_states.is_inside', true)
            ->whereNotNull('geofence_device_states.entered_at')
            ->where('geofences.is_active', true)
            ->whereIn('geofences.zone_type', self::DWELL_ZONE_TYPES)
            ->whereIn('devices.unit_type', UnitTypes::haulers())
            ->orderBy('geofence_device_states.entered_at')
            ->get([
                'geofence_device_states.dev_eui',
                'geofence_device_states.entered_at',
                'geofences.name',
                'geofences.zone_type',
            ])
            ->mapWithKeys(fn (GeofenceDeviceState $state) => [
                $state->dev_eui => [
                    'type' => (string) $state->getAttribute('zone_type'),
                    'name' => (string) $state->getAttribute('name'),
                    'entered_at' => $state->entered_at->toIso8601String(),
                ],
            ])
            ->all();
    }

    private function broadcastDwellZone(string $devEui): void
    {
        $device = Device::where('dev_eui', $devEui)->first();

        if ($device === null || ! UnitTypes::isHauler($device->unit_type)) {
            return;
        }

        event(new DeviceZoneChanged($device, $this->currentDwellZones([$devEui])[$devEui] ?? null));
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
