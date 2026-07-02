/**
 * Single source of truth for status/severity/speed colors, all backed by the
 * `--status-*` CSS custom properties defined in resources/css/app.css. Using
 * `var()` strings (rather than resolved hex) means every consumer — Recharts
 * fills, Leaflet path/marker colors, inline styles — repaints automatically
 * on light/dark theme toggle without re-running any of this logic.
 */

export type SpeedBand = 'slow' | 'moderate' | 'fast';
export type SignalQuality = 'good' | 'fair' | 'poor';

/**
 * Device status — the canonical 4 states, identical everywhere they appear
 * (StatusBadge, map markers, table rows, alert cards):
 *   online  = telemetry reporting < 60s
 *   offline = no signal
 *   warning = threshold breach (speed/geofence/alert-thresholds)
 *   danger  = critical fault
 */
export type DeviceStatus = 'online' | 'offline' | 'warning' | 'danger';

export const STATUS_LABEL: Record<DeviceStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    warning: 'Warning',
    danger: 'Danger',
};

export const STATUS_ONLINE = 'var(--color-status-online)';
export const STATUS_OFFLINE = 'var(--color-status-offline)';
export const STATUS_WARNING = 'var(--color-status-warning)';
export const STATUS_DANGER = 'var(--color-status-danger)';

const SPEED_COLORS: Record<SpeedBand, string> = {
    slow: 'var(--color-speed-slow)',
    moderate: 'var(--color-speed-moderate)',
    fast: 'var(--color-speed-fast)',
};

const SIGNAL_COLORS: Record<SignalQuality, string> = {
    good: STATUS_ONLINE,
    fair: STATUS_WARNING,
    poor: STATUS_DANGER,
};

export function getStatusColor(online: boolean): string {
    return online ? STATUS_ONLINE : STATUS_OFFLINE;
}

/** Speed bands (km/h): <10 slow, 10-30 moderate, >=30 fast. */
export function speedBand(speedKmh: number): SpeedBand {
    if (speedKmh < 10) {
        return 'slow';
    }

    if (speedKmh < 30) {
        return 'moderate';
    }

    return 'fast';
}

export function getSpeedColor(speedKmh: number): string {
    return SPEED_COLORS[speedBand(speedKmh)];
}

/** LoRaWAN RSSI thresholds (dBm): >= -85 good, -95..-85 fair, < -95 poor. */
export function signalQuality(rssi: number): SignalQuality {
    if (rssi >= -85) {
        return 'good';
    }

    if (rssi >= -95) {
        return 'fair';
    }

    return 'poor';
}

export function getSignalColor(rssi: number): string {
    return SIGNAL_COLORS[signalQuality(rssi)];
}
