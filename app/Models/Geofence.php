<?php

namespace App\Models;

use Database\Factories\GeofenceFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Geofence extends Model
{
    /** @use HasFactory<GeofenceFactory> */
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'color',
        'polygon',
        'is_active',
        'zone_type',
    ];

    protected $casts = [
        'polygon' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * @return HasMany<GeofenceDeviceState, $this>
     */
    public function deviceStates(): HasMany
    {
        return $this->hasMany(GeofenceDeviceState::class);
    }
}
