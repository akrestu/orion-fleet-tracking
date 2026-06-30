import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { UNIT_CATEGORIES } from '@/config/unit-types';
import type { UnitCategory } from '@/config/unit-types';
import type { DevicePosition } from '@/types/fleet';

const PNG_ICONS: Partial<Record<UnitCategory, string>> = {
    oht: '/icons/OHT.png',
    dt: '/icons/DT.png',
    dozer: '/icons/Dozzer.png',
    excavator: '/icons/Excavator.png',
};

const PNG_SIZE = 36;

function buildVehicleSvg(
    type: UnitCategory,
    c: string,
    d: string,
): { svg: string; w: number; h: number } {
    switch (type) {
        case 'grader':
            return {
                w: 22,
                h: 16,
                svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 16" width="22" height="16">
  <rect x="7" y="0" width="8" height="6" rx="1" fill="${c}"/>
  <rect x="8" y="0.5" width="6" height="4" rx="0.5" fill="rgba(255,255,255,0.3)"/>
  <rect x="9" y="6" width="4" height="7" rx="0.5" fill="${c}" opacity="0.6"/>
  <rect x="2" y="8" width="18" height="2.5" rx="0.5" fill="${d}" transform="rotate(-3 11 9)"/>
  <rect x="2" y="11" width="18" height="4" rx="1" fill="${c}"/>
  <rect x="9" y="0" width="2" height="2" rx="0.5" fill="${d}"/>
  <rect x="11" y="0" width="2" height="2" rx="0.5" fill="${d}"/>
  <rect x="0" y="11" width="2" height="4" rx="0.5" fill="${d}"/>
  <rect x="3" y="11" width="2" height="4" rx="0.5" fill="${d}"/>
  <rect x="17" y="11" width="2" height="4" rx="0.5" fill="${d}"/>
  <rect x="20" y="11" width="2" height="4" rx="0.5" fill="${d}"/>
</svg>`,
            };

        case 'compactor':
            return {
                w: 14,
                h: 20,
                svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 20" width="14" height="20">
  <ellipse cx="7" cy="5" rx="6" ry="5" fill="${d}"/>
  <ellipse cx="7" cy="5" rx="4" ry="3" fill="${c}" opacity="0.5"/>
  <rect x="3" y="9" width="8" height="9" rx="1" fill="${c}"/>
  <rect x="4" y="10" width="6" height="4" rx="0.5" fill="rgba(255,255,255,0.3)"/>
  <rect x="0" y="13" width="2.5" height="4" rx="0.5" fill="${d}"/>
  <rect x="11.5" y="13" width="2.5" height="4" rx="0.5" fill="${d}"/>
</svg>`,
            };

        case 'driller':
            return {
                w: 14,
                h: 22,
                svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 14 22" width="14" height="22">
  <rect x="5.5" y="0" width="3" height="11" rx="0.5" fill="${d}"/>
  <rect x="4.5" y="1" width="5" height="2" rx="0.5" fill="${c}" opacity="0.6"/>
  <rect x="4.5" y="5" width="5" height="2" rx="0.5" fill="${c}" opacity="0.6"/>
  <rect x="3.5" y="10" width="7" height="10" rx="1" fill="${c}"/>
  <rect x="4.5" y="11" width="5" height="4" rx="0.5" fill="rgba(255,255,255,0.3)"/>
  <rect x="0" y="11" width="3" height="9" rx="1" fill="${d}"/>
  <rect x="11" y="11" width="3" height="9" rx="1" fill="${d}"/>
</svg>`,
            };

        default:
            return {
                w: 12,
                h: 12,
                svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 12" width="12" height="12">
  <circle cx="6" cy="6" r="5" fill="${c}" stroke="${d}" stroke-width="1.5"/>
  <circle cx="6" cy="6" r="2" fill="${d}" opacity="0.6"/>
</svg>`,
            };
    }
}

function createDeviceIcon(device: DevicePosition): L.DivIcon {
    const cat = UNIT_CATEGORIES[device.unit_type] ?? UNIT_CATEGORIES.other;
    const { color, dark } = cat;
    const isOnline = device.status === 'online';
    const heading = device.heading_deg ?? 0;
    const pngSrc = PNG_ICONS[device.unit_type];
    const opacity = isOnline ? '1' : '0.65';
    const label = device.device_name ?? cat.abbr;

    let iconHtml: string;
    let iconW: number;
    let iconH: number;

    if (pngSrc) {
        const glow = isOnline ? `filter:drop-shadow(0 0 4px ${color}99);` : '';
        // Flip horizontally when heading points left (west side: 180°–360°)
        const flipX =
            heading > 180 && heading <= 360 ? 'scaleX(-1)' : 'scaleX(1)';
        iconW = PNG_SIZE;
        iconH = PNG_SIZE + 16;
        iconHtml = `
            <div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity};">
                <div style="${glow};transform:${flipX};">
                    <img src="${pngSrc}" style="display:block;width:${PNG_SIZE}px!important;height:${PNG_SIZE}px!important;max-width:${PNG_SIZE}px!important;min-width:${PNG_SIZE}px!important;"/>
                </div>
                <div style="
                    margin-top:2px;
                    background:rgba(0,0,0,0.65);
                    color:#fff;
                    font-size:10px;
                    font-weight:700;
                    font-family:sans-serif;
                    padding:1px 5px;
                    border-radius:4px;
                    white-space:nowrap;
                    pointer-events:none;
                    letter-spacing:0.3px;
                ">${label}</div>
            </div>`;
    } else {
        const { svg, w, h } = buildVehicleSvg(device.unit_type, color, dark);
        iconW = w;
        iconH = h + 16;
        const glow = isOnline ? `filter:drop-shadow(0 0 5px ${color}cc);` : '';
        iconHtml = `
            <div style="display:flex;flex-direction:column;align-items:center;opacity:${opacity};">
                <div style="transform:rotate(${heading}deg);transform-origin:${w / 2}px ${h / 2}px;display:inline-block;${glow}">${svg}</div>
                <div style="
                    margin-top:2px;
                    background:rgba(0,0,0,0.65);
                    color:#fff;
                    font-size:10px;
                    font-weight:700;
                    font-family:sans-serif;
                    padding:1px 5px;
                    border-radius:4px;
                    white-space:nowrap;
                    pointer-events:none;
                    letter-spacing:0.3px;
                ">${label}</div>
            </div>`;
    }

    return L.divIcon({
        html: iconHtml,
        className: '',
        iconSize: [iconW, iconH],
        iconAnchor: [iconW / 2, iconH / 2],
    });
}

interface DeviceMarkerProps {
    device: DevicePosition;
    isSelected: boolean;
}

export function DeviceMarker({ device, isSelected }: DeviceMarkerProps) {
    const map = useMap();
    const markerRef = useRef<L.Marker>(null);
    const cat = UNIT_CATEGORIES[device.unit_type] ?? UNIT_CATEGORIES.other;

    useEffect(() => {
        if (isSelected) {
            map.panTo([device.latitude, device.longitude], { animate: true });
        }
    }, [isSelected, device.latitude, device.longitude, map]);

    return (
        <Marker
            ref={markerRef}
            position={[device.latitude, device.longitude]}
            icon={createDeviceIcon(device)}
        >
            <Popup>
                <div className="min-w-[160px] text-sm">
                    <p className="font-semibold">{device.device_name}</p>
                    {device.unit_model && (
                        <p className="text-xs text-slate-500">
                            {device.unit_model}
                        </p>
                    )}
                    <p className="mt-0.5 font-mono text-xs text-slate-400">
                        {device.dev_eui}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <span
                            className="inline-block rounded px-1.5 py-0.5 text-xs font-bold text-white"
                            style={{ background: cat.color }}
                        >
                            {cat.abbr}
                        </span>
                        <span className="text-xs text-slate-600">
                            {cat.label.split('–')[0].trim()}
                        </span>
                    </div>
                    <p className="mt-1 text-xs">
                        {device.speed_kmh.toFixed(1)} km/h
                        {device.heading_deg !== null
                            ? ` · ${device.heading_deg}°`
                            : ''}
                    </p>
                    {(device.rssi !== null || device.snr !== null) && (
                        <p className="text-xs text-slate-400">
                            {device.rssi !== null && `RSSI: ${device.rssi} dBm`}
                            {device.rssi !== null &&
                                device.snr !== null &&
                                ' · '}
                            {device.snr !== null &&
                                `SNR: ${device.snr.toFixed(1)} dB`}
                        </p>
                    )}
                    {device.hdop !== null && (
                        <p className="text-xs text-slate-400">
                            HDOP: {device.hdop.toFixed(1)}
                        </p>
                    )}
                </div>
            </Popup>
        </Marker>
    );
}
