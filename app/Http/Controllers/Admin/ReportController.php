<?php

namespace App\Http\Controllers\Admin;

use App\Exports\ArrayExport;
use App\Http\Controllers\Controller;
use App\Models\Alert;
use App\Models\Device;
use App\Models\GpsLog;
use App\Services\ReportService;
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
    public function __construct(private readonly ReportService $reportService) {}

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
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request);

        $rows = $this->reportService->fleetUtilizationRows($from, $to, $devEuiFilter);

        return response()->json(['data' => $rows]);
    }

    public function exportFleetUtilization(Request $request): BinaryFileResponse
    {
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, abortOnRangeExceeded: true);

        $rows = $this->reportService->fleetUtilizationRows($from, $to, $devEuiFilter);

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

    public function speedViolations(Request $request): JsonResponse
    {
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request);

        [$rows, $summary] = $this->reportService->speedViolationsData($from, $to, $devEuiFilter);

        return response()->json(['data' => $rows, 'summary' => $summary]);
    }

    public function exportSpeedViolations(Request $request): BinaryFileResponse
    {
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, abortOnRangeExceeded: true);

        [$rows] = $this->reportService->speedViolationsData($from, $to, $devEuiFilter);

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

    public function exportGpsLogs(Request $request): StreamedResponse
    {
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, abortOnRangeExceeded: true);

        $query = GpsLog::with('device')
            ->whereBetween('recorded_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('recorded_at');

        if ($devEuiFilter) {
            $query->where('dev_eui', $devEuiFilter);
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
        $request->validate(['alert_type' => ['nullable', 'string']]);

        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, abortOnRangeExceeded: true);

        $query = Alert::with('device')
            ->whereBetween('triggered_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('triggered_at', 'desc');

        if ($devEuiFilter) {
            $query->where('dev_eui', $devEuiFilter);
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
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, startOfDay: true);

        ['trips' => $trips, 'summary' => $summary, 'warning' => $warning] = $this->reportService->cycleTimeData($from, $to, $devEuiFilter);

        return response()->json(['trips' => $trips, 'summary' => $summary, 'warning' => $warning]);
    }

    public function exportCycleTime(Request $request): BinaryFileResponse
    {
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, startOfDay: true, abortOnRangeExceeded: true);

        ['trips' => $trips] = $this->reportService->cycleTimeData($from, $to, $devEuiFilter);

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

    public function delayWaiting(Request $request): JsonResponse
    {
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, startOfDay: true);

        ['stops' => $stops, 'summary' => $summary] = $this->reportService->delayWaitingData($from, $to, $devEuiFilter);

        return response()->json(['stops' => $stops, 'summary' => $summary]);
    }

    public function exportDelayWaiting(Request $request): BinaryFileResponse
    {
        [$from, $to, $devEuiFilter] = $this->parseDateRange($request, startOfDay: true, abortOnRangeExceeded: true);

        ['stops' => $stops] = $this->reportService->delayWaitingData($from, $to, $devEuiFilter);

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

    public function gatewayReliability(Request $request): JsonResponse
    {
        [$from, $to] = $this->parseDateRange($request, defaultFrom: fn () => now()->subDay());

        $rows = $this->reportService->gatewayReliabilityRows($from, $to);

        return response()->json(['data' => $rows]);
    }

    public function exportGatewayReliability(Request $request): BinaryFileResponse
    {
        [$from, $to] = $this->parseDateRange($request, defaultFrom: fn () => now()->subDay(), abortOnRangeExceeded: true);

        $rows = $this->reportService->gatewayReliabilityRows($from, $to);

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
     * Validate and resolve the common `from`/`to`/`dev_eui` report filters.
     *
     * @return array{0: CarbonInterface, 1: CarbonInterface, 2: ?string}
     */
    private function parseDateRange(
        Request $request,
        bool $startOfDay = false,
        bool $abortOnRangeExceeded = false,
        ?\Closure $defaultFrom = null,
    ): array {
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'dev_eui' => ['nullable', 'string'],
        ]);

        $from = $request->date('from') ?? ($defaultFrom ? $defaultFrom() : ($startOfDay ? now()->startOfDay() : now()->startOfMonth()));
        $to = $request->date('to') ?? now()->endOfDay();

        if ($from->diffInDays($to) > 90) {
            if ($abortOnRangeExceeded) {
                abort(422, 'Date range cannot exceed 90 days.');
            }

            abort(response()->json(['message' => 'Date range cannot exceed 90 days.'], 422));
        }

        return [$from, $to, $request->string('dev_eui')->value() ?: null];
    }
}
