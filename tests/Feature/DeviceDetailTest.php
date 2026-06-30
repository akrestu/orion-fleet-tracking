<?php

use App\Models\Device;
use App\Models\GpsLog;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
    $this->device = Device::factory()->create();
});

it('allows admin to view device detail page', function () {
    $this->actingAs($this->admin)
        ->get("/admin/devices/{$this->device->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/devices/show')
            ->where('device.id', $this->device->id)
            ->where('device.dev_eui', $this->device->dev_eui)
        );
});

it('denies operator access to device detail', function () {
    $this->actingAs($this->operator)
        ->get("/admin/devices/{$this->device->id}")
        ->assertForbidden();
});

it('returns gps logs for the device', function () {
    GpsLog::factory()->count(3)->create(['dev_eui' => $this->device->dev_eui]);

    $this->actingAs($this->admin)
        ->get("/admin/devices/{$this->device->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('gpsLogs', 3)
        );
});

it('returns empty gps logs when device has none', function () {
    $this->actingAs($this->admin)
        ->get("/admin/devices/{$this->device->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('gpsLogs', 0));
});

it('returns 404 for non-existent device', function () {
    $this->actingAs($this->admin)
        ->get('/admin/devices/99999')
        ->assertNotFound();
});
