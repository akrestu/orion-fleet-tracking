<?php

use App\Models\Alert;
use App\Models\Device;
use App\Models\GpsLog;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('creates a device with correct attributes', function () {
    $device = Device::create([
        'dev_eui' => 'aabb112233445566',
        'application_id' => 'app-uuid-1234',
        'device_name' => '2026_Hauler_Test',
        'unit_type' => 'hauler',
        'is_active' => true,
    ]);

    expect($device->dev_eui)->toBe('aabb112233445566')
        ->and($device->unit_type)->toBe('hauler')
        ->and($device->is_active)->toBeTrue();
});

it('returns offline status when last_seen_at is null', function () {
    $device = Device::factory()->create(['last_seen_at' => null]);
    expect($device->status)->toBe('offline');
});

it('returns online status when last_seen_at is within 10 minutes', function () {
    $device = Device::factory()->create(['last_seen_at' => now()->subMinutes(5)]);
    expect($device->status)->toBe('online');
});

it('returns offline status when last_seen_at is older than 10 minutes', function () {
    $device = Device::factory()->create(['last_seen_at' => now()->subMinutes(15)]);
    expect($device->status)->toBe('offline');
});

it('scopeActive only returns active devices', function () {
    Device::factory()->create(['is_active' => true]);
    Device::factory()->create(['is_active' => false]);

    $activeDevices = Device::active()->get();

    expect($activeDevices)->toHaveCount(1)
        ->and($activeDevices->first()->is_active)->toBeTrue();
});

it('has many gps logs via dev_eui', function () {
    $device = Device::factory()->create(['dev_eui' => 'ccdd334455667788']);

    GpsLog::create([
        'dev_eui' => 'ccdd334455667788',
        'latitude' => -3.779223,
        'longitude' => 103.67939,
        'speed_kmh' => 0,
        'recorded_at' => now(),
        'created_at' => now(),
    ]);

    expect($device->gpsLogs)->toHaveCount(1);
});

it('has many alerts via dev_eui', function () {
    $device = Device::factory()->create(['dev_eui' => 'eeff556677889900']);

    Alert::create([
        'dev_eui' => 'eeff556677889900',
        'alert_type' => 'overspeed',
        'triggered_at' => now(),
    ]);

    expect($device->alerts)->toHaveCount(1);
});

it('gps log scopeRecent filters by minutes', function () {
    $device = Device::factory()->create(['dev_eui' => '1234567890abcdef']);

    GpsLog::create([
        'dev_eui' => '1234567890abcdef',
        'latitude' => -3.0,
        'longitude' => 103.0,
        'speed_kmh' => 10,
        'recorded_at' => now()->subMinutes(30),
        'created_at' => now(),
    ]);

    GpsLog::create([
        'dev_eui' => '1234567890abcdef',
        'latitude' => -3.1,
        'longitude' => 103.1,
        'speed_kmh' => 20,
        'recorded_at' => now()->subMinutes(90),
        'created_at' => now(),
    ]);

    expect(GpsLog::recent(60)->count())->toBe(1);
});

it('alert scopeUnresolved filters correctly', function () {
    $device = Device::factory()->create(['dev_eui' => 'fedcba9876543210']);

    Alert::create([
        'dev_eui' => 'fedcba9876543210',
        'alert_type' => 'offline',
        'triggered_at' => now(),
        'resolved_at' => null,
    ]);

    Alert::create([
        'dev_eui' => 'fedcba9876543210',
        'alert_type' => 'overspeed',
        'triggered_at' => now()->subHour(),
        'resolved_at' => now(),
    ]);

    expect(Alert::unresolved()->count())->toBe(1);
});
