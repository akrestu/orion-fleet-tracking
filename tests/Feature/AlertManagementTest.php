<?php

use App\Models\Alert;
use App\Models\Device;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
    $this->device = Device::factory()->create();
});

// --- Access control ---

it('allows admin to view alert management page', function () {
    $this->actingAs($this->admin)
        ->get('/admin/alerts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/alerts/index'));
});

it('denies operator access to alert management', function () {
    $this->actingAs($this->operator)
        ->get('/admin/alerts')
        ->assertForbidden();
});

it('redirects unauthenticated users from alert management', function () {
    $this->get('/admin/alerts')
        ->assertRedirect('/login');
});

// --- Listing ---

it('returns alerts with device info', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'overspeed',
    ]);

    $this->actingAs($this->admin)
        ->get('/admin/alerts')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/alerts/index')
            ->has('alerts', 1)
            ->where('alerts.0.alert_type', 'overspeed')
            ->where('alerts.0.dev_eui', $this->device->dev_eui)
        );
});

// --- Resolve ---

it('admin can resolve an alert', function () {
    $alert = Alert::factory()->create(['dev_eui' => $this->device->dev_eui]);

    $this->assertNull($alert->resolved_at);

    $this->actingAs($this->admin)
        ->patch("/admin/alerts/{$alert->id}/resolve")
        ->assertRedirect();

    $this->assertNotNull($alert->fresh()->resolved_at);
});

it('operator cannot resolve an alert', function () {
    $alert = Alert::factory()->create(['dev_eui' => $this->device->dev_eui]);

    $this->actingAs($this->operator)
        ->patch("/admin/alerts/{$alert->id}/resolve")
        ->assertForbidden();
});

// --- Delete ---

it('admin can delete an alert', function () {
    $alert = Alert::factory()->create(['dev_eui' => $this->device->dev_eui]);

    $this->actingAs($this->admin)
        ->delete("/admin/alerts/{$alert->id}")
        ->assertRedirect();

    $this->assertDatabaseMissing('alerts', ['id' => $alert->id]);
});

it('operator cannot delete an alert', function () {
    $alert = Alert::factory()->create(['dev_eui' => $this->device->dev_eui]);

    $this->actingAs($this->operator)
        ->delete("/admin/alerts/{$alert->id}")
        ->assertForbidden();
});
