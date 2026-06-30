<?php

namespace App\Jobs;

use App\Models\GpsLog;
use App\Services\GeofenceService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class CheckGeofences implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $backoff = 5;

    public function __construct(public readonly GpsLog $gpsLog) {}

    public function handle(GeofenceService $geofenceService): void
    {
        $geofenceService->check($this->gpsLog);
    }
}
