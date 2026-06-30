import 'leaflet.heat';

import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';

type HeatPoint = [number, number, number]; // [lat, lng, intensity]

interface Props {
    timeRange: '24h' | '7d';
}

async function fetchCoverage(timeRange: '24h' | '7d'): Promise<HeatPoint[]> {
    const from =
        timeRange === '7d'
            ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
            : new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const res = await fetch(`/api/fleet/signal-coverage?from=${encodeURIComponent(from)}`, {
        credentials: 'same-origin',
    });

    return res.json() as Promise<HeatPoint[]>;
}

function HeatmapRenderer({ timeRange }: Props) {
    const map = useMap();
    const layerRef = useRef<L.HeatLayer | null>(null);
    const [pointCount, setPointCount] = useState(0);

    useEffect(() => {
        let cancelled = false;

        fetchCoverage(timeRange).then((points) => {
            if (cancelled) return;

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
                        0.0: '#ef4444', // red — poor signal
                        0.4: '#f59e0b', // amber
                        0.7: '#22c55e', // green — good signal
                        1.0: '#3b82f6', // blue — excellent
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
        <div className="bg-card/90 border-border absolute bottom-20 right-4 z-[999] rounded-lg border px-3 py-2 shadow-sm">
            <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">Signal Coverage</p>
            <p className="text-foreground mt-0.5 text-xs">{pointCount.toLocaleString()} titik RSSI</p>
            <div className="mt-1.5 flex items-center gap-1 text-xs">
                <span className="inline-block h-2 w-4 rounded-sm bg-red-500" /> Lemah
                <span className="ml-1 inline-block h-2 w-4 rounded-sm bg-amber-500" /> Sedang
                <span className="ml-1 inline-block h-2 w-4 rounded-sm bg-green-500" /> Baik
                <span className="ml-1 inline-block h-2 w-4 rounded-sm bg-blue-500" /> Sangat Baik
            </div>
        </div>
    ) : null;
}

export function SignalHeatmapLayer({ timeRange }: Props) {
    return <HeatmapRenderer timeRange={timeRange} />;
}
