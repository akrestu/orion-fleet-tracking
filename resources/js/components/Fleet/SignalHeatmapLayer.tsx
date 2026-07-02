import 'leaflet.heat';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

type HeatPoint = [number, number, number]; // [lat, lng, intensity]

interface Props {
    timeRange: '24h' | '7d';
}

/** Canvas gradients can't resolve CSS custom properties, so read the computed
 * value from the document at paint time instead of hardcoding hex. */
function resolveToken(cssVarExpr: string): string {
    const varName = cssVarExpr.match(/--[\w-]+/)?.[0];

    if (!varName) {
        return cssVarExpr;
    }

    const value = getComputedStyle(document.documentElement)
        .getPropertyValue(varName)
        .trim();

    return value || cssVarExpr;
}

async function fetchCoverage(timeRange: '24h' | '7d'): Promise<HeatPoint[]> {
    const from =
        timeRange === '7d'
            ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await fetch(
        `/api/fleet/signal-coverage?from=${encodeURIComponent(from)}`,
        {
            credentials: 'same-origin',
        },
    );

    return res.json() as Promise<HeatPoint[]>;
}

function HeatmapRenderer({ timeRange }: Props) {
    const map = useMap();
    const layerRef = useRef<L.HeatLayer | null>(null);
    const [pointCount, setPointCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        fetchCoverage(timeRange).then((points) => {
            if (cancelled) {
                return;
            }

            setPointCount(points.length);

            if (layerRef.current) {
                layerRef.current.setLatLngs(points);
            } else {
                layerRef.current = L.heatLayer(points, {
                    radius: 25,
                    blur: 20,
                    maxZoom: 18,
                    max: 1.0,
                    gradient: {
                        0.0: resolveToken('var(--color-status-danger)'), // poor signal
                        0.4: resolveToken('var(--color-status-warning)'), // moderate
                        0.7: resolveToken('var(--color-status-online)'), // good signal
                        1.0: resolveToken('var(--color-primary)'), // excellent
                    },
                }).addTo(map);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [map, timeRange]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (layerRef.current) {
                map.removeLayer(layerRef.current);
                layerRef.current = null;
            }
        };
    }, [map]);

    return pointCount > 0 ? (
        <div className="absolute right-4 bottom-20 z-[999] rounded-lg border border-border bg-card/90 px-3 py-2 shadow-sm">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Signal Coverage
            </p>
            <p className="mt-0.5 text-xs text-foreground">
                {pointCount.toLocaleString()} titik RSSI
            </p>
            <div className="mt-1.5 flex items-center gap-1 text-xs">
                <span className="inline-block h-2 w-4 rounded-sm bg-status-danger" />{' '}
                Lemah
                <span className="ml-1 inline-block h-2 w-4 rounded-sm bg-status-warning" />{' '}
                Sedang
                <span className="ml-1 inline-block h-2 w-4 rounded-sm bg-status-online" />{' '}
                Baik
                <span className="ml-1 inline-block h-2 w-4 rounded-sm bg-primary" />{' '}
                Sangat Baik
            </div>
        </div>
    ) : null;
}

export function SignalHeatmapLayer({ timeRange }: Props) {
    return <HeatmapRenderer timeRange={timeRange} />;
}
