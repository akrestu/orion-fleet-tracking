<?php

namespace App\Enums;

enum AlertType: string
{
    case Overspeed = 'overspeed';
    case Geofence = 'geofence';
    case Offline = 'offline';
    case LowSignal = 'low_signal';

    public function label(): string
    {
        return match ($this) {
            AlertType::Overspeed => 'Overspeed',
            AlertType::Geofence => 'Geofence',
            AlertType::Offline => 'Offline',
            AlertType::LowSignal => 'Low Signal',
        };
    }

    /** Unit label for threshold value display */
    public function thresholdUnit(): ?string
    {
        return match ($this) {
            AlertType::Overspeed => 'km/h',
            AlertType::Offline => 'minutes',
            AlertType::LowSignal => 'dBm (RSSI)',
            AlertType::Geofence => null,
        };
    }

    /** Whether this alert type supports a numeric threshold */
    public function hasThreshold(): bool
    {
        return $this !== AlertType::Geofence;
    }
}
