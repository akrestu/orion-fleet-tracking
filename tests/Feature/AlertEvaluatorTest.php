<?php

use App\Enums\AlertType;
use App\Events\ChirpstackUplinkReceived;
use App\Models\Alert;
use App\Models\AlertThreshold;
use App\Models\Device;
use App\Models\User;
use App\Services\AlertEvaluator;
use App\Services\GpsIngestionService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    // Broadcasting and geofence jobs are not under test here.
    Event::fake([ChirpstackUplinkReceived::class]);
    Queue::fake();
    AlertEvaluator::flushRules();
});

afterEach(function () {
    Carbon::setTestNow();
});

/**
 * @param  array<string, mixed>  $overrides
 */
function ingestUplink(string $devEui, array $overrides = []): void
{
    app(GpsIngestionService::class)->ingest(array_merge([
        'dev_eui' => $devEui,
        'device_name' => 'OHT-07',
        'application_id' => 'app-1',
        'recorded_at' => now()->utc(),
        'latitude' => -3.78412,
        'longitude' => 103.52961,
        'speed_kmh' => 20.0,
        'heading_deg' => 48,
        'hdop' => 0.9,
        'satellites' => 11,
        'rssi' => -90,
        'snr' => 7.5,
        'gateway_id' => 'GW-PIT-N01',
        'raw_payload' => [],
    ], $overrides));
}

/**
 * @param  array<string, mixed>  $scope
 */
function thresholdRule(AlertType $type, float $value, array $scope = []): AlertThreshold
{
    return AlertThreshold::create(array_merge([
        'alert_type' => $type,
        'threshold_value' => $value,
        'is_active' => true,
    ], $scope));
}

test('an uplink above the overspeed limit raises one alert, not one per uplink', function () {
    $device = Device::factory()->create(['unit_type' => 'oht']);
    thresholdRule(AlertType::Overspeed, 40);

    ingestUplink($device->dev_eui, ['speed_kmh' => 52.1, 'recorded_at' => now()->subSeconds(20)]);
    ingestUplink($device->dev_eui, ['speed_kmh' => 55.0, 'recorded_at' => now()->subSeconds(10)]);
    ingestUplink($device->dev_eui, ['speed_kmh' => 30.0]);

    $alerts = Alert::where('alert_type', AlertType::Overspeed)->get();

    expect($alerts)->toHaveCount(1)
        ->and($alerts->first()->meta)->toMatchArray(['speed_kmh' => 52.1, 'threshold' => 40]);
});

test('the most specific rule wins: device over unit type over global', function () {
    $truck = Device::factory()->create(['unit_type' => 'oht']);
    $grader = Device::factory()->create(['unit_type' => 'gr']);
    $special = Device::factory()->create(['unit_type' => 'oht']);

    thresholdRule(AlertType::Overspeed, 50);
    thresholdRule(AlertType::Overspeed, 40, ['unit_type' => 'oht']);
    thresholdRule(AlertType::Overspeed, 30, ['dev_eui' => $special->dev_eui]);

    $evaluator = app(AlertEvaluator::class);

    expect($evaluator->thresholdFor($truck, AlertType::Overspeed))->toBe(40.0)
        ->and($evaluator->thresholdFor($grader, AlertType::Overspeed))->toBe(50.0)
        ->and($evaluator->thresholdFor($special, AlertType::Overspeed))->toBe(30.0);
});

test('inactive rules are ignored', function () {
    $device = Device::factory()->create();
    AlertThreshold::create(['alert_type' => AlertType::Overspeed, 'threshold_value' => 10, 'is_active' => false]);

    ingestUplink($device->dev_eui, ['speed_kmh' => 80]);

    expect(Alert::count())->toBe(0);
});

test('low signal fires below a negative RSSI limit, also when the limit was stored positive', function () {
    $weak = Device::factory()->create();
    $legacy = Device::factory()->create();
    thresholdRule(AlertType::LowSignal, -110, ['dev_eui' => $weak->dev_eui]);
    thresholdRule(AlertType::LowSignal, 110, ['dev_eui' => $legacy->dev_eui]);

    ingestUplink($weak->dev_eui, ['rssi' => -118]);
    ingestUplink($legacy->dev_eui, ['rssi' => -115]);
    ingestUplink(Device::factory()->create()->dev_eui, ['rssi' => -130]);

    $alerts = Alert::where('alert_type', AlertType::LowSignal)->get();

    expect($alerts)->toHaveCount(2)
        ->and($alerts->firstWhere('dev_eui', $weak->dev_eui)->meta)->toMatchArray(['rssi' => -118, 'threshold' => -110]);
});

test('silent devices raise an offline alert that resolves on the next uplink', function () {
    Carbon::setTestNow('2026-11-18 03:00:00');
    thresholdRule(AlertType::Offline, 15);
    $silent = Device::factory()->create(['last_seen_at' => now()->subMinutes(25), 'is_active' => true]);
    Device::factory()->create(['last_seen_at' => now()->subMinutes(5), 'is_active' => true]);

    $this->artisan('alerts:check-offline')->assertSuccessful();
    $this->artisan('alerts:check-offline')->assertSuccessful();

    $offline = Alert::where('alert_type', AlertType::Offline)->get();
    expect($offline)->toHaveCount(1)
        ->and($offline->first()->dev_eui)->toBe($silent->dev_eui)
        ->and($offline->first()->meta)->toMatchArray(['offline_minutes' => 25, 'threshold' => 15]);

    ingestUplink($silent->dev_eui);

    expect($offline->first()->fresh()->resolved_at)->not->toBeNull();
});

test('rule changes take effect immediately', function () {
    $admin = User::factory()->admin()->create();
    $device = Device::factory()->create();

    ingestUplink($device->dev_eui, ['speed_kmh' => 60, 'recorded_at' => now()->subMinute()]);
    expect(Alert::count())->toBe(0);

    $this->actingAs($admin)->post(route('admin.alert-thresholds.store'), [
        'alert_type' => 'overspeed',
        'threshold_value' => 40,
        'is_active' => true,
    ])->assertSessionHasNoErrors();

    ingestUplink($device->dev_eui, ['speed_kmh' => 60]);
    expect(Alert::where('alert_type', AlertType::Overspeed)->count())->toBe(1);
});

test('threshold validation accepts negative RSSI and rejects negative speeds', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)->post(route('admin.alert-thresholds.store'), [
        'alert_type' => 'low_signal', 'threshold_value' => -110, 'is_active' => true,
    ])->assertSessionHasNoErrors();

    $this->actingAs($admin)->post(route('admin.alert-thresholds.store'), [
        'alert_type' => 'low_signal', 'threshold_value' => 20, 'is_active' => true,
    ])->assertSessionHasErrors('threshold_value');

    $this->actingAs($admin)->post(route('admin.alert-thresholds.store'), [
        'alert_type' => 'overspeed', 'threshold_value' => -5, 'is_active' => true,
    ])->assertSessionHasErrors('threshold_value');

    $rule = AlertThreshold::where('alert_type', 'low_signal')->firstOrFail();

    $this->actingAs($admin)->put(route('admin.alert-thresholds.update', $rule), [
        'threshold_value' => -120, 'is_active' => true,
    ])->assertSessionHasNoErrors();

    expect($rule->fresh()->threshold_value)->toBe(-120.0);
});
