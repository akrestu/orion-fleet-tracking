<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Device extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'device_group_id',
        'dev_eui',
        'join_eui',
        'application_id',
        'device_name',
        'unit_type',
        'unit_model',
        'is_active',
        'operational_status',
        'last_seen_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function deviceGroup(): BelongsTo
    {
        return $this->belongsTo(DeviceGroup::class);
    }

    public function gpsLogs(): HasMany
    {
        return $this->hasMany(GpsLog::class, 'dev_eui', 'dev_eui');
    }

    public function alerts(): HasMany
    {
        return $this->hasMany(Alert::class, 'dev_eui', 'dev_eui');
    }

    /** 'online' jika last_seen_at dalam 10 menit terakhir, else 'offline' */
    public function getStatusAttribute(): string
    {
        if ($this->last_seen_at === null) {
            return 'offline';
        }

        return $this->last_seen_at->gt(now()->subMinutes(10)) ? 'online' : 'offline';
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /** Eager-load each device's most recent GPS log without an N+1 query. */
    public function scopeWithLatestGpsLog(Builder $query): Builder
    {
        $latestLogIds = GpsLog::selectRaw('MAX(id) as id')->groupBy('dev_eui');

        return $query->with(['gpsLogs' => function ($query) use ($latestLogIds) {
            $query->whereIn('id', $latestLogIds)->orderByDesc('recorded_at');
        }]);
    }
}
