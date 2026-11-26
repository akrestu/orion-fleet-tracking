<?php

use App\Enums\UserRole;
use App\Models\User;
use Database\Seeders\UserSeeder;
use Illuminate\Support\Facades\Hash;

test('it seeds one account per role', function () {
    $this->seed(UserSeeder::class);

    foreach (UserRole::cases() as $role) {
        expect(User::where('role', $role)->count())->toBe(1);
    }
});

test('re-running the seeder keeps an existing password', function () {
    $this->seed(UserSeeder::class);
    User::where('unique_id', 'ORN-ADMIN')->first()->update(['password' => Hash::make('changed-secret')]);

    $this->seed(UserSeeder::class);

    expect(User::count())->toBe(count(UserRole::cases()))
        ->and(Hash::check('changed-secret', User::where('unique_id', 'ORN-ADMIN')->first()->password))->toBeTrue();
});
