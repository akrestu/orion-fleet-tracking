import type L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { unitMarkerIcon } from '@/components/orion/map-marker';
import { UnitIcon } from '@/components/orion/unit-icon';
import { StatusBadge } from '@/components/ui/badge';
import { useAnimatedMarkerPosition } from '@/hooks/use-animated-marker';
import { useAppearance } from '@/hooks/use-appearance';
import { useTick } from '@/hooks/use-tick';
import { toUnitType, unitMeta } from '@/lib/orion/unit-types';
import { formatRelativeTime, isStale } from '@/lib/time';
import type { DevicePosition } from '@/types/fleet';

interface DeviceMarkerProps {
    device: DevicePosition;
    isSelected: boolean;
}

export function DeviceMarker({ device, isSelected }: DeviceMarkerProps) {
    const map = useMap();
    const markerRef = useRef<L.Marker>(null);
    const cat = unitMeta(device.unit_type);
    const { resolvedAppearance } = useAppearance();
    const isOnline = device.status === 'online';
    useTick();
    const lastUpdate = formatRelativeTime(device.recorded_at);
    const stale = isOnline && isStale(device.recorded_at);

    const positionRef = useRef<[number, number]>([
        device.latitude,
        device.longitude,
    ]);
    // Captured once — the Marker's initial `position` prop is never updated again after
    // mount, since all subsequent movement is driven imperatively by the animation hook.
    const [initialPosition] = useState<[number, number]>(() => [
        device.latitude,
        device.longitude,
    ]);

    useEffect(() => {
        positionRef.current = [device.latitude, device.longitude];
    });

    useAnimatedMarkerPosition(markerRef, [device.latitude, device.longitude]);

    // Fly to the unit only when it becomes selected, not on every live position update —
    // otherwise a moving, selected unit would keep interrupting its own flyTo animation.
    useEffect(() => {
        if (isSelected) {
            map.flyTo(positionRef.current, map.getZoom(), { duration: 0.75 });
        }
    }, [isSelected, map]);

    const icon = useMemo(
        () =>
            unitMarkerIcon({
                type: toUnitType(device.unit_type),
                status: device.status,
                heading: device.heading_deg,
                selected: isSelected,
                dark: resolvedAppearance === 'dark',
            }),
        [
            device.status,
            device.unit_type,
            device.heading_deg,
            isSelected,
            resolvedAppearance,
        ],
    );

    return (
        <Marker
            ref={markerRef}
            position={initialPosition}
            icon={icon}
            title={`${device.device_name} · ${device.status}`}
        >
            <Popup>
                <div className="min-w-[160px] text-sm">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">{device.device_name}</p>
                        <StatusBadge
                            status={isOnline ? 'online' : 'offline'}
                            className="shrink-0 text-[10px]"
                        />
                    </div>
                    {device.unit_model && (
                        <p className="text-xs text-muted-foreground">
                            {device.unit_model}
                        </p>
                    )}
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                        {device.dev_eui}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                        <UnitIcon type={cat.key} size={20} />
                        <span className="text-xs text-muted-foreground">
                            {cat.label}
                        </span>
                    </div>
                    <p className="mt-1 font-mono text-xs">
                        {device.speed_kmh.toFixed(1)} km/h
                        {device.heading_deg !== null
                            ? ` · ${device.heading_deg}°`
                            : ''}
                    </p>
                    {lastUpdate && (
                        <p
                            className={
                                stale
                                    ? 'mt-1 text-xs font-medium text-warning'
                                    : 'mt-1 text-xs text-muted-foreground'
                            }
                        >
                            {stale && '⚠ '}
                            Update terakhir: {lastUpdate}
                        </p>
                    )}
                    {(device.rssi !== null || device.snr !== null) && (
                        <p className="font-mono text-xs text-muted-foreground">
                            {device.rssi !== null && `RSSI: ${device.rssi} dBm`}
                            {device.rssi !== null &&
                                device.snr !== null &&
                                ' · '}
                            {device.snr !== null &&
                                `SNR: ${device.snr.toFixed(1)} dB`}
                        </p>
                    )}
                    {device.hdop !== null && (
                        <p className="font-mono text-xs text-muted-foreground">
                            HDOP: {device.hdop.toFixed(1)}
                        </p>
                    )}
                </div>
            </Popup>
        </Marker>
    );
}
