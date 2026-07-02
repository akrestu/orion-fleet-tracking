import 'leaflet/dist/leaflet.css';

import { Head } from '@inertiajs/react';
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import L from 'leaflet';
import {
    ArrowUpDown,
    Download,
    ExternalLink,
    FileText,
    Gauge,
    MapPin,
    Pause,
    Play,
    RefreshCw,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    MapContainer,
    Marker,
    TileLayer,
    Tooltip,
    useMap,
} from 'react-leaflet';
import type { Tileset } from '@/components/Fleet/MapTileUpload';
import { RouteHistoryLayer } from '@/components/Fleet/RouteHistoryLayer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAnimatedMarkerPosition } from '@/hooks/use-animated-marker';
import { useUrlFilter } from '@/hooks/useUrlFilter';
import { createDeviceIcon } from '@/lib/device-icon';
import adminReports from '@/routes/admin/reports';
import fleet from '@/routes/fleet';
import type { GpsLogPoint, UnitCategory } from '@/types/fleet';

type DeviceOption = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
};

type PageProps = {
    devices: DeviceOption[];
    tilesets: Tileset[];
};

type UtilizationRow = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    log_count: number;
    operation_hours: number;
    running_hours: number;
    idle_hours: number;
    distance_km: number;
    avg_speed_kmh: number;
    max_speed_kmh: number;
};

type ViolationRow = {
    id: number;
    dev_eui: string;
    device_name: string;
    unit_type: string;
    speed_kmh: number | null;
    threshold_kmh: number | null;
    triggered_at: string | null;
    triggered_at_human: string | null;
    is_resolved: boolean;
};

type ViolationSummary = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    violation_count: number;
    max_speed_kmh: number | null;
    avg_speed_kmh: number | null;
};

type TripRow = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    load_start: string;
    load_end: string;
    dump_start: string | null;
    dump_end: string | null;
    cycle_duration_min: number | null;
    haul_duration_min: number | null;
    return_duration_min: number | null;
    distance_km: number | null;
    avg_speed_kmh: number | null;
};

type RawGpsRow = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    latitude: number;
    longitude: number;
    speed_kmh: number;
    heading_deg: number | null;
    rssi: number | null;
    snr: number | null;
    recorded_at: string;
};

type GeofenceAlertRow = {
    id: number;
    dev_eui: string;
    device_name: string;
    unit_type: string;
    geofence_name: string | null;
    event: 'enter' | 'exit' | null;
    triggered_at: string | null;
    triggered_at_human: string | null;
};

type TripSummary = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    trip_count: number;
    avg_cycle_min: number | null;
    avg_haul_min: number | null;
    avg_return_min: number | null;
};

type StopRow = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    type: 'waiting' | 'delay';
    zone: string;
    started_at: string;
    ended_at: string;
    duration_min: number;
};

type StopSummary = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    waiting_count: number;
    waiting_min: number;
    delay_count: number;
    delay_min: number;
};

type GatewayRow = {
    gateway_id: string;
    uplink_count: number;
    device_count: number;
    avg_rssi: number;
    min_rssi: number;
    max_rssi: number;
    avg_snr: number;
    first_seen: string;
    last_seen: string;
};

const today = new Date().toISOString().slice(0, 10);
const firstOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
)
    .toISOString()
    .slice(0, 10);

function buildQueryString(params: Record<string, string>): string {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v) {
            qs.set(k, v);
        }
    });
    const s = qs.toString();

    return s ? '?' + s : '';
}

function FilterBar({
    devices,
    devEui,
    onDevEuiChange,
    dateFrom,
    onDateFromChange,
    dateTo,
    onDateToChange,
    onClear,
    onApply,
    loading,
}: {
    devices: DeviceOption[];
    devEui: string;
    onDevEuiChange: (v: string) => void;
    dateFrom: string;
    onDateFromChange: (v: string) => void;
    dateTo: string;
    onDateToChange: (v: string) => void;
    onClear: () => void;
    onApply: () => void;
    loading: boolean;
}) {
    const hasFilters =
        devEui !== 'all' || dateFrom !== firstOfMonth || dateTo !== today;

    return (
        <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Device</Label>
                <Combobox
                    className="w-52"
                    value={devEui}
                    onValueChange={(v) => onDevEuiChange(v || 'all')}
                    placeholder="All devices"
                    searchPlaceholder="Search device..."
                    options={[
                        { value: 'all', label: 'All devices' },
                        ...devices.map((d) => ({
                            value: d.dev_eui,
                            label: d.device_name,
                        })),
                    ]}
                />
            </div>

            <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">
                    From date
                </Label>
                <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => onDateFromChange(e.target.value)}
                    className="w-40"
                />
            </div>

            <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">To date</Label>
                <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => onDateToChange(e.target.value)}
                    className="w-40"
                />
            </div>

            <Button
                onClick={onApply}
                disabled={loading}
                size="sm"
                className="gap-1.5 self-end"
            >
                <RefreshCw
                    className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                />
                {loading ? 'Loading…' : 'Apply'}
            </Button>

            {hasFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClear}
                    className="gap-1 self-end"
                >
                    <X className="h-3.5 w-3.5" />
                    Reset
                </Button>
            )}
        </div>
    );
}

function TableSkeleton({ cols }: { cols: number }) {
    return (
        <>
            {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                    {Array.from({ length: cols }).map((__, j) => (
                        <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                        </TableCell>
                    ))}
                </TableRow>
            ))}
        </>
    );
}

function formatMin(min: number | null): string {
    if (min === null) {
        return '—';
    }

    if (min < 60) {
        return `${min} min`;
    }

    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);

    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    return new Date(iso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
}

function RawGpsDataTab({ devices }: { devices: DeviceOption[] }) {
    const [devEui, setDevEui] = useUrlFilter('dev_eui', 'all');
    const [dateFrom, setDateFrom] = useUrlFilter('from', today);
    const [dateTo, setDateTo] = useUrlFilter('to', today);
    const [data, setData] = useState<RawGpsRow[]>([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const fetchData = useCallback(
        async (dEui: string, from: string, to: string, targetPage: number) => {
            setLoading(true);

            try {
                const params: Record<string, string> = {
                    from,
                    to,
                    page: String(targetPage),
                };

                if (dEui !== 'all') {
                    params.dev_eui = dEui;
                }

                const res = await fetch(
                    adminReports.rawGpsData.url() + buildQueryString(params),
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );
                const json = await res.json();
                setData(json.data ?? []);
                setLastPage(json.last_page ?? 1);
                setTotal(json.total ?? 0);
                setPage(json.current_page ?? 1);
                setLoaded(true);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchData(devEui, dateFrom, dateTo, 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchData(devEui, dateFrom, dateTo, 1);
    const handleClear = () => {
        setDevEui('all');
        setDateFrom(today);
        setDateTo(today);
        setData([]);
        setPage(1);
        setLastPage(1);
        setTotal(0);
        setLoaded(false);
    };

    const handleExport = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.gpsLogs.url() + buildQueryString(params);
    };

    const columns: ColumnDef<RawGpsRow>[] = [
        {
            accessorKey: 'device_name',
            header: 'Device',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">
                        {row.original.device_name}
                    </div>
                    <Badge
                        variant="outline"
                        className="mt-0.5 text-xs capitalize"
                    >
                        {row.original.unit_type}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: 'latitude',
            header: 'Latitude',
            cell: ({ row }) => (
                <span className="font-mono text-sm tabular-nums">
                    {row.original.latitude.toFixed(6)}
                </span>
            ),
        },
        {
            accessorKey: 'longitude',
            header: 'Longitude',
            cell: ({ row }) => (
                <span className="font-mono text-sm tabular-nums">
                    {row.original.longitude.toFixed(6)}
                </span>
            ),
        },
        {
            accessorKey: 'speed_kmh',
            header: 'Speed',
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.speed_kmh} km/h
                </span>
            ),
        },
        {
            accessorKey: 'heading_deg',
            header: 'Heading',
            cell: ({ row }) => (
                <span className="text-muted-foreground tabular-nums">
                    {row.original.heading_deg !== null
                        ? `${row.original.heading_deg}°`
                        : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'recorded_at',
            header: 'Timestamp',
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {new Date(row.original.recorded_at).toLocaleString()}
                </span>
            ),
        },
        {
            accessorKey: 'rssi',
            header: 'RSSI',
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.rssi !== null
                        ? `${row.original.rssi} dBm`
                        : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'snr',
            header: 'SNR',
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.snr !== null ? `${row.original.snr} dB` : '—'}
                </span>
            ),
        },
    ];

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    });

    return (
        <div className="flex flex-col gap-4">
            <FilterBar
                devices={devices}
                devEui={devEui}
                onDevEuiChange={setDevEui}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                onClear={handleClear}
                onApply={handleApply}
                loading={loading}
            />

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {h.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  h.column.columnDef.header,
                                                  h.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton cols={columns.length} />
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {loaded
                                        ? 'No GPS data found for the selected period.'
                                        : 'Apply filters to load the report.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            fetchData(devEui, dateFrom, dateTo, page - 1)
                        }
                        disabled={page <= 1 || loading}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {Math.max(1, lastPage)} (
                        {total.toLocaleString()} rows)
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            fetchData(devEui, dateFrom, dateTo, page + 1)
                        }
                        disabled={page >= lastPage || loading}
                    >
                        Next
                    </Button>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExport}
                    className="gap-1.5"
                    disabled={!loaded}
                >
                    <Download className="h-4 w-4" />
                    Export GPS Logs CSV
                </Button>
            </div>
        </div>
    );
}

function TrackingFitBounds({ points }: { points: GpsLogPoint[] }) {
    const map = useMap();

    useEffect(() => {
        if (points.length === 0) {
            return;
        }

        const bounds = L.latLngBounds(
            points.map((p) => [p.latitude, p.longitude]),
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 18 });
    }, [points, map]);

    return null;
}

const PLAYBACK_SPEEDS = [1, 2, 4, 8] as const;
const PLAYBACK_TICK_MS = 300;
const BASE_LAYER_STORAGE_KEY = 'orion-map-base-layer';
const DEFAULT_BASE_LAYER = 'Satelit (Esri)';

/** Renders whichever base layer is currently active on Fleet Map (built-in or a custom uploaded tileset), so both maps stay visually consistent. */
function ActiveBaseLayer({
    tilesets,
    activeBaseLayer,
}: {
    tilesets: Tileset[];
    activeBaseLayer: string;
}) {
    const customTileset = tilesets.find((t) => t.name === activeBaseLayer);

    if (customTileset) {
        return (
            <TileLayer
                url={customTileset.tile_url}
                attribution={`Peta kustom: ${customTileset.name}`}
                minZoom={customTileset.min_zoom}
                maxZoom={customTileset.max_zoom}
            />
        );
    }

    if (activeBaseLayer === 'OpenStreetMap') {
        return (
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
        );
    }

    return (
        <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={19}
        />
    );
}

function PlaybackMarker({
    point,
    device,
    durationMs,
}: {
    point: GpsLogPoint;
    device: DeviceOption | undefined;
    durationMs: number;
}) {
    const markerRef = useRef<L.Marker>(null);
    // Captured once — subsequent movement is driven imperatively by the animation hook,
    // so react-leaflet must never reactively re-snap this prop.
    const [initialPosition] = useState<[number, number]>(() => [
        point.latitude,
        point.longitude,
    ]);
    useAnimatedMarkerPosition(
        markerRef,
        [point.latitude, point.longitude],
        durationMs,
    );

    // Replay always renders the unit at full color/opacity — "online/offline" reflects
    // live connectivity, which doesn't apply to historical playback.
    const icon = useMemo(
        () =>
            createDeviceIcon({
                unit_type: (device?.unit_type ?? 'other') as UnitCategory,
                status: 'online',
                heading_deg: point.heading_deg,
                device_name: device?.device_name ?? null,
            }),
        [device, point.heading_deg],
    );

    return (
        <Marker ref={markerRef} position={initialPosition} icon={icon}>
            <Tooltip permanent direction="top" offset={[0, -8]}>
                <span className="text-xs">
                    {new Date(point.recorded_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    })}{' '}
                    — {point.speed_kmh.toFixed(1)} km/h
                </span>
            </Tooltip>
        </Marker>
    );
}

function TrackingMonitoringTab({
    devices,
    tilesets,
}: {
    devices: DeviceOption[];
    tilesets: Tileset[];
}) {
    const [devEui, setDevEui] = useUrlFilter(
        'dev_eui',
        devices[0]?.dev_eui ?? '',
    );
    const [dateFrom, setDateFrom] = useUrlFilter('from', today);
    const [dateTo, setDateTo] = useUrlFilter('to', today);
    const [points, setPoints] = useState<GpsLogPoint[]>([]);
    const [loading, setLoading] = useState(false);
    const [playbackIndex, setPlaybackIndex] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] =
        useState<(typeof PLAYBACK_SPEEDS)[number]>(1);
    const [activeBaseLayer] = useState<string>(
        () =>
            localStorage.getItem(BASE_LAYER_STORAGE_KEY) ?? DEFAULT_BASE_LAYER,
    );
    const abortRef = useRef<AbortController | null>(null);

    const fetchHistory = useCallback(
        async (dEui: string, from: string, to: string) => {
            if (!dEui) {
                setPoints([]);

                return;
            }

            abortRef.current?.abort();
            const controller = new AbortController();
            abortRef.current = controller;
            setLoading(true);

            try {
                const fromIso = new Date(`${from}T00:00:00`).toISOString();
                const toIso = new Date(`${to}T23:59:59`).toISOString();
                const url = `/api/fleet/devices/${encodeURIComponent(dEui)}/history?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}&limit=5000`;
                const res = await fetch(url, {
                    signal: controller.signal,
                    credentials: 'same-origin',
                });
                const json = await res.json();
                const data: GpsLogPoint[] = (json.data ??
                    json) as GpsLogPoint[];
                setPoints(
                    data
                        .slice()
                        .sort((a, b) =>
                            a.recorded_at.localeCompare(b.recorded_at),
                        ),
                );
                setPlaybackIndex(0);
                setPlaying(false);
            } catch {
                // aborted or network error — ignore
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchHistory(devEui, dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Advance playback on a timer while `playing` is true.
    useEffect(() => {
        if (!playing || points.length === 0) {
            return;
        }

        const timer = setInterval(() => {
            setPlaybackIndex((i) => {
                if (i >= points.length - 1) {
                    setPlaying(false);

                    return i;
                }

                return i + 1;
            });
        }, PLAYBACK_TICK_MS / playbackSpeed);

        return () => clearInterval(timer);
    }, [playing, playbackSpeed, points.length]);

    const handleApply = () => fetchHistory(devEui, dateFrom, dateTo);
    const handleTogglePlay = () => {
        if (!playing && playbackIndex >= points.length - 1) {
            setPlaybackIndex(0);
        }

        setPlaying((p) => !p);
    };

    const currentPoint = points[playbackIndex] ?? null;

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                        Device
                    </Label>
                    <Combobox
                        className="w-52"
                        value={devEui}
                        onValueChange={(v) =>
                            setDevEui(v || (devices[0]?.dev_eui ?? ''))
                        }
                        placeholder="Select device"
                        searchPlaceholder="Search device..."
                        options={devices.map((d) => ({
                            value: d.dev_eui,
                            label: d.device_name,
                        }))}
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                        From date
                    </Label>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-40"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                        To date
                    </Label>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-40"
                    />
                </div>

                <Button
                    onClick={handleApply}
                    disabled={loading || !devEui}
                    size="sm"
                    className="gap-1.5 self-end"
                >
                    <RefreshCw
                        className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                    />
                    {loading ? 'Loading…' : 'Load Route'}
                </Button>

                <a href={fleet.map.url()} className="ml-auto self-end">
                    <Button variant="outline" size="sm" className="gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Fleet Map (Live)
                    </Button>
                </a>
            </div>

            {points.length > 0 && (
                <div className="flex flex-col gap-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            onClick={handleTogglePlay}
                            size="sm"
                            variant="outline"
                            className="w-24 gap-1.5"
                        >
                            {playing ? (
                                <Pause className="h-3.5 w-3.5" />
                            ) : (
                                <Play className="h-3.5 w-3.5" />
                            )}
                            {playing ? 'Pause' : 'Play'}
                        </Button>

                        <input
                            type="range"
                            min={0}
                            max={points.length - 1}
                            value={playbackIndex}
                            onChange={(e) => {
                                setPlaying(false);
                                setPlaybackIndex(Number(e.target.value));
                            }}
                            className="h-2 flex-1 accent-sky-500"
                        />

                        <div className="flex items-center gap-1">
                            {PLAYBACK_SPEEDS.map((s) => (
                                <Button
                                    key={s}
                                    size="sm"
                                    variant={
                                        playbackSpeed === s
                                            ? 'default'
                                            : 'outline'
                                    }
                                    className="h-7 w-10 px-0 text-xs"
                                    onClick={() => setPlaybackSpeed(s)}
                                >
                                    {s}x
                                </Button>
                            ))}
                        </div>
                    </div>

                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        Point {playbackIndex + 1} of {points.length}
                        {currentPoint && (
                            <>
                                {' '}
                                —{' '}
                                {new Date(
                                    currentPoint.recorded_at,
                                ).toLocaleString('id-ID')}{' '}
                                — {currentPoint.speed_kmh.toFixed(1)} km/h
                            </>
                        )}
                    </p>
                </div>
            )}

            <div className="h-[520px] overflow-hidden rounded-md border">
                <MapContainer
                    center={[-3.779223, 103.67939]}
                    zoom={16}
                    style={{ height: '100%', width: '100%' }}
                >
                    <ActiveBaseLayer
                        tilesets={tilesets}
                        activeBaseLayer={activeBaseLayer}
                    />
                    <TrackingFitBounds points={points} />
                    <RouteHistoryLayer points={points} />
                    {currentPoint && (
                        <PlaybackMarker
                            point={currentPoint}
                            device={devices.find((d) => d.dev_eui === devEui)}
                            durationMs={PLAYBACK_TICK_MS / playbackSpeed}
                        />
                    )}
                </MapContainer>
            </div>
        </div>
    );
}

function FleetUtilizationTab({ devices }: { devices: DeviceOption[] }) {
    const [devEui, setDevEui] = useUrlFilter('dev_eui', 'all');
    const [dateFrom, setDateFrom] = useUrlFilter('from', firstOfMonth);
    const [dateTo, setDateTo] = useUrlFilter('to', today);
    const [data, setData] = useState<UtilizationRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);

    const fetchData = useCallback(
        async (dEui: string, from: string, to: string) => {
            setLoading(true);

            try {
                const params: Record<string, string> = { from, to };

                if (dEui !== 'all') {
                    params.dev_eui = dEui;
                }

                const res = await fetch(
                    adminReports.fleetUtilization.url() +
                        buildQueryString(params),
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );
                const json = await res.json();
                setData(json.data ?? []);
                setLoaded(true);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchData(devEui, dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchData(devEui, dateFrom, dateTo);
    const handleClear = () => {
        setDevEui('all');
        setDateFrom(firstOfMonth);
        setDateTo(today);
        setData([]);
        setLoaded(false);
    };

    const handleExport = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.gpsLogs.url() + buildQueryString(params);
    };

    const handleExportExcel = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.fleetUtilization.url() +
            buildQueryString(params);
    };

    const columns: ColumnDef<UtilizationRow>[] = [
        {
            accessorKey: 'device_name',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Device <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">
                        {row.original.device_name}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                        {row.original.dev_eui}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'unit_type',
            header: 'Type',
            cell: ({ row }) => (
                <Badge variant="outline" className="capitalize">
                    {row.original.unit_type}
                </Badge>
            ),
        },
        {
            accessorKey: 'operation_hours',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Op. Hours <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                    {row.original.operation_hours} h
                </span>
            ),
        },
        {
            accessorKey: 'running_hours',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Running <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="text-status-online tabular-nums">
                    {row.original.running_hours} h
                </span>
            ),
        },
        {
            accessorKey: 'idle_hours',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Idle <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const pct =
                    row.original.operation_hours > 0
                        ? Math.round(
                              (row.original.idle_hours /
                                  row.original.operation_hours) *
                                  100,
                          )
                        : 0;

                return (
                    <span className="text-status-warning tabular-nums">
                        {row.original.idle_hours} h
                        {pct > 0 && (
                            <span className="ml-1 text-xs opacity-70">
                                ({pct}%)
                            </span>
                        )}
                    </span>
                );
            },
        },
        {
            accessorKey: 'distance_km',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Distance <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.distance_km} km
                </span>
            ),
        },
        {
            accessorKey: 'avg_speed_kmh',
            header: 'Avg Speed',
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.avg_speed_kmh} km/h
                </span>
            ),
        },
        {
            accessorKey: 'max_speed_kmh',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Max Speed <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.max_speed_kmh} km/h
                </span>
            ),
        },
        {
            accessorKey: 'log_count',
            header: 'GPS Points',
            cell: ({ row }) => (
                <span className="text-muted-foreground tabular-nums">
                    {row.original.log_count.toLocaleString()}
                </span>
            ),
        },
    ];

    const table = useReactTable({
        data,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    const totalHours = data.reduce((s, r) => s + r.operation_hours, 0);
    const totalRunning = data.reduce((s, r) => s + r.running_hours, 0);
    const totalIdle = data.reduce((s, r) => s + r.idle_hours, 0);
    const totalKm = data.reduce((s, r) => s + r.distance_km, 0);

    return (
        <div className="flex flex-col gap-4">
            <FilterBar
                devices={devices}
                devEui={devEui}
                onDevEuiChange={setDevEui}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                onClear={handleClear}
                onApply={handleApply}
                loading={loading}
            />

            {loaded && data.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Devices</CardDescription>
                            <CardTitle className="text-2xl tabular-nums">
                                {data.length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Op. Hours</CardDescription>
                            <CardTitle className="text-2xl tabular-nums">
                                {totalHours.toFixed(1)} h
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Running Hours</CardDescription>
                            <CardTitle className="text-2xl text-status-online tabular-nums">
                                {totalRunning.toFixed(1)} h
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Idle Hours</CardDescription>
                            <CardTitle className="text-2xl text-status-warning tabular-nums">
                                {totalIdle.toFixed(1)} h
                                {totalHours > 0 && (
                                    <span className="ml-1 text-sm font-normal opacity-70">
                                        (
                                        {Math.round(
                                            (totalIdle / totalHours) * 100,
                                        )}
                                        %)
                                    </span>
                                )}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Distance</CardDescription>
                            <CardTitle className="text-2xl tabular-nums">
                                {totalKm.toFixed(1)} km
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {h.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  h.column.columnDef.header,
                                                  h.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton cols={columns.length} />
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {loaded
                                        ? 'No data found for the selected period.'
                                        : 'Apply filters to load the report.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{' '}
                        {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        className="gap-1.5"
                        disabled={!loaded}
                    >
                        <Download className="h-4 w-4" />
                        Export GPS Logs CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportExcel}
                        className="gap-1.5"
                        disabled={!loaded}
                    >
                        <Download className="h-4 w-4" />
                        Export Excel
                    </Button>
                </div>
            </div>
        </div>
    );
}

function SpeedViolationsTab({ devices }: { devices: DeviceOption[] }) {
    const [devEui, setDevEui] = useUrlFilter('dev_eui', 'all');
    const [dateFrom, setDateFrom] = useUrlFilter('from', firstOfMonth);
    const [dateTo, setDateTo] = useUrlFilter('to', today);
    const [rows, setRows] = useState<ViolationRow[]>([]);
    const [summary, setSummary] = useState<ViolationSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);

    const fetchData = useCallback(
        async (dEui: string, from: string, to: string) => {
            setLoading(true);

            try {
                const params: Record<string, string> = { from, to };

                if (dEui !== 'all') {
                    params.dev_eui = dEui;
                }

                const res = await fetch(
                    adminReports.speedViolations.url() +
                        buildQueryString(params),
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );
                const json = await res.json();
                setRows(json.data ?? []);
                setSummary(json.summary ?? []);
                setLoaded(true);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchData(devEui, dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchData(devEui, dateFrom, dateTo);
    const handleClear = () => {
        setDevEui('all');
        setDateFrom(firstOfMonth);
        setDateTo(today);
        setRows([]);
        setSummary([]);
        setLoaded(false);
    };

    const handleExport = () => {
        const params: Record<string, string> = {
            from: dateFrom,
            to: dateTo,
            alert_type: 'overspeed',
        };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.alerts.url() + buildQueryString(params);
    };

    const handleExportExcel = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.speedViolations.url() +
            buildQueryString(params);
    };

    const columns: ColumnDef<ViolationRow>[] = [
        {
            accessorKey: 'device_name',
            header: 'Device',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">
                        {row.original.device_name}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                        {row.original.dev_eui}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'unit_type',
            header: 'Type',
            cell: ({ row }) => (
                <Badge variant="outline" className="capitalize">
                    {row.original.unit_type}
                </Badge>
            ),
        },
        {
            accessorKey: 'speed_kmh',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Speed <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) =>
                row.original.speed_kmh !== null ? (
                    <span className="font-medium text-status-danger tabular-nums">
                        {row.original.speed_kmh} km/h
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            accessorKey: 'threshold_kmh',
            header: 'Limit',
            cell: ({ row }) =>
                row.original.threshold_kmh !== null ? (
                    <span className="text-muted-foreground tabular-nums">
                        {row.original.threshold_kmh} km/h
                    </span>
                ) : (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            accessorKey: 'triggered_at',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Triggered <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span
                    className="text-sm text-muted-foreground"
                    title={row.original.triggered_at ?? ''}
                >
                    {row.original.triggered_at_human ?? '—'}
                </span>
            ),
        },
        {
            accessorKey: 'is_resolved',
            header: 'Status',
            cell: ({ row }) =>
                row.original.is_resolved ? (
                    <Badge variant="online">Resolved</Badge>
                ) : (
                    <Badge variant="danger">Active</Badge>
                ),
        },
    ];

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    return (
        <div className="flex flex-col gap-4">
            <FilterBar
                devices={devices}
                devEui={devEui}
                onDevEuiChange={setDevEui}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                onClear={handleClear}
                onApply={handleApply}
                loading={loading}
            />

            {loaded && summary.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Per-Device Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Device</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Violations</TableHead>
                                    <TableHead>Max Speed</TableHead>
                                    <TableHead>Avg Speed</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.map((s) => (
                                    <TableRow key={s.dev_eui}>
                                        <TableCell className="font-medium">
                                            {s.device_name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="capitalize"
                                            >
                                                {s.unit_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="danger" className="tabular-nums">
                                                {s.violation_count}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-status-danger tabular-nums">
                                            {s.max_speed_kmh !== null
                                                ? `${s.max_speed_kmh} km/h`
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground tabular-nums">
                                            {s.avg_speed_kmh !== null
                                                ? `${s.avg_speed_kmh} km/h`
                                                : '—'}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {h.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  h.column.columnDef.header,
                                                  h.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton cols={columns.length} />
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {loaded
                                        ? 'No speed violations found for the selected period.'
                                        : 'Apply filters to load the report.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{' '}
                        {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExport}
                        className="gap-1.5"
                        disabled={!loaded}
                    >
                        <Download className="h-4 w-4" />
                        Export Violations CSV
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportExcel}
                        className="gap-1.5"
                        disabled={!loaded}
                    >
                        <Download className="h-4 w-4" />
                        Export Excel
                    </Button>
                </div>
            </div>
        </div>
    );
}

function GeofenceAlertsTable({ devices }: { devices: DeviceOption[] }) {
    const [devEui, setDevEui] = useUrlFilter('geofence_dev_eui', 'all');
    const [dateFrom, setDateFrom] = useUrlFilter('geofence_from', firstOfMonth);
    const [dateTo, setDateTo] = useUrlFilter('geofence_to', today);
    const [rows, setRows] = useState<GeofenceAlertRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const fetchData = useCallback(
        async (dEui: string, from: string, to: string) => {
            setLoading(true);

            try {
                const params: Record<string, string> = { from, to };

                if (dEui !== 'all') {
                    params.dev_eui = dEui;
                }

                const res = await fetch(
                    adminReports.geofenceAlerts.url() +
                        buildQueryString(params),
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );
                const json = await res.json();
                setRows(json.data ?? []);
                setLoaded(true);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchData(devEui, dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchData(devEui, dateFrom, dateTo);
    const handleClear = () => {
        setDevEui('all');
        setDateFrom(firstOfMonth);
        setDateTo(today);
        setRows([]);
        setLoaded(false);
    };

    const handleExportExcel = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.geofenceAlerts.url() + buildQueryString(params);
    };

    const columns: ColumnDef<GeofenceAlertRow>[] = [
        {
            accessorKey: 'device_name',
            header: 'Device',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">
                        {row.original.device_name}
                    </div>
                    <Badge
                        variant="outline"
                        className="mt-0.5 text-xs capitalize"
                    >
                        {row.original.unit_type}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: 'geofence_name',
            header: 'Zone',
            cell: ({ row }) => (
                <span className="text-sm">
                    {row.original.geofence_name ?? '—'}
                </span>
            ),
        },
        {
            accessorKey: 'event',
            header: 'Event',
            cell: ({ row }) =>
                row.original.event === 'enter' ? (
                    <Badge variant="secondary">Enter</Badge>
                ) : (
                    <Badge variant="outline">Exit</Badge>
                ),
        },
        {
            accessorKey: 'triggered_at',
            header: 'Triggered',
            cell: ({ row }) => (
                <span
                    className="text-sm text-muted-foreground"
                    title={row.original.triggered_at ?? ''}
                >
                    {row.original.triggered_at_human ?? '—'}
                </span>
            ),
        },
    ];

    const table = useReactTable({
        data: rows,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    return (
        <div className="flex flex-col gap-4">
            <FilterBar
                devices={devices}
                devEui={devEui}
                onDevEuiChange={setDevEui}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                onClear={handleClear}
                onApply={handleApply}
                loading={loading}
            />

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {h.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  h.column.columnDef.header,
                                                  h.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton cols={columns.length} />
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {loaded
                                        ? 'No geofence alerts found for the selected period.'
                                        : 'Apply filters to load the report.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        Page {table.getState().pagination.pageIndex + 1} of{' '}
                        {Math.max(1, table.getPageCount())}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="gap-1.5"
                    disabled={!loaded}
                >
                    <Download className="h-4 w-4" />
                    Export Excel
                </Button>
            </div>
        </div>
    );
}

function SafetyMonitoringTab({ devices }: { devices: DeviceOption[] }) {
    return (
        <div className="flex flex-col gap-6">
            <div>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase">
                    Overspeed Violations
                </h3>
                <SpeedViolationsTab devices={devices} />
            </div>
            <div>
                <h3 className="mb-3 text-sm font-semibold text-muted-foreground uppercase">
                    Geofence Alerts
                </h3>
                <GeofenceAlertsTable devices={devices} />
            </div>
        </div>
    );
}

function CycleTimeTab({ devices }: { devices: DeviceOption[] }) {
    const [devEui, setDevEui] = useUrlFilter('dev_eui', 'all');
    const [dateFrom, setDateFrom] = useUrlFilter('from', today);
    const [dateTo, setDateTo] = useUrlFilter('to', today);
    const [trips, setTrips] = useState<TripRow[]>([]);
    const [summary, setSummary] = useState<TripSummary[]>([]);
    const [warning, setWarning] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);

    const fetchData = useCallback(
        async (dEui: string, from: string, to: string) => {
            setLoading(true);
            setWarning(null);

            try {
                const params: Record<string, string> = { from, to };

                if (dEui !== 'all') {
                    params.dev_eui = dEui;
                }

                const res = await fetch(
                    adminReports.cycleTime.url() + buildQueryString(params),
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );
                const json = await res.json();
                setTrips(json.trips ?? []);
                setSummary(json.summary ?? []);
                setWarning(json.warning ?? null);
                setLoaded(true);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchData(devEui, dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchData(devEui, dateFrom, dateTo);
    const handleClear = () => {
        setDevEui('all');
        setDateFrom(today);
        setDateTo(today);
        setTrips([]);
        setSummary([]);
        setWarning(null);
        setLoaded(false);
    };

    const handleExportExcel = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.cycleTime.url() + buildQueryString(params);
    };

    const columns: ColumnDef<TripRow>[] = [
        {
            accessorKey: 'device_name',
            header: 'Device',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">
                        {row.original.device_name}
                    </div>
                    <Badge
                        variant="outline"
                        className="mt-0.5 text-xs capitalize"
                    >
                        {row.original.unit_type}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: 'load_start',
            header: 'Load Start',
            cell: ({ row }) => (
                <div className="text-sm tabular-nums">
                    <div className="font-medium text-foreground">
                        {formatTime(row.original.load_start)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {new Date(row.original.load_start).toLocaleDateString()}
                    </div>
                </div>
            ),
        },
        {
            accessorKey: 'dump_start',
            header: 'Dump Start',
            cell: ({ row }) => (
                <div className="text-sm font-medium text-foreground tabular-nums">
                    {formatTime(row.original.dump_start)}
                </div>
            ),
        },
        {
            accessorKey: 'haul_duration_min',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Haul Time <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                    {formatMin(row.original.haul_duration_min)}
                </span>
            ),
        },
        {
            accessorKey: 'return_duration_min',
            header: 'Return Time',
            cell: ({ row }) => (
                <span className="text-muted-foreground tabular-nums">
                    {formatMin(row.original.return_duration_min)}
                </span>
            ),
        },
        {
            accessorKey: 'cycle_duration_min',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Cycle Time <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-semibold text-primary tabular-nums">
                    {formatMin(row.original.cycle_duration_min)}
                </span>
            ),
        },
        {
            accessorKey: 'distance_km',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Distance <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.distance_km !== null
                        ? `${row.original.distance_km} km`
                        : '—'}
                </span>
            ),
        },
        {
            accessorKey: 'avg_speed_kmh',
            header: 'Avg Speed',
            cell: ({ row }) => (
                <span className="text-muted-foreground tabular-nums">
                    {row.original.avg_speed_kmh !== null
                        ? `${row.original.avg_speed_kmh} km/h`
                        : '—'}
                </span>
            ),
        },
    ];

    const table = useReactTable({
        data: trips,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    return (
        <div className="flex flex-col gap-4">
            <FilterBar
                devices={devices}
                devEui={devEui}
                onDevEuiChange={setDevEui}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                onClear={handleClear}
                onApply={handleApply}
                loading={loading}
            />

            {warning && (
                <div className="rounded-md border border-status-warning/30 bg-status-warning-bg px-4 py-3 text-sm text-status-warning">
                    {warning}
                </div>
            )}

            {/* Per-device summary cards */}
            {loaded && summary.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {summary.map((s) => (
                        <Card key={s.dev_eui}>
                            <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-semibold">
                                        {s.device_name}
                                    </CardTitle>
                                    <Badge
                                        variant="outline"
                                        className="capitalize"
                                    >
                                        {s.unit_type}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div>
                                        <p className="text-2xl font-bold text-primary tabular-nums">
                                            {s.trip_count}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Trips
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-semibold tabular-nums">
                                            {formatMin(s.avg_haul_min)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Avg Haul
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xl font-semibold tabular-nums">
                                            {formatMin(s.avg_cycle_min)}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Avg Cycle
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Trip detail table */}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {h.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  h.column.columnDef.header,
                                                  h.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton cols={columns.length} />
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-32 text-center"
                                >
                                    <div className="flex flex-col items-center gap-1 text-muted-foreground">
                                        <p className="text-sm">
                                            {loaded
                                                ? 'No completed trips detected. Make sure Loading and Dumping geofence zones are configured.'
                                                : 'Apply filters to detect trips.'}
                                        </p>
                                        {loaded && (
                                            <p className="text-xs">
                                                A trip is detected when a device
                                                visits a Loading zone then a
                                                Dumping zone.
                                            </p>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of{' '}
                    {Math.max(1, table.getPageCount())}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="ml-auto gap-1.5"
                    disabled={!loaded}
                >
                    <Download className="h-4 w-4" />
                    Export Excel
                </Button>
            </div>
        </div>
    );
}

function DelayWaitingTab({ devices }: { devices: DeviceOption[] }) {
    const [devEui, setDevEui] = useUrlFilter('dev_eui', 'all');
    const [dateFrom, setDateFrom] = useUrlFilter('from', today);
    const [dateTo, setDateTo] = useUrlFilter('to', today);
    const [stops, setStops] = useState<StopRow[]>([]);
    const [summary, setSummary] = useState<StopSummary[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);

    const fetchData = useCallback(
        async (dEui: string, from: string, to: string) => {
            setLoading(true);

            try {
                const params: Record<string, string> = { from, to };

                if (dEui !== 'all') {
                    params.dev_eui = dEui;
                }

                const res = await fetch(
                    adminReports.delayWaiting.url() + buildQueryString(params),
                    {
                        headers: {
                            Accept: 'application/json',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    },
                );
                const json = await res.json();
                setStops(json.stops ?? []);
                setSummary(json.summary ?? []);
                setLoaded(true);
            } finally {
                setLoading(false);
            }
        },
        [],
    );

    useEffect(() => {
        fetchData(devEui, dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchData(devEui, dateFrom, dateTo);
    const handleClear = () => {
        setDevEui('all');
        setDateFrom(today);
        setDateTo(today);
        setStops([]);
        setSummary([]);
        setLoaded(false);
    };

    const handleExportExcel = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.delayWaiting.url() + buildQueryString(params);
    };

    const columns: ColumnDef<StopRow>[] = [
        {
            accessorKey: 'device_name',
            header: 'Device',
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">
                        {row.original.device_name}
                    </div>
                    <Badge
                        variant="outline"
                        className="mt-0.5 text-xs capitalize"
                    >
                        {row.original.unit_type}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: 'type',
            header: 'Type',
            cell: ({ row }) =>
                row.original.type === 'waiting' ? (
                    <Badge variant="warning" className="capitalize">
                        Waiting
                    </Badge>
                ) : (
                    <Badge variant="danger" className="capitalize">
                        Delay
                    </Badge>
                ),
        },
        {
            accessorKey: 'zone',
            header: 'Zone',
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground capitalize">
                    {row.original.zone.replace('_', ' ')}
                </span>
            ),
        },
        {
            accessorKey: 'started_at',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Started <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span
                    className="text-sm text-muted-foreground"
                    title={row.original.started_at}
                >
                    {formatTime(row.original.started_at)}
                </span>
            ),
        },
        {
            accessorKey: 'duration_min',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Duration <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                    {formatMin(row.original.duration_min)}
                </span>
            ),
        },
    ];

    const table = useReactTable({
        data: stops,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    return (
        <div className="flex flex-col gap-4">
            <FilterBar
                devices={devices}
                devEui={devEui}
                onDevEuiChange={setDevEui}
                dateFrom={dateFrom}
                onDateFromChange={setDateFrom}
                dateTo={dateTo}
                onDateToChange={setDateTo}
                onClear={handleClear}
                onApply={handleApply}
                loading={loading}
            />

            {loaded && summary.length > 0 && (
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">
                            Per-Device Summary
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Device</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Waiting Stops</TableHead>
                                    <TableHead>Waiting Time</TableHead>
                                    <TableHead>Delay Stops</TableHead>
                                    <TableHead>Delay Time</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {summary.map((s) => (
                                    <TableRow key={s.dev_eui}>
                                        <TableCell className="font-medium">
                                            {s.device_name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className="capitalize"
                                            >
                                                {s.unit_type}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {s.waiting_count}
                                        </TableCell>
                                        <TableCell className="text-status-warning tabular-nums">
                                            {formatMin(s.waiting_min)}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {s.delay_count}
                                        </TableCell>
                                        <TableCell className="text-status-danger tabular-nums">
                                            {formatMin(s.delay_min)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {h.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  h.column.columnDef.header,
                                                  h.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton cols={columns.length} />
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {loaded
                                        ? 'No waiting or delay stops found for the selected period.'
                                        : 'Apply filters to load the report.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of{' '}
                    {Math.max(1, table.getPageCount())}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="ml-auto gap-1.5"
                    disabled={!loaded}
                >
                    <Download className="h-4 w-4" />
                    Export Excel
                </Button>
            </div>
        </div>
    );
}

function GatewayReliabilityTab() {
    const [dateFrom, setDateFrom] = useUrlFilter('from', firstOfMonth);
    const [dateTo, setDateTo] = useUrlFilter('to', today);
    const [rows, setRows] = useState<GatewayRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);

    const fetchData = useCallback(async (from: string, to: string) => {
        setLoading(true);

        try {
            const params: Record<string, string> = { from, to };
            const res = await fetch(
                adminReports.gatewayReliability.url() +
                    buildQueryString(params),
                {
                    headers: {
                        Accept: 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    },
                },
            );
            const json = await res.json();
            setRows(json.data ?? []);
            setLoaded(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData(dateFrom, dateTo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleApply = () => fetchData(dateFrom, dateTo);
    const handleClear = () => {
        setDateFrom(firstOfMonth);
        setDateTo(today);
        setRows([]);
        setLoaded(false);
    };

    const handleExportExcel = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };
        window.location.href =
            adminReports.export.gatewayReliability.url() +
            buildQueryString(params);
    };

    const columns: ColumnDef<GatewayRow>[] = [
        {
            accessorKey: 'gateway_id',
            header: 'Gateway ID',
            cell: ({ row }) => (
                <span className="font-mono text-sm font-medium">
                    {row.original.gateway_id}
                </span>
            ),
        },
        {
            accessorKey: 'uplink_count',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Uplinks <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="font-medium tabular-nums">
                    {row.original.uplink_count.toLocaleString()}
                </span>
            ),
        },
        {
            accessorKey: 'device_count',
            header: 'Devices Served',
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.device_count}
                </span>
            ),
        },
        {
            accessorKey: 'avg_rssi',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() =>
                        column.toggleSorting(column.getIsSorted() === 'asc')
                    }
                >
                    Avg RSSI <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="tabular-nums">
                    {row.original.avg_rssi} dBm
                </span>
            ),
        },
        {
            accessorKey: 'min_rssi',
            header: 'RSSI Range',
            cell: ({ row }) => (
                <span className="text-muted-foreground tabular-nums">
                    {row.original.min_rssi} … {row.original.max_rssi} dBm
                </span>
            ),
        },
        {
            accessorKey: 'avg_snr',
            header: 'Avg SNR',
            cell: ({ row }) => (
                <span className="tabular-nums">{row.original.avg_snr} dB</span>
            ),
        },
        {
            accessorKey: 'last_seen',
            header: 'Last Seen',
            cell: ({ row }) => (
                <span
                    className="text-sm text-muted-foreground"
                    title={row.original.last_seen}
                >
                    {new Date(row.original.last_seen).toLocaleString()}
                </span>
            ),
        },
    ];

    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                        From date
                    </Label>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="w-40"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">
                        To date
                    </Label>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-40"
                    />
                </div>
                <Button
                    onClick={handleApply}
                    disabled={loading}
                    size="sm"
                    className="gap-1.5 self-end"
                >
                    <RefreshCw
                        className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
                    />
                    {loading ? 'Loading…' : 'Apply'}
                </Button>
                {(dateFrom !== firstOfMonth || dateTo !== today) && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="gap-1 self-end"
                    >
                        <X className="h-3.5 w-3.5" />
                        Reset
                    </Button>
                )}
            </div>

            {loaded && rows.length > 0 && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Active Gateways</CardDescription>
                            <CardTitle className="text-2xl tabular-nums">
                                {rows.length}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Total Uplinks</CardDescription>
                            <CardTitle className="text-2xl tabular-nums">
                                {rows
                                    .reduce((s, r) => s + r.uplink_count, 0)
                                    .toLocaleString()}
                            </CardTitle>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardDescription>Avg RSSI (fleet)</CardDescription>
                            <CardTitle className="text-2xl tabular-nums">
                                {(
                                    rows.reduce((s, r) => s + r.avg_rssi, 0) /
                                    rows.length
                                ).toFixed(1)}{' '}
                                dBm
                            </CardTitle>
                        </CardHeader>
                    </Card>
                </div>
            )}

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((h) => (
                                    <TableHead key={h.id}>
                                        {h.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  h.column.columnDef.header,
                                                  h.getContext(),
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableSkeleton cols={columns.length} />
                        ) : table.getRowModel().rows.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center text-muted-foreground"
                                >
                                    {loaded
                                        ? 'No gateway activity found for the selected period.'
                                        : 'Apply filters to load the report.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.previousPage()}
                    disabled={!table.getCanPreviousPage()}
                >
                    Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                    Page {table.getState().pagination.pageIndex + 1} of{' '}
                    {Math.max(1, table.getPageCount())}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => table.nextPage()}
                    disabled={!table.getCanNextPage()}
                >
                    Next
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="ml-auto gap-1.5"
                    disabled={!loaded}
                >
                    <Download className="h-4 w-4" />
                    Export Excel
                </Button>
            </div>
        </div>
    );
}

function ExportTab({ devices }: { devices: DeviceOption[] }) {
    const [devEui, setDevEui] = useState('all');
    const [dateFrom, setDateFrom] = useState(firstOfMonth);
    const [dateTo, setDateTo] = useState(today);
    const [alertType, setAlertType] = useState('all');

    const exportGpsLogs = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        window.location.href =
            adminReports.export.gpsLogs.url() + buildQueryString(params);
    };

    const exportAlerts = () => {
        const params: Record<string, string> = { from: dateFrom, to: dateTo };

        if (devEui !== 'all') {
            params.dev_eui = devEui;
        }

        if (alertType !== 'all') {
            params.alert_type = alertType;
        }

        window.location.href =
            adminReports.export.alerts.url() + buildQueryString(params);
    };

    return (
        <div className="flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base">Export Filters</CardTitle>
                    <CardDescription>
                        Set the date range and device for your exports.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">
                                Device
                            </Label>
                            <Select value={devEui} onValueChange={setDevEui}>
                                <SelectTrigger className="w-52">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All devices
                                    </SelectItem>
                                    {devices.map((d) => (
                                        <SelectItem
                                            key={d.dev_eui}
                                            value={d.dev_eui}
                                        >
                                            {d.device_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">
                                From date
                            </Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-40"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">
                                To date
                            </Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-40"
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base">
                                GPS Log Export
                            </CardTitle>
                        </div>
                        <CardDescription>
                            Export all GPS tracking data including coordinates,
                            speed, heading, and signal quality for the selected
                            period.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4 text-xs text-muted-foreground">
                            Columns: Device Name, DEV EUI, Unit Type, Latitude,
                            Longitude, Speed, Heading, HDOP, Satellites, RSSI,
                            SNR, Recorded At
                        </p>
                        <Button
                            onClick={exportGpsLogs}
                            className="w-full gap-2"
                        >
                            <Download className="h-4 w-4" />
                            Download GPS Logs CSV
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Gauge className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-base">
                                Alert Export
                            </CardTitle>
                        </div>
                        <CardDescription>
                            Export alert events including speed violations,
                            geofence events, and offline alerts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="mb-4 flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">
                                Alert Type
                            </Label>
                            <Select
                                value={alertType}
                                onValueChange={setAlertType}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">
                                        All types
                                    </SelectItem>
                                    <SelectItem value="overspeed">
                                        Overspeed
                                    </SelectItem>
                                    <SelectItem value="geofence">
                                        Geofence
                                    </SelectItem>
                                    <SelectItem value="offline">
                                        Offline
                                    </SelectItem>
                                    <SelectItem value="low_signal">
                                        Low Signal
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={exportAlerts} className="w-full gap-2">
                            <Download className="h-4 w-4" />
                            Download Alerts CSV
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function ReportsIndex({ devices, tilesets }: PageProps) {
    const [activeTab, setActiveTab] = useUrlFilter('tab', 'raw-gps');

    return (
        <>
            <Head title="Reports & Export" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">
                        Reports & Export
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Raw GPS tracker data plus tracking, productivity,
                        safety, maintenance, performance, and infrastructure
                        analytics.
                    </p>
                </div>

                <Tabs
                    value={activeTab}
                    onValueChange={setActiveTab}
                    className="flex flex-col gap-4"
                >
                    <TabsList className="h-auto w-fit flex-wrap">
                        <TabsTrigger value="raw-gps">Raw GPS Data</TabsTrigger>
                        <TabsTrigger value="tracking">
                            Tracking & Monitoring
                        </TabsTrigger>
                        <TabsTrigger value="productivity">
                            Productivity
                        </TabsTrigger>
                        <TabsTrigger value="safety">
                            Safety Monitoring
                        </TabsTrigger>
                        <TabsTrigger value="maintenance">
                            Maintenance Insight
                        </TabsTrigger>
                        <TabsTrigger value="performance">
                            Performance Analysis
                        </TabsTrigger>
                        <TabsTrigger value="infrastructure">
                            Infrastructure Coverage
                        </TabsTrigger>
                        <TabsTrigger value="export">Export Data</TabsTrigger>
                    </TabsList>

                    <TabsContent value="raw-gps">
                        <RawGpsDataTab devices={devices} />
                    </TabsContent>

                    <TabsContent value="tracking">
                        <TrackingMonitoringTab
                            devices={devices}
                            tilesets={tilesets}
                        />
                    </TabsContent>

                    <TabsContent value="productivity">
                        <CycleTimeTab devices={devices} />
                    </TabsContent>

                    <TabsContent value="safety">
                        <SafetyMonitoringTab devices={devices} />
                    </TabsContent>

                    <TabsContent value="maintenance">
                        <FleetUtilizationTab devices={devices} />
                    </TabsContent>

                    <TabsContent value="performance">
                        <DelayWaitingTab devices={devices} />
                    </TabsContent>

                    <TabsContent value="infrastructure">
                        <GatewayReliabilityTab />
                    </TabsContent>

                    <TabsContent value="export">
                        <ExportTab devices={devices} />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Reports & Export',
            href: adminReports.index.url(),
        },
    ],
};
