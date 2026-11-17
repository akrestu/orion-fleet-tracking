import { Polygon, Tooltip } from 'react-leaflet';
import { ZONE_COLORS } from '@/components/orion/map-marker';
import type { GeofenceZone } from '@/types/fleet';

interface Props {
    geofences: GeofenceZone[];
}

/** Zone colour from its type (ORION palette); untyped zones keep their admin-picked colour. */
function zoneColor(zone: GeofenceZone): string {
    return zone.zone_type && zone.zone_type !== 'none'
        ? ZONE_COLORS[zone.zone_type]
        : zone.color;
}

export function GeofenceLayer({ geofences }: Props) {
    return (
        <>
            {geofences.map((zone) => {
                const color = zoneColor(zone);

                return (
                    <Polygon
                        key={zone.id}
                        positions={zone.polygon.map(
                            (p) => [p.lat, p.lng] as [number, number],
                        )}
                        pathOptions={{
                            color,
                            fillColor: color,
                            fillOpacity: 0.16,
                            weight: 1.5,
                            dashArray: '6 4',
                        }}
                    >
                        <Tooltip
                            permanent
                            direction="center"
                            className="orion-zone-label"
                        >
                            {zone.name}
                        </Tooltip>
                    </Polygon>
                );
            })}
        </>
    );
}
