<?php

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;

uses(RefreshDatabase::class);

it('default role is viewer when not specified', function () {
    $user = User::factory()->create();
    expect($user->role)->toBe(UserRole::Viewer);
});

it('admin factory state sets admin role', function () {
    $user = User::factory()->admin()->create();
    expect($user->role)->toBe(UserRole::Admin)
        ->and($user->isAdmin())->toBeTrue()
        ->and($user->isOperator())->toBeFalse()
        ->and($user->isViewer())->toBeFalse();
});

it('operator factory state sets operator role', function () {
    $user = User::factory()->operator()->create();
    expect($user->role)->toBe(UserRole::Operator)
        ->and($user->isOperator())->toBeTrue()
        ->and($user->canOperate())->toBeTrue()
        ->and($user->canManage())->toBeFalse();
});

it('viewer cannot manage or operate', function () {
    $user = User::factory()->create(['role' => UserRole::Viewer]);
    expect($user->canManage())->toBeFalse()
        ->and($user->canOperate())->toBeFalse();
});

it('admin can manage and operate', function () {
    $user = User::factory()->admin()->create();
    expect($user->canManage())->toBeTrue()
        ->and($user->canOperate())->toBeTrue();
});

it('role middleware blocks unauthorized role', function () {
    $route = Route::get('/test-admin', fn () => 'ok')
        ->middleware(['auth', 'role:admin']);

    $viewer = User::factory()->create(['role' => UserRole::Viewer]);
    $this->actingAs($viewer)->get('/test-admin')->assertForbidden();
});

it('role middleware allows correct role', function () {
    Route::get('/test-operator', fn () => 'ok')
        ->middleware(['auth', 'role:admin,operator']);

    $operator = User::factory()->operator()->create();
    $this->actingAs($operator)->get('/test-operator')->assertOk();
});

it('role is cast from database correctly', function () {
    $user = User::factory()->create(['role' => UserRole::Admin]);
    $fresh = User::find($user->id);

    expect($fresh->role)->toBeInstanceOf(UserRole::class)
        ->and($fresh->role)->toBe(UserRole::Admin);
});
