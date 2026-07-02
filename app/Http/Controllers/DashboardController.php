<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\Device;
use App\Models\GpsLog;
use App\Models\User;
use App\Services\FleetUtilizationService;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __construct(private readonly FleetUtilizationService $fleetUtilizationService) {}

    public function __invoke(): Response
    {
        /** @var User $user */
        $user = Auth::user();
        $groupIds = $user->accessibleGroupIds();

        // Cache key includes user scope so admin and per-group users don't share stale data.
        $cacheKey = 'dashboard.'.($groupIds === null ? 'all' : implode('.', $groupIds));

        $data = Cache::remember($cacheKey, 30, function () use ($groupIds) {
            $deviceQuery = Device::active();

            if ($groupIds !== null) {
                $deviceQuery->whereIn('device_group_id', $groupIds);
            }

            $devices = $deviceQuery->get();
            $devicesByEui = $devices->keyBy('dev_eui');
            $onlineDevices = $devices->filter(fn ($d) => $d->status === 'online');
            $allowedEuis = $devices->pluck('dev_eui');

            $todayLogCount = GpsLog::where('recorded_at', '>=', today())
                ->whereIn('dev_eui', $allowedEuis)
                ->count();

            $lastHourLogCount = GpsLog::recent(60)
                ->whereIn('dev_eui', $allowedEuis)
                ->count();

            $unitTypeCounts = $devices
                ->groupBy('unit_type')
                ->map->count()
                ->sortDesc()
                ->toArray();

            $recentActivity = GpsLog::whereIn('dev_eui', $allowedEuis)
                ->latest('recorded_at')
                ->limit(8)
                ->get()
                ->map(function ($log) use ($devicesByEui) {
                    $device = $devicesByEui->get($log->dev_eui);

                    return [
                        'device_name' => $device?->device_name ?? $log->dev_eui,
                        'unit_type' => $device?->unit_type ?? 'other',
                        'speed_kmh' => round((float) $log->speed_kmh, 1),
                        'latitude' => (float) $log->latitude,
                        'longitude' => (float) $log->longitude,
                        'rssi' => $log->rssi,
                        'recorded_at' => $log->recorded_at?->diffForHumans(),
                    ];
                })->values()->toArray();

            $speedByDevice = GpsLog::recent(60)
                ->whereIn('dev_eui', $allowedEuis)
                ->selectRaw('dev_eui, AVG(speed_kmh) as avg_speed, MAX(speed_kmh) as max_speed, COUNT(*) as log_count')
                ->groupBy('dev_eui')
                ->get()
                ->map(fn ($row) => [
                    'device_name' => $devicesByEui->get($row->dev_eui)?->device_name ?? $row->dev_eui,
                    'avg_speed' => round($row->avg_speed, 1),
                    'max_speed' => round($row->max_speed, 1),
                    'log_count' => $row->log_count,
                ])->values()->toArray();

            // Alert summary — unresolved alerts grouped by type (today)
            $alertTypes = ['overspeed', 'geofence', 'offline', 'low_signal'];
            $alertCounts = Alert::unresolved()
                ->where('triggered_at', '>=', today())
                ->whereIn('dev_eui', $allowedEuis)
                ->selectRaw('alert_type, COUNT(*) as total')
                ->groupBy('alert_type')
                ->pluck('total', 'alert_type');

            $alertSummary = collect($alertTypes)->mapWithKeys(fn ($type) => [
                $type => (int) ($alertCounts[$type] ?? 0),
            ])->toArray();

            // Fleet productivity today — per-device: distance = avg_speed × log_count × 30s interval.
            // Summed across fleet to give total km travelled and operating hours.
            $productivityRows = GpsLog::where('recorded_at', '>=', today())
                ->whereIn('dev_eui', $allowedEuis)
                ->selectRaw('dev_eui, AVG(speed_kmh) as avg_speed, COUNT(*) as log_count')
                ->groupBy('dev_eui')
                ->get();

            $totalDistanceKm = $productivityRows->sum(
                fn ($row) => (float) $row->avg_speed * (int) $row->log_count * 30 / 3600,
            );

            // Operating hours: only count logs where device was moving (speed > 0)
            $operatingLogCount = GpsLog::where('recorded_at', '>=', today())
                ->whereIn('dev_eui', $allowedEuis)
                ->where('speed_kmh', '>', 0)
                ->selectRaw('dev_eui, COUNT(*) as log_count')
                ->groupBy('dev_eui')
                ->get()
                ->sum('log_count');

            $productivity = [
                'total_distance_km' => round($totalDistanceKm, 1),
                'total_op_hours' => round($operatingLogCount * 30 / 3600, 1),
            ];

            // Speed trend — avg speed per hour for last 8 hours
            $speedTrend = GpsLog::where('recorded_at', '>=', now()->subHours(8))
                ->whereIn('dev_eui', $allowedEuis)
                ->selectRaw("DATE_FORMAT(recorded_at, '%H:00') as hour, AVG(speed_kmh) as avg_speed, COUNT(*) as log_count")
                ->groupByRaw("DATE_FORMAT(recorded_at, '%H:00')")
                ->orderBy('hour')
                ->get()
                ->map(fn ($row) => [
                    'hour' => $row->hour,
                    'avg_speed' => round($row->avg_speed, 1),
                    'log_count' => (int) $row->log_count,
                ])
                ->values()->toArray();

            // Maintenance insight — fleet-wide running vs idle hours today.
            $runningHours = 0.0;
            $idleHours = 0.0;
            foreach ($allowedEuis as $devEui) {
                $stats = $this->fleetUtilizationService->computeForDevice($devEui, today(), today());
                if ($stats !== null) {
                    $runningHours += $stats['running_hours'];
                    $idleHours += $stats['idle_hours'];
                }
            }

            $maintenance = [
                'running_hours' => round($runningHours, 1),
                'idle_hours' => round($idleHours, 1),
            ];

            // Infrastructure coverage — avg signal quality per gateway today (top 5 by traffic).
            $gatewaySignal = GpsLog::where('recorded_at', '>=', today())
                ->whereIn('dev_eui', $allowedEuis)
                ->whereNotNull('gateway_id')
                ->selectRaw('gateway_id, AVG(rssi) as avg_rssi, AVG(snr) as avg_snr, COUNT(*) as uplink_count')
                ->groupBy('gateway_id')
                ->orderByDesc('uplink_count')
                ->limit(5)
                ->get()
                ->map(fn ($row) => [
                    'gateway_id' => $row->gateway_id,
                    'avg_rssi' => round((float) $row->avg_rssi, 1),
                    'avg_snr' => round((float) $row->avg_snr, 1),
                    'uplink_count' => (int) $row->uplink_count,
                ])
                ->values()->toArray();

            return [
                'stats' => [
                    'totalDevices' => $devices->count(),
                    'onlineDevices' => $onlineDevices->count(),
                    'offlineDevices' => $devices->count() - $onlineDevices->count(),
                    'todayLogs' => $todayLogCount,
                    'lastHourLogs' => $lastHourLogCount,
                ],
                'unitTypeCounts' => $unitTypeCounts,
                'recentActivity' => $recentActivity,
                'speedByDevice' => $speedByDevice,
                'alertSummary' => $alertSummary,
                'productivity' => $productivity,
                'speedTrend' => $speedTrend,
                'maintenance' => $maintenance,
                'gatewaySignal' => $gatewaySignal,
            ];
        });

        return Inertia::render('dashboard', $data);
    }
}
