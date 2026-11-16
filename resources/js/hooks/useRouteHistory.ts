import { useEffect, useRef, useState } from 'react';
import type { GpsLogPoint } from '@/types/fleet';

export type TimeRange = '1h' | '3h' | '6h' | '24h';

const TIME_RANGE_MINUTES: Record<TimeRange, number> = {
    '1h': 60,
    '3h': 180,
    '6h': 360,
    '24h': 1440,
};

type RouteResult = {
    key: string;
    points: GpsLogPoint[];
};

export function useRouteHistory(devEui: string | null, timeRange: TimeRange) {
    const [result, setResult] = useState<RouteResult | null>(null);
    const abortRef = useRef<AbortController | null>(null);
    const requestKey = devEui ? `${devEui}:${timeRange}` : null;

    useEffect(() => {
        if (!devEui || !requestKey) {
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const from = new Date(Date.now() - TIME_RANGE_MINUTES[timeRange] * 60 * 1000).toISOString();
        const url = `/api/fleet/devices/${encodeURIComponent(devEui)}/history?from=${encodeURIComponent(from)}&limit=5000`;

        fetch(url, { signal: controller.signal, credentials: 'same-origin' })
            .then((r) => r.json())
            .then((json) => {
                const data: GpsLogPoint[] = (json.data ?? json) as GpsLogPoint[];
                // sort ascending so polyline draws oldest → newest
                setResult({
                    key: requestKey,
                    points: data.slice().sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)),
                });
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    // network error — settle with an empty route so loading ends
                    setResult({ key: requestKey, points: [] });
                }
            });

        return () => controller.abort();
    }, [devEui, timeRange, requestKey]);

    // Loading and points are derived from the last settled request, avoiding synchronous setState in the effect.
    const isCurrent = requestKey !== null && result?.key === requestKey;

    return {
        points: isCurrent ? result.points : [],
        loading: requestKey !== null && !isCurrent,
    };
}
