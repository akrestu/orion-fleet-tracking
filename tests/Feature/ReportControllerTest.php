<?php

use App\Models\Alert;
use App\Models\Device;
use App\Models\GpsLog;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
    $this->device = Device::factory()->create();
});

// --- Access control ---

it('allows admin to view reports page', function () {
    $this->actingAs($this->admin)
        ->get('/admin/reports')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/reports/index'));
});

it('denies operator access to reports page', function () {
    $this->actingAs($this->operator)
        ->get('/admin/reports')
        ->assertForbidden();
});

it('redirects unauthenticated users from reports page', function () {
    $this->get('/admin/reports')
        ->assertRedirect('/login');
});

// --- Fleet utilization ---

it('returns fleet utilization data as JSON', function () {
    GpsLog::factory()->count(3)->sequence(
        fn ($seq) => ['recorded_at' => now()->subHours(1)->subSeconds($seq->index + 1)]
    )->create(['dev_eui' => $this->device->dev_eui]);

    $this->actingAs($this->admin)
        ->getJson('/admin/reports/fleet-utilization?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => ['dev_eui', 'device_name', 'unit_type', 'log_count', 'operation_hours', 'distance_km', 'avg_speed_kmh', 'max_speed_kmh'],
            ],
        ]);
});

it('filters fleet utilization by device', function () {
    $other = Device::factory()->create();
    GpsLog::factory()->count(2)->sequence(
        fn ($seq) => ['recorded_at' => now()->subSeconds($seq->index + 1)]
    )->create(['dev_eui' => $this->device->dev_eui]);
    GpsLog::factory()->count(2)->sequence(
        fn ($seq) => ['recorded_at' => now()->subSeconds($seq->index + 1)]
    )->create(['dev_eui' => $other->dev_eui]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/fleet-utilization?from='.today()->toDateString().'&to='.today()->toDateString().'&dev_eui='.$this->device->dev_eui)
        ->assertOk();

    $data = $response->json('data');
    expect($data)->toHaveCount(1)
        ->and($data[0]['dev_eui'])->toBe($this->device->dev_eui);
});

// --- Speed violations ---

it('returns speed violations as JSON', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'overspeed',
        'triggered_at' => now(),
        'meta' => ['speed_kmh' => 85, 'threshold' => 60],
    ]);

    $this->actingAs($this->admin)
        ->getJson('/admin/reports/speed-violations?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => ['id', 'dev_eui', 'device_name', 'speed_kmh', 'threshold_kmh', 'triggered_at', 'is_resolved'],
            ],
            'summary',
        ]);
});

it('excludes non-overspeed alerts from speed violations report', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'offline',
        'triggered_at' => now(),
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/speed-violations?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk();

    expect($response->json('data'))->toBeEmpty();
});

// --- CSV exports ---

it('exports GPS logs as CSV download', function () {
    GpsLog::factory()->create(['dev_eui' => $this->device->dev_eui, 'recorded_at' => now()]);

    $this->actingAs($this->admin)
        ->get('/admin/reports/export/gps-logs?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
});

it('exports alerts as CSV download', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'overspeed',
        'triggered_at' => now(),
    ]);

    $this->actingAs($this->admin)
        ->get('/admin/reports/export/alerts?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
});

it('denies operator access to CSV exports', function () {
    $this->actingAs($this->operator)
        ->get('/admin/reports/export/gps-logs')
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get('/admin/reports/export/alerts')
        ->assertForbidden();
});
