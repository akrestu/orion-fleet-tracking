<?php

namespace App\Services;

use App\Models\GpsLog;
use App\Support\GeoHelper;
use Carbon\CarbonInterface;

class FleetUtilizationService
{
    private const IDLE_THRESHOLD_KMH = 2.0;

    private const MAX_GAP_SECONDS = 300;

    /**
     * Compute utilization stats for one device over a date range by streaming
     * its GPS logs (no full in-memory load).
     *
     * @return array{log_count: int, operation_hours: float, running_hours: float, idle_hours: float, distance_km: float, avg_speed_kmh: float, max_speed_kmh: float}|null
     *         Null when the device has no logs in range.
     */
    public function computeForDevice(string $devEui, CarbonInterface $from, CarbonInterface $to): ?array
    {
        $totalDistance = 0.0;
        $operationSeconds = 0;
        $runningSeconds = 0;
        $idleSeconds = 0;
        $logCount = 0;
        $maxSpeed = 0.0;
        $speedSum = 0.0;
        $prev = null;

        GpsLog::where('dev_eui', $devEui)
            ->whereBetween('recorded_at', [$from, $to->copy()->endOfDay()])
            ->orderBy('recorded_at')
            ->select(['dev_eui', 'latitude', 'longitude', 'speed_kmh', 'recorded_at'])
            ->lazy()
            ->each(function ($curr) use (&$prev, &$totalDistance, &$operationSeconds, &$runningSeconds, &$idleSeconds, &$logCount, &$maxSpeed, &$speedSum) {
                $logCount++;
                $speed = (float) $curr->speed_kmh;
                $speedSum += $speed;
                if ($speed > $maxSpeed) {
                    $maxSpeed = $speed;
                }

                if ($prev !== null) {
                    $gap = abs($curr->recorded_at->diffInSeconds($prev->recorded_at));
                    if ($gap <= self::MAX_GAP_SECONDS) {
                        $operationSeconds += $gap;
                        $totalDistance += GeoHelper::haversineKm(
                            (float) $prev->latitude,
                            (float) $prev->longitude,
                            (float) $curr->latitude,
                            (float) $curr->longitude,
                        );
                        if ((float) $prev->speed_kmh >= self::IDLE_THRESHOLD_KMH) {
                            $runningSeconds += $gap;
                        } else {
                            $idleSeconds += $gap;
                        }
                    }
                }

                $prev = $curr;
            });

        if ($logCount === 0) {
            return null;
        }

        return [
            'log_count' => $logCount,
            'operation_hours' => round($operationSeconds / 3600, 2),
            'running_hours' => round($runningSeconds / 3600, 2),
            'idle_hours' => round($idleSeconds / 3600, 2),
            'distance_km' => round($totalDistance, 2),
            'avg_speed_kmh' => round($speedSum / $logCount, 1),
            'max_speed_kmh' => round($maxSpeed, 1),
        ];
    }
}
