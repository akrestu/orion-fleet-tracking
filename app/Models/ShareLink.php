<?php

namespace App\Models;

use Database\Factories\ShareLinkFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

/**
 * A read-only public link to the live fleet map (no login), e.g. for a control-room TV.
 * The token is stored encrypted (so admins can copy the link again) plus a SHA-256 hash for lookup.
 */
class ShareLink extends Model
{
    /** @use HasFactory<ShareLinkFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'token_hash',
        'token',
        'expires_at',
        'last_accessed_at',
        'created_by',
    ];

    protected $hidden = ['token', 'token_hash'];

    protected function casts(): array
    {
        return [
            'token' => 'encrypted',
            'expires_at' => 'datetime',
            'last_accessed_at' => 'datetime',
        ];
    }

    public static function generateToken(): string
    {
        return Str::random(40);
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    /**
     * Resolve a usable (not expired) link from a plaintext token.
     */
    public static function findUsable(string $token): ?self
    {
        return static::query()
            ->where('token_hash', static::hashToken($token))
            ->usable()
            ->first();
    }

    /**
     * @param  Builder<ShareLink>  $query
     * @return Builder<ShareLink>
     */
    public function scopeUsable(Builder $query): Builder
    {
        return $query->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
