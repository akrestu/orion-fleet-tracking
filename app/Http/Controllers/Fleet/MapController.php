<?php

namespace App\Http\Controllers\Fleet;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\MapTileset;
use App\Services\GeofenceService;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class MapController extends Controller
{
    public function __invoke(GeofenceService $geofenceService): Response
    {
        $groupIds = Auth::user()?->accessibleGroupIds();

        $devices = Device::active()
            ->when($groupIds !== null, fn ($q) => $q->whereIn('device_group_id', $groupIds))
            ->withLatestGpsLog()
            ->orderBy('device_name')
            ->get();

        /** @var array<string, true> $alerting */
        $alerting = Alert::unresolved()
            ->whereIn('dev_eui', $devices->pluck('dev_eui'))
            ->distinct()
            ->pluck('dev_eui')
            ->flip()
            ->map(fn () => true)
            ->all();

        $zones = $geofenceService->currentDwellZones($devices->pluck('dev_eui')->all());

        $positions = $devices->map(function ($device) use ($alerting, $zones) {
            $latest = $device->gpsLogs->first();

            return [
                'id' => $device->id,
                'dev_eui' => $device->dev_eui,
                'device_name' => $device->device_name,
                'unit_type' => $device->unit_type,
                'unit_model' => $device->unit_model,
                'status' => $device->status,
                'latitude' => $latest ? (float) $latest->latitude : 0,
                'longitude' => $latest ? (float) $latest->longitude : 0,
                'speed_kmh' => $latest ? (float) $latest->speed_kmh : 0,
                'heading_deg' => $latest?->heading_deg,
                'hdop' => $latest?->hdop ? (float) $latest->hdop : null,
                'rssi' => $latest?->rssi,
                'snr' => $latest?->snr ? (float) $latest->snr : null,
                'satellites' => $latest?->satellites,
                'gateway_id' => $latest?->gateway_id,
                'has_alert' => isset($alerting[$device->dev_eui]),
                'zone' => $zones[$device->dev_eui] ?? null,
                'recorded_at' => $latest?->recorded_at?->toIso8601String(),
            ];
        });

        $tilesets = MapTileset::orderBy('name')->get()->map(fn (MapTileset $t) => [
            'id' => $t->id,
            'name' => $t->name,
            'slug' => $t->slug,
            'min_zoom' => $t->min_zoom,
            'max_zoom' => $t->max_zoom,
            'tile_url' => asset("storage/map-tiles/{$t->slug}/{z}/{x}/{y}.png"),
        ]);

        $geofences = Geofence::where('is_active', true)
            ->orderBy('name')
            ->get()
            ->map(fn (Geofence $g) => [
                'id' => $g->id,
                'name' => $g->name,
                'color' => $g->color,
                'zone_type' => $g->zone_type,
                'polygon' => $g->polygon,
            ]);

        return Inertia::render('Fleet/Map', [
            'initialPositions' => $positions,
            'tilesets' => $tilesets,
            'geofences' => $geofences,
        ]);
    }
}
