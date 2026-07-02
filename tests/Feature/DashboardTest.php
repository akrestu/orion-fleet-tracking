<?php

use App\Models\Device;
use App\Models\GpsLog;
use App\Models\User;

test('guests are redirected to the login page', function () {
    $response = $this->get(route('dashboard'));
    $response->assertRedirect(route('login'));
});

test('authenticated users can visit the dashboard', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $response = $this->get(route('dashboard'));
    $response->assertOk();
});

test('dashboard exposes maintenance and gateway signal data', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $device = Device::factory()->create();
    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'gateway_id' => 'GW-001',
        'rssi' => -80,
        'snr' => 6,
        'speed_kmh' => 10,
        'recorded_at' => now(),
    ]);

    $response = $this->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('maintenance', fn ($page) => $page->hasAll(['running_hours', 'idle_hours']))
        ->has('gatewaySignal.0', fn ($page) => $page
            ->where('gateway_id', 'GW-001')
            ->hasAll(['avg_rssi', 'avg_snr', 'uplink_count'])));
});

test('dashboard exposes unit type counts and alert summary as plain arrays', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    Device::factory()->create(['unit_type' => 'oht']);
    Device::factory()->create(['unit_type' => 'oht']);
    Device::factory()->create(['unit_type' => 'dt']);

    $response = $this->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('unitTypeCounts.oht', 2)
        ->where('unitTypeCounts.dt', 1)
        ->has('alertSummary', fn ($page) => $page
            ->hasAll(['overspeed', 'geofence', 'offline', 'low_signal'])));
});

test('speed overview excludes logs from a deleted device', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $device = Device::factory()->create(['device_name' => 'Removed Truck']);
    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'speed_kmh' => 42,
        'recorded_at' => now(),
    ]);

    $device->delete();

    $response = $this->get(route('dashboard'));

    $response->assertOk();
    $response->assertInertia(fn ($page) => $page->where('speedByDevice', []));
});
