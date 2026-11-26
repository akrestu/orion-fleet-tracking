<?php

use App\Models\Device;
use App\Models\GpsLog;
use App\Models\ShareLink;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function () {
    $this->token = str_repeat('a', 40);
    $this->device = Device::factory()->create([
        'dev_eui' => '9956efb31332a835',
        'device_name' => 'DT-12',
        'unit_type' => 'dt',
        'is_active' => true,
    ]);
    GpsLog::factory()->create([
        'dev_eui' => $this->device->dev_eui,
        'latitude' => -3.779223,
        'longitude' => 103.67939,
        'speed_kmh' => 32.5,
        'recorded_at' => now()->subMinutes(5),
    ]);
});

it('lets an admin create and revoke a live map link', function () {
    $admin = User::factory()->admin()->create();

    $this->actingAs($admin)
        ->post('/admin/share-links', ['name' => 'TV Control Room'])
        ->assertRedirect();

    $link = ShareLink::sole();
    expect($link->name)->toBe('TV Control Room')
        ->and($link->token_hash)->toBe(ShareLink::hashToken($link->token));

    $this->actingAs($admin)
        ->get('/admin/share-links')
        ->assertInertia(fn ($page) => $page
            ->component('admin/share-links/index')
            ->where('links.0.url', route('live.show', $link->token)),
        );

    $this->actingAs($admin)->delete("/admin/share-links/{$link->id}")->assertRedirect();

    expect(ShareLink::count())->toBe(0);
});

it('forbids non-admins from managing links', function () {
    $this->actingAs(User::factory()->operator()->create())
        ->post('/admin/share-links', ['name' => 'Nope'])
        ->assertForbidden();
});

it('shows the live map without login and without device EUIs', function () {
    ShareLink::factory()->withToken($this->token)->create();

    $this->get("/live/{$this->token}")
        ->assertOk()
        ->assertDontSee($this->device->dev_eui)
        ->assertInertia(fn ($page) => $page
            ->component('share/live-map')
            ->where('snapshot.positions.0.device_name', 'DT-12')
            ->where('snapshot.positions.0.speed_kmh', 32.5)
            ->missing('snapshot.positions.0.dev_eui')
            ->has('snapshot.trails.'.$this->device->id, 1),
        );
});

it('serves the polling feed with only new trail points', function () {
    ShareLink::factory()->withToken($this->token)->create();

    $this->getJson("/live/{$this->token}/feed")
        ->assertOk()
        ->assertJsonPath('positions.0.device_name', 'DT-12')
        ->assertJsonCount(1, 'trails.'.$this->device->id);

    $this->getJson("/live/{$this->token}/feed?since=".urlencode(now()->subMinute()->toIso8601String()))
        ->assertOk()
        ->assertJsonMissingPath('trails.'.$this->device->id);
});

it('rejects unknown, expired and revoked links', function () {
    $this->get('/live/'.str_repeat('b', 40))->assertNotFound();

    ShareLink::factory()->withToken($this->token)->expired()->create();
    $this->getJson("/live/{$this->token}/feed")->assertNotFound();
});
