<?php

namespace App\Services;

use App\Models\Alert;
use App\Models\Device;
use App\Models\DeviceGroup;
use App\Models\GpsLog;
use App\Support\UnitTypes;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;

/**
 * Builds the Fleet Overview dashboard (hero, KPI tiles and the six insight
 * sections) for one user scope and one set of filters.
 *
 * Timestamps are stored in UTC; periods, shifts and hourly buckets are
 * expressed in site time (WIB, UTC+7, no DST).
 *
 * @phpstan-type Filters array{group: int|null, period: string, shift: string, unit_type: string|null, condition: string|null}
 */
class DashboardService
{
    public const TIMEZONE = 'Asia/Jakarta';

    /** recorded_at shifted to WIB (UTC+7) inside SQL; MySQL time zone tables are not assumed. */
    private const WIB_TIME_SQL = 'DATE_ADD(recorded_at, INTERVAL 7 HOUR)';

    private const WIB_HOUR_SQL = 'HOUR(DATE_ADD(recorded_at, INTERVAL 7 HOUR))';

    public const PERIODS = ['today', '7d', '30d'];

    /** Shift 1 = 06:00–17:59 WIB, shift 2 = 18:00–05:59 WIB. */
    public const SHIFTS = ['all', '1', '2'];

    public const CONDITIONS = ['operational', 'standby', 'breakdown'];

    public const ALERT_TYPES = ['overspeed', 'geofence', 'offline', 'low_signal'];

    /** Average RSSI (dBm) below which a unit is listed as low-signal. */
    private const LOW_SIGNAL_RSSI = -100;

    public function __construct(
        private readonly FleetUtilizationService $fleetUtilizationService,
        private readonly ReportService $reportService,
    ) {}

    /**
     * Read filters from the query string; unknown or inaccessible values fall back to defaults.
     *
     * @param  array<int>|null  $accessibleGroupIds  null = unrestricted (admin)
     * @return Filters
     */
    public function resolveFilters(Request $request, ?array $accessibleGroupIds): array
    {
        $group = filter_var($request->query('group'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $group = $group === false ? null : $group;

        if ($group !== null) {
            $allowed = $accessibleGroupIds === null
                ? DeviceGroup::whereKey($group)->exists()
                : in_array($group, $accessibleGroupIds, true);

            $group = $allowed ? $group : null;
        }

        return [
            'group' => $group,
            'period' => $this->pick($request->query('period'), self::PERIODS, 'today'),
            'shift' => $this->pick($request->query('shift'), self::SHIFTS, 'all'),
            'unit_type' => $this->pick($request->query('unit_type'), UnitTypes::keys(), null),
            'condition' => $this->pick($request->query('condition'), self::CONDITIONS, null),
        ];
    }

    /**
     * Active devices visible to the user after applying the filters.
     *
     * @param  Filters  $filters
     * @param  array<int>|null  $accessibleGroupIds
     * @return Collection<int, Device>
     */
    public function devices(array $filters, ?array $accessibleGroupIds): Collection
    {
        return Device::active()
            ->when($accessibleGroupIds !== null, fn (Builder $q) => $q->whereIn('device_group_id', $accessibleGroupIds))
            ->when($filters['group'] !== null, fn (Builder $q) => $q->where('device_group_id', $filters['group']))
            ->when($filters['unit_type'] !== null, fn (Builder $q) => $q->where('unit_type', $filters['unit_type']))
            ->when($filters['condition'] !== null, fn (Builder $q) => $q->where('operational_status', $filters['condition']))
            ->get();
    }

    /**
     * @param  array<int>|null  $accessibleGroupIds
     * @return array{groups: array<int, array{id: int, name: string}>, unitTypes: array<int, array{value: string, label: string}>, conditions: array<int, string>}
     */
    public function options(?array $accessibleGroupIds): array
    {
        $groups = DeviceGroup::query()
            ->when($accessibleGroupIds !== null, fn (Builder $q) => $q->whereKey($accessibleGroupIds))
            ->orderBy('name')
            ->get(['id', 'name'])
            ->map(fn (DeviceGroup $group) => ['id' => $group->id, 'name' => $group->name])
            ->values()
            ->all();

        $unitTypes = collect(UnitTypes::categories())
            ->map(fn (array $meta, string $key) => ['value' => $key, 'label' => $meta['label']])
            ->values()
            ->all();

        return ['groups' => $groups, 'unitTypes' => $unitTypes, 'conditions' => self::CONDITIONS];
    }

    /**
     * @param  Collection<int, Device>  $devices
     * @param  Filters  $filters
     * @return array{total: int, online: int, site: string|null}
     */
    public function hero(Collection $devices, array $filters): array
    {
        return [
            'total' => $devices->count(),
            'online' => $devices->filter(fn (Device $d) => $d->status === 'online')->count(),
            'site' => $filters['group'] !== null ? DeviceGroup::whereKey($filters['group'])->value('name') : null,
        ];
    }

    /**
     * KPI tiles: value, delta and a 12-point sparkline each.
     *
     * @param  Collection<int, Device>  $devices
     * @param  Filters  $filters
     * @return array<string, array<string, mixed>>
     */
    public function kpis(Collection $devices, array $filters): array
    {
        $euis = $devices->pluck('dev_eui')->all();
        $now = CarbonImmutable::now();
        [$from, $to] = $this->range($filters['period']);

        $total = $devices->count();
        $online = $devices->filter(fn (Device $d) => $d->status === 'online')->count();
        $offline = $total - $online;

        $hourly = $this->hourlyActivity($euis, $now);
        $onlineSpark = array_column($hourly, 'devices');
        $logsSpark = array_column($hourly, 'logs');

        $onlineHourAgo = GpsLog::whereIn('dev_eui', $euis)
            ->whereBetween('recorded_at', [$now->subMinutes(70), $now->subMinutes(60)])
            ->distinct()
            ->count('dev_eui');

        $logs = $this->logs($euis, $filters['shift'])->whereBetween('recorded_at', [$from, $to])->count();
        $span = $from->diffInSeconds($to);
        $previousLogs = $this->logs($euis, $filters['shift'])
            ->whereBetween('recorded_at', [$from->subSeconds((int) $span), $from])
            ->count();

        $lastHour = GpsLog::whereIn('dev_eui', $euis)->where('recorded_at', '>=', $now->subHour())->count();

        $newThisMonth = $devices
            ->filter(fn (Device $d) => $d->created_at !== null
                && $d->created_at->gte($now->setTimezone(self::TIMEZONE)->startOfMonth()))
            ->count();

        return [
            'total' => ['value' => $total, 'delta' => $newThisMonth, 'spark' => array_fill(0, 12, $total)],
            'online' => [
                'value' => $online,
                'pct' => $total > 0 ? (int) round($online / $total * 100) : 0,
                'spark' => $onlineSpark,
            ],
            'offline' => [
                'value' => $offline,
                'delta' => $offline - ($total - $onlineHourAgo),
                'spark' => array_map(fn (int $count) => max(0, $total - $count), $onlineSpark),
            ],
            'logs' => [
                'value' => $logs,
                'delta_pct' => $previousLogs > 0 ? (int) round(($logs - $previousLogs) / $previousLogs * 100) : null,
                'spark' => $logsSpark,
            ],
            'lastHour' => [
                'value' => $lastHour,
                'rate_per_sec' => round($lastHour / 3600, 1),
                'spark' => $this->lastHourBuckets($euis, $now),
            ],
        ];
    }

    /**
     * The six dashboard insight sections.
     *
     * @param  Collection<int, Device>  $devices
     * @param  Filters  $filters
     * @return array<string, mixed>
     */
    public function sections(Collection $devices, array $filters): array
    {
        $euis = $devices->pluck('dev_eui')->all();
        $namesByEui = $devices->pluck('device_name', 'dev_eui');
        [$from, $to] = $this->range($filters['period']);

        return [
            'tracking' => $this->tracking($devices),
            'safety' => $this->safety($euis, $namesByEui->all(), $from, $to),
            'activeAlerts' => $this->activeAlerts($euis, $namesByEui->all()),
            'maintenance' => $this->maintenance($devices, $euis, $namesByEui->all(), $filters['shift'], $from, $to),
            'productivity' => $this->productivity($euis, $from, $to),
            'infrastructure' => $this->infrastructure($euis, $filters['shift'], $from, $to),
            'performance' => $this->performance($euis, $filters['shift'], $from, $to),
        ];
    }

    /**
     * @param  Collection<int, Device>  $devices
     * @return array<int, array{type: string, online: int, total: int}>
     */
    private function tracking(Collection $devices): array
    {
        return $devices
            ->groupBy('unit_type')
            ->map(fn (Collection $group, string $type) => [
                'type' => $type,
                'online' => $group->filter(fn (Device $d) => $d->status === 'online')->count(),
                'total' => $group->count(),
            ])
            ->sortByDesc('total')
            ->values()
            ->all();
    }

    /**
     * @param  array<int, string>  $euis
     * @param  array<string, string>  $names
     * @return array{counts: array<string, int>, topOverspeed: array<int, array{device_name: string, events: int, max_speed: float|null}>}
     */
    private function safety(array $euis, array $names, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $alerts = Alert::whereIn('dev_eui', $euis)
            ->whereBetween('triggered_at', [$from, $to])
            ->get(['dev_eui', 'alert_type', 'meta']);

        $counts = collect(self::ALERT_TYPES)
            ->mapWithKeys(fn (string $type) => [
                $type => $alerts->filter(fn (Alert $a) => $a->alert_type->value === $type)->count(),
            ])
            ->all();

        $topOverspeed = $alerts
            ->filter(fn (Alert $a) => $a->alert_type->value === 'overspeed')
            ->groupBy('dev_eui')
            ->map(function (Collection $group, string $devEui) use ($names) {
                $speeds = $group->map(fn (Alert $a) => isset($a->meta['speed_kmh']) ? (float) $a->meta['speed_kmh'] : null)->filter();

                return [
                    'device_name' => $names[$devEui] ?? $devEui,
                    'events' => $group->count(),
                    'max_speed' => $speeds->isEmpty() ? null : round($speeds->max(), 1),
                ];
            })
            ->sortBy([['events', 'desc'], ['max_speed', 'desc']])
            ->take(3)
            ->values()
            ->all();

        return ['counts' => $counts, 'topOverspeed' => $topOverspeed];
    }

    /**
     * Latest unresolved alerts (any period) for the mobile "Active alerts" card.
     *
     * @param  array<int, string>  $euis
     * @param  array<string, string>  $names
     * @return array<int, array{id: int, type: string, device_name: string, speed_kmh: float|null, threshold_kmh: float|null, zone: string|null, event: string|null, triggered_at: string|null}>
     */
    private function activeAlerts(array $euis, array $names): array
    {
        return Alert::unresolved()
            ->whereIn('dev_eui', $euis)
            ->latest('triggered_at')
            ->limit(5)
            ->get(['id', 'dev_eui', 'alert_type', 'meta', 'triggered_at'])
            ->map(fn (Alert $alert) => [
                'id' => $alert->id,
                'type' => $alert->alert_type->value,
                'device_name' => $names[$alert->dev_eui] ?? $alert->dev_eui,
                'speed_kmh' => isset($alert->meta['speed_kmh']) ? round((float) $alert->meta['speed_kmh'], 1) : null,
                'threshold_kmh' => isset($alert->meta['threshold']) ? round((float) $alert->meta['threshold'], 1) : null,
                'zone' => $alert->meta['geofence_name'] ?? null,
                'event' => $alert->meta['event'] ?? null,
                'triggered_at' => $alert->triggered_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, Device>  $devices
     * @param  array<int, string>  $euis
     * @param  array<string, string>  $names
     * @return array{conditions: array<string, int>, lowSignal: array<int, array{device_name: string, avg_rssi: int, avg_snr: float}>}
     */
    private function maintenance(Collection $devices, array $euis, array $names, string $shift, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $conditions = collect(self::CONDITIONS)
            ->mapWithKeys(fn (string $c) => [$c => $devices->where('operational_status', $c)->count()])
            ->all();

        $lowSignal = $this->logs($euis, $shift)
            ->whereBetween('recorded_at', [$from, $to])
            ->whereNotNull('rssi')
            ->selectRaw('dev_eui, AVG(rssi) as avg_rssi, AVG(snr) as avg_snr')
            ->groupBy('dev_eui')
            ->havingRaw('AVG(rssi) < ?', [self::LOW_SIGNAL_RSSI])
            ->orderBy('avg_rssi')
            ->limit(3)
            ->toBase()
            ->get()
            ->map(fn ($row) => [
                'device_name' => $names[$row->dev_eui] ?? $row->dev_eui,
                'avg_rssi' => (int) round((float) $row->avg_rssi),
                'avg_snr' => round((float) $row->avg_snr, 1),
            ])
            ->values()
            ->all();

        return ['conditions' => $conditions, 'lowSignal' => $lowSignal];
    }

    /**
     * Running vs idle hours, distance and average cycle time over the period.
     * Shift is not applied here: utilization is computed from continuous trips.
     *
     * @param  array<int, string>  $euis
     * @return array{running_hours: float, idle_hours: float, utilization_pct: int|null, distance_km: float, avg_cycle_min: float|null}
     */
    private function productivity(array $euis, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $running = 0.0;
        $idle = 0.0;
        $distance = 0.0;

        foreach ($euis as $devEui) {
            $stats = $this->fleetUtilizationService->computeForDevice($devEui, $from, $to);

            if ($stats !== null) {
                $running += $stats['running_hours'];
                $idle += $stats['idle_hours'];
                $distance += $stats['distance_km'];
            }
        }

        $avgCycle = null;

        if ($euis !== []) {
            $summary = collect($this->reportService->cycleTimeData($from, $to, null)['summary'])
                ->whereIn('dev_eui', $euis)
                ->filter(fn (array $row) => $row['avg_cycle_min'] !== null && $row['trip_count'] > 0);

            $trips = $summary->sum('trip_count');
            $avgCycle = $trips > 0
                ? round($summary->sum(fn (array $row) => $row['avg_cycle_min'] * $row['trip_count']) / $trips, 1)
                : null;
        }

        $tracked = $running + $idle;

        return [
            'running_hours' => round($running, 1),
            'idle_hours' => round($idle, 1),
            'utilization_pct' => $tracked > 0 ? (int) round($running / $tracked * 100) : null,
            'distance_km' => round($distance, 1),
            'avg_cycle_min' => $avgCycle,
        ];
    }

    /**
     * @param  array<int, string>  $euis
     * @return array{gateway_count: int, gateways: array<int, array{gateway_id: string, avg_rssi: int, avg_snr: float, uplink_count: int}>}
     */
    private function infrastructure(array $euis, string $shift, CarbonImmutable $from, CarbonImmutable $to): array
    {
        $base = fn () => $this->logs($euis, $shift)
            ->whereBetween('recorded_at', [$from, $to])
            ->whereNotNull('gateway_id');

        $gateways = $base()
            ->selectRaw('gateway_id, AVG(rssi) as avg_rssi, AVG(snr) as avg_snr, COUNT(*) as uplink_count')
            ->groupBy('gateway_id')
            ->orderByDesc('uplink_count')
            ->limit(5)
            ->toBase()
            ->get()
            ->map(fn ($row) => [
                'gateway_id' => $row->gateway_id,
                'avg_rssi' => (int) round((float) $row->avg_rssi),
                'avg_snr' => round((float) $row->avg_snr, 1),
                'uplink_count' => (int) $row->uplink_count,
            ])
            ->values()
            ->all();

        return [
            'gateway_count' => (int) $base()->distinct()->count('gateway_id'),
            'gateways' => $gateways,
        ];
    }

    /**
     * Average speed per WIB hour of day across the period.
     *
     * @param  array<int, string>  $euis
     * @return array<int, array{hour: string, avg_speed: float}>
     */
    private function performance(array $euis, string $shift, CarbonImmutable $from, CarbonImmutable $to): array
    {
        return $this->logs($euis, $shift)
            ->whereBetween('recorded_at', [$from, $to])
            ->selectRaw('LPAD('.self::WIB_HOUR_SQL.", 2, '0') as hour, AVG(speed_kmh) as avg_speed")
            ->groupBy('hour')
            ->orderBy('hour')
            ->toBase()
            ->get()
            ->map(fn ($row) => ['hour' => (string) $row->hour, 'avg_speed' => round((float) $row->avg_speed, 1)])
            ->values()
            ->all();
    }

    /**
     * Distinct reporting devices and uplink count for each of the last 12 WIB hours (oldest first).
     *
     * @param  array<int, string>  $euis
     * @return array<int, array{devices: int, logs: int}>
     */
    private function hourlyActivity(array $euis, CarbonImmutable $now): array
    {
        $rows = GpsLog::whereIn('dev_eui', $euis)
            ->where('recorded_at', '>=', $now->subHours(11)->startOfHour())
            ->selectRaw('DATE_FORMAT('.self::WIB_TIME_SQL.", '%Y-%m-%d %H') as bucket, COUNT(DISTINCT dev_eui) as devices, COUNT(*) as logs")
            ->groupBy('bucket')
            ->toBase()
            ->get()
            ->keyBy('bucket');

        $wibNow = $now->setTimezone(self::TIMEZONE);

        return collect(range(11, 0))
            ->map(function (int $hoursAgo) use ($rows, $wibNow) {
                $row = $rows->get($wibNow->subHours($hoursAgo)->format('Y-m-d H'));

                return ['devices' => (int) ($row->devices ?? 0), 'logs' => (int) ($row->logs ?? 0)];
            })
            ->all();
    }

    /**
     * Uplinks in each 5-minute slot of the last hour (oldest first).
     *
     * @param  array<int, string>  $euis
     * @return array<int, int>
     */
    private function lastHourBuckets(array $euis, CarbonImmutable $now): array
    {
        $counts = GpsLog::whereIn('dev_eui', $euis)
            ->where('recorded_at', '>=', $now->subHour())
            ->selectRaw('FLOOR(TIMESTAMPDIFF(SECOND, recorded_at, ?) / 300) as slot, COUNT(*) as total', [$now->toDateTimeString()])
            ->groupBy('slot')
            ->pluck('total', 'slot');

        return collect(range(11, 0))->map(fn (int $slot) => (int) ($counts[$slot] ?? 0))->all();
    }

    /**
     * GPS logs for the given devices, optionally limited to a shift.
     *
     * @param  array<int, string>  $euis
     * @return Builder<GpsLog>
     */
    private function logs(array $euis, string $shift): Builder
    {
        return GpsLog::query()
            ->whereIn('dev_eui', $euis)
            ->when($shift === '1', fn (Builder $q) => $q->whereRaw(self::WIB_HOUR_SQL.' BETWEEN 6 AND 17'))
            ->when($shift === '2', fn (Builder $q) => $q->whereRaw(self::WIB_HOUR_SQL.' NOT BETWEEN 6 AND 17'));
    }

    /**
     * Period start (WIB midnight) and now, both in UTC.
     *
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}
     */
    private function range(string $period): array
    {
        $now = CarbonImmutable::now();
        $days = match ($period) {
            '7d' => 6,
            '30d' => 29,
            default => 0,
        };

        $from = $now->setTimezone(self::TIMEZONE)->subDays($days)->startOfDay()->utc();

        return [$from, $now];
    }

    /**
     * @param  array<int, string>  $allowed
     */
    private function pick(mixed $value, array $allowed, ?string $default): ?string
    {
        return is_string($value) && in_array($value, $allowed, true) ? $value : $default;
    }
}
