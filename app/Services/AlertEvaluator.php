<?php

namespace App\Services;

use App\Enums\AlertType;
use App\Models\Alert;
use App\Models\AlertThreshold;
use App\Models\Device;
use App\Models\GpsLog;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * Turns Alert Threshold rules into alerts.
 *
 * - Overspeed and low signal are checked on every new uplink.
 * - Offline is checked by the scheduled `alerts:check-offline` command.
 * - A device has at most one unresolved alert per type; a new breach while one is
 *   still open is not duplicated. Offline alerts resolve themselves on the next uplink.
 * - The effective rule is the most specific active one: device › unit type › global.
 */
class AlertEvaluator
{
    /** Cache key for the active rule set; cleared whenever a rule changes. */
    public const CACHE_KEY = 'alert-thresholds.active';

    private const CACHE_TTL_SECONDS = 300;

    /**
     * Effective threshold for a device and alert type, or null when no active rule applies.
     * Low-signal limits are always returned as negative dBm (RSSI), even if stored positive.
     */
    public function thresholdFor(Device $device, AlertType $type): ?float
    {
        $rules = $this->activeRules()->where('alert_type', $type);

        $rule = $rules->firstWhere('dev_eui', $device->dev_eui)
            ?? $rules->first(fn (AlertThreshold $r) => $r->dev_eui === null && $r->unit_type === $device->unit_type)
            ?? $rules->first(fn (AlertThreshold $r) => $r->dev_eui === null && $r->unit_type === null);

        if ($rule === null) {
            return null;
        }

        return $type === AlertType::LowSignal
            ? -abs($rule->threshold_value)
            : $rule->threshold_value;
    }

    /** Checks a freshly ingested uplink for overspeed and low signal; clears an open offline alert. */
    public function evaluateUplink(GpsLog $log, Device $device): void
    {
        $this->resolveOpen($device, AlertType::Offline);

        $speedLimit = $this->thresholdFor($device, AlertType::Overspeed);
        $speed = (float) $log->speed_kmh;

        if ($speedLimit !== null && $speed > $speedLimit) {
            $this->raise($device, AlertType::Overspeed, [
                'speed_kmh' => round($speed, 1),
                'threshold' => $speedLimit,
                'latitude' => (float) $log->latitude,
                'longitude' => (float) $log->longitude,
            ]);
        }

        $rssiLimit = $this->thresholdFor($device, AlertType::LowSignal);

        if ($rssiLimit !== null && $log->rssi !== null && $log->rssi < $rssiLimit) {
            $this->raise($device, AlertType::LowSignal, [
                'rssi' => $log->rssi,
                'threshold' => $rssiLimit,
                'gateway_id' => $log->gateway_id,
            ]);
        }
    }

    /**
     * Raises offline alerts for active devices silent longer than their threshold (minutes).
     *
     * @return int Number of new offline alerts.
     */
    public function evaluateOffline(): int
    {
        if ($this->activeRules()->where('alert_type', AlertType::Offline)->isEmpty()) {
            return 0;
        }

        $raised = 0;

        Device::active()
            ->whereNotNull('last_seen_at')
            ->select(['id', 'dev_eui', 'unit_type', 'last_seen_at'])
            ->lazyById()
            ->each(function (Device $device) use (&$raised) {
                $limitMinutes = $this->thresholdFor($device, AlertType::Offline);

                if ($limitMinutes === null || $device->last_seen_at === null) {
                    return;
                }

                $silentMinutes = (int) $device->last_seen_at->diffInMinutes(now(), true);

                if ($silentMinutes > $limitMinutes && $this->raise($device, AlertType::Offline, [
                    'offline_minutes' => $silentMinutes,
                    'threshold' => $limitMinutes,
                    'last_seen_at' => $device->last_seen_at->toIso8601String(),
                ])) {
                    $raised++;
                }
            });

        return $raised;
    }

    /** Forgets the cached rule set (call after creating, editing or deleting a rule). */
    public static function flushRules(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    /**
     * @return Collection<int, AlertThreshold>
     */
    private function activeRules(): Collection
    {
        return Cache::remember(
            self::CACHE_KEY,
            self::CACHE_TTL_SECONDS,
            fn () => AlertThreshold::query()->where('is_active', true)->get(),
        );
    }

    /**
     * Creates an alert unless the device already has an unresolved one of this type.
     *
     * @param  array<string, mixed>  $meta
     */
    private function raise(Device $device, AlertType $type, array $meta): bool
    {
        $alreadyOpen = Alert::query()
            ->where('dev_eui', $device->dev_eui)
            ->where('alert_type', $type)
            ->whereNull('resolved_at')
            ->exists();

        if ($alreadyOpen) {
            return false;
        }

        Alert::create([
            'dev_eui' => $device->dev_eui,
            'alert_type' => $type,
            'triggered_at' => now(),
            'meta' => $meta,
        ]);

        return true;
    }

    private function resolveOpen(Device $device, AlertType $type): void
    {
        Alert::query()
            ->where('dev_eui', $device->dev_eui)
            ->where('alert_type', $type)
            ->whereNull('resolved_at')
            ->update(['resolved_at' => now()]);
    }
}
