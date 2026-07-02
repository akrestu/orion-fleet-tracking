import L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

/** Above this distance a position update is treated as a teleport (reconnect, first fix, large replay gap) and snapped instead of animated. */
const SNAP_DISTANCE_METERS = 2000;

/** Any point-based Leaflet layer that can report and receive a `LatLng` — satisfied structurally by both `L.Marker` and `L.CircleMarker`. */
interface PositionedLayer {
    getLatLng(): L.LatLng;
    setLatLng(latlng: L.LatLngExpression): unknown;
}

function easeOutCubic(t: number): number {
    return 1 - (1 - t) ** 3;
}

/** Glides a Leaflet marker/circle-marker from its current position to `target` instead of jumping, driven by imperative `setLatLng` calls. */
export function useAnimatedMarkerPosition<T extends PositionedLayer>(
    markerRef: RefObject<T | null>,
    target: [number, number],
    durationMs = 1200,
) {
    const frameRef = useRef<number | null>(null);
    const hasPositionedRef = useRef(false);

    useEffect(() => {
        const marker = markerRef.current;

        if (!marker) {
            return;
        }

        if (frameRef.current !== null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
        }

        const targetLatLng = L.latLng(target[0], target[1]);

        if (!hasPositionedRef.current) {
            marker.setLatLng(targetLatLng);
            hasPositionedRef.current = true;

            return;
        }

        const start = marker.getLatLng();
        const distanceMeters = start.distanceTo(targetLatLng);

        if (distanceMeters === 0) {
            return;
        }

        if (distanceMeters > SNAP_DISTANCE_METERS) {
            marker.setLatLng(targetLatLng);

            return;
        }

        const startLat = start.lat;
        const startLng = start.lng;
        const deltaLat = targetLatLng.lat - startLat;
        const deltaLng = targetLatLng.lng - startLng;
        const startTime = performance.now();

        const step = (now: number) => {
            const elapsed = now - startTime;
            const t = Math.min(1, elapsed / durationMs);
            const eased = easeOutCubic(t);

            marker.setLatLng([
                startLat + deltaLat * eased,
                startLng + deltaLng * eased,
            ]);

            if (t < 1) {
                frameRef.current = requestAnimationFrame(step);
            } else {
                frameRef.current = null;
            }
        };

        frameRef.current = requestAnimationFrame(step);

        return () => {
            if (frameRef.current !== null) {
                cancelAnimationFrame(frameRef.current);
                frameRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [target[0], target[1], durationMs]);
}
