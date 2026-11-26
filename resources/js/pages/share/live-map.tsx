import 'leaflet/dist/leaflet.css';

import { Head } from '@inertiajs/react';
import L from 'leaflet';
import { Map as MapIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Drawer as DrawerPrimitive } from 'vaul';

import { DeviceMarker } from '@/components/Fleet/DeviceMarker';
import { DeviceSidebarItem } from '@/components/Fleet/DeviceSidebarItem';
import { GeofenceLayer } from '@/components/Fleet/GeofenceLayer';
import {
    MAP_CARD,
    MapLegend,
    Segmented,
    ZoomControls,
} from '@/components/Fleet/map-overlays';
import type { Tileset } from '@/components/Fleet/MapTileUpload';
import { RouteHistoryLayer } from '@/components/Fleet/RouteHistoryLayer';
import { ConnectionBadge } from '@/components/orion/badges';
import type { ConnectionState } from '@/components/orion/badges';
import { EmptyState, LastSeen, OrionLockup } from '@/components/orion/misc';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import live from '@/routes/live';
import type {
    DevicePosition,
    DwellZone,
    GeofenceZone,
    GpsLogPoint,
} from '@/types/fleet';

/** [lat, lng, speed_kmh, recorded_at ISO] */
type TrailPoint = [number, number, number, string];

interface SharedUnit {
    id: string;
    device_name: string;
    unit_type: DevicePosition['unit_type'];
    unit_model: string | null;
    status: 'online' | 'offline';
    latitude: number;
    longitude: number;
    speed_kmh: number;
    heading_deg: number | null;
    recorded_at: string | null;
    zone: DwellZone | null;
}

interface Snapshot {
    positions: SharedUnit[];
    trails: Record<string, TrailPoint[]>;
    server_time: string;
}

interface Props {
    linkName: string;
    token: string;
    trailMinutes: number;
    tilesets: Tileset[];
    geofences: GeofenceZone[];
    snapshot: Snapshot;
}

const POLL_MS = 10_000;
const DEFAULT_CENTER: [number, number] = [-3.779223, 103.67939];
const SHEET_SNAPS: (string | number)[] = ['148px', 0.55, 0.92];
/** Above this a unit counts as moving (km/h). */
const MOVING_KMH = 5;

/** The shared view carries no EUI or radio data; adapt it to the Fleet Map shape. */
function toDevicePosition({ id, ...unit }: SharedUnit): DevicePosition {
    return {
        ...unit,
        dev_eui: id,
        hdop: null,
        rssi: null,
        snr: null,
    };
}

function hasFix(d: DevicePosition): boolean {
    return d.latitude !== 0 && d.longitude !== 0;
}

/** Appends new trail points and drops anything older than the trail window. */
function mergeTrails(
    prev: Record<string, TrailPoint[]>,
    incoming: Record<string, TrailPoint[]>,
    windowMinutes: number,
): Record<string, TrailPoint[]> {
    const cutoff = Date.now() - windowMinutes * 60_000;
    const next: Record<string, TrailPoint[]> = {};
    const ids = new Set([...Object.keys(prev), ...Object.keys(incoming)]);

    ids.forEach((id) => {
        const seen = new Set((prev[id] ?? []).map((p) => p[3]));
        const merged = [
            ...(prev[id] ?? []),
            ...(incoming[id] ?? []).filter((p) => !seen.has(p[3])),
        ].filter((p) => new Date(p[3]).getTime() >= cutoff);

        if (merged.length > 0) {
            next[id] = merged;
        }
    });

    return next;
}

function toTrailPoints(id: string, trail: TrailPoint[]): GpsLogPoint[] {
    return trail.map(([lat, lng, speed, at], i) => ({
        id: i,
        dev_eui: id,
        latitude: lat,
        longitude: lng,
        speed_kmh: speed,
        heading_deg: null,
        rssi: null,
        snr: null,
        recorded_at: at,
    }));
}

function FitBoundsOnLoad({ positions }: { positions: DevicePosition[] }) {
    const map = useMap();
    const hasFitted = useRef(false);

    useEffect(() => {
        const valid = positions.filter(hasFix);

        if (hasFitted.current || valid.length === 0) {
            return;
        }

        hasFitted.current = true;
        map.fitBounds(
            L.latLngBounds(valid.map((d) => [d.latitude, d.longitude])),
            { padding: [60, 60], maxZoom: 17 },
        );
    }, [positions, map]);

    return null;
}

/** Polls the share feed every 10 s; trails are fetched incrementally with `since`. */
function useSharedFeed(token: string, initial: Snapshot, trailMinutes: number) {
    const [units, setUnits] = useState<SharedUnit[]>(initial.positions);
    const [trails, setTrails] = useState(initial.trails);
    const [connection, setConnection] = useState<ConnectionState>('connected');
    const [revoked, setRevoked] = useState(false);
    const since = useRef(initial.server_time);

    const poll = useCallback(async () => {
        try {
            const res = await fetch(
                live.feed.url(token, { query: { since: since.current } }),
                { headers: { Accept: 'application/json' } },
            );

            if (res.status === 404) {
                setRevoked(true);

                return;
            }

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data: Snapshot = await res.json();
            since.current = data.server_time;
            setUnits(data.positions);
            setTrails((prev) => mergeTrails(prev, data.trails, trailMinutes));
            setConnection('connected');
        } catch {
            setConnection('reconnecting');
        }
    }, [token, trailMinutes]);

    useEffect(() => {
        if (revoked) {
            return;
        }

        const id = window.setInterval(poll, POLL_MS);

        return () => window.clearInterval(id);
    }, [poll, revoked]);

    return { units, trails, connection, revoked };
}

export default function SharedLiveMap({
    linkName,
    token,
    trailMinutes,
    tilesets,
    geofences,
    snapshot,
}: Props) {
    const { units, trails, connection, revoked } = useSharedFeed(
        token,
        snapshot,
        trailMinutes,
    );
    const isMobile = useIsMobile();
    const [map, setMap] = useState<L.Map | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [baseLayer, setBaseLayer] = useState('satellite');
    const [sheetSnap, setSheetSnap] = useState<string | number | null>(
        SHEET_SNAPS[0],
    );

    const devices = useMemo(() => units.map(toDevicePosition), [units]);
    const mapped = devices.filter(hasFix);
    const online = devices.filter((d) => d.status === 'online');
    const counts = {
        online: online.length,
        moving: online.filter((d) => d.speed_kmh > MOVING_KMH).length,
        loading: devices.filter((d) => d.zone?.type === 'loading').length,
        dumping: devices.filter((d) => d.zone?.type === 'dumping').length,
    };
    const latestFix = devices.reduce<string | null>(
        (latest, d) =>
            d.recorded_at && (!latest || d.recorded_at > latest)
                ? d.recorded_at
                : latest,
        null,
    );
    const activeTileset = tilesets.find((t) => `tileset-${t.id}` === baseLayer);

    const baseLayerOptions = [
        { value: 'satellite', label: 'Satelit' },
        { value: 'osm', label: 'OSM' },
        ...tilesets.map((t) => ({ value: `tileset-${t.id}`, label: t.name })),
    ];

    const handleSelect = (id: string) => {
        setSelectedId((prev) => (prev === id ? null : id));

        if (isMobile) {
            setSheetSnap(SHEET_SNAPS[0]);
        }
    };

    if (revoked) {
        return (
            <>
                <Head title="Live Map" />
                <main className="grid min-h-svh place-items-center bg-background p-4">
                    <EmptyState
                        icon={<MapIcon className="size-6" />}
                        title="Link tidak berlaku lagi"
                    >
                        Link live map ini sudah dicabut atau kedaluwarsa. Minta
                        link baru ke admin ORION.
                    </EmptyState>
                </main>
            </>
        );
    }

    const kpis = (
        <dl className="grid grid-cols-4 gap-2">
            {(
                [
                    ['Online', counts.online],
                    ['Bergerak', counts.moving],
                    ['Loading', counts.loading],
                    ['Dumping', counts.dumping],
                ] as const
            ).map(([label, value]) => (
                <div
                    key={label}
                    className="rounded-lg border bg-background px-2 py-1.5"
                >
                    <dt className="text-[11px] text-muted-foreground">
                        {label}
                    </dt>
                    <dd className="text-lg font-semibold tabular-nums">
                        {value}
                    </dd>
                </div>
            ))}
        </dl>
    );

    const unitList =
        devices.length === 0 ? (
            <EmptyState
                icon={<MapIcon className="size-6" />}
                title="Belum ada unit"
                className="px-6"
            >
                Unit aktif akan muncul setelah mengirim posisi GPS.
            </EmptyState>
        ) : (
            devices.map((device) => (
                <DeviceSidebarItem
                    key={device.dev_eui}
                    device={device}
                    isSelected={selectedId === device.dev_eui}
                    onClick={() => handleSelect(device.dev_eui)}
                />
            ))
        );

    return (
        <>
            <Head title={`Live Map · ${linkName}`} />

            <div className="sr-only" aria-live="polite" role="status">
                {connection === 'connected'
                    ? 'Live map terhubung'
                    : 'Live map terputus, mencoba menyambung kembali'}
            </div>

            <div className="flex h-svh w-full overflow-hidden bg-background">
                {!isMobile && (
                    <aside className="flex w-80 shrink-0 flex-col border-r bg-card">
                        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
                            <OrionLockup size={24} />
                            <ConnectionBadge state={connection} />
                        </div>
                        <div className="flex flex-col gap-3 border-b p-4">
                            <div>
                                <h1 className="text-base font-semibold">
                                    Live Map
                                </h1>
                                <p className="truncate text-xs text-muted-foreground">
                                    {linkName} · jejak {trailMinutes} menit
                                    terakhir
                                </p>
                            </div>
                            {kpis}
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {unitList}
                        </div>
                        {latestFix && (
                            <p className="border-t px-4 py-2 text-xs text-muted-foreground">
                                Update terakhir <LastSeen at={latestFix} />
                            </p>
                        )}
                    </aside>
                )}

                <main className="relative isolate flex-1">
                    <MapContainer
                        ref={setMap}
                        center={DEFAULT_CENTER}
                        zoom={16}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        className="bg-muted"
                    >
                        {baseLayer === 'satellite' && (
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                                maxZoom={19}
                            />
                        )}
                        {baseLayer === 'osm' && (
                            <TileLayer
                                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            />
                        )}
                        {activeTileset && (
                            <TileLayer
                                key={activeTileset.id}
                                url={activeTileset.tile_url}
                                attribution={`Peta kustom: ${activeTileset.name}`}
                                minZoom={activeTileset.min_zoom}
                                maxZoom={activeTileset.max_zoom}
                            />
                        )}

                        <FitBoundsOnLoad positions={devices} />
                        <GeofenceLayer geofences={geofences} />

                        {Object.entries(trails).map(([id, trail]) => (
                            <RouteHistoryLayer
                                key={id}
                                points={toTrailPoints(id, trail)}
                            />
                        ))}

                        {mapped.map((device) => (
                            <DeviceMarker
                                key={device.dev_eui}
                                device={
                                    connection === 'connected'
                                        ? device
                                        : { ...device, status: 'offline' }
                                }
                                isSelected={selectedId === device.dev_eui}
                                publicView
                                onSelect={handleSelect}
                            />
                        ))}
                    </MapContainer>

                    {isMobile ? (
                        <div
                            className={cn(
                                MAP_CARD,
                                'absolute inset-x-3 top-3 z-[1000] flex h-12 items-center justify-between gap-2 px-3',
                            )}
                        >
                            <OrionLockup size={22} compact />
                            <ConnectionBadge state={connection} />
                        </div>
                    ) : (
                        <>
                            <div
                                className={cn(
                                    MAP_CARD,
                                    'absolute top-4 right-4 z-[1000] p-2',
                                )}
                            >
                                <Segmented
                                    label="Lapisan dasar peta"
                                    value={baseLayer}
                                    onChange={setBaseLayer}
                                    options={baseLayerOptions}
                                />
                            </div>
                            <MapLegend className="absolute bottom-4 left-4 z-[1000] hidden lg:flex" />
                            <ZoomControls
                                map={map}
                                className="absolute right-4 bottom-6 z-[1000]"
                            />
                        </>
                    )}
                </main>
            </div>

            {isMobile && (
                <DrawerPrimitive.Root
                    open
                    modal={false}
                    dismissible={false}
                    snapPoints={SHEET_SNAPS}
                    activeSnapPoint={sheetSnap}
                    setActiveSnapPoint={setSheetSnap}
                >
                    <DrawerPrimitive.Portal>
                        <DrawerPrimitive.Content
                            aria-describedby={undefined}
                            className="fixed inset-x-0 bottom-0 z-30 flex h-[92svh] flex-col rounded-t-3xl border-t bg-card shadow-[0_-8px_24px_oklch(0.3_0.03_250/0.12)] outline-none"
                        >
                            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" />
                            <div className="flex flex-col gap-3 px-4 pt-3 pb-3">
                                <DrawerPrimitive.Title className="flex items-baseline justify-between gap-2">
                                    <span className="truncate text-base font-semibold">
                                        Live Map · {linkName}
                                    </span>
                                    {latestFix && (
                                        <span className="shrink-0 text-xs font-normal text-muted-foreground">
                                            <LastSeen at={latestFix} />
                                        </span>
                                    )}
                                </DrawerPrimitive.Title>
                                {kpis}
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto border-t pb-6">
                                {unitList}
                            </div>
                        </DrawerPrimitive.Content>
                    </DrawerPrimitive.Portal>
                </DrawerPrimitive.Root>
            )}
        </>
    );
}
