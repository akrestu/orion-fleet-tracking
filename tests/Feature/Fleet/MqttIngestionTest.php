<?php

use App\Events\ChirpstackUplinkReceived;
use App\Models\Device;
use App\Models\GpsLog;
use App\Services\GpsIngestionService;
use App\Services\MqttPayloadParser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;

uses(RefreshDatabase::class);

// ─── Fixture ────────────────────────────────────────────────────────────────

function validChirpstackPayload(array $overrides = []): string
{
    $base = [
        'deduplicationId' => '4a3322cd-b4b9-4e77-8bce-a6c396448935',
        'time' => '2026-06-27T03:47:23.776323479+00:00',
        'deviceInfo' => [
            'tenantId' => '8fe6a223-6073-4f51-8428-9691f69dd482',
            'tenantName' => 'ChirpStack',
            'applicationId' => '7791e609-dbc6-4c9e-abc9-43e1c6c163d3',
            'applicationName' => 'Genesis-Eagle-Eye',
            'deviceProfileId' => 'c4a4fe03-0aac-4369-b4d8-814a89fcca17',
            'deviceProfileName' => 'Genesis25',
            'deviceName' => '2026_Hauler_0001',
            'devEui' => '9956efb31332a835',
            'deviceClassEnabled' => 'CLASS_A',
            'tags' => [],
        ],
        'object' => [
            'speed_kmh' => 42.5,
            'latitude' => -3.779223,
            'longitude' => 103.67939,
            'unit_id' => 1,
            'satellites' => 38,
            'hdop' => 0.5,
            'heading_deg' => 342,
        ],
        'rxInfo' => [[
            'gatewayId' => '2cf7f11375000072',
            'rssi' => -55,
            'snr' => 12.8,
        ]],
    ];

    return json_encode(array_merge_recursive($base, $overrides));
}

// ─── MqttPayloadParser ───────────────────────────────────────────────────────

describe('MqttPayloadParser', function () {
    beforeEach(function () {
        $this->parser = new MqttPayloadParser;
    });

    it('parses a valid ChirpStack payload correctly', function () {
        $result = $this->parser->parse(validChirpstackPayload());

        expect($result)->toBeArray()
            ->and($result['dev_eui'])->toBe('9956efb31332a835')
            ->and($result['device_name'])->toBe('2026_Hauler_0001')
            ->and($result['latitude'])->toBe(-3.779223)
            ->and($result['longitude'])->toBe(103.67939)
            ->and($result['speed_kmh'])->toBe(42.5)
            ->and($result['heading_deg'])->toBe(342)
            ->and($result['hdop'])->toBe(0.5)
            ->and($result['satellites'])->toBe(38)
            ->and($result['rssi'])->toBe(-55)
            ->and($result['snr'])->toBe(12.8)
            ->and($result['gateway_id'])->toBe('2cf7f11375000072');
    });

    it('returns null for invalid JSON', function () {
        expect($this->parser->parse('not-json'))->toBeNull();
    });

    it('returns null when devEui is missing', function () {
        $payload = json_decode(validChirpstackPayload(), true);
        unset($payload['deviceInfo']['devEui']);
        expect($this->parser->parse(json_encode($payload)))->toBeNull();
    });

    it('returns null when GPS coordinates are missing', function () {
        $payload = json_decode(validChirpstackPayload(), true);
        unset($payload['object']['latitude'], $payload['object']['longitude']);
        expect($this->parser->parse(json_encode($payload)))->toBeNull();
    });

    it('returns null when coordinates are 0,0 (GPS not fixed)', function () {
        $payload = json_decode(validChirpstackPayload(), true);
        $payload['object']['latitude'] = 0.0;
        $payload['object']['longitude'] = 0.0;
        expect($this->parser->parse(json_encode($payload)))->toBeNull();
    });

    it('validates coordinate boundaries', function () {
        $parser = $this->parser;

        expect($parser->isValidCoordinate(-3.779223, 103.67939))->toBeTrue();
        expect($parser->isValidCoordinate(0.0, 0.0))->toBeFalse();       // no GPS fix
        expect($parser->isValidCoordinate(91.0, 0.0))->toBeFalse();      // lat out of range
        expect($parser->isValidCoordinate(0.0, 181.0))->toBeFalse();     // lng out of range
        expect($parser->isValidCoordinate(-90.0, 180.0))->toBeTrue();    // edge valid
    });
});

// ─── GpsIngestionService ─────────────────────────────────────────────────────

describe('GpsIngestionService', function () {
    beforeEach(function () {
        $this->parser = new MqttPayloadParser;
        $this->service = app(GpsIngestionService::class);
    });

    it('creates a gps_log record on ingest', function () {
        $parsed = $this->parser->parse(validChirpstackPayload());

        $gpsLog = $this->service->ingest($parsed);

        expect($gpsLog)->toBeInstanceOf(GpsLog::class);
        expect(GpsLog::count())->toBe(1);

        $log = GpsLog::first();
        expect($log->dev_eui)->toBe('9956efb31332a835')
            ->and($log->latitude)->toEqual(-3.779223)
            ->and($log->speed_kmh)->toEqual(42.5);
    });

    it('auto-creates a device if not exists', function () {
        $parsed = $this->parser->parse(validChirpstackPayload());

        expect(Device::count())->toBe(0);
        $this->service->ingest($parsed);
        expect(Device::count())->toBe(1);

        $device = Device::first();
        expect($device->dev_eui)->toBe('9956efb31332a835')
            ->and($device->device_name)->toBe('2026_Hauler_0001');
    });

    it('updates device last_seen_at on ingest', function () {
        $device = Device::factory()->create([
            'dev_eui' => '9956efb31332a835',
            'last_seen_at' => now()->subHour(),
        ]);

        $parsed = $this->parser->parse(validChirpstackPayload());
        $this->service->ingest($parsed);

        $device->refresh();
        expect($device->last_seen_at->gt(now()->subMinute()))->toBeTrue();
    });

    it('does not overwrite unit_type of existing device', function () {
        Device::factory()->create([
            'dev_eui' => '9956efb31332a835',
            'unit_type' => 'dozer',
        ]);

        $parsed = $this->parser->parse(validChirpstackPayload());
        $this->service->ingest($parsed);

        expect(Device::first()->unit_type)->toBe('dozer');
    });

    it('dispatches ChirpstackUplinkReceived event on ingest', function () {
        Event::fake();

        $parsed = $this->parser->parse(validChirpstackPayload());
        $gpsLog = $this->service->ingest($parsed);

        Event::assertDispatched(ChirpstackUplinkReceived::class, function ($event) use ($gpsLog) {
            return $event->gpsLog->id === $gpsLog->id
                && $event->device->dev_eui === '9956efb31332a835';
        });
    });

    it('broadcasts correct payload structure', function () {
        Event::fake();

        $parsed = $this->parser->parse(validChirpstackPayload());
        $this->service->ingest($parsed);

        Event::assertDispatched(ChirpstackUplinkReceived::class, function ($event) {
            $payload = $event->broadcastWith();

            return isset($payload['dev_eui'], $payload['latitude'], $payload['longitude'], $payload['speed_kmh'])
                && $payload['dev_eui'] === '9956efb31332a835'
                && $payload['latitude'] === -3.779223
                && $payload['speed_kmh'] === 42.5;
        });
    });
});
