<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Geofence extends Model
{
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

    public function deviceStates(): HasMany
    {
        return $this->hasMany(GeofenceDeviceState::class);
    }
}
