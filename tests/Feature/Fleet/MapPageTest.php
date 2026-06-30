<?php

use App\Models\Device;
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
        $user = User::factory()->create();
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
});
