<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\CreateUserRequest;
use App\Http\Requests\Admin\ResetUserPasswordRequest;
use App\Http\Requests\Admin\UpdateUserRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

class UserController extends Controller
{
    public function index(): Response
    {
        $users = User::query()
            ->orderBy('name')
            ->with('deviceGroups:id,name')
            ->get(['id', 'name', 'unique_id', 'email', 'role', 'created_at', 'two_factor_confirmed_at']);

        // Latest session activity per user (database session driver); unix timestamps.
        /** @var array<int, int> $lastActive */
        $lastActive = DB::table('sessions')
            ->whereNotNull('user_id')
            ->selectRaw('user_id, MAX(last_activity) as last_activity')
            ->groupBy('user_id')
            ->pluck('last_activity', 'user_id')
            ->map(fn ($ts) => (int) $ts)
            ->all();

        return Inertia::render('admin/users/index', [
            'users' => $users->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'unique_id' => $user->unique_id,
                'email' => $user->email,
                'role' => $user->role->value,
                'role_label' => $user->role->label(),
                'created_at' => $user->created_at?->toDateString(),
                'groups' => $user->deviceGroups->pluck('name')->all(),
                'two_factor_enabled' => $user->two_factor_confirmed_at !== null,
                'last_active_at' => isset($lastActive[$user->id])
                    ? Carbon::createFromTimestamp($lastActive[$user->id])->toIso8601String()
                    : null,
            ]),
            'roles' => collect(UserRole::cases())->map(fn (UserRole $role) => [
                'value' => $role->value,
                'label' => $role->label(),
            ]),
        ]);
    }

    public function store(CreateUserRequest $request): RedirectResponse
    {
        User::create([
            'name' => $request->validated('name'),
            'unique_id' => $request->validated('unique_id'),
            'email' => $request->validated('email'),
            'password' => Hash::make($request->validated('password')),
            'role' => UserRole::from($request->validated('role')),
        ]);

        return back()->with('success', 'User created successfully.');
    }

    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        $newRole = UserRole::from($request->validated('role'));

        if ($user->isAdmin() && $newRole !== UserRole::Admin) {
            // Lock the users table row to prevent concurrent demotions racing past this guard.
            $updated = DB::transaction(function () use ($request, $user, $newRole) {
                $adminCount = User::where('role', UserRole::Admin)->lockForUpdate()->count();

                if ($adminCount <= 1) {
                    return false;
                }

                $user->update([
                    'name' => $request->validated('name'),
                    'unique_id' => $request->validated('unique_id'),
                    'email' => $request->validated('email'),
                    'role' => $newRole,
                ]);

                return true;
            });

            if (! $updated) {
                return back()->withErrors(['user' => 'Cannot demote the last admin account.']);
            }

            return back()->with('success', 'User updated successfully.');
        }

        $user->update([
            'name' => $request->validated('name'),
            'unique_id' => $request->validated('unique_id'),
            'email' => $request->validated('email'),
            'role' => $newRole,
        ]);

        return back()->with('success', 'User updated successfully.');
    }

    public function resetPassword(ResetUserPasswordRequest $request, User $user): RedirectResponse
    {
        $user->update([
            'password' => Hash::make($request->validated('password')),
        ]);

        return back()->with('success', "Password for {$user->name} has been reset.");
    }

    public function destroy(User $user): RedirectResponse
    {
        if ($user->id === auth()->id()) {
            return back()->withErrors(['user' => 'You cannot delete your own account.']);
        }

        if ($user->isAdmin()) {
            // Lock the users table row to prevent concurrent deletions racing past this guard.
            $deleted = DB::transaction(function () use ($user) {
                $adminCount = User::where('role', UserRole::Admin)->lockForUpdate()->count();

                if ($adminCount <= 1) {
                    return false;
                }

                $user->delete();

                return true;
            });

            if (! $deleted) {
                return back()->withErrors(['user' => 'Cannot delete the last admin account.']);
            }
        } else {
            $user->delete();
        }

        return back()->with('success', 'User deleted successfully.');
    }
}
