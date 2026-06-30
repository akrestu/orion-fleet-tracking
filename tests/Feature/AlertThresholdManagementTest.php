<?php

use App\Enums\AlertType;
use App\Models\AlertThreshold;
use App\Models\Device;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
});

// --- Access control ---

it('allows admin to view alert thresholds page', function () {
    $this->actingAs($this->admin)
        ->get('/admin/alert-thresholds')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/alert-thresholds/index'));
});

it('denies operator access to alert thresholds', function () {
    $this->actingAs($this->operator)
        ->get('/admin/alert-thresholds')
        ->assertForbidden();
});

// --- Create ---

it('admin can create a global overspeed threshold', function () {
    $this->actingAs($this->admin)
        ->post('/admin/alert-thresholds', [
            'alert_type' => 'overspeed',
            'threshold_value' => 80,
            'is_active' => true,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('alert_thresholds', [
        'alert_type' => 'overspeed',
        'threshold_value' => 80,
        'dev_eui' => null,
        'unit_type' => null,
    ]);
});

it('admin can create a device-specific threshold', function () {
    $device = Device::factory()->create();

    $this->actingAs($this->admin)
        ->post('/admin/alert-thresholds', [
            'alert_type' => 'overspeed',
            'dev_eui' => $device->dev_eui,
            'threshold_value' => 60,
            'is_active' => true,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('alert_thresholds', [
        'alert_type' => 'overspeed',
        'dev_eui' => $device->dev_eui,
        'threshold_value' => 60,
    ]);
});

it('rejects geofence as a threshold type', function () {
    $this->actingAs($this->admin)
        ->post('/admin/alert-thresholds', [
            'alert_type' => 'geofence',
            'threshold_value' => 100,
        ])
        ->assertSessionHasErrors('alert_type');
});

it('rejects negative threshold values', function () {
    $this->actingAs($this->admin)
        ->post('/admin/alert-thresholds', [
            'alert_type' => 'overspeed',
            'threshold_value' => -10,
        ])
        ->assertSessionHasErrors('threshold_value');
});

// --- Update ---

it('admin can update a threshold value', function () {
    $threshold = AlertThreshold::factory()->create([
        'alert_type' => AlertType::Overspeed,
        'threshold_value' => 80,
    ]);

    $this->actingAs($this->admin)
        ->put("/admin/alert-thresholds/{$threshold->id}", [
            'threshold_value' => 100,
            'is_active' => true,
        ])
        ->assertRedirect();

    expect($threshold->fresh()->threshold_value)->toBe(100.0);
});

// --- Delete ---

it('admin can delete a threshold', function () {
    $threshold = AlertThreshold::factory()->create();

    $this->actingAs($this->admin)
        ->delete("/admin/alert-thresholds/{$threshold->id}")
        ->assertRedirect();

    $this->assertDatabaseMissing('alert_thresholds', ['id' => $threshold->id]);
});

it('operator cannot delete a threshold', function () {
    $threshold = AlertThreshold::factory()->create();

    $this->actingAs($this->operator)
        ->delete("/admin/alert-thresholds/{$threshold->id}")
        ->assertForbidden();
});
