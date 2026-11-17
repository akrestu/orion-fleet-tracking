/**
 * Telemetry helpers shared by dashboard, map and reports.
 * Colours are returned as token `var()` strings so Recharts / inline styles
 * repaint automatically when the theme changes.
 */

export type SignalQuality = 'good' | 'fair' | 'poor';

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

const SIGNAL_COLOR_VAR: Record<SignalQuality, string> = {
    good: 'var(--online)',
    fair: 'var(--warning)',
    poor: 'var(--danger)',
};

export function signalColorVar(rssi: number): string {
    return SIGNAL_COLOR_VAR[signalQuality(rssi)];
}
