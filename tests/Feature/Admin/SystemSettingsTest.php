<?php

use App\Models\ApiToken;
use App\Models\SystemSetting;
use App\Models\User;
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
