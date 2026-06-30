<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // Admin default — ganti password di production
        User::updateOrCreate(
            ['email' => 'admin@orion.local'],
            [
                'name' => 'ORION Admin',
                'password' => Hash::make('password'),
                'role' => UserRole::Admin,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'operator@orion.local'],
            [
                'name' => 'ORION Operator',
                'password' => Hash::make('password'),
                'role' => UserRole::Operator,
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'viewer@orion.local'],
            [
                'name' => 'ORION Viewer',
                'password' => Hash::make('password'),
                'role' => UserRole::Viewer,
                'email_verified_at' => now(),
            ]
        );

        $this->call(DeviceSeeder::class);
    }
}
