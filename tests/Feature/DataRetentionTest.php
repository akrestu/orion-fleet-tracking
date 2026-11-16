<?php

use App\Models\AuditLog;
use App\Models\Device;
use App\Models\GpsLog;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * @return array<string, mixed>
 */
function gpsLogAttributes(string $devEui, DateTimeInterface $recordedAt): array
{
    return [
        'dev_eui' => $devEui,
        'latitude' => -6.2,
        'longitude' => 106.8,
        'speed_kmh' => 10,
        'recorded_at' => $recordedAt,
        'created_at' => $recordedAt,
    ];
}

test('model:prune removes GPS logs older than the retention window', function () {
    config(['app.gps_log_retention_days' => 30]);
    $device = Device::factory()->create();

    $old = GpsLog::create(gpsLogAttributes($device->dev_eui, now()->subDays(31)));
    $recent = GpsLog::create(gpsLogAttributes($device->dev_eui, now()->subDays(5)));

    $this->artisan('model:prune', ['--model' => [GpsLog::class]])->assertSuccessful();

    expect(GpsLog::find($old->id))->toBeNull()
        ->and(GpsLog::find($recent->id))->not->toBeNull();
});

test('a retention of zero days keeps every GPS log', function () {
    config(['app.gps_log_retention_days' => 0]);
    $device = Device::factory()->create();
    GpsLog::create(gpsLogAttributes($device->dev_eui, now()->subYears(5)));

    $this->artisan('model:prune', ['--model' => [GpsLog::class]])->assertSuccessful();

    expect(GpsLog::count())->toBe(1);
});

test('model:prune removes audit logs older than the retention window', function () {
    config(['app.audit_log_retention_days' => 90]);

    $old = AuditLog::forceCreate(['event' => 'old', 'description' => 'old', 'created_at' => now()->subDays(91)]);
    $recent = AuditLog::forceCreate(['event' => 'new', 'description' => 'new', 'created_at' => now()]);

    $this->artisan('model:prune', ['--model' => [AuditLog::class]])->assertSuccessful();

    expect(AuditLog::find($old->id))->toBeNull()
        ->and(AuditLog::find($recent->id))->not->toBeNull();
});
