<?php

use App\Events\DeviceZoneChanged;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\GpsLog;
use App\Models\User;
use App\Services\GeofenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

beforeEach(function () {
    Event::fake([DeviceZoneChanged::class]);

    $this->service = new GeofenceService;
    $this->hauler = Device::factory()->create(['unit_type' => 'dt']);
    $this->loading = Geofence::factory()->create(['zone_type' => 'loading', 'name' => 'Pit A']);

    // Matches the polygon centre used by GeofenceFactory.
    $this->inside = ['lat' => -3.779223, 'lng' => 103.67939];
    $this->outside = ['lat' => -3.9, 'lng' => 103.9];
    $this->start = now()->subMinutes(30)->startOfMinute();
});

function fixAt(Device $device, array $point, DateTimeInterface $at): GpsLog
{
    return GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'latitude' => $point['lat'],
        'longitude' => $point['lng'],
        'recorded_at' => $at,
    ]);
}

it('starts the dwell at the first fix inside a loading zone and keeps it while the hauler stays', function () {
    $this->service->check(fixAt($this->hauler, $this->outside, $this->start));
    $this->service->check(fixAt($this->hauler, $this->inside, $this->start->copy()->addMinutes(2)));
    $this->service->check(fixAt($this->hauler, $this->inside, $this->start->copy()->addMinutes(4)));

    $zone = $this->service->currentDwellZones([$this->hauler->dev_eui])[$this->hauler->dev_eui];

    expect($zone['type'])->toBe('loading')
        ->and($zone['name'])->toBe('Pit A')
        ->and($zone['entered_at'])->toBe($this->start->copy()->addMinutes(2)->toIso8601String());

    Event::assertDispatchedTimes(DeviceZoneChanged::class, 1);
    Event::assertDispatched(DeviceZoneChanged::class, fn (DeviceZoneChanged $e) => $e->zone['type'] === 'loading');
});

it('clears the dwell and broadcasts when the hauler leaves the zone', function () {
    $this->service->check(fixAt($this->hauler, $this->inside, $this->start));
    $this->service->check(fixAt($this->hauler, $this->outside, $this->start->copy()->addMinutes(5)));

    expect($this->service->currentDwellZones([$this->hauler->dev_eui]))->toBe([]);
    Event::assertDispatched(DeviceZoneChanged::class, fn (DeviceZoneChanged $e) => $e->zone === null);
});

it('does not track dwell for non-hauler units', function () {
    $excavator = Device::factory()->create(['unit_type' => 'excavator']);

    $this->service->check(fixAt($excavator, $this->inside, $this->start));

    expect($this->service->currentDwellZones([$excavator->dev_eui]))->toBe([]);
    Event::assertNotDispatched(DeviceZoneChanged::class);
});

it('shows the current dwell zone on the fleet map', function () {
    $this->service->check(fixAt($this->hauler, $this->inside, $this->start));

    $this->actingAs(User::factory()->admin()->create())
        ->get('/fleet/map')
        ->assertInertia(fn ($page) => $page
            ->where('initialPositions.0.zone.type', 'loading')
            ->where('initialPositions.0.zone.entered_at', $this->start->toIso8601String()),
        );
});

it('reports loading and dumping time per trip for haulers only, ending each visit at the first fix outside', function () {
    Geofence::query()->delete();
    $square = fn (float $c) => [
        ['lat' => $c + 0.001, 'lng' => $c - 0.001],
        ['lat' => $c + 0.001, 'lng' => $c + 0.001],
        ['lat' => $c - 0.001, 'lng' => $c + 0.001],
        ['lat' => $c - 0.001, 'lng' => $c - 0.001],
    ];
    Geofence::factory()->create(['zone_type' => 'loading', 'polygon' => $square(1.0)]);
    Geofence::factory()->create(['zone_type' => 'dumping', 'polygon' => $square(2.0)]);
    $excavator = Device::factory()->create(['unit_type' => 'excavator']);

    $loading = ['lat' => 1.0, 'lng' => 1.0];
    $haulRoad = ['lat' => 1.5, 'lng' => 1.5];
    $dumping = ['lat' => 2.0, 'lng' => 2.0];
    $start = today()->addHours(8);

    foreach ([$this->hauler, $excavator] as $device) {
        // Loading 0–6 min (heartbeat at 4, first fix outside at 6), haul, dump 15–18, return, back at 30.
        fixAt($device, $loading, $start);
        fixAt($device, $loading, $start->copy()->addMinutes(4));
        fixAt($device, $haulRoad, $start->copy()->addMinutes(6));
        fixAt($device, $dumping, $start->copy()->addMinutes(15));
        fixAt($device, $haulRoad, $start->copy()->addMinutes(18));
        fixAt($device, $loading, $start->copy()->addMinutes(30));
    }

    $trips = $this->actingAs(User::factory()->admin()->create())
        ->getJson('/admin/reports/cycle-time?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->json('trips');

    expect($trips)->toHaveCount(1)
        ->and($trips[0]['dev_eui'])->toBe($this->hauler->dev_eui)
        ->and($trips[0]['load_duration_min'])->toBe(6)
        ->and($trips[0]['haul_duration_min'])->toBe(9)
        ->and($trips[0]['dump_duration_min'])->toBe(3)
        ->and($trips[0]['return_duration_min'])->toBe(12)
        ->and($trips[0]['cycle_duration_min'])->toBe(30);
});
