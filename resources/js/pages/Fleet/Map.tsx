import 'leaflet/dist/leaflet.css';

import { Head, usePage } from '@inertiajs/react';
import L from 'leaflet';
import { Menu } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useFleetTracking } from '@/hooks/use-fleet-tracking';
import { useIsMobile } from '@/hooks/use-mobile';
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
    const isMobile = useIsMobile();
    const [sidebarOpen, setSidebarOpen] = useState(false);
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

    const sidebarContent = (
        <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Devices
                </p>
                <ConnectionBadge connected={isConnected} />
            </div>

            {/* Stats / filter status — juga berfungsi sebagai legenda */}
            <ToggleGroup
                type="single"
                value={statusFilter}
                onValueChange={(value) => {
                    if (value) {
                        setStatusFilter(value as typeof statusFilter);
                    }
                }}
                className="grid grid-cols-3 gap-1.5 border-b border-border px-4 py-3"
            >
                <ToggleGroupItem
                    value="all"
                    aria-label="Tampilkan semua unit"
                    className="h-auto flex-col items-start gap-0 rounded-md! bg-muted/50 px-2 py-2 text-left hover:bg-muted data-[state=on]:bg-muted data-[state=on]:text-foreground data-[state=on]:ring-1 data-[state=on]:ring-border"
                >
                    <p className="text-xs text-muted-foreground">Semua</p>
                    <p className="text-lg font-bold text-foreground">
                        {positionList.length}
                    </p>
                </ToggleGroupItem>
                <ToggleGroupItem
                    value="online"
                    aria-label="Tampilkan unit online"
                    className="h-auto flex-col items-start gap-0 rounded-md! bg-status-online/5 px-2 py-2 text-left hover:bg-status-online/10 data-[state=on]:bg-status-online/15 data-[state=on]:text-status-online data-[state=on]:ring-1 data-[state=on]:ring-status-online/40"
                >
                    <p className="flex items-center gap-1 text-xs text-status-online">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-online" />
                        Online
                    </p>
                    <p className="text-lg font-bold text-status-online">
                        {onlineCount}
                    </p>
                </ToggleGroupItem>
                <ToggleGroupItem
                    value="offline"
                    aria-label="Tampilkan unit offline"
                    className="h-auto flex-col items-start gap-0 rounded-md! bg-status-offline/5 px-2 py-2 text-left hover:bg-status-offline/10 data-[state=on]:bg-status-offline/15 data-[state=on]:text-status-offline data-[state=on]:ring-1 data-[state=on]:ring-status-offline/40"
                >
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-status-offline" />
                        Offline
                    </p>
                    <p className="text-lg font-bold text-status-offline">
                        {offlineCount}
                    </p>
                </ToggleGroupItem>
            </ToggleGroup>

            {/* Signal heatmap toggle */}
            <div className="border-b border-border px-4 py-2">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Coverage Sinyal
                    </p>
                    <Toggle
                        size="sm"
                        pressed={showHeatmap}
                        onPressedChange={setShowHeatmap}
                        aria-label="Aktifkan heatmap coverage sinyal"
                        className="h-auto rounded px-2 py-0.5 text-xs font-medium data-[state=on]:bg-violet-500 data-[state=on]:text-white"
                    >
                        {showHeatmap ? 'Aktif' : 'Nonaktif'}
                    </Toggle>
                </div>
                {showHeatmap && (
                    <ToggleGroup
                        type="single"
                        value={heatmapTimeRange}
                        onValueChange={(value) => {
                            if (value) {
                                setHeatmapTimeRange(
                                    value as typeof heatmapTimeRange,
                                );
                            }
                        }}
                        className="mt-1.5 flex gap-1"
                    >
                        {(['24h', '7d'] as const).map((r) => (
                            <ToggleGroupItem
                                key={r}
                                value={r}
                                aria-label={`Rentang waktu ${r === '24h' ? '24 jam' : '7 hari'}`}
                                className="h-auto rounded! px-2 py-0.5 text-xs font-medium data-[state=on]:bg-violet-500 data-[state=on]:text-white"
                            >
                                {r === '24h' ? '24 Jam' : '7 Hari'}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                )}
            </div>

            {/* Route history time range — only show when a device is selected */}
            {selectedDevEui && (
                <div className="border-b border-border px-4 py-2">
                    <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Riwayat Rute{' '}
                        {routeLoading && (
                            <span className="opacity-60">(memuat…)</span>
                        )}
                    </p>
                    <ToggleGroup
                        type="single"
                        value={historyTimeRange}
                        onValueChange={(value) => {
                            if (value) {
                                setHistoryTimeRange(value as TimeRange);
                            }
                        }}
                        className="flex gap-1"
                    >
                        {TIME_RANGE_OPTIONS.map((opt) => (
                            <ToggleGroupItem
                                key={opt.value}
                                value={opt.value}
                                aria-label={`Riwayat rute ${opt.label}`}
                                className="h-auto rounded! px-2 py-0.5 text-xs font-medium data-[state=on]:bg-sky-500 data-[state=on]:text-white"
                            >
                                {opt.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
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
                            isSelected={selectedDevEui === device.dev_eui}
                            onClick={() => {
                                handleSelectDevice(device.dev_eui);

                                if (isMobile) {
                                    setSidebarOpen(false);
                                }
                            }}
                        />
                    ))
                )}
            </ScrollArea>
        </>
    );

    return (
        <>
            <Head title="Fleet Map" />

            {/* Screen-reader-only announcement of live connection state — the map
                itself updates too frequently (per GPS tick) to announce every change. */}
            <div className="sr-only" aria-live="polite" role="status">
                {isConnected
                    ? 'Terhubung ke live tracking'
                    : 'Terputus dari live tracking, mencoba menyambung kembali'}
            </div>

            <div className="flex min-h-0 w-full flex-1 overflow-hidden">
                {/* Device list sidebar — inline on desktop, slide-over sheet on mobile */}
                {isMobile ? (
                    <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                        <SheetContent
                            side="left"
                            className="w-72 gap-0 p-0 sm:max-w-72"
                        >
                            <SheetTitle className="sr-only">
                                Daftar Devices
                            </SheetTitle>
                            {sidebarContent}
                        </SheetContent>
                    </Sheet>
                ) : (
                    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
                        {sidebarContent}
                    </aside>
                )}

                {/* Map */}
                <main className="relative flex-1">
                    {isMobile && (
                        <div className="absolute top-3 left-3 z-[1000]">
                            <Button
                                size="icon"
                                variant="secondary"
                                className="shadow-md"
                                aria-label="Buka daftar devices"
                                onClick={() => setSidebarOpen(true)}
                            >
                                <Menu className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

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
