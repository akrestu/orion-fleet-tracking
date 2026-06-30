<?php

use App\Enums\UserRole;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    $this->admin = User::factory()->admin()->create();
    $this->operator = User::factory()->operator()->create();
    $this->viewer = User::factory()->create();
});

// --- Access control ---

it('allows admin to view user management page', function () {
    $this->actingAs($this->admin)
        ->get('/admin/users')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/users/index'));
});

it('denies operator access to user management', function () {
    $this->actingAs($this->operator)
        ->get('/admin/users')
        ->assertForbidden();
});

it('denies viewer access to user management', function () {
    $this->actingAs($this->viewer)
        ->get('/admin/users')
        ->assertForbidden();
});

it('redirects unauthenticated users to login', function () {
    $this->get('/admin/users')
        ->assertRedirect('/login');
});

// --- Create user ---

it('admin can create a new user', function () {
    $this->actingAs($this->admin)
        ->post('/admin/users', [
            'name' => 'New User',
            'email' => 'newuser@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => UserRole::Operator->value,
        ])
        ->assertRedirect();

    $this->assertDatabaseHas('users', [
        'email' => 'newuser@example.com',
        'role' => UserRole::Operator->value,
    ]);
});

it('rejects creating a user with duplicate email', function () {
    User::factory()->create(['email' => 'taken@example.com']);

    $this->actingAs($this->admin)
        ->post('/admin/users', [
            'name' => 'Duplicate',
            'email' => 'taken@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => UserRole::Viewer->value,
        ])
        ->assertSessionHasErrors('email');
});

// --- Update user ---

it('admin can update a user role', function () {
    $target = User::factory()->create(['role' => UserRole::Viewer]);

    $this->actingAs($this->admin)
        ->put("/admin/users/{$target->id}", [
            'name' => $target->name,
            'email' => $target->email,
            'role' => UserRole::Operator->value,
        ])
        ->assertRedirect();

    expect($target->fresh()->role)->toBe(UserRole::Operator);
});

// --- Delete user ---

it('admin can delete another user', function () {
    $target = User::factory()->create();

    $this->actingAs($this->admin)
        ->delete("/admin/users/{$target->id}")
        ->assertRedirect();

    $this->assertDatabaseMissing('users', ['id' => $target->id]);
});

it('admin cannot delete their own account', function () {
    $this->actingAs($this->admin)
        ->delete("/admin/users/{$this->admin->id}")
        ->assertSessionHasErrors('user');

    $this->assertDatabaseHas('users', ['id' => $this->admin->id]);
});

it('cannot delete the last admin account', function () {
    User::where('role', UserRole::Admin)->where('id', '!=', $this->admin->id)->delete();

    $this->actingAs($this->admin)
        ->delete("/admin/users/{$this->admin->id}")
        ->assertSessionHasErrors('user');
});

it('allows deleting an admin when another admin exists', function () {
    $secondAdmin = User::factory()->admin()->create();

    $this->actingAs($secondAdmin)
        ->delete("/admin/users/{$this->admin->id}")
        ->assertRedirect();

    $this->assertDatabaseMissing('users', ['id' => $this->admin->id]);
});

// --- Reset password ---

it('admin can reset another user password', function () {
    $target = User::factory()->create();
    $oldHash = $target->password;

    $this->actingAs($this->admin)
        ->patch("/admin/users/{$target->id}/reset-password", [
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])
        ->assertRedirect();

    expect($target->fresh()->password)->not->toBe($oldHash);
});

it('rejects reset password when confirmation does not match', function () {
    $target = User::factory()->create();

    $this->actingAs($this->admin)
        ->patch("/admin/users/{$target->id}/reset-password", [
            'password' => 'newpassword123',
            'password_confirmation' => 'wrongconfirm',
        ])
        ->assertSessionHasErrors('password');
});

it('operator cannot reset a user password', function () {
    $target = User::factory()->create();

    $this->actingAs($this->operator)
        ->patch("/admin/users/{$target->id}/reset-password", [
            'password' => 'newpassword123',
            'password_confirmation' => 'newpassword123',
        ])
        ->assertForbidden();
});
