import type L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { UnitPopupContent } from '@/components/Fleet/map-overlays';
import { unitMarkerIcon } from '@/components/orion/map-marker';
import type { MarkerStatus } from '@/components/orion/map-marker';
import { useAnimatedMarkerPosition } from '@/hooks/use-animated-marker';
import { useAppearance } from '@/hooks/use-appearance';
import { toUnitType } from '@/lib/orion/unit-types';
import type { DevicePosition } from '@/types/fleet';

interface DeviceMarkerProps {
    device: DevicePosition;
    isSelected: boolean;
    canOpenDetails?: boolean;
    /** Shared live map: popup hides EUI, radio and gateway details. */
    publicView?: boolean;
    onSelect?: (devEui: string) => void;
}

const PULSE_CLASS = 'orion-marker-pulse';

function prefersReducedMotion(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
}

export function DeviceMarker({
    device,
    isSelected,
    canOpenDetails = false,
    publicView = false,
    onSelect,
}: DeviceMarkerProps) {
    const map = useMap();
    const markerRef = useRef<L.Marker>(null);
    const { resolvedAppearance } = useAppearance();
    const status: MarkerStatus = device.has_alert ? 'alert' : device.status;

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

    // 200 ms glide per spec; reduced-motion users get an instant jump.
    useAnimatedMarkerPosition(
        markerRef,
        [device.latitude, device.longitude],
        prefersReducedMotion() ? 1 : 200,
    );

    // Pulse ring on every new fix (CSS disables it under prefers-reduced-motion).
    const firstFix = useRef(device.recorded_at);
    useEffect(() => {
        const el = markerRef.current?.getElement();

        if (!el || device.recorded_at === firstFix.current) {
            return;
        }

        el.classList.remove(PULSE_CLASS);
        void el.offsetWidth; // restart the animation
        el.classList.add(PULSE_CLASS);
        const timer = window.setTimeout(
            () => el.classList.remove(PULSE_CLASS),
            1100,
        );

        return () => window.clearTimeout(timer);
    }, [device.recorded_at]);

    // Fly to the unit and open its popup only when it becomes selected, not on every
    // live update — otherwise a moving, selected unit would keep interrupting flyTo.
    useEffect(() => {
        if (isSelected) {
            map.flyTo(positionRef.current, map.getZoom(), { duration: 0.75 });
            markerRef.current?.openPopup();
        }
    }, [isSelected, map]);

    const icon = useMemo(
        () =>
            unitMarkerIcon({
                type: toUnitType(device.unit_type),
                status,
                heading: device.heading_deg,
                selected: isSelected,
                dark: resolvedAppearance === 'dark',
            }),
        [
            status,
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
            title={`${device.device_name} · ${status}`}
            keyboard
            eventHandlers={{
                click: () => {
                    if (!isSelected) {
                        onSelect?.(device.dev_eui);
                    }
                },
            }}
        >
            <Popup className="orion-popup" closeButton={false} minWidth={280}>
                <UnitPopupContent
                    device={device}
                    canOpenDetails={canOpenDetails}
                    publicView={publicView}
                />
            </Popup>
        </Marker>
    );
}
