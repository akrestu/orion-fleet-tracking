<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditLog extends Model
{
    use MassPrunable;

    public $timestamps = false;

    /**
     * Records older than the configured retention window are removed by `model:prune`.
     * A retention of 0 days disables pruning.
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        $retentionDays = (int) config('app.audit_log_retention_days');

        if ($retentionDays <= 0) {
            return static::query()->whereRaw('1 = 0');
        }

        return static::query()->where('created_at', '<', now()->subDays($retentionDays));
    }

    protected $fillable = ['user_id', 'event', 'description', 'ip_address', 'user_agent', 'properties'];

    protected $casts = [
        'properties' => 'array',
        'created_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
