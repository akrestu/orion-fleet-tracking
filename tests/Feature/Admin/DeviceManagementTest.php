<?php

use App\Models\Device;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
});

// --- Access control ---

it('allows admin to view device management page', function () {
    $this->actingAs($this->admin)
        ->get('/admin/devices')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/devices/index'));
});

it('denies operator access to device management', function () {
    $this->actingAs($this->operator)
        ->get('/admin/devices')
        ->assertForbidden();
});

it('redirects unauthenticated users to login', function () {
    $this->get('/admin/devices')
        ->assertRedirect('/login');
});

// --- Create device ---

it('admin can create a new device', function () {
    $this->actingAs($this->admin)
        ->post('/admin/devices', [
            'dev_eui' => 'AABBCCDDEEFF0011',
            'application_id' => 'fleet-tracker',
            'device_name' => 'Test Unit 01',
            'unit_type' => 'oht',
            'is_active' => true,
            'operational_status' => 'operational',
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('devices', [
        'dev_eui' => 'AABBCCDDEEFF0011',
        'device_name' => 'Test Unit 01',
    ]);
});

it('rejects creating a device with a duplicate dev_eui', function () {
    $existing = Device::factory()->create();

    $this->actingAs($this->admin)
        ->post('/admin/devices', [
            'dev_eui' => $existing->dev_eui,
            'application_id' => 'fleet-tracker',
            'device_name' => 'Duplicate',
            'unit_type' => 'oht',
            'is_active' => true,
        ])
        ->assertSessionHasErrors('dev_eui');
});

// --- Update device ---

it('admin can update a device', function () {
    $device = Device::factory()->create(['device_name' => 'Old Name']);

    $this->actingAs($this->admin)
        ->put("/admin/devices/{$device->id}", [
            'application_id' => $device->application_id,
            'device_name' => 'New Name',
            'unit_type' => $device->unit_type,
            'is_active' => false,
            'operational_status' => 'operational',
        ])
        ->assertRedirect();

    expect($device->fresh())
        ->device_name->toBe('New Name')
        ->is_active->toBeFalse();
});

// --- Delete device ---

it('admin can delete a device', function () {
    $device = Device::factory()->create();

    $this->actingAs($this->admin)
        ->delete("/admin/devices/{$device->id}")
        ->assertRedirect();

    $this->assertSoftDeleted('devices', ['id' => $device->id]);
});
