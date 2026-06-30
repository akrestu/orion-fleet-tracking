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
