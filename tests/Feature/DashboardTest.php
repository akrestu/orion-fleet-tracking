<?php

use App\Models\Alert;
use App\Models\Device;
use App\Models\DeviceGroup;
use App\Models\GpsLog;
use App\Models\User;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;

afterEach(function () {
    Carbon::setTestNow();
});

test('guests are redirected to the login page', function () {
    $this->get(route('dashboard'))->assertRedirect(route('login'));
});

test('dashboard renders hero, filters and options immediately and defers the heavy data', function () {
    $this->actingAs(User::factory()->admin()->create());

    $group = DeviceGroup::factory()->create(['name' => 'Site Lahat']);
    Device::factory()->create(['device_group_id' => $group->id, 'last_seen_at' => now()]);
    Device::factory()->create(['device_group_id' => $group->id, 'last_seen_at' => null]);

    $this->get(route('dashboard'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard')
            ->where('filters', [
                'group' => null,
                'period' => 'today',
                'shift' => 'all',
                'unit_type' => null,
                'condition' => null,
            ])
            ->where('hero.total', 2)
            ->where('hero.online', 1)
            ->where('hero.site', null)
            ->has('options.groups', 1)
            ->where('options.groups.0.name', 'Site Lahat')
            ->missing('kpis')
            ->missing('sections'));
});

test('kpis expose values, deltas and sparklines', function () {
    $this->actingAs(User::factory()->admin()->create());

    $device = Device::factory()->create(['last_seen_at' => now()]);
    foreach ([5, 6, 7] as $minutesAgo) {
        GpsLog::factory()->create(['dev_eui' => $device->dev_eui, 'recorded_at' => now()->subMinutes($minutesAgo)]);
    }

    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('kpis', fn (Assert $page) => $page
                ->where('kpis.total.value', 1)
                ->where('kpis.online.value', 1)
                ->where('kpis.online.pct', 100)
                ->where('kpis.offline.value', 0)
                ->where('kpis.logs.value', 3)
                ->where('kpis.lastHour.value', 3)
                ->has('kpis.online.spark', 12)
                ->has('kpis.logs.spark', 12)
                ->has('kpis.lastHour.spark', 12)
                ->has('kpis.total.delta')
                ->has('kpis.logs.delta_pct')));
});

test('sections expose tracking, safety, maintenance, productivity, infrastructure and performance', function () {
    $this->actingAs(User::factory()->admin()->create());

    $truck = Device::factory()->create([
        'device_name' => 'OHT-07',
        'unit_type' => 'oht',
        'operational_status' => 'operational',
        'last_seen_at' => now(),
    ]);
    Device::factory()->create(['unit_type' => 'oht', 'operational_status' => 'breakdown', 'last_seen_at' => null]);

    GpsLog::factory()->create([
        'dev_eui' => $truck->dev_eui,
        'gateway_id' => 'GW-PIT-N01',
        'rssi' => -118,
        'snr' => -9.5,
        'speed_kmh' => 30,
        'recorded_at' => now()->subMinutes(2),
    ]);

    Alert::create([
        'dev_eui' => $truck->dev_eui,
        'alert_type' => 'overspeed',
        'triggered_at' => now()->subMinutes(3),
        'meta' => ['speed_kmh' => 52.4, 'threshold' => 40],
    ]);
    Alert::create([
        'dev_eui' => $truck->dev_eui,
        'alert_type' => 'overspeed',
        'triggered_at' => now()->subMinutes(1),
        'meta' => ['speed_kmh' => 47, 'threshold' => 40],
    ]);

    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('sections', fn (Assert $page) => $page
                ->where('sections.tracking.0', ['type' => 'oht', 'online' => 1, 'total' => 2])
                ->where('sections.safety.counts.overspeed', 2)
                ->where('sections.safety.counts.geofence', 0)
                ->where('sections.safety.topOverspeed.0.device_name', 'OHT-07')
                ->where('sections.safety.topOverspeed.0.events', 2)
                ->where('sections.safety.topOverspeed.0.max_speed', 52.4)
                ->where('sections.maintenance.conditions', ['operational' => 1, 'standby' => 0, 'breakdown' => 1])
                ->where('sections.maintenance.lowSignal.0.device_name', 'OHT-07')
                ->where('sections.maintenance.lowSignal.0.avg_rssi', -118)
                ->has('sections.productivity', fn (Assert $p) => $p
                    ->hasAll(['running_hours', 'idle_hours', 'utilization_pct', 'distance_km', 'avg_cycle_min']))
                ->has('sections.activeAlerts', 2)
                ->where('sections.activeAlerts.0.type', 'overspeed')
                ->where('sections.activeAlerts.0.device_name', 'OHT-07')
                ->where('sections.activeAlerts.0.speed_kmh', 47)
                ->where('sections.activeAlerts.0.threshold_kmh', 40)
                ->where('sections.infrastructure.gateway_count', 1)
                ->where('sections.infrastructure.gateways.0.gateway_id', 'GW-PIT-N01')
                ->where('sections.infrastructure.gateways.0.uplink_count', 1)
                ->has('sections.performance.0', fn (Assert $p) => $p->hasAll(['hour', 'avg_speed']))));
});

test('unit type and condition filters narrow the device set', function () {
    $this->actingAs(User::factory()->admin()->create());

    Device::factory()->create(['unit_type' => 'oht', 'operational_status' => 'operational']);
    Device::factory()->create(['unit_type' => 'oht', 'operational_status' => 'standby']);
    Device::factory()->create(['unit_type' => 'dt', 'operational_status' => 'operational']);

    $this->get(route('dashboard', ['unit_type' => 'oht', 'condition' => 'operational']))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.unit_type', 'oht')
            ->where('filters.condition', 'operational')
            ->where('hero.total', 1));
});

test('operators only see their groups and cannot select another group', function () {
    $mine = DeviceGroup::factory()->create(['name' => 'Site Lahat']);
    $other = DeviceGroup::factory()->create(['name' => 'Site Muara']);
    Device::factory()->count(2)->create(['device_group_id' => $mine->id]);
    Device::factory()->count(5)->create(['device_group_id' => $other->id]);

    $operator = User::factory()->operator()->create();
    $operator->deviceGroups()->attach($mine);
    $this->actingAs($operator);

    $this->get(route('dashboard', ['group' => $other->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.group', null)
            ->where('hero.total', 2)
            ->has('options.groups', 1)
            ->where('options.groups.0.name', 'Site Lahat'));

    $this->get(route('dashboard', ['group' => $mine->id]))
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.group', $mine->id)
            ->where('hero.site', 'Site Lahat'));
});

test('invalid filter values fall back to defaults', function () {
    $this->actingAs(User::factory()->admin()->create());

    $this->get(route('dashboard', ['period' => 'forever', 'shift' => '9', 'unit_type' => 'rocket', 'condition' => 'x']))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('filters.period', 'today')
            ->where('filters.shift', 'all')
            ->where('filters.unit_type', null)
            ->where('filters.condition', null));
});

test('shift filter counts logs by WIB shift hours', function () {
    // 10:00 WIB = 03:00 UTC
    Carbon::setTestNow(Carbon::parse('2026-11-17 03:00:00', 'UTC'));
    $this->actingAs(User::factory()->admin()->create());

    $device = Device::factory()->create(['last_seen_at' => now()]);
    // 08:00 WIB → shift 1 (06–18)
    GpsLog::factory()->create(['dev_eui' => $device->dev_eui, 'recorded_at' => Carbon::parse('2026-11-17 01:00:00', 'UTC')]);
    // 05:00 WIB → shift 2 (18–06)
    GpsLog::factory()->create(['dev_eui' => $device->dev_eui, 'recorded_at' => Carbon::parse('2026-11-16 22:00:00', 'UTC')]);

    $this->get(route('dashboard', ['shift' => '1']))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('kpis', fn (Assert $page) => $page->where('kpis.logs.value', 1)));

    $this->get(route('dashboard', ['shift' => '2']))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('kpis', fn (Assert $page) => $page->where('kpis.logs.value', 1)));

    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->loadDeferredProps('kpis', fn (Assert $page) => $page->where('kpis.logs.value', 2)));
});

test('data from a deleted device is excluded', function () {
    $this->actingAs(User::factory()->admin()->create());

    $device = Device::factory()->create(['device_name' => 'Removed Truck']);
    GpsLog::factory()->create([
        'dev_eui' => $device->dev_eui,
        'gateway_id' => 'GW-1',
        'speed_kmh' => 42,
        'recorded_at' => now(),
    ]);
    $device->delete();

    $this->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('hero.total', 0)
            ->loadDeferredProps('sections', fn (Assert $page) => $page
                ->where('sections.infrastructure.gateways', [])
                ->where('sections.performance', [])));
});
