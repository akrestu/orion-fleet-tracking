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

it('exposes active counts per type and device unit info', function () {
    Alert::create(['dev_eui' => $this->device->dev_eui, 'alert_type' => 'overspeed', 'triggered_at' => now()]);
    Alert::create(['dev_eui' => $this->device->dev_eui, 'alert_type' => 'overspeed', 'triggered_at' => now()]);
    Alert::create(['dev_eui' => $this->device->dev_eui, 'alert_type' => 'geofence', 'triggered_at' => now(), 'resolved_at' => now()]);

    $this->actingAs($this->admin)
        ->get('/admin/alerts')
        ->assertInertia(fn (Assert $page) => $page
            ->where('summary', ['overspeed' => 2, 'geofence' => 0, 'offline' => 0, 'low_signal' => 0])
            ->where('resolvedLast7Days', 1)
            ->where('alerts.0.unit_type', $this->device->unit_type)
            ->where('activeAlertCount', 2));
});

it('admin can resolve several alerts at once', function () {
    $a = Alert::create(['dev_eui' => $this->device->dev_eui, 'alert_type' => 'overspeed', 'triggered_at' => now()]);
    $b = Alert::create(['dev_eui' => $this->device->dev_eui, 'alert_type' => 'offline', 'triggered_at' => now()]);
    $c = Alert::create(['dev_eui' => $this->device->dev_eui, 'alert_type' => 'offline', 'triggered_at' => now()]);

    $this->actingAs($this->admin)
        ->post(route('admin.alerts.resolve-many'), ['ids' => [$a->id, $b->id]])
        ->assertRedirect();

    expect($a->fresh()->resolved_at)->not->toBeNull()
        ->and($b->fresh()->resolved_at)->not->toBeNull()
        ->and($c->fresh()->resolved_at)->toBeNull();
});

it('operator cannot bulk resolve alerts and sees no alert count', function () {
    $a = Alert::create(['dev_eui' => $this->device->dev_eui, 'alert_type' => 'overspeed', 'triggered_at' => now()]);

    $this->actingAs($this->operator)
        ->post(route('admin.alerts.resolve-many'), ['ids' => [$a->id]])
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('activeAlertCount', null));

    expect($a->fresh()->resolved_at)->toBeNull();
});
