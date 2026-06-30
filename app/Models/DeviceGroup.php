<?php

namespace App\Models;

use Database\Factories\DeviceGroupFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DeviceGroup extends Model
{
    /** @use HasFactory<DeviceGroupFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'location',
        'description',
        'color',
    ];

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    /** @return array{online: int, offline: int, total: int} */
    public function deviceStats(): array
    {
        $devices = $this->devices()->get(['last_seen_at', 'is_active']);
        $online = $devices->filter(fn (Device $d) => $d->status === 'online')->count();

        return [
            'total' => $devices->count(),
            'online' => $online,
            'offline' => $devices->count() - $online,
        ];
    }
}
