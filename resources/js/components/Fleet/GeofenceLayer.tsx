import { Polygon, Tooltip } from 'react-leaflet';
import type { GeofenceZone } from '@/types/fleet';

interface Props {
    geofences: GeofenceZone[];
}

export function GeofenceLayer({ geofences }: Props) {
    return (
        <>
            {geofences.map((zone) => (
                <Polygon
                    key={zone.id}
                    positions={zone.polygon.map((p) => [p.lat, p.lng] as [number, number])}
                    pathOptions={{
                        color: zone.color,
                        fillColor: zone.color,
                        fillOpacity: 0.15,
                        weight: 2,
                        dashArray: '6 4',
                    }}
                >
                    <Tooltip sticky direction="top">
                        <span className="font-semibold">{zone.name}</span>
                    </Tooltip>
                </Polygon>
            ))}
        </>
    );
}
