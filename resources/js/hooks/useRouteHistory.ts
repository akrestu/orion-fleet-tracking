import { useEffect, useRef, useState } from 'react';
import type { GpsLogPoint } from '@/types/fleet';

export type TimeRange = '1h' | '3h' | '6h' | '24h';

const TIME_RANGE_MINUTES: Record<TimeRange, number> = {
    '1h': 60,
    '3h': 180,
    '6h': 360,
    '24h': 1440,
};

export function useRouteHistory(devEui: string | null, timeRange: TimeRange) {
    const [points, setPoints] = useState<GpsLogPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (!devEui) {
            setPoints([]);
            return;
        }

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);

        const from = new Date(Date.now() - TIME_RANGE_MINUTES[timeRange] * 60 * 1000).toISOString();
        const url = `/api/fleet/devices/${encodeURIComponent(devEui)}/history?from=${encodeURIComponent(from)}&limit=5000`;

        fetch(url, { signal: controller.signal, credentials: 'same-origin' })
            .then((r) => r.json())
            .then((json) => {
                const data: GpsLogPoint[] = (json.data ?? json) as GpsLogPoint[];
                // sort ascending so polyline draws oldest → newest
                setPoints(data.slice().sort((a, b) => a.recorded_at.localeCompare(b.recorded_at)));
            })
            .catch(() => {
                // aborted or network error — ignore
            })
            .finally(() => {
                setLoading(false);
            });

        return () => controller.abort();
    }, [devEui, timeRange]);

    return { points, loading };
}
