<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\Geofence;
use App\Models\GpsLog;
use App\Models\MapTileset;
use App\Models\ShareLink;
use App\Services\GeofenceService;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Public, read-only live map behind a share-link token (no login). Shows position,
 * trail, speed, status and loading/dumping dwell — never EUIs, radio or gateway data.
 */
class LiveShareController extends Controller
{
    /** Trail length shown on the shared map. */
    public const TRAIL_MINUTES = 30;

    public function __construct(private readonly GeofenceService $geofenceService) {}

    public function show(string $token): Response
    {
        $link = $this->resolve($token);

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

        return Inertia::render('share/live-map', [
            'linkName' => $link->name,
            'token' => $token,
            'trailMinutes' => self::TRAIL_MINUTES,
            'tilesets' => $tilesets,
            'geofences' => $geofences,
            'snapshot' => $this->snapshot(now()->subMinutes(self::TRAIL_MINUTES)),
        ]);
    }

    public function feed(Request $request, string $token): JsonResponse
    {
        $this->resolve($token);

        $request->validate(['since' => ['nullable', 'date']]);

        $oldest = now()->subMinutes(self::TRAIL_MINUTES);
        $since = $request->date('since');

        return response()->json($this->snapshot($since !== null && $since->gt($oldest) ? $since : $oldest));
    }

    private function resolve(string $token): ShareLink
    {
        $link = ShareLink::findUsable($token);

        abort_if($link === null, 404);

        // Throttle the write: a TV polling every 10 s should not update the row every time.
        if ($link->last_accessed_at === null || $link->last_accessed_at->lt(now()->subMinute())) {
            $link->forceFill(['last_accessed_at' => now()])->saveQuietly();
        }

        return $link;
    }

    /**
     * @return array{positions: array<int, array<string, mixed>>, trails: array<string, array<int, array{0: float, 1: float, 2: float, 3: string}>>, server_time: string}
     */
    private function snapshot(CarbonInterface $trailSince): array
    {
        $devices = Device::active()->withLatestGpsLog()->orderBy('device_name')->get();
        $zones = $this->geofenceService->currentDwellZones($devices->pluck('dev_eui')->all());
        $idByEui = $devices->pluck('id', 'dev_eui');

        $positions = $devices->map(function (Device $device) use ($zones) {
            $latest = $device->gpsLogs->first();

            return [
                'id' => (string) $device->id,
                'device_name' => $device->device_name,
                'unit_type' => $device->unit_type,
                'unit_model' => $device->unit_model,
                'status' => $device->status,
                'latitude' => $latest ? (float) $latest->latitude : 0,
                'longitude' => $latest ? (float) $latest->longitude : 0,
                'speed_kmh' => $latest ? (float) $latest->speed_kmh : 0,
                'heading_deg' => $latest?->heading_deg,
                'recorded_at' => $latest?->recorded_at?->toIso8601String(),
                'zone' => $zones[$device->dev_eui] ?? null,
            ];
        })->values()->all();

        $trails = [];
        GpsLog::query()
            ->whereIn('dev_eui', $idByEui->keys())
            ->where('recorded_at', '>', $trailSince)
            ->where('latitude', '!=', 0)
            ->orderBy('recorded_at')
            ->select(['dev_eui', 'latitude', 'longitude', 'speed_kmh', 'recorded_at'])
            ->lazy()
            ->each(function (GpsLog $log) use (&$trails, $idByEui) {
                $trails[(string) $idByEui[$log->dev_eui]][] = [
                    (float) $log->latitude,
                    (float) $log->longitude,
                    (float) $log->speed_kmh,
                    $log->recorded_at->toIso8601String(),
                ];
            });

        return [
            'positions' => $positions,
            'trails' => $trails,
            'server_time' => now()->toIso8601String(),
        ];
    }
}
