import L from 'leaflet';
import { UNIT_TYPES } from '@/lib/orion/unit-types';
import type { UnitType } from '@/lib/orion/unit-types';

export type MarkerStatus = 'online' | 'offline' | 'alert';

/**
 * ORION unit marker for Leaflet.
 *  - fill + white silhouette  = unit type
 *  - ring (solid / dashed)     = status (online / offline / alert)
 *  - small notch on the edge  = heading (icon itself stays upright)
 * Uses raw colours (not CSS vars) so markers render identically on satellite tiles.
 */
const RING: Record<MarkerStatus, string> = {
    online: 'oklch(0.6 0.15 150)',
    offline: 'oklch(0.62 0.01 250)',
    alert: 'oklch(0.56 0.2 27)',
};

export function unitMarkerIcon(opts: {
    type: UnitType;
    status: MarkerStatus;
    heading?: number | null;
    size?: number;
    selected?: boolean;
    dark?: boolean;
}) {
    const { type, status, heading, size = 40, selected, dark } = opts;
    const meta = UNIT_TYPES[type];
    const off = status === 'offline';
    const notch =
        heading == null || off
            ? ''
            : `<g transform="rotate(${Math.round(heading)} 22 22)"><path d="M22 0 L26 5 H18 Z" fill="${dark ? '#f5f5f5' : '#1f2329'}"/></g>`;
    const html = `
<svg width="${size}" height="${size}" viewBox="0 0 44 44" role="img" aria-label="${meta.label} ${status}" style="filter:drop-shadow(0 1px 2px rgb(0 0 0 / .35));overflow:visible">
  ${selected ? `<circle cx="22" cy="22" r="22" fill="none" stroke="${meta.color}" stroke-opacity=".35" stroke-width="4"/>` : ''}
  <circle cx="22" cy="22" r="18" fill="${meta.color}" fill-opacity="${off ? 0.5 : 1}" stroke="${RING[status]}" stroke-width="3" ${off ? 'stroke-dasharray="4 3"' : ''}/>
  ${notch}
  <g transform="translate(9 9) scale(0.81)"><path d="${meta.path}" fill="#fff"/></g>
</svg>`;

    return L.divIcon({
        html,
        className: 'orion-marker',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
}

/** Speed band → route polyline colour (single-hue ramp; fast is darker, never red). */
export function speedBandColor(kmh: number, dark = false) {
    if (kmh < 15) {
        return dark ? 'oklch(0.5 0.08 232)' : 'oklch(0.78 0.09 232)';
    }

    if (kmh <= 35) {
        return dark ? 'oklch(0.72 0.12 230)' : 'oklch(0.58 0.14 232)';
    }

    return dark ? 'oklch(0.88 0.08 225)' : 'oklch(0.38 0.12 242)';
}

/** Geofence zone colours by type. */
export const ZONE_COLORS = {
    loading: 'oklch(0.58 0.13 205)',
    dumping: 'oklch(0.52 0.22 295)',
    waiting: 'oklch(0.64 0.14 222)',
    parking: 'oklch(0.6 0.01 250)',
    general: 'oklch(0.58 0.22 340)',
} as const;
