<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\FleetHistoryRequest;
use App\Http\Resources\DevicePositionResource;
use App\Http\Resources\GpsLogResource;
use App\Models\Device;
use App\Models\GpsLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Auth;

class FleetController extends Controller
{
    /**
     * Posisi terakhir semua device aktif.
     * Menggunakan subquery untuk menghindari N+1 — satu query ke gps_logs.
     */
    public function positions(): AnonymousResourceCollection
    {
        $groupIds = $this->resolveGroupIds();

        $devices = Device::active()
            ->when($groupIds !== null, fn ($q) => $q->whereIn('device_group_id', $groupIds))
            ->withLatestGpsLog()
            ->orderBy('device_name')
            ->get();

        return DevicePositionResource::collection($devices);
    }

    /**
     * Track history untuk satu device (filter by from/to/limit).
     */
    public function history(FleetHistoryRequest $request, string $devEui): AnonymousResourceCollection|JsonResponse
    {
        $device = Device::where('dev_eui', $devEui)->first();

        if (! $device) {
            return response()->json(['message' => 'Device not found.'], 404);
        }

        $groupIds = $this->resolveGroupIds();

        if ($groupIds !== null && ! in_array($device->device_group_id, $groupIds)) {
            return response()->json(['message' => 'Device not found.'], 404);
        }

        $query = GpsLog::forDevice($devEui)->orderByDesc('recorded_at');

        if ($request->filled('from')) {
            $query->where('recorded_at', '>=', $request->date('from'));
        }

        if ($request->filled('to')) {
            $query->where('recorded_at', '<=', $request->date('to'));
        }

        $logs = $query->limit((int) ($request->input('limit', 200)))->get();

        return GpsLogResource::collection($logs);
    }

    /**
     * Sampel RSSI dari seluruh fleet untuk heatmap coverage sinyal.
     * Mengambil max 5000 titik dari rentang waktu yang dipilih, di-sample merata.
     *
     * @return JsonResponse array of {lat, lng, intensity}
     */
    public function signalCoverage(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $groupIds = $this->resolveGroupIds();

        $query = GpsLog::query()
            ->select(['latitude', 'longitude', 'rssi'])
            ->whereNotNull('rssi')
            ->where('latitude', '!=', 0)
            ->where('longitude', '!=', 0)
            ->when($groupIds !== null, function ($q) use ($groupIds) {
                $q->whereHas('device', fn ($d) => $d->whereIn('device_group_id', $groupIds));
            });

        if ($request->filled('from')) {
            $query->where('recorded_at', '>=', $request->date('from'));
        } else {
            $query->where('recorded_at', '>=', now()->subDay());
        }

        if ($request->filled('to')) {
            $query->where('recorded_at', '<=', $request->date('to'));
        }

        // Sample evenly at DB level using MOD(id, step) to avoid loading all rows.
        $total = (clone $query)->count();
        $step = max(1, (int) ceil($total / 5000));

        $points = (clone $query)
            ->whereRaw('MOD(id, ?) = 0', [$step])
            ->orderBy('recorded_at')
            ->limit(5000)
            ->get()
            ->map(function ($row) {
                // Normalise RSSI (-120…0 dBm) to 0…1 intensity for leaflet.heat
                $intensity = max(0.0, min(1.0, ($row->rssi + 120) / 120));

                return [(float) $row->latitude, (float) $row->longitude, round($intensity, 3)];
            });

        return response()->json($points);
    }

    /**
     * List semua device sesuai hak akses user.
     */
    public function devices(): AnonymousResourceCollection
    {
        $groupIds = $this->resolveGroupIds();

        $devices = Device::when($groupIds !== null, fn ($q) => $q->whereIn('device_group_id', $groupIds))
            ->orderBy('device_name')
            ->get();

        return DevicePositionResource::collection($devices);
    }

    /**
     * Returns accessible device_group_ids for the current request.
     * Session-authenticated users: scoped by their role/groups.
     * API token requests: unrestricted (null = see everything).
     *
     * @return int[]|null
     */
    private function resolveGroupIds(): ?array
    {
        $user = Auth::user();

        return $user?->accessibleGroupIds();
    }
}
