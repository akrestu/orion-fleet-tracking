<?php

use App\Enums\UserRole;
use App\Models\MapTileset;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

test('guests cannot access tile routes', function () {
    $this->get(route('fleet.map.tiles.index'))->assertRedirect(route('login'));
    $this->post(route('fleet.map.tiles.store'))->assertRedirect(route('login'));
});

test('authenticated users can list tilesets', function () {
    $user = User::factory()->create();
    MapTileset::create(['name' => 'Site A', 'slug' => 'site-a-abc123', 'min_zoom' => 0, 'max_zoom' => 19]);

    $this->actingAs($user)
        ->getJson(route('fleet.map.tiles.index'))
        ->assertOk()
        ->assertJsonCount(1)
        ->assertJsonFragment(['name' => 'Site A']);
});

test('non-admin users cannot upload a tileset', function () {
    $user = User::factory()->create(['role' => UserRole::Operator]);

    $this->actingAs($user)
        ->postJson(route('fleet.map.tiles.store'), [])
        ->assertForbidden();
});

test('non-admin users cannot delete a tileset', function () {
    $user = User::factory()->create(['role' => UserRole::Operator]);
    $tileset = MapTileset::create(['name' => 'Old Map', 'slug' => 'old-map-xyz', 'min_zoom' => 0, 'max_zoom' => 19]);

    $this->actingAs($user)
        ->deleteJson(route('fleet.map.tiles.destroy', $tileset))
        ->assertForbidden();

    $this->assertDatabaseHas('map_tilesets', ['id' => $tileset->id]);
});

test('upload requires a name and zip file', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);

    $response = $this->actingAs($admin)
        ->postJson(route('fleet.map.tiles.store'), []);

    expect($response->status())->toBe(422);
});

test('admins can upload a zip tileset', function () {
    Storage::fake('public');
    $admin = User::factory()->create(['role' => UserRole::Admin]);

    $tmpZip = tempnam(sys_get_temp_dir(), 'tiles').'.zip';
    $zip = new ZipArchive;
    $zip->open($tmpZip, ZipArchive::CREATE);
    $zip->addFromString('14/10/5234.png', 'fake-png-data');
    $zip->close();

    $file = new UploadedFile($tmpZip, 'tiles.zip', 'application/zip', UPLOAD_ERR_OK, true);

    $this->actingAs($admin)
        ->postJson(route('fleet.map.tiles.store'), [
            'name' => 'Site Tambang',
            'tiles' => $file,
        ])
        ->assertCreated()
        ->assertJsonFragment(['name' => 'Site Tambang']);

    $this->assertDatabaseHas('map_tilesets', ['name' => 'Site Tambang']);
});

test('admins can delete a tileset', function () {
    $admin = User::factory()->create(['role' => UserRole::Admin]);
    $tileset = MapTileset::create(['name' => 'Old Map', 'slug' => 'old-map-xyz', 'min_zoom' => 0, 'max_zoom' => 19]);

    $this->actingAs($admin)
        ->deleteJson(route('fleet.map.tiles.destroy', $tileset))
        ->assertNoContent();

    $this->assertDatabaseMissing('map_tilesets', ['id' => $tileset->id]);
});
