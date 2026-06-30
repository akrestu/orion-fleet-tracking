<?php

namespace App\Http\Controllers\Admin;

use App\Exports\ArrayExport;
use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\GpsLog;
use App\Services\FleetUtilizationService;
use App\Support\GeoHelper;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
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

        $rows = $this->buildFleetUtilizationRows($from, $to, $request->string('dev_eui')->value() ?: null);

        return response()->json(['data' => $rows]);
    }

    public function exportFleetUtilization(Request $request): BinaryFileResponse
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

        $rows = $this->buildFleetUtilizationRows($from, $to, $request->string('dev_eui')->value() ?: null);

        $export = array_map(fn (array $r) => [
            'Device Name' => $r['device_name'],
            'DEV EUI' => $r['dev_eui'],
            'Unit Type' => $r['unit_type'],
            'Operation Hours' => $r['operation_hours'],
            'Running Hours' => $r['running_hours'],
            'Idle Hours' => $r['idle_hours'],
            'Distance (km)' => $r['distance_km'],
            'Avg Speed (km/h)' => $r['avg_speed_kmh'],
            'Max Speed (km/h)' => $r['max_speed_kmh'],
            'GPS Points' => $r['log_count'],
        ], $rows);

        $filename = 'fleet-utilization-'.$from->toDateString().'-to-'.$to->toDateString().'.xlsx';

        return Excel::download(
            new ArrayExport($export, ['Device Name', 'DEV EUI', 'Unit Type', 'Operation Hours', 'Running Hours', 'Idle Hours', 'Distance (km)', 'Avg Speed (km/h)', 'Max Speed (km/h)', 'GPS Points'], 'Fleet Utilization'),
            $filename,
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildFleetUtilizationRows(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
    {
        // Exclude devices that are on standby or breakdown — they are not in operation.
        $excludedDevEuis = Device::whereIn('operational_status', ['standby', 'breakdown'])
            ->pluck('dev_eui');

        // Devices with meaningful data (exclude standby/breakdown already handled above).
        $devEuis = Device::active()
            ->when($excludedDevEuis->isNotEmpty(), fn ($q) => $q->whereNotIn('dev_eui', $excludedDevEuis))
            ->when($devEuiFilter, fn ($q) => $q->where('dev_eui', $devEuiFilter))
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

        return array_values($rows);
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

        [$rows, $summary] = $this->buildSpeedViolationsData($from, $to, $request->string('dev_eui')->value() ?: null);

        return response()->json(['data' => $rows, 'summary' => $summary]);
    }

    public function exportSpeedViolations(Request $request): BinaryFileResponse
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

        [$rows] = $this->buildSpeedViolationsData($from, $to, $request->string('dev_eui')->value() ?: null);

        $export = array_map(fn (array $r) => [
            'Device Name' => $r['device_name'],
            'DEV EUI' => $r['dev_eui'],
            'Unit Type' => $r['unit_type'],
            'Speed (km/h)' => $r['speed_kmh'],
            'Threshold (km/h)' => $r['threshold_kmh'],
            'Triggered At' => $r['triggered_at'],
            'Status' => $r['is_resolved'] ? 'Resolved' : 'Active',
        ], $rows);

        $filename = 'speed-violations-'.$from->toDateString().'-to-'.$to->toDateString().'.xlsx';

        return Excel::download(
            new ArrayExport($export, ['Device Name', 'DEV EUI', 'Unit Type', 'Speed (km/h)', 'Threshold (km/h)', 'Triggered At', 'Status'], 'Speed Violations'),
            $filename,
        );
    }

    /**
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    private function buildSpeedViolationsData(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
    {
        $query = Alert::with('device')
            ->where('alert_type', 'overspeed')
            ->whereBetween('triggered_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('triggered_at', 'desc');

        if ($devEuiFilter) {
            $query->where('dev_eui', $devEuiFilter);
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
        ])->values()->all();

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
        })->values()->all();

        return [$rows, $summary];
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

        ['trips' => $trips, 'summary' => $summary, 'warning' => $warning] = $this->buildCycleTimeData($from, $to, $request->string('dev_eui')->value() ?: null);

        return response()->json(['trips' => $trips, 'summary' => $summary, 'warning' => $warning]);
    }

    public function exportCycleTime(Request $request): BinaryFileResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? now()->startOfDay();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            abort(422, 'Date range cannot exceed 90 days.');
        }

        ['trips' => $trips] = $this->buildCycleTimeData($from, $to, $request->string('dev_eui')->value() ?: null);

        $export = array_map(fn (array $t) => [
            'Device Name' => $t['device_name'],
            'DEV EUI' => $t['dev_eui'],
            'Unit Type' => $t['unit_type'],
            'Load Start' => $t['load_start'],
            'Load End' => $t['load_end'],
            'Dump Start' => $t['dump_start'],
            'Dump End' => $t['dump_end'],
            'Haul Duration (min)' => $t['haul_duration_min'],
            'Return Duration (min)' => $t['return_duration_min'],
            'Cycle Duration (min)' => $t['cycle_duration_min'],
        ], $trips);

        $filename = 'cycle-time-'.$from->toDateString().'-to-'.$to->toDateString().'.xlsx';

        return Excel::download(
            new ArrayExport($export, ['Device Name', 'DEV EUI', 'Unit Type', 'Load Start', 'Load End', 'Dump Start', 'Dump End', 'Haul Duration (min)', 'Return Duration (min)', 'Cycle Duration (min)'], 'Cycle Time'),
            $filename,
        );
    }

    /**
     * @return array{trips: array<int, array<string, mixed>>, summary: array<int, array<string, mixed>>, warning: ?string}
     */
    private function buildCycleTimeData(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
    {
        // Only geofences with a meaningful zone_type
        $geofences = Geofence::where('is_active', true)
            ->whereIn('zone_type', ['loading', 'dumping', 'parking'])
            ->get();

        if ($geofences->isEmpty()) {
            return ['trips' => [], 'summary' => [], 'warning' => 'No loading/dumping/parking zones configured.'];
        }

        $devices = Device::active()
            ->when($devEuiFilter, fn ($q) => $q->where('dev_eui', $devEuiFilter))
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

        return ['trips' => $trips, 'summary' => $summary, 'warning' => null];
    }

    public function delayWaiting(Request $request): JsonResponse
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

        ['stops' => $stops, 'summary' => $summary] = $this->buildDelayWaitingData($from, $to, $request->string('dev_eui')->value() ?: null);

        return response()->json(['stops' => $stops, 'summary' => $summary]);
    }

    public function exportDelayWaiting(Request $request): BinaryFileResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? now()->startOfDay();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            abort(422, 'Date range cannot exceed 90 days.');
        }

        ['stops' => $stops] = $this->buildDelayWaitingData($from, $to, $request->string('dev_eui')->value() ?: null);

        $export = array_map(fn (array $s) => [
            'Device Name' => $s['device_name'],
            'DEV EUI' => $s['dev_eui'],
            'Unit Type' => $s['unit_type'],
            'Type' => ucfirst($s['type']),
            'Zone' => $s['zone'],
            'Started At' => $s['started_at'],
            'Ended At' => $s['ended_at'],
            'Duration (min)' => $s['duration_min'],
        ], $stops);

        $filename = 'delay-waiting-'.$from->toDateString().'-to-'.$to->toDateString().'.xlsx';

        return Excel::download(
            new ArrayExport($export, ['Device Name', 'DEV EUI', 'Unit Type', 'Type', 'Zone', 'Started At', 'Ended At', 'Duration (min)'], 'Delay & Waiting'),
            $filename,
        );
    }

    /**
     * @return array{stops: array<int, array<string, mixed>>, summary: array<int, array<string, mixed>>}
     */
    private function buildDelayWaitingData(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
    {
        $idleThresholdKmh = 2.0;
        $minStopSeconds = 180;
        $maxGapSeconds = 300;

        $geofences = Geofence::where('is_active', true)
            ->whereIn('zone_type', ['loading', 'dumping', 'parking'])
            ->get();

        $devices = Device::active()
            ->when($devEuiFilter, fn ($q) => $q->where('dev_eui', $devEuiFilter))
            ->orderBy('device_name')
            ->get(['dev_eui', 'device_name', 'unit_type'])
            ->keyBy('dev_eui');

        $stops = [];

        foreach ($devices as $devEui => $device) {
            $prev = null;
            $stopStart = null;
            $stopPoint = null;

            $closeStop = function () use (&$stopStart, &$stopPoint, &$prev, $geofences, $devEui, $device, &$stops, $minStopSeconds) {
                if ($stopStart === null || $prev === null) {
                    return;
                }

                $duration = abs($prev->recorded_at->diffInSeconds($stopStart));
                if ($duration < $minStopSeconds) {
                    return;
                }

                $zone = null;
                foreach ($geofences as $geofence) {
                    if (GeoHelper::pointInPolygon((float) $stopPoint->latitude, (float) $stopPoint->longitude, $geofence->polygon)) {
                        $zone = $geofence->zone_type;
                        break;
                    }
                }

                if ($zone === 'parking') {
                    return;
                }

                $stops[] = [
                    'dev_eui' => $devEui,
                    'device_name' => $device?->device_name ?? $devEui,
                    'unit_type' => $device?->unit_type ?? 'other',
                    'type' => $zone === null ? 'delay' : 'waiting',
                    'zone' => $zone ?? 'on_route',
                    'latitude' => (float) $stopPoint->latitude,
                    'longitude' => (float) $stopPoint->longitude,
                    'started_at' => $stopStart->toIso8601String(),
                    'ended_at' => $prev->recorded_at->toIso8601String(),
                    'duration_min' => round($duration / 60, 1),
                ];
            };

            GpsLog::where('dev_eui', $devEui)
                ->whereBetween('recorded_at', [$from, $to->copy()->endOfDay()])
                ->orderBy('recorded_at')
                ->select(['dev_eui', 'latitude', 'longitude', 'speed_kmh', 'recorded_at'])
                ->lazy()
                ->each(function ($curr) use (&$prev, &$stopStart, &$stopPoint, $idleThresholdKmh, $maxGapSeconds, $closeStop) {
                    if ($prev !== null) {
                        $gap = abs($curr->recorded_at->diffInSeconds($prev->recorded_at));
                        if ($gap > $maxGapSeconds) {
                            $closeStop();
                            $stopStart = null;
                        }
                    }

                    $isStopped = (float) $curr->speed_kmh < $idleThresholdKmh;

                    if ($isStopped) {
                        if ($stopStart === null) {
                            $stopStart = $curr->recorded_at;
                            $stopPoint = $curr;
                        }
                    } else {
                        $closeStop();
                        $stopStart = null;
                    }

                    $prev = $curr;
                });

            $closeStop();
        }

        $summaryMap = [];
        foreach ($stops as $stop) {
            $key = $stop['dev_eui'];
            if (! isset($summaryMap[$key])) {
                $summaryMap[$key] = [
                    'dev_eui' => $stop['dev_eui'],
                    'device_name' => $stop['device_name'],
                    'unit_type' => $stop['unit_type'],
                    'waiting_count' => 0,
                    'waiting_min' => 0.0,
                    'delay_count' => 0,
                    'delay_min' => 0.0,
                ];
            }

            if ($stop['type'] === 'waiting') {
                $summaryMap[$key]['waiting_count']++;
                $summaryMap[$key]['waiting_min'] += $stop['duration_min'];
            } else {
                $summaryMap[$key]['delay_count']++;
                $summaryMap[$key]['delay_min'] += $stop['duration_min'];
            }
        }

        $summary = array_values(array_map(function ($s) {
            $s['waiting_min'] = round($s['waiting_min'], 1);
            $s['delay_min'] = round($s['delay_min'], 1);

            return $s;
        }, $summaryMap));

        usort($stops, fn ($a, $b) => strcmp($b['started_at'], $a['started_at']));

        return ['stops' => $stops, 'summary' => $summary];
    }

    public function gatewayReliability(Request $request): JsonResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->date('from') ?? now()->subDay();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            return response()->json(['message' => 'Date range cannot exceed 90 days.'], 422);
        }

        $rows = $this->buildGatewayReliabilityRows($from, $to);

        return response()->json(['data' => $rows]);
    }

    public function exportGatewayReliability(Request $request): BinaryFileResponse
    {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $request->date('from') ?? now()->subDay();
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            abort(422, 'Date range cannot exceed 90 days.');
        }

        $rows = $this->buildGatewayReliabilityRows($from, $to);

        $export = array_map(fn (array $r) => [
            'Gateway ID' => $r['gateway_id'],
            'Uplinks' => $r['uplink_count'],
            'Devices Served' => $r['device_count'],
            'Avg RSSI (dBm)' => $r['avg_rssi'],
            'Min RSSI (dBm)' => $r['min_rssi'],
            'Max RSSI (dBm)' => $r['max_rssi'],
            'Avg SNR (dB)' => $r['avg_snr'],
            'First Seen' => $r['first_seen'],
            'Last Seen' => $r['last_seen'],
        ], $rows);

        $filename = 'gateway-reliability-'.$from->toDateString().'-to-'.$to->toDateString().'.xlsx';

        return Excel::download(
            new ArrayExport($export, ['Gateway ID', 'Uplinks', 'Devices Served', 'Avg RSSI (dBm)', 'Min RSSI (dBm)', 'Max RSSI (dBm)', 'Avg SNR (dB)', 'First Seen', 'Last Seen'], 'Gateway Reliability'),
            $filename,
        );
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function buildGatewayReliabilityRows(CarbonInterface $from, CarbonInterface $to): array
    {
        return GpsLog::query()
            ->selectRaw('gateway_id, COUNT(*) as uplink_count, COUNT(DISTINCT dev_eui) as device_count, AVG(rssi) as avg_rssi, MIN(rssi) as min_rssi, MAX(rssi) as max_rssi, AVG(snr) as avg_snr, MIN(recorded_at) as first_seen, MAX(recorded_at) as last_seen')
            ->whereNotNull('gateway_id')
            ->whereBetween('recorded_at', [$from, $to->copy()->endOfDay()])
            ->groupBy('gateway_id')
            ->orderByDesc('uplink_count')
            ->get()
            ->map(fn ($row) => [
                'gateway_id' => $row->gateway_id,
                'uplink_count' => (int) $row->uplink_count,
                'device_count' => (int) $row->device_count,
                'avg_rssi' => round((float) $row->avg_rssi, 1),
                'min_rssi' => (int) $row->min_rssi,
                'max_rssi' => (int) $row->max_rssi,
                'avg_snr' => round((float) $row->avg_snr, 1),
                'first_seen' => Carbon::parse($row->first_seen)->toIso8601String(),
                'last_seen' => Carbon::parse($row->last_seen)->toIso8601String(),
            ])
            ->values()
            ->all();
    }
}
