import { CircleMarker, Polyline, Tooltip } from 'react-leaflet';
import { catmullRomSegment } from '@/lib/spline';
import { getSpeedColor } from '@/lib/status-colors';
import type { GpsLogPoint } from '@/types/fleet';

interface Props {
    points: GpsLogPoint[];
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
}

export function RouteHistoryLayer({ points }: Props) {
    if (points.length < 2) {
        return null;
    }

    // Build coloured segments between consecutive points, curved via Catmull-Rom
    // interpolation (using neighboring points as tangent control) so the route glides
    // through each pair instead of zig-zagging. Fewer sub-points for very large routes
    // to protect render performance.
    const numPoints = points.length > 1500 ? 4 : 8;
    const segments = points.slice(0, -1).map((pt, i) => {
        const p0: [number, number] =
            i === 0
                ? [pt.latitude, pt.longitude]
                : [points[i - 1].latitude, points[i - 1].longitude];
        const p1: [number, number] = [pt.latitude, pt.longitude];
        const p2: [number, number] = [
            points[i + 1].latitude,
            points[i + 1].longitude,
        ];
        const p3: [number, number] =
            i + 2 < points.length
                ? [points[i + 2].latitude, points[i + 2].longitude]
                : p2;

        return {
            positions: catmullRomSegment(p0, p1, p2, p3, numPoints),
            color: getSpeedColor(pt.speed_kmh),
        };
    });

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
                        pathOptions={{
                            color: getSpeedColor(pt.speed_kmh),
                            fillOpacity: 0.9,
                            weight: 1,
                        }}
                    >
                        <Tooltip>
                            <span className="text-xs">
                                {formatTime(pt.recorded_at)} —{' '}
                                {pt.speed_kmh.toFixed(1)} km/h
                            </span>
                        </Tooltip>
                    </CircleMarker>
                ))}
        </>
    );
}
