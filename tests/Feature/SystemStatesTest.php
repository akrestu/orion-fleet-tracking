<?php

use App\Models\DeviceGroup;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('users without device groups get the admin contact email', function () {
    $admin = User::factory()->admin()->create(['email' => 'ops-admin@example.test']);
    $operator = User::factory()->operator()->create();

    $this->actingAs($operator)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('auth.accessibleGroupIds', [])
            ->where('supportEmail', 'ops-admin@example.test'));

    $operator->deviceGroups()->attach(DeviceGroup::factory()->create());

    $this->actingAs($operator->fresh())
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('supportEmail', null));

    $this->actingAs($admin)
        ->get(route('dashboard'))
        ->assertInertia(fn (Assert $page) => $page->where('supportEmail', null));
});

test('missing pages render the ORION error page when debug is off', function () {
    config(['app.debug' => false]);

    $this->actingAs(User::factory()->create())
        ->get('/this-page-does-not-exist')
        ->assertNotFound()
        ->assertInertia(fn (Assert $page) => $page
            ->component('error')
            ->where('status', 404)
            ->has('reference'));
});

test('json requests keep the default error response', function () {
    config(['app.debug' => false]);

    $this->getJson('/this-page-does-not-exist')
        ->assertNotFound()
        ->assertJsonStructure(['message']);
});
