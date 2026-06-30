<?php

use App\Models\Device;
use App\Models\GpsLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function actingAsUser(): User
{
    $user = User::factory()->create();
    test()->actingAs($user);

    return $user;
}

// ─── GET /api/fleet/positions ────────────────────────────────────────────────

describe('GET /api/fleet/positions', function () {
    it('requires authentication', function () {
        $this->getJson('/api/fleet/positions')->assertUnauthorized();
    });

    it('returns empty array when no devices exist', function () {
        actingAsUser();

        $this->getJson('/api/fleet/positions')
            ->assertOk()
            ->assertJsonCount(0, 'data');
    });

    it('returns only active devices with last position', function () {
        actingAsUser();

        $active = Device::factory()->create(['dev_eui' => '9956efb31332a835', 'is_active' => true]);
        Device::factory()->create(['dev_eui' => 'aabbccddeeff0011', 'is_active' => false]);

        GpsLog::create([
            'dev_eui' => $active->dev_eui,
            'latitude' => -3.779223,
            'longitude' => 103.67939,
            'speed_kmh' => 42.5,
            'recorded_at' => now()->subMinutes(2),
            'created_at' => now(),
        ]);

        $response = $this->getJson('/api/fleet/positions')->assertOk();

        expect($response->json('data'))->toHaveCount(1);
        $item = $response->json('data.0');
        expect($item['dev_eui'])->toBe($active->dev_eui)
            ->and($item['position']['latitude'])->toBe(-3.779223)
            ->and($item['position']['speed_kmh'])->toBe(42.5);
    });

    it('returns correct device status', function () {
        actingAsUser();

        Device::factory()->create([
            'dev_eui' => '9956efb31332a835',
            'is_active' => true,
            'last_seen_at' => now()->subMinutes(5),
        ]);

        $response = $this->getJson('/api/fleet/positions')->assertOk();

        expect($response->json('data.0.status'))->toBe('online');
    });
});

// ─── GET /api/fleet/devices ──────────────────────────────────────────────────

describe('GET /api/fleet/devices', function () {
    it('requires authentication', function () {
        $this->getJson('/api/fleet/devices')->assertUnauthorized();
    });

    it('returns all devices including inactive', function () {
        actingAsUser();

        Device::factory()->create(['is_active' => true]);
        Device::factory()->create(['is_active' => false]);

        $this->getJson('/api/fleet/devices')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    });
});

// ─── GET /api/fleet/devices/{devEui}/history ────────────────────────────────

describe('GET /api/fleet/devices/{devEui}/history', function () {
    it('requires authentication', function () {
        $this->getJson('/api/fleet/devices/9956efb31332a835/history')->assertUnauthorized();
    });

    it('returns 404 for unknown device', function () {
        actingAsUser();

        $this->getJson('/api/fleet/devices/unknown000000000/history')->assertNotFound();
    });

    it('returns gps logs ordered by recorded_at desc', function () {
        actingAsUser();

        $device = Device::factory()->create(['dev_eui' => '9956efb31332a835']);

        GpsLog::create(['dev_eui' => $device->dev_eui, 'latitude' => -3.7, 'longitude' => 103.6, 'speed_kmh' => 10, 'recorded_at' => now()->subMinutes(10), 'created_at' => now()]);
        GpsLog::create(['dev_eui' => $device->dev_eui, 'latitude' => -3.8, 'longitude' => 103.7, 'speed_kmh' => 20, 'recorded_at' => now()->subMinutes(5), 'created_at' => now()]);

        $response = $this->getJson("/api/fleet/devices/{$device->dev_eui}/history")->assertOk();

        expect($response->json('data'))->toHaveCount(2);
        expect($response->json('data.0.speed_kmh'))->toBe(20);
    });

    it('filters by from date', function () {
        actingAsUser();

        $device = Device::factory()->create(['dev_eui' => '9956efb31332a835']);

        GpsLog::create(['dev_eui' => $device->dev_eui, 'latitude' => -3.7, 'longitude' => 103.6, 'speed_kmh' => 10, 'recorded_at' => now()->subHours(3), 'created_at' => now()]);
        GpsLog::create(['dev_eui' => $device->dev_eui, 'latitude' => -3.8, 'longitude' => 103.7, 'speed_kmh' => 20, 'recorded_at' => now()->subHour(), 'created_at' => now()]);

        $from = now()->subHours(2)->format('Y-m-d H:i:s');
        $response = $this->getJson("/api/fleet/devices/{$device->dev_eui}/history?from={$from}")->assertOk();

        expect($response->json('data'))->toHaveCount(1);
        expect($response->json('data.0.speed_kmh'))->toBe(20);
    });

    it('respects limit parameter', function () {
        actingAsUser();

        $device = Device::factory()->create(['dev_eui' => '9956efb31332a835']);

        for ($i = 0; $i < 5; $i++) {
            GpsLog::create(['dev_eui' => $device->dev_eui, 'latitude' => -3.7, 'longitude' => 103.6, 'speed_kmh' => 0, 'recorded_at' => now()->subMinutes($i + 1), 'created_at' => now()]);
        }

        $response = $this->getJson("/api/fleet/devices/{$device->dev_eui}/history?limit=3")->assertOk();

        expect($response->json('data'))->toHaveCount(3);
    });

    it('rejects invalid date in from parameter', function () {
        actingAsUser();
        Device::factory()->create(['dev_eui' => '9956efb31332a835']);

        $this->getJson('/api/fleet/devices/9956efb31332a835/history?from=not-a-date')->assertUnprocessable();
    });
});
