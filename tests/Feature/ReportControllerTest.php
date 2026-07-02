<?php

use App\Models\Alert;
use App\Models\Device;
use App\Models\Geofence;
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

// --- Summary KPIs ---

it('returns summary KPIs as JSON', function () {
    Device::factory()->create(['is_active' => true, 'last_seen_at' => now()]);
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'overspeed',
        'triggered_at' => now(),
    ]);

    $this->actingAs($this->admin)
        ->getJson('/admin/reports/summary')
        ->assertOk()
        ->assertJsonStructure(['active_units', 'online_now', 'alerts_today', 'avg_utilization_pct']);
});

it('denies operator access to summary KPIs', function () {
    $this->actingAs($this->operator)
        ->get('/admin/reports/summary')
        ->assertForbidden();
});

// --- Raw GPS data ---

it('returns paginated raw GPS data as JSON', function () {
    GpsLog::factory()->count(3)->sequence(
        fn ($seq) => ['recorded_at' => now()->subSeconds($seq->index + 1)]
    )->create(['dev_eui' => $this->device->dev_eui]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/raw-gps-data?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertJsonStructure([
            'data' => [
                '*' => ['dev_eui', 'device_name', 'unit_type', 'latitude', 'longitude', 'speed_kmh', 'heading_deg', 'rssi', 'snr', 'recorded_at'],
            ],
            'current_page',
            'last_page',
            'total',
        ]);

    expect($response->json('total'))->toBe(3);
});

it('denies operator access to raw GPS data report', function () {
    $this->actingAs($this->operator)
        ->get('/admin/reports/raw-gps-data')
        ->assertForbidden();
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

// --- Geofence alerts ---

it('returns geofence alerts as JSON', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'geofence',
        'triggered_at' => now(),
        'meta' => ['geofence_name' => 'Loading Zone A', 'event' => 'enter'],
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/geofence-alerts?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertJsonStructure([
            'data' => ['*' => ['id', 'dev_eui', 'device_name', 'geofence_name', 'event', 'triggered_at']],
        ]);

    expect($response->json('data.0.geofence_name'))->toBe('Loading Zone A')
        ->and($response->json('data.0.event'))->toBe('enter');
});

it('excludes non-geofence alerts from geofence alerts report', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'overspeed',
        'triggered_at' => now(),
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/geofence-alerts?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk();

    expect($response->json('data'))->toBeEmpty();
});

it('exports geofence alerts as Excel download', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'geofence',
        'triggered_at' => now(),
        'meta' => ['geofence_name' => 'Loading Zone A', 'event' => 'enter'],
    ]);

    $this->actingAs($this->admin)
        ->get('/admin/reports/export/geofence-alerts?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('denies operator access to geofence alerts report and export', function () {
    $this->actingAs($this->operator)
        ->get('/admin/reports/geofence-alerts')
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get('/admin/reports/export/geofence-alerts')
        ->assertForbidden();
});

// --- Cycle time ---

it('detects a completed loading-dumping-loading cycle', function () {
    Geofence::factory()->create([
        'zone_type' => 'loading',
        'polygon' => [
            ['lat' => 1.001, 'lng' => 0.999],
            ['lat' => 1.001, 'lng' => 1.001],
            ['lat' => 0.999, 'lng' => 1.001],
            ['lat' => 0.999, 'lng' => 0.999],
        ],
    ]);
    Geofence::factory()->create([
        'zone_type' => 'dumping',
        'polygon' => [
            ['lat' => 2.001, 'lng' => 1.999],
            ['lat' => 2.001, 'lng' => 2.001],
            ['lat' => 1.999, 'lng' => 2.001],
            ['lat' => 1.999, 'lng' => 1.999],
        ],
    ]);

    $start = now()->subHours(2);

    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'latitude' => 1.0,
        'longitude' => 1.0,
        'recorded_at' => $start,
    ]);
    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'latitude' => 2.0,
        'longitude' => 2.0,
        'recorded_at' => $start->copy()->addMinutes(10),
    ]);
    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'latitude' => 1.0,
        'longitude' => 1.0,
        'recorded_at' => $start->copy()->addMinutes(20),
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/cycle-time?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk();

    $trips = $response->json('trips');
    expect($trips)->toHaveCount(1)
        ->and($trips[0]['cycle_duration_min'])->toBe(20)
        ->and($trips[0]['haul_duration_min'])->toBe(10)
        ->and($trips[0]['distance_km'])->toBeGreaterThan(0)
        ->and($trips[0]['avg_speed_kmh'])->toBeGreaterThan(0);
});

// --- Delay & waiting time ---

it('detects a delay stop outside any geofence', function () {
    $start = now()->subHours(2);

    // Simulate a device reporting every 30s while stationary for 10 minutes (real send interval).
    GpsLog::factory()->count(21)->sequence(
        fn ($seq) => ['recorded_at' => $start->copy()->addSeconds($seq->index * 30)]
    )->create([
        'dev_eui' => $this->device->dev_eui,
        'latitude' => 1.0,
        'longitude' => 1.0,
        'speed_kmh' => 0.5,
    ]);

    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'latitude' => 1.0,
        'longitude' => 1.0,
        'speed_kmh' => 40,
        'recorded_at' => $start->copy()->addMinutes(11),
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/delay-waiting?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertJsonStructure([
            'stops' => ['*' => ['dev_eui', 'type', 'zone', 'started_at', 'ended_at', 'duration_min']],
            'summary',
        ]);

    $stops = $response->json('stops');
    expect($stops)->toHaveCount(1)
        ->and($stops[0]['type'])->toBe('delay')
        ->and($stops[0]['zone'])->toBe('on_route');
});

it('ignores short stationary periods below the minimum stop threshold', function () {
    $start = now()->subHour();
    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'speed_kmh' => 0.5,
        'recorded_at' => $start,
    ]);
    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'speed_kmh' => 0.5,
        'recorded_at' => $start->copy()->addMinute(),
    ]);
    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'speed_kmh' => 40,
        'recorded_at' => $start->copy()->addMinutes(2),
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/delay-waiting?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk();

    expect($response->json('stops'))->toBeEmpty();
});

// --- Gateway reliability ---

it('returns gateway reliability stats as JSON', function () {
    GpsLog::factory()->count(3)->sequence(
        fn ($seq) => ['recorded_at' => now()->subSeconds($seq->index + 1)]
    )->create([
        'dev_eui' => $this->device->dev_eui,
        'gateway_id' => 'GW-001',
        'rssi' => -90,
        'snr' => 5,
    ]);

    $response = $this->actingAs($this->admin)
        ->getJson('/admin/reports/gateway-reliability?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertJsonStructure([
            'data' => ['*' => ['gateway_id', 'uplink_count', 'device_count', 'avg_rssi', 'min_rssi', 'max_rssi', 'avg_snr', 'first_seen', 'last_seen']],
        ]);

    $data = $response->json('data');
    expect($data)->toHaveCount(1)
        ->and($data[0]['gateway_id'])->toBe('GW-001')
        ->and($data[0]['uplink_count'])->toBe(3);
});

it('denies operator access to delay-waiting and gateway-reliability reports', function () {
    $this->actingAs($this->operator)
        ->get('/admin/reports/delay-waiting')
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get('/admin/reports/gateway-reliability')
        ->assertForbidden();
});

// --- Excel exports ---

it('exports fleet utilization as Excel download', function () {
    GpsLog::factory()->create(['dev_eui' => $this->device->dev_eui, 'recorded_at' => now()]);

    $this->actingAs($this->admin)
        ->get('/admin/reports/export/fleet-utilization?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('exports speed violations as Excel download', function () {
    Alert::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'alert_type' => 'overspeed',
        'triggered_at' => now(),
    ]);

    $this->actingAs($this->admin)
        ->get('/admin/reports/export/speed-violations?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('exports cycle time as Excel download', function () {
    $this->actingAs($this->admin)
        ->get('/admin/reports/export/cycle-time?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('exports delay & waiting as Excel download', function () {
    $this->actingAs($this->admin)
        ->get('/admin/reports/export/delay-waiting?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('exports gateway reliability as Excel download', function () {
    GpsLog::factory()->create(['dev_eui' => $this->device->dev_eui, 'gateway_id' => 'GW-001', 'recorded_at' => now()]);

    $this->actingAs($this->admin)
        ->get('/admin/reports/export/gateway-reliability?from='.today()->toDateString().'&to='.today()->toDateString())
        ->assertOk()
        ->assertHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
});

it('denies operator access to Excel exports', function () {
    $this->actingAs($this->operator)
        ->get('/admin/reports/export/fleet-utilization')
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get('/admin/reports/export/speed-violations')
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get('/admin/reports/export/cycle-time')
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get('/admin/reports/export/delay-waiting')
        ->assertForbidden();

    $this->actingAs($this->operator)
        ->get('/admin/reports/export/gateway-reliability')
        ->assertForbidden();
});
