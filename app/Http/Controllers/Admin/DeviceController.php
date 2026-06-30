<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateDeviceRequest;
use App\Http\Requests\Admin\UpdateDeviceRequest;
use App\Models\Device;
use App\Models\DeviceGroup;
use App\Models\GpsLog;
use App\Support\UnitTypes;
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
                'last_seen_at' => $device->last_seen_at?->diffForHumans(),
            ]),
            'unitCategories' => UnitTypes::categories(),
            'groups' => $groups->map(fn (DeviceGroup $g) => [
                'id' => $g->id,
                'name' => $g->name,
                'color' => $g->color,
            ]),
        ]);
    }

    public function show(Device $device): Response
    {
        $gpsLogs = GpsLog::forDevice($device->dev_eui)
            ->orderByDesc('recorded_at')
            ->limit(200)
            ->get(['recorded_at', 'latitude', 'longitude', 'speed_kmh', 'heading_deg', 'rssi', 'snr', 'satellites', 'hdop']);

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
                'last_seen_at' => $device->last_seen_at?->diffForHumans(),
            ],
            'gpsLogs' => $gpsLogs->map(fn (GpsLog $log) => [
                'recorded_at' => $log->recorded_at?->toDateTimeString(),
                'latitude' => $log->latitude,
                'longitude' => $log->longitude,
                'speed_kmh' => $log->speed_kmh,
                'heading_deg' => $log->heading_deg,
                'rssi' => $log->rssi,
                'snr' => $log->snr,
                'satellites' => $log->satellites,
                'hdop' => $log->hdop,
            ]),
            'unitCategories' => UnitTypes::categories(),
        ]);
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
