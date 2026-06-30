<?php

use App\Models\Device;
use App\Models\GpsLog;
use App\Services\FleetUtilizationService;
use Carbon\Carbon;

it('returns null for a device with no logs in range', function () {
    $device = Device::factory()->create();

    $stats = (new FleetUtilizationService)->computeForDevice(
        $device->dev_eui,
        now()->startOfDay(),
        now()->endOfDay(),
    );

    expect($stats)->toBeNull();
});

it('computes distance, running and idle time from consecutive logs', function () {
    $device = Device::factory()->create();
    $base = Carbon::parse('2026-06-30 08:00:00');

    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'latitude' => -3.78,
        'longitude' => 103.68,
        'speed_kmh' => 10.0,
        'recorded_at' => $base,
    ]);

    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'latitude' => -3.79,
        'longitude' => 103.69,
        'speed_kmh' => 0.0,
        'recorded_at' => $base->copy()->addMinutes(1),
    ]);

    $stats = (new FleetUtilizationService)->computeForDevice(
        $device->dev_eui,
        $base->copy()->startOfDay(),
        $base->copy()->endOfDay(),
    );

    expect($stats)
        ->not->toBeNull()
        ->and($stats['log_count'])->toBe(2)
        ->and($stats['operation_hours'])->toBeGreaterThan(0)
        ->and($stats['running_hours'])->toBeGreaterThan(0)
        ->and($stats['idle_hours'])->toBe(0.0)
        ->and($stats['distance_km'])->toBeGreaterThan(0)
        ->and($stats['max_speed_kmh'])->toBe(10.0);
});

it('treats gaps over 300 seconds as non-operational and skips distance', function () {
    $device = Device::factory()->create();
    $base = Carbon::parse('2026-06-30 08:00:00');

    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'latitude' => -3.78,
        'longitude' => 103.68,
        'speed_kmh' => 10.0,
        'recorded_at' => $base,
    ]);

    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'latitude' => -3.90,
        'longitude' => 103.90,
        'speed_kmh' => 10.0,
        'recorded_at' => $base->copy()->addMinutes(10),
    ]);

    $stats = (new FleetUtilizationService)->computeForDevice(
        $device->dev_eui,
        $base->copy()->startOfDay(),
        $base->copy()->endOfDay(),
    );

    expect($stats['operation_hours'])->toBe(0.0)
        ->and($stats['distance_km'])->toBe(0.0);
});
