import L from 'leaflet';
import { UNIT_CATEGORIES } from '@/config/unit-types';
import type { UnitCategory } from '@/config/unit-types';

const BADGE_SIZE = 30;
const CONE_LENGTH = 11;

/**
 * Single vector marker shape shared by every unit type: a static circular
 * badge (never rotated, so the abbreviation stays legible) with a heading
 * cone that rotates independently around it. Replaces the previous mix of
 * photographic PNG sprites (4 types) and hand-drawn SVG silhouettes (the
 * other 4), which read as two different art styles on the live map.
 */
function buildBadgeSvg(color: string, abbr: string): string {
    const r = BADGE_SIZE / 2 - 2;
    const cx = BADGE_SIZE / 2;
    const cy = BADGE_SIZE / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BADGE_SIZE} ${BADGE_SIZE}" width="${BADGE_SIZE}" height="${BADGE_SIZE}">
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="white" stroke-width="2"/>
  <text x="${cx}" y="${cy + 3.5}" font-size="10" font-weight="700" text-anchor="middle" fill="white" font-family="sans-serif">${abbr}</text>
</svg>`;
}

function buildConeSvg(color: string): string {
    const w = 14;
    const h = CONE_LENGTH;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <polygon points="${w / 2},0 ${w},${h} 0,${h}" fill="${color}" opacity="0.85"/>
</svg>`;
}

export interface DeviceIconInput {
    unit_type: UnitCategory;
    status: 'online' | 'offline';
    heading_deg: number | null;
    device_name: string | null;
}

/** Builds the same vehicle marker divIcon (unified vector shape, colored by unit type, rotated heading cone) used across the fleet map and tracking replay. */
export function createDeviceIcon(device: DeviceIconInput): L.DivIcon {
    const cat = UNIT_CATEGORIES[device.unit_type] ?? UNIT_CATEGORIES.other;
    const { color } = cat;
    const isOnline = device.status === 'online';
    const hasHeading = device.heading_deg !== null;
    const heading = device.heading_deg ?? 0;
    const opacity = isOnline ? '1' : '0.55';
    const grayscale = isOnline ? '' : 'grayscale(0.85) ';
    const glow = isOnline
        ? `filter:drop-shadow(0 0 4px color-mix(in oklch, ${color} 80%, transparent));`
        : '';
    const label = device.device_name ?? cat.abbr;

    const labelBg = isOnline ? 'rgba(0,0,0,0.65)' : 'rgba(100,100,100,0.55)';
    const labelHtml = `
        <div style="
            margin-top:2px;
            background:${labelBg};
            color:#fff;
            font-size:10px;
            font-weight:700;
            font-family:sans-serif;
            padding:1px 5px;
            border-radius:4px;
            white-space:nowrap;
            pointer-events:none;
            letter-spacing:0.3px;
            display:flex;
            align-items:center;
            gap:3px;
        ">${isOnline ? '' : '<span style="opacity:0.75;">⏸</span>'}${label}</div>`;

    const coneHtml = hasHeading
        ? `<div style="position:absolute;top:${-CONE_LENGTH + 4}px;left:50%;transform:translateX(-50%) rotate(${heading}deg);transform-origin:50% ${BADGE_SIZE / 2 + CONE_LENGTH - 4}px;">${buildConeSvg(color)}</div>`
        : '';

    const iconW = BADGE_SIZE;
    const iconH = BADGE_SIZE + 16;

    const iconHtml = `
        <div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity};filter:${grayscale}">
            <div style="position:relative;${glow}">
                ${coneHtml}
                ${buildBadgeSvg(color, cat.abbr)}
            </div>
            ${labelHtml}
        </div>`;

    return L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [iconW, iconH],
        iconAnchor: [iconW / 2, iconH / 2],
    });
}
