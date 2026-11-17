import 'leaflet/dist/leaflet.css';

import { Head, usePage } from '@inertiajs/react';
import L from 'leaflet';
import { Layers, Map as MapIcon, Menu, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { Drawer as DrawerPrimitive } from 'vaul';

import { DeviceMarker } from '@/components/Fleet/DeviceMarker';
import { DeviceSidebarItem } from '@/components/Fleet/DeviceSidebarItem';
import { GeofenceLayer } from '@/components/Fleet/GeofenceLayer';
import {
    LayersPanel,
    MAP_CARD,
    MapLegend,
    RouteRangeCard,
    Segmented,
    ZoomControls,
} from '@/components/Fleet/map-overlays';
import type { BaseLayerOption } from '@/components/Fleet/map-overlays';
import { MapTileUpload } from '@/components/Fleet/MapTileUpload';
import type { Tileset } from '@/components/Fleet/MapTileUpload';
import { RouteHistoryLayer } from '@/components/Fleet/RouteHistoryLayer';
import { SignalHeatmapLayer } from '@/components/Fleet/SignalHeatmapLayer';
import { ConnectionBadge } from '@/components/orion/badges';
import { EmptyState, LastSeen } from '@/components/orion/misc';
import {
    LiveConnectionBanner,
    NoGroupState,
    useHasNoGroups,
} from '@/components/orion/states';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useSidebar } from '@/components/ui/sidebar';
import { useFleetTracking } from '@/hooks/use-fleet-tracking';
import { useLiveConnection } from '@/hooks/use-live-connection';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import type { TimeRange } from '@/hooks/useRouteHistory';
import { cn } from '@/lib/utils';
import fleet from '@/routes/fleet';
import type { Auth } from '@/types/auth';
import type { DevicePosition, GeofenceZone } from '@/types/fleet';

interface Props {
    initialPositions: DevicePosition[];
    tilesets: Tileset[];
    geofences: GeofenceZone[];
}

type StatusFilter = 'all' | 'online' | 'offline';

const DEFAULT_CENTER: [number, number] = [-3.779223, 103.67939];
const DEFAULT_ZOOM = 17;
const BASE_LAYER_STORAGE_KEY = 'orion-map-base-layer';
const DEFAULT_BASE_LAYER = 'satellite';
/** Mobile bottom-sheet snap points: peek (map first) · half · full. */
const SHEET_SNAPS: (string | number)[] = ['300px', 0.55, 0.92];

function readStoredBaseLayer(): string {
    try {
        return (
            localStorage.getItem(BASE_LAYER_STORAGE_KEY) ?? DEFAULT_BASE_LAYER
        );
    } catch {
        return DEFAULT_BASE_LAYER;
    }
}

function hasFix(d: DevicePosition): boolean {
    return d.latitude !== 0 && d.longitude !== 0;
}

/** Frames the map to fit every known unit once, as soon as any unit has a real GPS fix — then never re-runs. */
function FitBoundsOnLoad({ positions }: { positions: DevicePosition[] }) {
    const map = useMap();
    const hasFitted = useRef(false);

    useEffect(() => {
        if (hasFitted.current) {
            return;
        }

        const valid = positions.filter(hasFix);

        if (valid.length === 0) {
            return;
        }

        hasFitted.current = true;
        map.fitBounds(
            L.latLngBounds(valid.map((d) => [d.latitude, d.longitude])),
            { padding: [60, 60], maxZoom: 18 },
        );
    }, [positions, map]);

    return null;
}

export default function FleetMap({
    initialPositions,
    tilesets: initialTilesets,
    geofences,
}: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const isAdmin = auth.user.role === 'admin';
    const { positionList } = useFleetTracking(
        initialPositions,
        auth.accessibleGroupIds,
    );
    const connection = useLiveConnection();
    const isMobile = useIsMobile();
    const { setOpenMobile } = useSidebar();
    const hasNoGroups = useHasNoGroups();

    const [map, setMap] = useState<L.Map | null>(null);
    // `?device={eui}` (from Device Detail → Show on map) preselects that unit.
    const [selectedDevEui, setSelectedDevEui] = useState<string | null>(() =>
        new URLSearchParams(window.location.search).get('device'),
    );
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [search, setSearch] = useState('');
    const [historyTimeRange, setHistoryTimeRange] = useState<TimeRange>('3h');
    const [tilesets, setTilesets] = useState<Tileset[]>(initialTilesets);
    const [baseLayer, setBaseLayer] = useState<string>(readStoredBaseLayer);
    const [showGeofence, setShowGeofence] = useState(true);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [heatmapRange, setHeatmapRange] = useState<'24h' | '7d'>('24h');
    const [sheetSnap, setSheetSnap] = useState<string | number | null>(
        SHEET_SNAPS[1],
    );

    const selectedDevice = useMemo(
        () => positionList.find((d) => d.dev_eui === selectedDevEui),
        [positionList, selectedDevEui],
    );
    const { points: routePoints, loading: routeLoading } = useRouteHistory(
        selectedDevEui,
        historyTimeRange,
    );

    const baseLayers: BaseLayerOption[] = [
        { id: 'satellite', label: 'Satelit' },
        { id: 'osm', label: 'OpenStreetMap' },
        ...tilesets.map((t) => ({ id: `tileset-${t.id}`, label: t.name })),
    ];
    const activeBaseLayer = baseLayers.some((l) => l.id === baseLayer)
        ? baseLayer
        : DEFAULT_BASE_LAYER;
    const activeTileset = tilesets.find(
        (t) => `tileset-${t.id}` === activeBaseLayer,
    );

    const handleBaseLayerChange = (id: string) => {
        setBaseLayer(id);

        try {
            localStorage.setItem(BASE_LAYER_STORAGE_KEY, id);
        } catch {
            // Storage unavailable (private mode) — keep the choice for this visit only.
        }
    };

    const handleSelectDevice = (devEui: string) => {
        setSelectedDevEui((prev) => (prev === devEui ? null : devEui));

        if (isMobile) {
            setSheetSnap(SHEET_SNAPS[0]);
        }
    };

    const onlineCount = positionList.filter(
        (d) => d.status === 'online',
    ).length;
    const offlineCount = positionList.length - onlineCount;
    const latestFix = positionList.reduce<string | null>(
        (latest, d) =>
            d.recorded_at && (!latest || d.recorded_at > latest)
                ? d.recorded_at
                : latest,
        null,
    );

    const matchesStatus = (d: DevicePosition) =>
        statusFilter === 'all' ||
        (statusFilter === 'online'
            ? d.status === 'online'
            : d.status !== 'online');
    const needle = search.trim().toLowerCase();
    const listedDevices = positionList.filter(
        (d) =>
            matchesStatus(d) &&
            (needle === '' ||
                d.device_name.toLowerCase().includes(needle) ||
                d.dev_eui.toLowerCase().includes(needle)),
    );
    const mappedDevices = positionList.filter(
        (d) => matchesStatus(d) && hasFix(d),
    );

    const statusOptions = (withCounts: boolean) => [
        {
            value: 'all' as const,
            label: withCounts ? `Semua ${positionList.length}` : 'Semua',
        },
        {
            value: 'online' as const,
            label: withCounts ? `Online ${onlineCount}` : 'Online',
        },
        {
            value: 'offline' as const,
            label: withCounts ? `Offline ${offlineCount}` : 'Offline',
        },
    ];

    const layersPanel = (
        <LayersPanel
            baseLayers={baseLayers}
            baseLayer={activeBaseLayer}
            onBaseLayerChange={handleBaseLayerChange}
            showGeofence={showGeofence}
            onShowGeofenceChange={setShowGeofence}
            showHeatmap={showHeatmap}
            onShowHeatmapChange={setShowHeatmap}
            heatmapRange={heatmapRange}
            onHeatmapRangeChange={setHeatmapRange}
            footer={
                isAdmin && (
                    <div className="mt-1 border-t pt-2">
                        <MapTileUpload
                            tilesets={tilesets}
                            onUploaded={(t) =>
                                setTilesets((prev) => [...prev, t])
                            }
                            onDeleted={(id) =>
                                setTilesets((prev) =>
                                    prev.filter((t) => t.id !== id),
                                )
                            }
                        />
                    </div>
                )
            }
        />
    );

    const deviceList =
        positionList.length === 0 ? (
            <EmptyState
                icon={<MapIcon className="size-6" />}
                title="Belum ada unit"
                className="px-6"
            >
                Unit aktif di grup Anda akan muncul di sini setelah mengirim
                posisi GPS.
            </EmptyState>
        ) : listedDevices.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
                Tidak ada unit yang cocok.
            </p>
        ) : (
            listedDevices.map((device) => (
                <DeviceSidebarItem
                    key={device.dev_eui}
                    device={device}
                    isSelected={selectedDevEui === device.dev_eui}
                    onClick={() => handleSelectDevice(device.dev_eui)}
                />
            ))
        );

    const floatingButton = cn(
        MAP_CARD,
        'grid size-11 shrink-0 place-items-center focus-visible:outline-2 focus-visible:outline-ring',
    );

    if (hasNoGroups) {
        return (
            <>
                <Head title="Fleet Map" />
                <NoGroupState className="min-h-svh" />
            </>
        );
    }

    return (
        <>
            <Head title="Fleet Map" />

            {/* Screen-reader-only announcement of live connection state — the map
                itself updates too frequently (per GPS tick) to announce every change. */}
            <div className="sr-only" aria-live="polite" role="status">
                {connection === 'connected'
                    ? 'Terhubung ke live tracking'
                    : 'Terputus dari live tracking, mencoba menyambung kembali'}
            </div>

            <div className="flex min-h-0 w-full flex-1 overflow-hidden">
                {!isMobile && (
                    <aside className="flex w-80 shrink-0 flex-col border-r bg-card">
                        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
                            <p className="text-sm">
                                <span className="text-muted-foreground">
                                    ORION /{' '}
                                </span>
                                <span className="font-medium">Fleet Map</span>
                            </p>
                            <ConnectionBadge state={connection} />
                        </div>

                        <div className="flex flex-col gap-3 border-b p-4">
                            <label className="relative block">
                                <span className="sr-only">
                                    Cari unit atau EUI
                                </span>
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search unit or EUI"
                                    className="h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </label>
                            <Segmented
                                label="Filter status unit"
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={statusOptions(true)}
                            />
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            {deviceList}
                        </div>
                    </aside>
                )}

                <main className="relative isolate flex-1">
                    <MapContainer
                        ref={setMap}
                        center={DEFAULT_CENTER}
                        zoom={DEFAULT_ZOOM}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                        className="bg-muted"
                    >
                        {activeBaseLayer === 'satellite' && (
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
                                maxZoom={19}
                            />
                        )}
                        {activeBaseLayer === 'osm' && (
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

                        <FitBoundsOnLoad positions={positionList} />

                        {showGeofence && (
                            <GeofenceLayer geofences={geofences} />
                        )}
                        <RouteHistoryLayer points={routePoints} />
                        {showHeatmap && (
                            <SignalHeatmapLayer timeRange={heatmapRange} />
                        )}

                        {mappedDevices.map((device) => (
                            <DeviceMarker
                                key={device.dev_eui}
                                device={
                                    // While the live feed is down, every position is stale.
                                    connection === 'connected'
                                        ? device
                                        : { ...device, status: 'offline' }
                                }
                                isSelected={selectedDevEui === device.dev_eui}
                                canOpenDetails={isAdmin}
                                onSelect={handleSelectDevice}
                            />
                        ))}
                    </MapContainer>

                    {/* ---------- Overlays ---------- */}
                    {isMobile ? (
                        <div className="absolute inset-x-0 top-0 z-[1000] flex items-center gap-2 p-3">
                            <button
                                type="button"
                                aria-label="Buka menu navigasi"
                                onClick={() => setOpenMobile(true)}
                                className={floatingButton}
                            >
                                <Menu className="size-5" />
                            </button>
                            <label
                                className={cn(
                                    MAP_CARD,
                                    'relative flex h-11 min-w-0 flex-1 items-center',
                                )}
                            >
                                <span className="sr-only">Cari unit</span>
                                <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
                                <input
                                    type="search"
                                    value={search}
                                    onChange={(e) => {
                                        setSearch(e.target.value);
                                        setSheetSnap(SHEET_SNAPS[1]);
                                    }}
                                    placeholder="Cari unit"
                                    className="h-full w-full rounded-xl bg-transparent pr-8 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                                />
                                <span
                                    aria-hidden
                                    className={cn(
                                        'pointer-events-none absolute right-3.5 size-2 rounded-full',
                                        connection === 'connected'
                                            ? 'bg-online'
                                            : connection === 'reconnecting'
                                              ? 'bg-warning'
                                              : 'bg-offline',
                                    )}
                                />
                            </label>
                            <Popover>
                                <PopoverTrigger
                                    aria-label="Lapisan peta"
                                    className={floatingButton}
                                >
                                    <Layers className="size-5" />
                                </PopoverTrigger>
                                <PopoverContent
                                    align="end"
                                    className="z-[1100] w-auto p-0"
                                >
                                    {layersPanel}
                                </PopoverContent>
                            </Popover>
                        </div>
                    ) : (
                        <>
                            {selectedDevice && (
                                <div className="absolute top-4 left-4 z-[1000] max-w-[calc(100%-20rem)]">
                                    <RouteRangeCard
                                        deviceName={selectedDevice.device_name}
                                        value={historyTimeRange}
                                        onChange={setHistoryTimeRange}
                                        loading={routeLoading}
                                    />
                                </div>
                            )}
                            <div
                                className={cn(
                                    MAP_CARD,
                                    'absolute top-4 right-4 z-[1000]',
                                )}
                            >
                                {layersPanel}
                            </div>
                            <MapLegend className="absolute bottom-4 left-4 z-[1000] hidden lg:flex" />
                            <ZoomControls
                                map={map}
                                className="absolute right-4 bottom-6 z-[1000]"
                            />
                        </>
                    )}

                    <LiveConnectionBanner
                        className={cn(
                            'absolute z-[1000]',
                            isMobile
                                ? 'inset-x-3 top-[68px]'
                                : 'top-4 left-1/2 w-[min(520px,calc(100%-34rem))] min-w-80 -translate-x-1/2',
                        )}
                    />
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
                            <div className="flex items-baseline justify-between px-4 pt-4 pb-3">
                                <DrawerPrimitive.Title className="text-lg font-semibold tabular-nums">
                                    {positionList.length} unit
                                </DrawerPrimitive.Title>
                                {latestFix && (
                                    <span className="text-xs text-muted-foreground">
                                        updated <LastSeen at={latestFix} />
                                    </span>
                                )}
                            </div>
                            <Segmented
                                label="Filter status unit"
                                value={statusFilter}
                                onChange={setStatusFilter}
                                options={statusOptions(false)}
                                className="mx-4 mb-3 [&>button]:min-h-10"
                            />
                            <div className="min-h-0 flex-1 overflow-y-auto border-t pb-28">
                                {deviceList}
                            </div>
                        </DrawerPrimitive.Content>
                    </DrawerPrimitive.Portal>
                </DrawerPrimitive.Root>
            )}
        </>
    );
}

FleetMap.layout = {
    breadcrumbs: [{ title: 'Fleet Map', href: fleet.map.url() }],
};
