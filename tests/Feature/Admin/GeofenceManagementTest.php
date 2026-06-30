<?php

use App\Models\Geofence;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
});

$samplePolygon = fn () => [
    ['lat' => -3.77, 'lng' => 103.67],
    ['lat' => -3.78, 'lng' => 103.68],
    ['lat' => -3.79, 'lng' => 103.67],
];

// --- Access control ---

it('allows admin to view geofences page', function () {
    $this->actingAs($this->admin)
        ->get('/admin/geofences')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/geofences/index'));
});

it('denies operator access to geofences', function () {
    $this->actingAs($this->operator)
        ->get('/admin/geofences')
        ->assertForbidden();
});

it('redirects unauthenticated users to login', function () {
    $this->get('/admin/geofences')
        ->assertRedirect('/login');
});

// --- CRUD ---

it('admin can create a geofence zone', function () use ($samplePolygon) {
    $this->actingAs($this->admin)
        ->post('/admin/geofences', [
            'name' => 'Pit Area A',
            'description' => 'Main pit zone',
            'color' => '#f59e0b',
            'polygon' => $samplePolygon(),
            'is_active' => true,
            'zone_type' => 'loading',
        ])
        ->assertRedirect();

    expect(Geofence::where('name', 'Pit Area A')->exists())->toBeTrue();
});

it('validates polygon must have at least 3 points', function () {
    $this->actingAs($this->admin)
        ->post('/admin/geofences', [
            'name' => 'Too small',
            'color' => '#f59e0b',
            'polygon' => [
                ['lat' => -3.77, 'lng' => 103.67],
                ['lat' => -3.78, 'lng' => 103.68],
            ],
        ])
        ->assertSessionHasErrors('polygon');
});

it('admin can update a geofence zone', function () use ($samplePolygon) {
    $geofence = Geofence::factory()->create();

    $this->actingAs($this->admin)
        ->put("/admin/geofences/{$geofence->id}", [
            'name' => 'Updated Zone',
            'description' => null,
            'color' => '#10b981',
            'polygon' => $samplePolygon(),
            'is_active' => false,
            'zone_type' => 'dumping',
        ])
        ->assertRedirect();

    expect($geofence->fresh())
        ->name->toBe('Updated Zone')
        ->color->toBe('#10b981')
        ->is_active->toBeFalse();
});

it('admin can delete a geofence zone', function () {
    $geofence = Geofence::factory()->create();

    $this->actingAs($this->admin)
        ->delete("/admin/geofences/{$geofence->id}")
        ->assertRedirect();

    expect(Geofence::find($geofence->id))->toBeNull();
});

it('geofences index lists all zones', function () {
    Geofence::factory()->count(3)->create();

    $this->actingAs($this->admin)
        ->get('/admin/geofences')
        ->assertInertia(fn (Assert $page) => $page
            ->component('admin/geofences/index')
            ->has('geofences', 3)
        );
});
