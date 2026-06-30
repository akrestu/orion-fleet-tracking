<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\GpsLog;
use App\Services\FleetUtilizationService;
use App\Support\GeoHelper;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    public function __construct(private readonly FleetUtilizationService $fleetUtilizationService) {}

    public function index(): InertiaResponse
    {
        $devices = Device::active()
            ->orderBy('device_name')
            ->get(['dev_eui', 'device_name', 'unit_type'])
            ->map(fn ($d) => [
                'dev_eui' => $d->dev_eui,
                'device_name' => $d->device_name,
                'unit_type' => $d->unit_type,
            ]);

        return Inertia::render('admin/reports/index', [
            'devices' => $devices,
        ]);
    }

    public function fleetUtilization(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            return response()->json(['message' => 'Date range cannot exceed 90 days.'], 422);
        }

        // Exclude devices that are on standby or breakdown — they are not in operation.
        $excludedDevEuis = Device::whereIn('operational_status', ['standby', 'breakdown'])
            ->pluck('dev_eui');

        // Devices with meaningful data (exclude standby/breakdown already handled above).
        $devEuis = Device::active()
            ->when($excludedDevEuis->isNotEmpty(), fn ($q) => $q->whereNotIn('dev_eui', $excludedDevEuis))
            ->when($request->filled('dev_eui'), fn ($q) => $q->where('dev_eui', $request->dev_eui))
            ->orderBy('device_name')
            ->pluck('dev_eui', 'dev_eui');

        $deviceNames = Device::whereIn('dev_eui', $devEuis)
            ->pluck('device_name', 'dev_eui');
        $deviceUnitTypes = Device::whereIn('dev_eui', $devEuis)
            ->pluck('unit_type', 'dev_eui');

        $rows = [];

        // Process one device at a time to avoid loading all logs into memory.
        foreach ($devEuis as $devEui) {
            $stats = $this->fleetUtilizationService->computeForDevice($devEui, $from, $to);

            if ($stats === null) {
                continue;
            }

            $rows[] = [
                'dev_eui' => $devEui,
                'device_name' => $deviceNames[$devEui] ?? $devEui,
                'unit_type' => $deviceUnitTypes[$devEui] ?? 'other',
                ...$stats,
            ];
        }

        return response()->json(['data' => array_values($rows)]);
    }

    public function speedViolations(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            return response()->json(['message' => 'Date range cannot exceed 90 days.'], 422);
        }

        $query = Alert::with('device')
            ->where('alert_type', 'overspeed')
            ->whereBetween('triggered_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('triggered_at', 'desc');

        if ($request->filled('dev_eui')) {
            $query->where('dev_eui', $request->dev_eui);
        }

        $alerts = $query->get();

        $rows = $alerts->map(fn ($alert) => [
            'id' => $alert->id,
            'dev_eui' => $alert->dev_eui,
            'device_name' => $alert->device?->device_name ?? $alert->dev_eui,
            'unit_type' => $alert->device?->unit_type ?? 'other',
            'speed_kmh' => isset($alert->meta['speed_kmh']) ? round((float) $alert->meta['speed_kmh'], 1) : null,
            'threshold_kmh' => isset($alert->meta['threshold']) ? round((float) $alert->meta['threshold'], 1) : null,
            'triggered_at' => $alert->triggered_at?->toIso8601String(),
            'triggered_at_human' => $alert->triggered_at?->diffForHumans(),
            'is_resolved' => $alert->resolved_at !== null,
        ]);

        $summary = $alerts->groupBy('dev_eui')->map(function ($deviceAlerts, $devEui) {
            $device = $deviceAlerts->first()->device;
            $speeds = $deviceAlerts->pluck('meta')->filter()->map(fn ($m) => $m['speed_kmh'] ?? null)->filter();

            return [
                'dev_eui' => $devEui,
                'device_name' => $device?->device_name ?? $devEui,
                'unit_type' => $device?->unit_type ?? 'other',
                'violation_count' => $deviceAlerts->count(),
                'max_speed_kmh' => $speeds->isNotEmpty() ? round((float) $speeds->max(), 1) : null,
                'avg_speed_kmh' => $speeds->isNotEmpty() ? round((float) $speeds->avg(), 1) : null,
            ];
        })->values();

        return response()->json(['data' => $rows, 'summary' => $summary]);
    }

    public function exportGpsLogs(Request $request): StreamedResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            abort(422, 'Date range cannot exceed 90 days.');
        }

        $query = GpsLog::with('device')
            ->whereBetween('recorded_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('recorded_at');

        if ($request->filled('dev_eui')) {
            $query->where('dev_eui', $request->dev_eui);
        }

        $filename = 'gps-logs-'.$from->toDateString().'-to-'.$to->toDateString().'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Device Name', 'DEV EUI', 'Unit Type', 'Latitude', 'Longitude', 'Speed (km/h)', 'Heading (°)', 'HDOP', 'Satellites', 'RSSI', 'SNR', 'Recorded At']);

            $sanitize = fn (string $value): string => str_replace(["\r", "\n", "\t"], ' ', $value);

            $query->chunk(500, function ($logs) use ($handle, $sanitize) {
                foreach ($logs as $log) {
                    fputcsv($handle, [
                        $sanitize($log->device?->device_name ?? $log->dev_eui),
                        $sanitize($log->dev_eui),
                        $sanitize($log->device?->unit_type ?? 'other'),
                        $log->latitude,
                        $log->longitude,
                        $log->speed_kmh,
                        $log->heading_deg,
                        $log->hdop,
                        $log->satellites,
                        $log->rssi,
                        $log->snr,
                        $log->recorded_at?->toDateTimeString(),
                    ]);
                }
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function exportAlerts(Request $request): StreamedResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
            'alert_type' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? now()->startOfMonth();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            abort(422, 'Date range cannot exceed 90 days.');
        }

        $query = Alert::with('device')
            ->whereBetween('triggered_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('triggered_at', 'desc');

        if ($request->filled('dev_eui')) {
            $query->where('dev_eui', $request->dev_eui);
        }

        if ($request->filled('alert_type')) {
            $query->where('alert_type', $request->alert_type);
        }

        $filename = 'alerts-'.$from->toDateString().'-to-'.$to->toDateString().'.csv';

        return response()->streamDownload(function () use ($query) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Device Name', 'DEV EUI', 'Unit Type', 'Alert Type', 'Speed (km/h)', 'Threshold (km/h)', 'Triggered At', 'Status', 'Resolved At']);

            $sanitize = fn (string $value): string => str_replace(["\r", "\n", "\t"], ' ', $value);

            $query->chunk(500, function ($alerts) use ($handle, $sanitize) {
                foreach ($alerts as $alert) {
                    fputcsv($handle, [
                        $sanitize($alert->device?->device_name ?? $alert->dev_eui),
                        $sanitize($alert->dev_eui),
                        $sanitize($alert->device?->unit_type ?? 'other'),
                        $sanitize($alert->alert_type->value),
                        $alert->meta['speed_kmh'] ?? '',
                        $alert->meta['threshold'] ?? '',
                        $alert->triggered_at?->toDateTimeString(),
                        $alert->resolved_at ? 'Resolved' : 'Active',
                        $alert->resolved_at?->toDateTimeString() ?? '',
                    ]);
                }
            });

            fclose($handle);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    public function cycleTime(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? now()->startOfDay();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            return response()->json(['message' => 'Date range cannot exceed 90 days.'], 422);
        }

        // Only geofences with a meaningful zone_type
        $geofences = Geofence::where('is_active', true)
            ->whereIn('zone_type', ['loading', 'dumping', 'parking'])
            ->get();

        if ($geofences->isEmpty()) {
            return response()->json(['trips' => [], 'summary' => [], 'warning' => 'No loading/dumping/parking zones configured.']);
        }

        $devices = Device::active()
            ->when($request->filled('dev_eui'), fn ($q) => $q->where('dev_eui', $request->dev_eui))
            ->orderBy('device_name')
            ->get(['dev_eui', 'device_name', 'unit_type'])
            ->keyBy('dev_eui');

        $trips = [];

        // Process one device at a time to avoid loading all logs into memory.
        foreach ($devices as $devEui => $device) {

            // Build zone timeline by streaming rows one at a time.
            $timeline = [];
            GpsLog::where('dev_eui', $devEui)
                ->whereBetween('recorded_at', [$from, $to->copy()->endOfDay()])
                ->orderBy('recorded_at')
                ->select(['dev_eui', 'latitude', 'longitude', 'speed_kmh', 'recorded_at'])
                ->lazy()
                ->each(function ($log) use ($geofences, &$timeline) {
                    $lat = (float) $log->latitude;
                    $lng = (float) $log->longitude;
                    $zoneType = null;
                    foreach ($geofences as $geofence) {
                        if (GeoHelper::pointInPolygon($lat, $lng, $geofence->polygon)) {
                            $zoneType = $geofence->zone_type;
                            break;
                        }
                    }
                    $timeline[] = ['zone' => $zoneType, 'at' => $log->recorded_at, 'speed' => (float) $log->speed_kmh];
                });

            // Compress consecutive same-zone segments
            $segments = [];
            foreach ($timeline as $point) {
                $last = end($segments);
                if ($last && $last['zone'] === $point['zone']) {
                    $segments[array_key_last($segments)]['end'] = $point['at'];
                } else {
                    $segments[] = ['zone' => $point['zone'], 'start' => $point['at'], 'end' => $point['at']];
                }
            }

            // Detect cycles: loading → (haul) → dumping → (return) → loading...
            $currentTrip = null;
            foreach ($segments as $seg) {
                if ($seg['zone'] === 'loading') {
                    // Start a new trip
                    $currentTrip = [
                        'dev_eui' => $devEui,
                        'device_name' => $device?->device_name ?? $devEui,
                        'unit_type' => $device?->unit_type ?? 'other',
                        'load_start' => $seg['start']->toIso8601String(),
                        'load_end' => $seg['end']->toIso8601String(),
                        'dump_start' => null,
                        'dump_end' => null,
                        'return_start' => null,
                        'cycle_duration_min' => null,
                        'haul_duration_min' => null,
                        'return_duration_min' => null,
                    ];
                } elseif ($seg['zone'] === 'dumping' && $currentTrip !== null && $currentTrip['dump_start'] === null) {
                    $currentTrip['dump_start'] = $seg['start']->toIso8601String();
                    $currentTrip['dump_end'] = $seg['end']->toIso8601String();
                    $currentTrip['haul_duration_min'] = round(
                        abs($seg['start']->diffInSeconds(Carbon::parse($currentTrip['load_end']))) / 60,
                        1,
                    );
                } elseif ($seg['zone'] === 'loading' && $currentTrip !== null && $currentTrip['dump_start'] !== null) {
                    // Back at loading = cycle complete
                    $currentTrip['return_start'] = $currentTrip['dump_end'];
                    $currentTrip['return_duration_min'] = round(
                        abs($seg['start']->diffInSeconds(Carbon::parse($currentTrip['dump_end']))) / 60,
                        1,
                    );
                    $currentTrip['cycle_duration_min'] = round(
                        abs($seg['start']->diffInSeconds(Carbon::parse($currentTrip['load_start']))) / 60,
                        1,
                    );
                    $trips[] = $currentTrip;
                    // Start fresh trip at this loading zone
                    $currentTrip = [
                        'dev_eui' => $devEui,
                        'device_name' => $device?->device_name ?? $devEui,
                        'unit_type' => $device?->unit_type ?? 'other',
                        'load_start' => $seg['start']->toIso8601String(),
                        'load_end' => $seg['end']->toIso8601String(),
                        'dump_start' => null,
                        'dump_end' => null,
                        'return_start' => null,
                        'cycle_duration_min' => null,
                        'haul_duration_min' => null,
                        'return_duration_min' => null,
                    ];
                }
            }
        }

        // Per-device summary
        $summaryMap = [];
        foreach ($trips as $trip) {
            $key = $trip['dev_eui'];
            if (! isset($summaryMap[$key])) {
                $summaryMap[$key] = [
                    'dev_eui' => $trip['dev_eui'],
                    'device_name' => $trip['device_name'],
                    'unit_type' => $trip['unit_type'],
                    'trip_count' => 0,
                    'avg_cycle_min' => [],
                    'avg_haul_min' => [],
                    'avg_return_min' => [],
                ];
            }
            $summaryMap[$key]['trip_count']++;
            if ($trip['cycle_duration_min'] !== null) {
                $summaryMap[$key]['avg_cycle_min'][] = $trip['cycle_duration_min'];
            }
            if ($trip['haul_duration_min'] !== null) {
                $summaryMap[$key]['avg_haul_min'][] = $trip['haul_duration_min'];
            }
            if ($trip['return_duration_min'] !== null) {
                $summaryMap[$key]['avg_return_min'][] = $trip['return_duration_min'];
            }
        }

        $summary = array_values(array_map(function ($s) {
            $avg = fn (array $arr) => count($arr) > 0 ? round(array_sum($arr) / count($arr), 1) : null;

            return [
                'dev_eui' => $s['dev_eui'],
                'device_name' => $s['device_name'],
                'unit_type' => $s['unit_type'],
                'trip_count' => $s['trip_count'],
                'avg_cycle_min' => $avg($s['avg_cycle_min']),
                'avg_haul_min' => $avg($s['avg_haul_min']),
                'avg_return_min' => $avg($s['avg_return_min']),
            ];
        }, $summaryMap));

        return response()->json(['trips' => $trips, 'summary' => $summary]);
    }
}
