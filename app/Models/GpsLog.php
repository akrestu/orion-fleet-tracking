<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GpsLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'dev_eui',
        'latitude',
        'longitude',
        'speed_kmh',
        'heading_deg',
        'hdop',
        'satellites',
        'rssi',
        'snr',
        'gateway_id',
        'raw_payload',
        'recorded_at',
        'created_at',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'speed_kmh' => 'float',
        'heading_deg' => 'float',
        'hdop' => 'float',
        'rssi' => 'integer',
        'snr' => 'float',
        'satellites' => 'integer',
        'raw_payload' => 'array',
        'recorded_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function device(): BelongsTo
    {
        return $this->belongsTo(Device::class, 'dev_eui', 'dev_eui');
    }

    public function scopeRecent(Builder $query, int $minutes = 60): Builder
    {
        return $query->where('recorded_at', '>=', now()->subMinutes($minutes));
    }

    public function scopeForDevice(Builder $query, string $devEui): Builder
    {
        return $query->where('dev_eui', $devEui);
    }
}
