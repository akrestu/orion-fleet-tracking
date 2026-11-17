<?php

namespace App\Http\Controllers\Admin;

use App\Enums\AlertType;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateDeviceRequest;
use App\Http\Requests\Admin\UpdateDeviceRequest;
use App\Models\Alert;
use App\Models\AlertThreshold;
use App\Models\Device;
use App\Models\DeviceGroup;
use App\Models\GpsLog;
use App\Services\DashboardService;
use App\Services\FleetUtilizationService;
use App\Services\ReportService;
use App\Support\UnitTypes;
use Carbon\CarbonImmutable;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

class DeviceController extends Controller
{
    public function index(): Response
    {
        $devices = Device::query()
            ->with('deviceGroup:id,name,color')
            ->orderBy('device_name')
            ->get(['id', 'device_group_id', 'dev_eui', 'join_eui', 'application_id', 'device_name', 'unit_type', 'unit_model', 'is_active', 'operational_status', 'last_seen_at']);

        $groups = DeviceGroup::orderBy('name')->get(['id', 'name', 'color']);

        return Inertia::render('admin/devices/index', [
            'devices' => $devices->map(fn (Device $device) => [
                'id' => $device->id,
                'device_group_id' => $device->device_group_id,
                'device_group' => $device->deviceGroup ? [
                    'id' => $device->deviceGroup->id,
                    'name' => $device->deviceGroup->name,
                    'color' => $device->deviceGroup->color,
                ] : null,
                'dev_eui' => $device->dev_eui,
                'join_eui' => $device->join_eui,
                'application_id' => $device->application_id,
                'device_name' => $device->device_name,
                'unit_type' => $device->unit_type,
                'unit_model' => $device->unit_model,
                'is_active' => $device->is_active,
                'operational_status' => $device->operational_status,
                'status' => $device->status,
                'last_seen_at' => $device->last_seen_at?->toIso8601String(),
            ]),
            'unitCategories' => UnitTypes::categories(),
            'groups' => $groups->map(fn (DeviceGroup $g) => [
                'id' => $g->id,
                'name' => $g->name,
                'color' => $g->color,
            ]),
        ]);
    }

    public function show(Device $device, FleetUtilizationService $utilization, ReportService $reports): Response
    {
        $gpsLogs = GpsLog::forDevice($device->dev_eui)
            ->orderByDesc('recorded_at')
            ->limit(200)
            ->get(['recorded_at', 'latitude', 'longitude', 'speed_kmh', 'heading_deg', 'rssi', 'snr', 'satellites', 'hdop', 'gateway_id']);

        $device->loadMissing('deviceGroup:id,name');

        return Inertia::render('admin/devices/show', [
            'device' => [
                'id' => $device->id,
                'dev_eui' => $device->dev_eui,
                'join_eui' => $device->join_eui,
                'application_id' => $device->application_id,
                'device_name' => $device->device_name,
                'unit_type' => $device->unit_type,
                'unit_model' => $device->unit_model,
                'is_active' => $device->is_active,
                'operational_status' => $device->operational_status,
                'status' => $device->status,
                'last_seen_at' => $device->last_seen_at?->toIso8601String(),
                'device_group_id' => $device->device_group_id,
                'group_name' => $device->deviceGroup?->name,
                'last_gateway' => $gpsLogs->first()?->gateway_id,
                'created_at' => $device->created_at?->toIso8601String(),
            ],
            'overspeedThreshold' => $this->overspeedThreshold($device),
            'gpsLogs' => $gpsLogs->map(fn (GpsLog $log) => [
                'recorded_at' => $log->recorded_at->toIso8601String(),
                'latitude' => (float) $log->latitude,
                'longitude' => (float) $log->longitude,
                'speed_kmh' => $log->speed_kmh,
                'heading_deg' => $log->heading_deg,
                'rssi' => $log->rssi,
                'snr' => $log->snr !== null ? (float) $log->snr : null,
                'satellites' => $log->satellites,
                'hdop' => $log->hdop !== null ? (float) $log->hdop : null,
                'gateway_id' => $log->gateway_id,
            ]),
            'stats' => Inertia::defer(fn () => $this->todayStats($device, $utilization, $reports)),
            'unitCategories' => UnitTypes::categories(),
            'groups' => DeviceGroup::orderBy('name')->get(['id', 'name', 'color']),
        ]);
    }

    /**
     * Today (WIB) at a glance for one unit.
     *
     * @return array{distance_km: float|null, running_hours: float|null, idle_hours: float|null, cycles: int, avg_cycle_min: float|null, alerts: int}
     */
    private function todayStats(Device $device, FleetUtilizationService $utilization, ReportService $reports): array
    {
        $from = CarbonImmutable::now(DashboardService::TIMEZONE)->startOfDay()->utc();
        $to = CarbonImmutable::now('UTC');

        $usage = $utilization->computeForDevice($device->dev_eui, $from, $to);
        $cycle = collect($reports->cycleTimeData($from, $to, $device->dev_eui)['summary'])
            ->firstWhere('dev_eui', $device->dev_eui);

        return [
            'distance_km' => $usage !== null ? round($usage['distance_km'], 1) : null,
            'running_hours' => $usage !== null ? round($usage['running_hours'], 1) : null,
            'idle_hours' => $usage !== null ? round($usage['idle_hours'], 1) : null,
            'cycles' => (int) ($cycle['trip_count'] ?? 0),
            'avg_cycle_min' => isset($cycle['avg_cycle_min']) ? (float) $cycle['avg_cycle_min'] : null,
            'alerts' => Alert::where('dev_eui', $device->dev_eui)->where('triggered_at', '>=', $from)->count(),
        ];
    }

    /** Effective overspeed limit (km/h): device rule › unit-type rule › global rule. */
    private function overspeedThreshold(Device $device): ?float
    {
        $rules = AlertThreshold::where('alert_type', AlertType::Overspeed)
            ->where('is_active', true)
            ->where(fn ($q) => $q->where('dev_eui', $device->dev_eui)
                ->orWhere(fn ($q) => $q->whereNull('dev_eui')->where('unit_type', $device->unit_type))
                ->orWhere(fn ($q) => $q->whereNull('dev_eui')->whereNull('unit_type')))
            ->get();

        $rule = $rules->firstWhere('dev_eui', $device->dev_eui)
            ?? $rules->first(fn (AlertThreshold $r) => $r->dev_eui === null && $r->unit_type !== null)
            ?? $rules->first(fn (AlertThreshold $r) => $r->dev_eui === null && $r->unit_type === null);

        return $rule?->threshold_value;
    }

    public function store(CreateDeviceRequest $request): RedirectResponse
    {
        Device::create([
            'device_group_id' => $request->validated('device_group_id'),
            'dev_eui' => $request->validated('dev_eui'),
            'join_eui' => $request->validated('join_eui'),
            'application_id' => $request->validated('application_id'),
            'device_name' => $request->validated('device_name'),
            'unit_type' => $request->validated('unit_type'),
            'unit_model' => $request->validated('unit_model'),
            'is_active' => $request->boolean('is_active', true),
            'operational_status' => $request->validated('operational_status', 'operational'),
        ]);

        return back()->with('success', 'Device created successfully.');
    }

    public function update(UpdateDeviceRequest $request, Device $device): RedirectResponse
    {
        $device->update([
            'device_group_id' => $request->validated('device_group_id'),
            'join_eui' => $request->validated('join_eui'),
            'application_id' => $request->validated('application_id'),
            'device_name' => $request->validated('device_name'),
            'unit_type' => $request->validated('unit_type'),
            'unit_model' => $request->validated('unit_model'),
            'is_active' => $request->boolean('is_active'),
            'operational_status' => $request->validated('operational_status'),
        ]);

        return back()->with('success', 'Device updated successfully.');
    }

    public function destroy(Device $device): RedirectResponse
    {
        $device->delete();

        return back()->with('success', 'Device deleted successfully.');
    }
}
