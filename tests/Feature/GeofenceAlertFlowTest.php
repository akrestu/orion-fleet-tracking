<?php

use App\Enums\AlertType;
use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
use App\Models\GeofenceDeviceState;
use App\Models\GpsLog;
use App\Services\GeofenceService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->service = new GeofenceService;
    $this->device = Device::factory()->create();

    // Matches the polygon center used by GeofenceFactory.
    $this->inside = ['lat' => -3.779223, 'lng' => 103.67939];
    $this->outside = ['lat' => -3.9, 'lng' => 103.9];
});

function gpsLogAt(Device $device, array $point): GpsLog
{
    return GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'latitude' => $point['lat'],
        'longitude' => $point['lng'],
    ]);
}

it('does not fire an alert the first time a device is seen inside a geofence', function () {
    Geofence::factory()->create();

    $this->service->check(gpsLogAt($this->device, $this->inside));

    expect(Alert::count())->toBe(0);
    expect(GeofenceDeviceState::first()->is_inside)->toBeTrue();
});

it('fires an enter alert when a device transitions from outside to inside', function () {
    $geofence = Geofence::factory()->create();

    $this->service->check(gpsLogAt($this->device, $this->outside));
    expect(Alert::count())->toBe(0);

    $this->service->check(gpsLogAt($this->device, $this->inside));

    expect(Alert::count())->toBe(1);
    $alert = Alert::first();
    expect($alert->alert_type)->toBe(AlertType::Geofence);
    expect($alert->meta['event'])->toBe('enter');
    expect($alert->meta['geofence_id'])->toBe($geofence->id);
});

it('fires an exit alert when a device transitions from inside to outside', function () {
    Geofence::factory()->create();

    $this->service->check(gpsLogAt($this->device, $this->inside));
    $this->service->check(gpsLogAt($this->device, $this->outside));

    expect(Alert::count())->toBe(1);
    expect(Alert::first()->meta['event'])->toBe('exit');
});

it('does not fire an alert when the device stays inside the geofence', function () {
    Geofence::factory()->create();

    $this->service->check(gpsLogAt($this->device, $this->inside));
    $this->service->check(gpsLogAt($this->device, $this->inside));

    expect(Alert::count())->toBe(0);
});

it('ignores inactive geofences', function () {
    Geofence::factory()->create(['is_active' => false]);

    $this->service->check(gpsLogAt($this->device, $this->outside));
    $this->service->check(gpsLogAt($this->device, $this->inside));

    expect(Alert::count())->toBe(0);
    expect(GeofenceDeviceState::count())->toBe(0);
});
