<?php

namespace App\Models;

use App\Enums\AlertType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Alert extends Model
{
    use HasFactory;

    protected $fillable = [
        'dev_eui',
        'alert_type',
        'triggered_at',
        'resolved_at',
        'meta',
    ];

    protected $casts = [
        'alert_type' => AlertType::class,
        'triggered_at' => 'datetime',
        'resolved_at' => 'datetime',
        'meta' => 'array',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'dev_eui', 'dev_eui');
    }

    public function scopeUnresolved(Builder $query): Builder
    {
        return $query->whereNull('resolved_at');
    }
}
