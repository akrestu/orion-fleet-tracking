<?php

use App\Models\Alert;
use App\Models\AlertThreshold;
use App\Models\Device;
use App\Models\DeviceGroup;
use App\Models\GpsLog;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
});

// --- Access control ---

it('allows admin to view device management page', function () {
    $this->actingAs($this->admin)
        ->get('/admin/devices')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/devices/index'));
});

it('denies operator access to device management', function () {
    $this->actingAs($this->operator)
        ->get('/admin/devices')
        ->assertForbidden();
});

it('redirects unauthenticated users to login', function () {
    $this->get('/admin/devices')
        ->assertRedirect('/login');
});

// --- Create device ---

it('admin can create a new device', function () {
    $this->actingAs($this->admin)
        ->post('/admin/devices', [
            'dev_eui' => 'AABBCCDDEEFF0011',
            'application_id' => 'fleet-tracker',
            'device_name' => 'Test Unit 01',
            'unit_type' => 'oht',
            'is_active' => true,
            'operational_status' => 'operational',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('devices', [
        'dev_eui' => 'AABBCCDDEEFF0011',
        'device_name' => 'Test Unit 01',
    ]);
});

it('rejects creating a device with a duplicate dev_eui', function () {
    $existing = Device::factory()->create();

    $this->actingAs($this->admin)
        ->post('/admin/devices', [
            'dev_eui' => $existing->dev_eui,
            'application_id' => 'fleet-tracker',
            'device_name' => 'Duplicate',
            'unit_type' => 'oht',
            'is_active' => true,
        ])
        ->assertSessionHasErrors('dev_eui');
});

// --- Update device ---

it('admin can update a device', function () {
    $device = Device::factory()->create(['device_name' => 'Old Name']);

    $this->actingAs($this->admin)
        ->put("/admin/devices/{$device->id}", [
            'application_id' => $device->application_id,
            'device_name' => 'New Name',
            'unit_type' => $device->unit_type,
            'is_active' => false,
            'operational_status' => 'operational',
        ])
        ->assertRedirect();

    expect($device->fresh())
        ->device_name->toBe('New Name')
        ->is_active->toBeFalse();
});

// --- Delete device ---

it('admin can delete a device', function () {
    $device = Device::factory()->create();

    $this->actingAs($this->admin)
        ->delete("/admin/devices/{$device->id}")
        ->assertRedirect();

    $this->assertSoftDeleted('devices', ['id' => $device->id]);
});

it('lists devices with ISO last-seen timestamps', function () {
    $admin = User::factory()->admin()->create();
    Device::factory()->create(['last_seen_at' => '2026-11-17 03:00:00']);

    $this->actingAs($admin)
        ->get(route('admin.devices.index'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('devices.0.last_seen_at', '2026-11-17T03:00:00+00:00'));
});

it('device detail exposes info, logs, effective overspeed limit and deferred stats', function () {
    $admin = User::factory()->admin()->create();
    $group = DeviceGroup::factory()->create(['name' => 'Pit Utara']);
    $device = Device::factory()->create(['unit_type' => 'oht', 'device_group_id' => $group->id]);

    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'gateway_id' => 'GW-PIT-N01',
        'speed_kmh' => 42,
        'recorded_at' => now()->subMinute(),
    ]);
    Alert::create(['dev_eui' => $device->dev_eui, 'alert_type' => 'overspeed', 'triggered_at' => now()]);

    AlertThreshold::factory()->create(['alert_type' => 'overspeed', 'threshold_value' => 50]);
    AlertThreshold::factory()->create(['alert_type' => 'overspeed', 'unit_type' => 'oht', 'threshold_value' => 40]);
    AlertThreshold::factory()->create(['alert_type' => 'overspeed', 'unit_type' => 'dt', 'threshold_value' => 30]);

    $this->actingAs($admin)
        ->get(route('admin.devices.show', $device))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/devices/show')
            ->where('device.group_name', 'Pit Utara')
            ->where('device.last_gateway', 'GW-PIT-N01')
            ->where('overspeedThreshold', 40)
            ->where('gpsLogs.0.gateway_id', 'GW-PIT-N01')
            ->missing('stats')
            ->loadDeferredProps(fn (Assert $page) => $page
                ->where('stats.alerts', 1)
                ->has('stats', fn (Assert $s) => $s->hasAll(['distance_km', 'running_hours', 'idle_hours', 'cycles', 'avg_cycle_min', 'alerts']))));
});
