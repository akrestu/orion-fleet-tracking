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
        'entered_at',
        'checked_at',
    ];

    protected $casts = [
        'is_inside' => 'boolean',
        'entered_at' => 'datetime',
        'checked_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<Geofence, $this>
     */
    public function geofence(): BelongsTo
    {
        return $this->belongsTo(Geofence::class);
    }
}
