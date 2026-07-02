<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\GpsLog;
use App\Support\GeoHelper;
use Carbon\Carbon;
use Carbon\CarbonInterface;

class ReportService
{
    public function __construct(private readonly FleetUtilizationService $fleetUtilizationService) {}

    /**
     * @return array<int, array<string, mixed>>
     */
    public function fleetUtilizationRows(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
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

    /**
     * @return array{0: array<int, array<string, mixed>>, 1: array<int, array<string, mixed>>}
     */
    public function speedViolationsData(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
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

    /**
     * @return array<int, array<string, mixed>>
     */
    public function geofenceAlertsData(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
    {
        $query = Alert::with('device')
            ->where('alert_type', 'geofence')
            ->whereBetween('triggered_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('triggered_at', 'desc');

        if ($devEuiFilter) {
            $query->where('dev_eui', $devEuiFilter);
        }

        return $query->get()->map(fn ($alert) => [
            'id' => $alert->id,
            'dev_eui' => $alert->dev_eui,
            'device_name' => $alert->device?->device_name ?? $alert->dev_eui,
            'unit_type' => $alert->device?->unit_type ?? 'other',
            'geofence_name' => $alert->meta['geofence_name'] ?? null,
            'event' => $alert->meta['event'] ?? null,
            'triggered_at' => $alert->triggered_at?->toIso8601String(),
            'triggered_at_human' => $alert->triggered_at?->diffForHumans(),
        ])->values()->all();
    }

    /**
     * @return array{trips: array<int, array<string, mixed>>, summary: array<int, array<string, mixed>>, warning: ?string}
     */
    public function cycleTimeData(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
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
                    $timeline[] = ['zone' => $zoneType, 'at' => $log->recorded_at, 'speed' => (float) $log->speed_kmh, 'lat' => $lat, 'lng' => $lng];
                });

            $tripDistanceKm = function (CarbonInterface $start, CarbonInterface $end) use ($timeline): float {
                $distance = 0.0;
                $prevPoint = null;
                foreach ($timeline as $point) {
                    if ($point['at']->lt($start) || $point['at']->gt($end)) {
                        continue;
                    }
                    if ($prevPoint !== null) {
                        $distance += GeoHelper::haversineKm($prevPoint['lat'], $prevPoint['lng'], $point['lat'], $point['lng']);
                    }
                    $prevPoint = $point;
                }

                return round($distance, 2);
            };

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
                if ($seg['zone'] === 'loading' && $currentTrip !== null && $currentTrip['dump_start'] !== null) {
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
                    $currentTrip['distance_km'] = $tripDistanceKm(Carbon::parse($currentTrip['load_start']), $seg['start']);
                    $currentTrip['avg_speed_kmh'] = $currentTrip['cycle_duration_min'] > 0
                        ? round($currentTrip['distance_km'] / ($currentTrip['cycle_duration_min'] / 60), 1)
                        : null;
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
                        'distance_km' => null,
                        'avg_speed_kmh' => null,
                    ];
                } elseif ($seg['zone'] === 'loading') {
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
                        'distance_km' => null,
                        'avg_speed_kmh' => null,
                    ];
                } elseif ($seg['zone'] === 'dumping' && $currentTrip !== null && $currentTrip['dump_start'] === null) {
                    $currentTrip['dump_start'] = $seg['start']->toIso8601String();
                    $currentTrip['dump_end'] = $seg['end']->toIso8601String();
                    $currentTrip['haul_duration_min'] = round(
                        abs($seg['start']->diffInSeconds(Carbon::parse($currentTrip['load_end']))) / 60,
                        1,
                    );
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

    /**
     * @return array{stops: array<int, array<string, mixed>>, summary: array<int, array<string, mixed>>}
     */
    public function delayWaitingData(CarbonInterface $from, CarbonInterface $to, ?string $devEuiFilter): array
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

    /**
     * @return array<int, array<string, mixed>>
     */
    public function gatewayReliabilityRows(CarbonInterface $from, CarbonInterface $to): array
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
