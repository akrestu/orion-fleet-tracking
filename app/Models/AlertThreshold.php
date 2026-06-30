<?php

namespace App\Models;

use App\Enums\AlertType;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AlertThreshold extends Model
{
    use HasFactory;

    protected $fillable = [
        'alert_type',
        'dev_eui',
        'unit_type',
        'threshold_value',
        'is_active',
    ];

    protected $casts = [
        'alert_type' => AlertType::class,
        'threshold_value' => 'float',
        'is_active' => 'boolean',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'dev_eui', 'dev_eui');
    }

    /** 'device' | 'unit_type' | 'global' */
    public function getScopeAttribute(): string
    {
        if ($this->dev_eui !== null) {
            return 'device';
        }

        if ($this->unit_type !== null) {
            return 'unit_type';
        }

        return 'global';
    }
}
