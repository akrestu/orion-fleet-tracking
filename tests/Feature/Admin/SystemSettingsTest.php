<?php

use App\Models\ApiToken;
use App\Models\Device;
use App\Models\DeviceGroup;
use App\Models\SystemSetting;
use App\Models\User;
use App\Services\MqttSettings;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
});

// --- Access control ---

it('allows admin to view system settings', function () {
    $this->actingAs($this->admin)
        ->get('/admin/system-settings')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/system-settings/index'));
});

it('denies operator access to system settings', function () {
    $this->actingAs($this->operator)
        ->get('/admin/system-settings')
        ->assertForbidden();
});

// --- MQTT settings ---

it('admin can update MQTT settings', function () {
    $this->actingAs($this->admin)
        ->put('/admin/system-settings', [
            ...validMqttPayload(),
            'mqtt_host' => 'mqtt.example.com',
            'mqtt_port' => 8883,
            'mqtt_username' => 'fleet',
            'mqtt_password' => 'secret',
            'mqtt_topic_prefix' => 'fleet/',
            'mqtt_use_tls' => true,
        ])
        ->assertRedirect();

    expect(SystemSetting::getValue('mqtt_host'))->toBe('mqtt.example.com');
    expect(SystemSetting::getValue('mqtt_port'))->toBe('8883');
    expect(SystemSetting::getValue('mqtt_use_tls'))->toBe('true');
});

it('validates MQTT settings', function () {
    $this->actingAs($this->admin)
        ->put('/admin/system-settings', [
            'mqtt_host' => '',
            'mqtt_port' => 99999,
        ])
        ->assertSessionHasErrors(['mqtt_host', 'mqtt_port']);
});

// --- API Tokens ---

it('admin can create an API token', function () {
    $this->actingAs($this->admin)
        ->post('/admin/api-tokens', ['name' => 'CI Pipeline'])
        ->assertRedirect();

    expect(ApiToken::where('name', 'CI Pipeline')->exists())->toBeTrue();
});

it('admin can delete an API token', function () {
    $token = ApiToken::create([
        'name' => 'Old Token',
        'token' => str_repeat('a', 64),
        'created_by' => $this->admin->id,
    ]);

    $this->actingAs($this->admin)
        ->delete("/admin/api-tokens/{$token->id}")
        ->assertRedirect();

    expect(ApiToken::find($token->id))->toBeNull();
});

it('grants fleet.read by default so UI-created tokens can call the fleet API', function () {
    $this->actingAs($this->admin)
        ->post('/admin/api-tokens', ['name' => 'Default Abilities']);

    expect(ApiToken::where('name', 'Default Abilities')->value('abilities'))
        ->toBe(['fleet.read']);
});

it('scopes API token fleet access to the selected device groups', function () {
    $groupA = DeviceGroup::factory()->create();
    $groupB = DeviceGroup::factory()->create();
    Device::factory()->create(['device_group_id' => $groupA->id]);
    Device::factory()->create(['device_group_id' => $groupB->id]);

    $this->actingAs($this->admin)
        ->post('/admin/api-tokens', ['name' => 'Scoped', 'device_group_ids' => [$groupA->id]])
        ->assertSessionHasNoErrors();

    $plaintext = session('new_token');
    auth()->logout();

    $this->withToken($plaintext)
        ->getJson('/api/v1/fleet/devices')
        ->assertOk()
        ->assertJsonCount(1, 'data');
});

it('redirects the api-tokens index to system settings', function () {
    $this->actingAs($this->admin)
        ->get('/admin/api-tokens')
        ->assertRedirect(route('admin.system-settings.index'));
});

/**
 * @return array<string, mixed>
 */
function validMqttPayload(): array
{
    return [
        'mqtt_host' => 'broker.example.test',
        'mqtt_port' => 1883,
        'mqtt_client_id' => 'orion-subscriber',
        'mqtt_username' => 'orion',
        'mqtt_password' => '',
        'mqtt_clean_session' => false,
        'mqtt_auto_reconnect' => true,
        'mqtt_reconnect_max_attempts' => 999999,
        'mqtt_reconnect_delay' => 5,
        'mqtt_use_tls' => false,
        'mqtt_tls_verify_peer' => true,
        'mqtt_tls_verify_peer_name' => true,
        'mqtt_tls_allow_self_signed' => false,
        'chirpstack_app_id' => '1f2e3d4c-0000-4000-8000-abcdefabcdef',
        'mqtt_topic_prefix' => '',
    ];
}

it('shows the .env MQTT configuration until settings are saved, without leaking the password', function () {
    config([
        'mqtt-client.connections.default.host' => 'env-broker.local',
        'mqtt-client.connections.default.client_id' => 'env-client',
        'mqtt-client.connections.default.connection_settings.auth.password' => 'env-secret',
        'mqtt-client.connections.default.connection_settings.tls.verify_peer' => true,
        'app.chirpstack_app_id' => 'env-app',
    ]);

    $this->actingAs($this->admin)
        ->get('/admin/system-settings')
        ->assertInertia(fn (Assert $page) => $page
            ->where('mqttSettings.mqtt_host', 'env-broker.local')
            ->where('mqttSettings.mqtt_client_id', 'env-client')
            ->where('mqttSettings.chirpstack_app_id', 'env-app')
            ->where('mqttSettings.mqtt_tls_verify_peer', true)
            ->where('mqttSettings.mqtt_password', '')
            ->where('mqttSettings.mqtt_password_is_set', true)
            ->where('mqttMeta.saved', false)
            ->where('mqttMeta.default_topic', 'application/env-app/device/+/event/up'));
});

it('saved MQTT settings override the subscriber config and keep the password encrypted', function () {
    $this->actingAs($this->admin)
        ->put('/admin/system-settings', [
            ...validMqttPayload(),
            'mqtt_port' => 8883,
            'mqtt_password' => 's3cret',
            'mqtt_use_tls' => true,
            'mqtt_tls_allow_self_signed' => true,
            'mqtt_reconnect_delay' => 10,
        ])
        ->assertSessionHasNoErrors();

    expect(SystemSetting::getValue('mqtt_password'))->not->toBe('s3cret');

    $applied = app(MqttSettings::class)->apply();

    expect($applied)->toBe([
        'host' => 'broker.example.test',
        'port' => 8883,
        'topic' => 'application/1f2e3d4c-0000-4000-8000-abcdefabcdef/device/+/event/up',
        'source' => 'settings',
    ])
        ->and(config('mqtt-client.connections.default.connection_settings.auth.password'))->toBe('s3cret')
        ->and(config('mqtt-client.connections.default.connection_settings.tls.enabled'))->toBeTrue()
        ->and(config('mqtt-client.connections.default.connection_settings.tls.allow_self_signed_certificate'))->toBeTrue()
        ->and(config('mqtt-client.connections.default.connection_settings.auto_reconnect.delay_between_reconnect_attempts'))->toBe(10)
        ->and(config('mqtt-client.connections.default.client_id'))->toBe('orion-subscriber');
});

it('keeps the saved password when left blank and removes it on request', function () {
    $this->actingAs($this->admin)->put('/admin/system-settings', [...validMqttPayload(), 'mqtt_password' => 'keep-me']);
    $this->actingAs($this->admin)->put('/admin/system-settings', validMqttPayload());

    app(MqttSettings::class)->apply();
    expect(config('mqtt-client.connections.default.connection_settings.auth.password'))->toBe('keep-me');

    $this->actingAs($this->admin)->put('/admin/system-settings', [...validMqttPayload(), 'mqtt_password_clear' => true]);

    app(MqttSettings::class)->apply();
    expect(config('mqtt-client.connections.default.connection_settings.auth.password'))->toBeNull();
});

it('saving MQTT settings signals the running subscriber to reload', function () {
    $settings = app(MqttSettings::class);
    $before = $settings->version();

    expect($settings->hasChangedSince($before))->toBeFalse();

    $this->actingAs($this->admin)
        ->put('/admin/system-settings', [...validMqttPayload(), 'mqtt_host' => 'new-broker.example.test'])
        ->assertSessionHasNoErrors();

    expect($settings->hasChangedSince($before))->toBeTrue()
        ->and($settings->hasChangedSince($settings->version()))->toBeFalse()
        ->and($settings->apply()['host'])->toBe('new-broker.example.test');
});

it('a failed validation does not signal a reload', function () {
    $settings = app(MqttSettings::class);
    $before = $settings->version();

    $this->actingAs($this->admin)
        ->put('/admin/system-settings', [...validMqttPayload(), 'mqtt_port' => 0])
        ->assertSessionHasErrors('mqtt_port');

    expect($settings->hasChangedSince($before))->toBeFalse();
});
