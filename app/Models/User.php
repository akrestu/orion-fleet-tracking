<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property UserRole $role
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'role'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
            'role' => UserRole::class,
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === UserRole::Admin;
    }

    public function isOperator(): bool
    {
        return $this->role === UserRole::Operator;
    }

    public function isViewer(): bool
    {
        return $this->role === UserRole::Viewer;
    }

    public function canManage(): bool
    {
        return $this->role->canManage();
    }

    public function canOperate(): bool
    {
        return $this->role->canOperate();
    }

    public function deviceGroups(): BelongsToMany
    {
        return $this->belongsToMany(DeviceGroup::class);
    }

    /**
     * Returns device_group_ids this user can access, or null if unrestricted.
     * Null means "see everything". Non-null means "only these groups".
     * Operators with no group assignments are unrestricted (see all).
     * Result is cached per request via once() to avoid repeated DB hits.
     *
     * @return int[]|null
     */
    public function accessibleGroupIds(): ?array
    {
        return once(function () {
            if ($this->isAdmin()) {
                return null;
            }

            $ids = $this->deviceGroups()->pluck('device_groups.id')->all();

            return empty($ids) ? null : $ids;
        });
    }
}
