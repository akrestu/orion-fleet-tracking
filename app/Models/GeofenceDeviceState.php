<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GeofenceDeviceState extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'geofence_id',
        'dev_eui',
        'is_inside',
        'checked_at',
    ];

    protected $casts = [
        'is_inside' => 'boolean',
        'checked_at' => 'datetime',
    ];

    public function geofence(): BelongsTo
    {
        return $this->belongsTo(Geofence::class);
    }
}
