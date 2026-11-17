import 'leaflet/dist/leaflet.css';

import { Deferred, Head, Link } from '@inertiajs/react';
import L from 'leaflet';
import { Download, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import { DeviceDialog } from '@/components/admin/device-form-dialog';
import type {
    AdminDevice,
    DeviceGroupRef,
} from '@/components/admin/device-form-dialog';
import { Segmented } from '@/components/Fleet/map-overlays';
import { RouteHistoryLayer } from '@/components/Fleet/RouteHistoryLayer';
import { ConditionBadge, StatusBadge } from '@/components/orion/badges';
import { unitMarkerIcon } from '@/components/orion/map-marker';
import { LastSeen } from '@/components/orion/misc';
import { UnitIcon } from '@/components/orion/unit-icon';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppearance } from '@/hooks/use-appearance';
import { useRouteHistory } from '@/hooks/useRouteHistory';
import type { TimeRange } from '@/hooks/useRouteHistory';
import { toUnitType, unitMeta } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';
import { index as adminDevicesIndex } from '@/routes/admin/devices';
import { gpsLogs as exportGpsLogs } from '@/routes/admin/reports/export';
import fleet from '@/routes/fleet';

type DeviceDetail = AdminDevice & {
    group_name: string | null;
    last_gateway: string | null;
    created_at: string | null;
};

type GpsLogRow = {
    recorded_at: string;
    latitude: number;
    longitude: number;
    speed_kmh: number | null;
    heading_deg: number | null;
    rssi: number | null;
    snr: number | null;
    satellites: number | null;
    hdop: number | null;
    gateway_id: string | null;
};

type DeviceStats = {
    distance_km: number | null;
    running_hours: number | null;
    idle_hours: number | null;
    cycles: number;
    avg_cycle_min: number | null;
    alerts: number;
};

type PageProps = {
    device: DeviceDetail;
    gpsLogs: GpsLogRow[];
    overspeedThreshold: number | null;
    stats?: DeviceStats;
    groups: DeviceGroupRef[];
};

const ROUTE_RANGES: TimeRange[] = ['1h', '3h', '6h', '24h'];
const LOG_ROWS = 50;
const dash = '—';

/** 24 h WIB clock, e.g. 14:32:48. */
function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour12: false,
    });
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function StatTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums md:text-2xl">
                {value}
            </p>
        </div>
    );
}

function StatTiles({
    speedNow,
    stats,
}: {
    speedNow: string;
    stats: DeviceStats;
}) {
    const hours = (h: number | null) => (h === null ? dash : `${h} h`);

    return (
        <>
            <StatTile label="Speed now" value={speedNow} />
            <StatTile
                label="Distance today"
                value={
                    stats.distance_km === null
                        ? dash
                        : `${stats.distance_km} km`
                }
            />
            <StatTile
                label="Running / idle"
                value={`${hours(stats.running_hours)} / ${hours(stats.idle_hours)}`}
            />
            <StatTile label="Cycles today" value={String(stats.cycles)} />
            <StatTile
                label="Avg cycle time"
                value={
                    stats.avg_cycle_min === null
                        ? dash
                        : `${Math.round(stats.avg_cycle_min)} min`
                }
            />
            <StatTile label="Alerts today" value={String(stats.alerts)} />
        </>
    );
}

/** Keeps the mini-map framed on the route (or the unit when there is no route yet). */
function FitRoute({
    points,
    fallback,
}: {
    points: [number, number][];
    fallback: [number, number];
}) {
    const map = useMap();
    const [lat, lng] = fallback;

    useEffect(() => {
        if (points.length >= 2) {
            map.fitBounds(L.latLngBounds(points), {
                padding: [32, 32],
                maxZoom: 18,
            });
        } else {
            map.setView([lat, lng], 17);
        }
    }, [map, points, lat, lng]);

    return null;
}

function RouteCard({
    device,
    latest,
}: {
    device: DeviceDetail;
    latest: GpsLogRow | undefined;
}) {
    const [range, setRange] = useState<TimeRange>('3h');
    const { points, loading } = useRouteHistory(device.dev_eui, range);
    const { resolvedAppearance } = useAppearance();
    const routeLatLngs = useMemo(
        () => points.map((p) => [p.latitude, p.longitude] as [number, number]),
        [points],
    );
    const icon = useMemo(
        () =>
            unitMarkerIcon({
                type: toUnitType(device.unit_type),
                status: device.status,
                heading: latest?.heading_deg,
                dark: resolvedAppearance === 'dark',
                size: 34,
            }),
        [device.unit_type, device.status, latest, resolvedAppearance],
    );

    return (
        <section className="flex min-h-[360px] flex-col overflow-hidden rounded-xl border bg-card">
            <div className="flex items-center justify-between gap-3 px-5 py-3">
                <h2 className="font-semibold">
                    Route · last {range.replace('h', ' h')}
                    {loading && <span className="sr-only"> (memuat)</span>}
                </h2>
                <Segmented
                    label="Rentang riwayat rute"
                    value={range}
                    onChange={setRange}
                    options={ROUTE_RANGES.map((r) => ({ value: r, label: r }))}
                />
            </div>
            <div className="relative isolate min-h-[300px] flex-1 bg-muted">
                {latest ? (
                    <MapContainer
                        center={[latest.latitude, latest.longitude]}
                        zoom={17}
                        zoomControl={false}
                        attributionControl={false}
                        style={{ position: 'absolute', inset: 0 }}
                    >
                        <TileLayer
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            maxZoom={19}
                        />
                        <FitRoute
                            points={routeLatLngs}
                            fallback={[latest.latitude, latest.longitude]}
                        />
                        <RouteHistoryLayer points={points} />
                        <Marker
                            position={[latest.latitude, latest.longitude]}
                            icon={icon}
                        />
                    </MapContainer>
                ) : (
                    <p className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
                        Belum ada posisi GPS untuk unit ini.
                    </p>
                )}
            </div>
        </section>
    );
}

export default function DeviceShow({
    device,
    gpsLogs,
    overspeedThreshold,
    stats,
    groups,
}: PageProps) {
    const [editing, setEditing] = useState(false);
    const cat = unitMeta(device.unit_type);
    const online = device.status === 'online';
    const latest = gpsLogs[0];
    const speedNow =
        online && latest?.speed_kmh != null
            ? `${latest.speed_kmh.toFixed(1)} km/h`
            : dash;
    const isOver = (kmh: number | null) =>
        kmh !== null && overspeedThreshold !== null && kmh > overspeedThreshold;

    const info: { label: string; value: ReactNode; mono?: boolean }[] = [
        { label: 'Device EUI', value: device.dev_eui, mono: true },
        { label: 'Category', value: cat.label },
        { label: 'Model', value: device.unit_model ?? dash },
        { label: 'Group / site', value: device.group_name ?? dash },
        {
            label: 'Condition',
            value: (
                <span className="capitalize">{device.operational_status}</span>
            ),
        },
        { label: 'Active', value: device.is_active ? 'Yes' : 'No' },
        {
            label: 'Last gateway',
            value: device.last_gateway ?? dash,
            mono: true,
        },
        {
            label: 'Registered',
            value: device.created_at ? formatDate(device.created_at) : dash,
        },
    ];

    const [exportFrom] = useState(() =>
        new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10),
    );

    return (
        <>
            <Head title={device.device_name} />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <UnitIcon
                            type={cat.key}
                            variant="tile"
                            size={64}
                            muted={!online}
                        />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                                    {device.device_name}
                                    {device.unit_model &&
                                        ` ${device.unit_model}`}
                                </h1>
                                <StatusBadge online={online} />
                                <ConditionBadge
                                    condition={device.operational_status}
                                />
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {[
                                    cat.label,
                                    device.unit_model,
                                    device.group_name,
                                ]
                                    .filter(Boolean)
                                    .join(' · ')}
                                {' · '}
                                {device.last_seen_at ? (
                                    <>
                                        last uplink{' '}
                                        <LastSeen at={device.last_seen_at} />
                                    </>
                                ) : (
                                    'no uplink yet'
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            asChild
                            className="h-11 flex-1 md:h-10 md:flex-none"
                        >
                            <Link
                                href={fleet.map.url({
                                    query: { device: device.dev_eui },
                                })}
                            >
                                <MapIcon className="size-4" /> Show on map
                            </Link>
                        </Button>
                        <Button
                            onClick={() => setEditing(true)}
                            className="h-11 flex-1 md:h-10 md:flex-none"
                        >
                            Edit device
                        </Button>
                    </div>
                </header>

                <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <Deferred
                        data="stats"
                        fallback={Array.from({ length: 6 }, (_, i) => (
                            <Skeleton key={i} className="h-[76px] rounded-xl" />
                        ))}
                    >
                        {stats && (
                            <StatTiles speedNow={speedNow} stats={stats} />
                        )}
                    </Deferred>
                </div>

                <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                    <section className="rounded-xl border bg-card px-5 py-4">
                        <h2 className="mb-2 font-semibold">Device info</h2>
                        <dl>
                            {info.map((row) => (
                                <div
                                    key={row.label}
                                    className="flex items-center justify-between gap-4 border-t py-3 text-sm"
                                >
                                    <dt className="text-muted-foreground">
                                        {row.label}
                                    </dt>
                                    <dd
                                        className={cn(
                                            'text-right font-medium',
                                            row.mono && 'font-mono text-xs',
                                        )}
                                    >
                                        {row.value}
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    <RouteCard device={device} latest={latest} />
                </div>

                <section className="overflow-hidden rounded-xl border bg-card">
                    <div className="flex items-center justify-between gap-3 px-5 py-4">
                        <h2 className="font-semibold">Recent GPS logs</h2>
                        <a
                            href={exportGpsLogs.url({
                                query: {
                                    dev_eui: device.dev_eui,
                                    from: exportFrom,
                                },
                            })}
                            className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-2 hover:underline md:min-h-0"
                        >
                            <Download className="size-4" /> Export CSV
                        </a>
                    </div>
                    {gpsLogs.length === 0 ? (
                        <p className="border-t p-6 text-center text-sm text-muted-foreground">
                            Belum ada log GPS.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm whitespace-nowrap">
                                <thead className="bg-sidebar text-muted-foreground">
                                    <tr className="h-[38px] text-right [&>th]:px-4 [&>th]:font-medium">
                                        <th className="pl-5! text-left">
                                            Recorded at
                                        </th>
                                        <th className="text-left">
                                            Coordinates
                                        </th>
                                        <th>Speed</th>
                                        <th>Heading</th>
                                        <th>HDOP</th>
                                        <th>Sats</th>
                                        <th>RSSI</th>
                                        <th>SNR</th>
                                        <th className="pr-5!">Gateway</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gpsLogs.slice(0, LOG_ROWS).map((log) => (
                                        <tr
                                            key={log.recorded_at}
                                            className="h-11 border-t text-right tabular-nums [&>td]:px-4"
                                        >
                                            <td className="pl-5! text-left">
                                                {formatTime(log.recorded_at)}
                                            </td>
                                            <td className="text-left font-mono text-xs">
                                                {log.latitude.toFixed(5)},{' '}
                                                {log.longitude.toFixed(5)}
                                            </td>
                                            <td
                                                className={cn(
                                                    isOver(log.speed_kmh) &&
                                                        'font-semibold text-danger',
                                                )}
                                            >
                                                {log.speed_kmh === null
                                                    ? dash
                                                    : `${log.speed_kmh.toFixed(1)} km/h`}
                                            </td>
                                            <td>
                                                {log.heading_deg === null
                                                    ? dash
                                                    : `${log.heading_deg}°`}
                                            </td>
                                            <td>
                                                {log.hdop === null
                                                    ? dash
                                                    : log.hdop.toFixed(1)}
                                            </td>
                                            <td>{log.satellites ?? dash}</td>
                                            <td className="font-mono text-xs">
                                                {log.rssi === null
                                                    ? dash
                                                    : `${log.rssi} dBm`}
                                            </td>
                                            <td className="font-mono text-xs">
                                                {log.snr === null
                                                    ? dash
                                                    : log.snr.toFixed(1)}
                                            </td>
                                            <td className="pr-5! font-mono text-xs text-muted-foreground">
                                                {log.gateway_id ?? dash}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <DeviceDialog
                device={device}
                groups={groups}
                open={editing}
                onOpenChange={setEditing}
            />
        </>
    );
}

DeviceShow.layout = {
    breadcrumbs: [
        { title: 'Device Management', href: adminDevicesIndex() },
        { title: 'Device Detail' },
    ],
};
