import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import type { GpsLogPoint } from '@/types/fleet';

interface Props {
    points: GpsLogPoint[];
}

function speedColor(speed: number): string {
    if (speed < 10) return '#22c55e';   // green — slow / idle
    if (speed < 30) return '#f59e0b';   // amber — moderate
    return '#ef4444';                    // red — fast
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function RouteHistoryLayer({ points }: Props) {
    if (points.length < 2) return null;

    // Build coloured segments between consecutive points
    const segments = points.slice(0, -1).map((pt, i) => ({
        positions: [
            [pt.latitude, pt.longitude],
            [points[i + 1].latitude, points[i + 1].longitude],
        ] as [number, number][],
        color: speedColor(pt.speed_kmh),
    }));

    return (
        <>
            {segments.map((seg, i) => (
                <Polyline
                    key={i}
                    positions={seg.positions}
                    pathOptions={{ color: seg.color, weight: 3, opacity: 0.8 }}
                />
            ))}

            {/* Point markers every ~5th point to avoid clutter */}
            {points
                .filter((_, i) => i % 5 === 0 || i === points.length - 1)
                .map((pt) => (
                    <CircleMarker
                        key={pt.id}
                        center={[pt.latitude, pt.longitude]}
                        radius={3}
                        pathOptions={{ color: speedColor(pt.speed_kmh), fillOpacity: 0.9, weight: 1 }}
                    >
                        <Tooltip>
                            <span className="text-xs">
                                {formatTime(pt.recorded_at)} — {pt.speed_kmh.toFixed(1)} km/h
                            </span>
                        </Tooltip>
                    </CircleMarker>
                ))}
        </>
    );
}
