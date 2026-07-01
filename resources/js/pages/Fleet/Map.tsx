import 'leaflet/dist/leaflet.css';

import { Head, usePage } from '@inertiajs/react';
import L from 'leaflet';
import { useEffect, useRef, useState } from 'react';
import {
    LayersControl,
    MapContainer,
    TileLayer,
    useMap,
    useMapEvents,
} from 'react-leaflet';

import { ConnectionBadge } from '@/components/Fleet/ConnectionBadge';
import { DeviceMarker } from '@/components/Fleet/DeviceMarker';
import { DeviceSidebarItem } from '@/components/Fleet/DeviceSidebarItem';
import { GeofenceLayer } from '@/components/Fleet/GeofenceLayer';
import { MapTileUpload } from '@/components/Fleet/MapTileUpload';
import type { Tileset } from '@/components/Fleet/MapTileUpload';
import { RouteHistoryLayer } from '@/components/Fleet/RouteHistoryLayer';
import { SignalHeatmapLayer } from '@/components/Fleet/SignalHeatmapLayer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useFleetTracking } from '@/hooks/use-fleet-tracking';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import type { TimeRange } from '@/hooks/useRouteHistory';
import fleet from '@/routes/fleet';
import type { Auth } from '@/types/auth';
import type { DevicePosition, GeofenceZone } from '@/types/fleet';

const TIME_RANGE_OPTIONS: { label: string; value: TimeRange }[] = [
    { label: '1j', value: '1h' },
    { label: '3j', value: '3h' },
    { label: '6j', value: '6h' },
    { label: '24j', value: '24h' },
];

interface Props {
    initialPositions: DevicePosition[];
    tilesets: Tileset[];
    geofences: GeofenceZone[];
}

const DEFAULT_CENTER: [number, number] = [-3.779223, 103.67939];
const DEFAULT_ZOOM = 17;
const BASE_LAYER_STORAGE_KEY = 'orion-map-base-layer';
const DEFAULT_BASE_LAYER = 'Satelit (Esri)';

/** Frames the map to fit every known unit once, as soon as any unit has a real GPS fix — then never re-runs. */
function FitBoundsOnLoad({ positions }: { positions: DevicePosition[] }) {
    const map = useMap();
    const hasFitted = useRef(false);

    useEffect(() => {
        if (hasFitted.current || positions.length === 0) {
            return;
        }

        const validPositions = positions.filter(
            (d) => d.latitude !== 0 && d.longitude !== 0,
        );

        if (validPositions.length === 0) {
            return;
        }

        hasFitted.current = true;
        const bounds = L.latLngBounds(
            validPositions.map((d) => [d.latitude, d.longitude]),
        );
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 18 });
    }, [positions, map]);

    return null;
}

function BaseLayerPersistence({
    onChange,
}: {
    onChange: (name: string) => void;
}) {
    useMapEvents({
        baselayerchange: (e) => onChange(e.name),
    });

    return null;
}

export default function FleetMap({
    initialPositions,
    tilesets: initialTilesets,
    geofences,
}: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { positionList, isConnected } = useFleetTracking(
        initialPositions,
        auth.accessibleGroupIds,
    );
    const [selectedDevEui, setSelectedDevEui] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<
        'all' | 'online' | 'offline'
    >('all');
    const [historyTimeRange, setHistoryTimeRange] = useState<TimeRange>('1h');
    const [mapReady, setMapReady] = useState(false);
    const [tilesets, setTilesets] = useState<Tileset[]>(initialTilesets);
    const [baseLayer, setBaseLayer] = useState<string>(
        () =>
            localStorage.getItem(BASE_LAYER_STORAGE_KEY) ?? DEFAULT_BASE_LAYER,
    );

    const handleBaseLayerChange = (name: string) => {
        setBaseLayer(name);
        localStorage.setItem(BASE_LAYER_STORAGE_KEY, name);
    };

    const availableBaseLayers = [
        'Satelit (Esri)',
        'OpenStreetMap',
        ...tilesets.map((t) => t.name),
    ];
    const activeBaseLayer = availableBaseLayers.includes(baseLayer)
        ? baseLayer
        : DEFAULT_BASE_LAYER;

    const { points: routePoints, loading: routeLoading } = useRouteHistory(
        selectedDevEui,
        historyTimeRange,
    );
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapTimeRange, setHeatmapTimeRange] = useState<'24h' | '7d'>(
        '24h',
    );

    const handleSelectDevice = (devEui: string) => {
        setSelectedDevEui((prev) => (prev === devEui ? null : devEui));
    };

    const handleTilesetUploaded = (tileset: Tileset) => {
        setTilesets((prev) => [...prev, tileset]);
    };

    const handleTilesetDeleted = (id: number) => {
        setTilesets((prev) => prev.filter((t) => t.id !== id));
    };

    const onlineCount = positionList.filter(
        (d) => d.status === 'online',
    ).length;
    const offlineCount = positionList.length - onlineCount;

    const visiblePositions = positionList.filter((d) => {
        if (statusFilter === 'online') {
            return d.status === 'online';
        }

        if (statusFilter === 'offline') {
            return d.status !== 'online';
        }

        return true;
    });

    return (
        <>
            <Head title="Fleet Map" />

            <div className="flex min-h-0 w-full flex-1 overflow-hidden">
                {/* Device list sidebar */}
                <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-border px-4 py-3">
                        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            Devices
                        </p>
                        <ConnectionBadge connected={isConnected} />
                    </div>

                    {/* Stats / filter status — juga berfungsi sebagai legenda */}
                    <div className="grid grid-cols-3 gap-1.5 border-b border-border px-4 py-3">
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`rounded-md px-2 py-2 text-left transition-colors ${
                                statusFilter === 'all'
                                    ? 'bg-muted ring-1 ring-border'
                                    : 'bg-muted/50 hover:bg-muted'
                            }`}
                        >
                            <p className="text-xs text-muted-foreground">
                                Semua
                            </p>
                            <p className="text-lg font-bold text-foreground">
                                {positionList.length}
                            </p>
                        </button>
                        <button
                            onClick={() => setStatusFilter('online')}
                            className={`rounded-md px-2 py-2 text-left transition-colors ${
                                statusFilter === 'online'
                                    ? 'bg-emerald-500/15 ring-1 ring-emerald-500/40'
                                    : 'bg-emerald-500/5 hover:bg-emerald-500/10'
                            }`}
                        >
                            <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Online
                            </p>
                            <p className="text-lg font-bold text-emerald-500 dark:text-emerald-400">
                                {onlineCount}
                            </p>
                        </button>
                        <button
                            onClick={() => setStatusFilter('offline')}
                            className={`rounded-md px-2 py-2 text-left transition-colors ${
                                statusFilter === 'offline'
                                    ? 'bg-slate-400/15 ring-1 ring-slate-400/40'
                                    : 'bg-slate-400/5 hover:bg-slate-400/10'
                            }`}
                        >
                            <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Offline
                            </p>
                            <p className="text-lg font-bold text-slate-500 dark:text-slate-400">
                                {offlineCount}
                            </p>
                        </button>
                    </div>

                    {/* Signal heatmap toggle */}
                    <div className="border-b border-border px-4 py-2">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                Coverage Sinyal
                            </p>
                            <button
                                onClick={() => setShowHeatmap((v) => !v)}
                                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                    showHeatmap
                                        ? 'bg-violet-500 text-white'
                                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                            >
                                {showHeatmap ? 'Aktif' : 'Nonaktif'}
                            </button>
                        </div>
                        {showHeatmap && (
                            <div className="mt-1.5 flex gap-1">
                                {(['24h', '7d'] as const).map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => setHeatmapTimeRange(r)}
                                        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                            heatmapTimeRange === r
                                                ? 'bg-violet-500 text-white'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                    >
                                        {r === '24h' ? '24 Jam' : '7 Hari'}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Route history time range — only show when a device is selected */}
                    {selectedDevEui && (
                        <div className="border-b border-border px-4 py-2">
                            <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                                Riwayat Rute{' '}
                                {routeLoading && (
                                    <span className="opacity-60">
                                        (memuat…)
                                    </span>
                                )}
                            </p>
                            <div className="flex gap-1">
                                {TIME_RANGE_OPTIONS.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() =>
                                            setHistoryTimeRange(opt.value)
                                        }
                                        className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                            historyTimeRange === opt.value
                                                ? 'bg-sky-500 text-white'
                                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                        }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                            {routePoints.length > 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {routePoints.length} titik GPS
                                </p>
                            )}
                        </div>
                    )}

                    {/* Device list */}
                    <ScrollArea className="flex-1">
                        {positionList.length === 0 ? (
                            <div className="space-y-2 p-4">
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                                <Skeleton className="h-16 w-full" />
                            </div>
                        ) : visiblePositions.length === 0 ? (
                            <p className="p-4 text-center text-xs text-muted-foreground">
                                Tidak ada unit dengan status ini.
                            </p>
                        ) : (
                            visiblePositions.map((device) => (
                                <DeviceSidebarItem
                                    key={device.dev_eui}
                                    device={device}
                                    isSelected={
                                        selectedDevEui === device.dev_eui
                                    }
                                    onClick={() =>
                                        handleSelectDevice(device.dev_eui)
                                    }
                                />
                            ))
                        )}
                    </ScrollArea>
                </aside>

                {/* Map */}
                <main className="relative flex-1">
                    {!mapReady && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                            <div className="text-center">
                                <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                <p className="text-sm text-muted-foreground">
                                    Loading map...
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Upload button — ditampilkan di atas peta */}
                    <div className="absolute bottom-6 left-4 z-[1000]">
                        <MapTileUpload
                            tilesets={tilesets}
                            onUploaded={handleTilesetUploaded}
                            onDeleted={handleTilesetDeleted}
                        />
                    </div>

                    <MapContainer
                        center={DEFAULT_CENTER}
                        zoom={DEFAULT_ZOOM}
                        style={{ height: '100%', width: '100%' }}
                        whenReady={() => setMapReady(true)}
                        zoomControl={true}
                    >
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer
                                checked={activeBaseLayer === 'Satelit (Esri)'}
                                name="Satelit (Esri)"
                            >
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                                    maxZoom={19}
                                />
                            </LayersControl.BaseLayer>

                            <LayersControl.BaseLayer
                                checked={activeBaseLayer === 'OpenStreetMap'}
                                name="OpenStreetMap"
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                            </LayersControl.BaseLayer>

                            {tilesets.map((tileset) => (
                                <LayersControl.BaseLayer
                                    key={tileset.id}
                                    checked={activeBaseLayer === tileset.name}
                                    name={tileset.name}
                                >
                                    <TileLayer
                                        url={tileset.tile_url}
                                        attribution={`Peta kustom: ${tileset.name}`}
                                        minZoom={tileset.min_zoom}
                                        maxZoom={tileset.max_zoom}
                                    />
                                </LayersControl.BaseLayer>
                            ))}
                        </LayersControl>

                        <BaseLayerPersistence
                            onChange={handleBaseLayerChange}
                        />
                        <FitBoundsOnLoad positions={positionList} />

                        <GeofenceLayer geofences={geofences} />
                        <RouteHistoryLayer points={routePoints} />
                        {showHeatmap && (
                            <SignalHeatmapLayer timeRange={heatmapTimeRange} />
                        )}

                        {visiblePositions
                            .filter(
                                (d) => d.latitude !== 0 && d.longitude !== 0,
                            )
                            .map((device) => (
                                <DeviceMarker
                                    key={device.dev_eui}
                                    device={device}
                                    isSelected={
                                        selectedDevEui === device.dev_eui
                                    }
                                />
                            ))}
                    </MapContainer>
                </main>
            </div>
        </>
    );
}

FleetMap.layout = {
    breadcrumbs: [{ title: 'Fleet Map', href: fleet.map.url() }],
};
