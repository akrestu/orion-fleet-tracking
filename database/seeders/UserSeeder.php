<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds one login account for every UserRole.
 *
 * The password comes from SEED_USER_PASSWORD in .env (fallback: "password").
 * Existing accounts are matched by unique_id and keep their current password,
 * so re-running the seeder on a live server never resets anyone's login.
 */
class UserSeeder extends Seeder
{
    public function run(): void
    {
        $password = env('SEED_USER_PASSWORD', 'password');

        foreach ($this->accounts() as $account) {
            $user = User::firstOrNew(['unique_id' => $account['unique_id']]);

            $user->fill([
                'name' => $account['name'],
                'email' => $account['email'],
                'role' => $account['role'],
            ]);

            if (! $user->exists) {
                $user->password = Hash::make($password);
                $user->email_verified_at = now();
            }

            $user->save();
        }
    }

    /**
     * @return array<int, array{unique_id: string, name: string, email: string, role: UserRole}>
     */
    private function accounts(): array
    {
        return array_map(fn (UserRole $role): array => [
            'unique_id' => 'ORN-'.strtoupper($role->value),
            'name' => 'ORION '.$role->label(),
            'email' => $role->value.'@orion.local',
            'role' => $role,
        ], UserRole::cases());
    }
}
