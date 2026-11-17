<?php

use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\GpsLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

describe('Fleet Map page', function () {
    it('redirects guests to login', function () {
        $this->get(route('fleet.map'))->assertRedirectToRoute('login');
    });

    it('renders for authenticated users', function () {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->get(route('fleet.map'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->component('Fleet/Map'));
    });

    it('passes initialPositions prop to page', function () {
        $user = User::factory()->admin()->create();
        $device = Device::factory()->create(['dev_eui' => '9956efb31332a835', 'is_active' => true]);

        GpsLog::create([
            'dev_eui' => $device->dev_eui,
            'latitude' => -3.779223,
            'longitude' => 103.67939,
            'speed_kmh' => 42.5,
            'recorded_at' => now()->subMinutes(2),
            'created_at' => now(),
        ]);

        $this->actingAs($user)
            ->get(route('fleet.map'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('Fleet/Map')
                ->has('initialPositions', 1)
                ->where('initialPositions.0.dev_eui', '9956efb31332a835')
                ->where('initialPositions.0.latitude', -3.779223),
            );
    });

    it('excludes inactive devices from initialPositions', function () {
        $user = User::factory()->create();
        Device::factory()->create(['is_active' => false]);

        $this->actingAs($user)
            ->get(route('fleet.map'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page->has('initialPositions', 0));
    });

    it('exposes gateway, satellites, alert flag and geofence zone type', function () {
        $user = User::factory()->admin()->create();
        $alerting = Device::factory()->create(['device_name' => 'A-01', 'is_active' => true]);
        $quiet = Device::factory()->create(['device_name' => 'B-01', 'is_active' => true]);

        GpsLog::factory()->create([
            'dev_eui' => $alerting->dev_eui,
            'gateway_id' => 'GW-PIT-N01',
            'satellites' => 11,
            'recorded_at' => now()->subMinute(),
        ]);
        Alert::create(['dev_eui' => $alerting->dev_eui, 'alert_type' => 'overspeed', 'triggered_at' => now()]);
        Alert::create(['dev_eui' => $quiet->dev_eui, 'alert_type' => 'overspeed', 'triggered_at' => now(), 'resolved_at' => now()]);
        Geofence::factory()->create(['is_active' => true, 'zone_type' => 'loading']);

        $this->actingAs($user)
            ->get(route('fleet.map'))
            ->assertInertia(fn ($page) => $page
                ->where('initialPositions.0.gateway_id', 'GW-PIT-N01')
                ->where('initialPositions.0.satellites', 11)
                ->where('initialPositions.0.has_alert', true)
                ->where('initialPositions.1.has_alert', false)
                ->where('geofences.0.zone_type', 'loading'),
            );
    });
});
