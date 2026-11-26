import { Link } from '@inertiajs/react';
import type L from 'leaflet';
import { ArrowRight, Minus, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { StatusBadge, ZoneBadge } from '@/components/orion/badges';
import { LastSeen } from '@/components/orion/misc';
import { UnitIcon } from '@/components/orion/unit-icon';
import { Checkbox } from '@/components/ui/checkbox';
import type { TimeRange } from '@/hooks/useRouteHistory';
import { unitMeta } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';
import { show as deviceShow } from '@/routes/admin/devices';
import type { DevicePosition } from '@/types/fleet';

/** Floating card chrome shared by every map overlay. */
export const MAP_CARD =
    'rounded-xl border bg-card text-card-foreground shadow-[0_4px_16px_oklch(0.3_0.03_250/0.12)] dark:shadow-[0_4px_16px_oklch(0_0_0/0.45)]';

const ROUTE_RANGES: TimeRange[] = ['1h', '3h', '6h', '24h'];

/** Small segmented control (aria-pressed buttons). */
export function Segmented<T extends string>({
    value,
    options,
    onChange,
    label,
    className,
}: {
    value: T;
    options: { value: T; label: ReactNode }[];
    onChange: (value: T) => void;
    label: string;
    className?: string;
}) {
    return (
        <div
            role="group"
            aria-label={label}
            className={cn('flex rounded-lg bg-muted p-1', className)}
        >
            {options.map((opt) => (
                <button
                    key={opt.value}
                    type="button"
                    aria-pressed={value === opt.value}
                    onClick={() => onChange(opt.value)}
                    className={cn(
                        'flex-1 rounded-md px-3 py-1 text-sm whitespace-nowrap text-muted-foreground tabular-nums transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
                        value === opt.value &&
                            'bg-card font-medium text-foreground shadow-sm',
                    )}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

/** Top-left card: route history window for the selected unit. */
export function RouteRangeCard({
    deviceName,
    value,
    onChange,
    loading,
}: {
    deviceName: string;
    value: TimeRange;
    onChange: (value: TimeRange) => void;
    loading: boolean;
}) {
    return (
        <div
            className={cn(
                MAP_CARD,
                'flex items-center gap-3 py-1.5 pr-1.5 pl-4',
            )}
        >
            <span className="truncate text-sm font-medium whitespace-nowrap">
                Route · {deviceName}
                {loading && (
                    <span className="sr-only"> (memuat riwayat rute)</span>
                )}
            </span>
            <Segmented
                label="Rentang riwayat rute"
                value={value}
                onChange={onChange}
                options={ROUTE_RANGES.map((r) => ({ value: r, label: r }))}
            />
        </div>
    );
}

export type BaseLayerOption = { id: string; label: string };

/** "Peta dasar" radio list + overlay checkboxes (desktop card / mobile popover body). */
export function LayersPanel({
    baseLayers,
    baseLayer,
    onBaseLayerChange,
    showGeofence,
    onShowGeofenceChange,
    showHeatmap,
    onShowHeatmapChange,
    heatmapRange,
    onHeatmapRangeChange,
    footer,
}: {
    baseLayers: BaseLayerOption[];
    baseLayer: string;
    onBaseLayerChange: (id: string) => void;
    showGeofence: boolean;
    onShowGeofenceChange: (value: boolean) => void;
    showHeatmap: boolean;
    onShowHeatmapChange: (value: boolean) => void;
    heatmapRange: '24h' | '7d';
    onHeatmapRangeChange: (value: '24h' | '7d') => void;
    footer?: ReactNode;
}) {
    return (
        <div className="flex w-60 flex-col gap-1 p-3 text-sm">
            <fieldset>
                <legend className="mb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Peta dasar
                </legend>
                {baseLayers.map((layer) => (
                    <label
                        key={layer.id}
                        className="flex min-h-9 cursor-pointer items-center gap-2.5"
                    >
                        <input
                            type="radio"
                            name="orion-base-layer"
                            value={layer.id}
                            checked={baseLayer === layer.id}
                            onChange={() => onBaseLayerChange(layer.id)}
                            className="size-4 accent-primary"
                        />
                        <span className="truncate">{layer.label}</span>
                    </label>
                ))}
            </fieldset>

            <div className="my-1 border-t" />

            <label className="flex min-h-9 cursor-pointer items-center gap-2.5">
                <Checkbox
                    checked={showGeofence}
                    onCheckedChange={(v) => onShowGeofenceChange(v === true)}
                />
                Geofence
            </label>
            <label className="flex min-h-9 cursor-pointer items-center gap-2.5">
                <Checkbox
                    checked={showHeatmap}
                    onCheckedChange={(v) => onShowHeatmapChange(v === true)}
                />
                Heatmap sinyal
            </label>
            {showHeatmap && (
                <Segmented
                    label="Rentang heatmap sinyal"
                    value={heatmapRange}
                    onChange={onHeatmapRangeChange}
                    options={[
                        { value: '24h', label: '24 jam' },
                        { value: '7d', label: '7 hari' },
                    ]}
                />
            )}
            {footer}
        </div>
    );
}

/** Bottom-left legend: speed bands (route) + ring meanings (markers). */
export function MapLegend({ className }: { className?: string }) {
    const bands = [
        { cls: 'bg-speed-slow', label: '0–15' },
        { cls: 'bg-speed-mod', label: '15–35' },
        { cls: 'bg-speed-fast', label: '>35 km/h' },
    ];

    return (
        <div
            className={cn(
                MAP_CARD,
                'flex items-center gap-4 px-4 py-2 text-sm whitespace-nowrap',
                className,
            )}
        >
            <span className="text-muted-foreground">Speed</span>
            {bands.map((b) => (
                <span key={b.label} className="flex items-center gap-1.5">
                    <span className={cn('h-1 w-5 rounded-full', b.cls)} />
                    <span className="tabular-nums">{b.label}</span>
                </span>
            ))}
            <span className="h-5 border-l" aria-hidden />
            <span className="flex items-center gap-1.5">
                <span className="size-3.5 rounded-full border-2 border-online" />
                Online
            </span>
            <span className="flex items-center gap-1.5">
                <span className="size-3.5 rounded-full border-2 border-dashed border-offline" />
                Offline
            </span>
            <span className="flex items-center gap-1.5">
                <span className="size-3.5 rounded-full border-2 border-danger" />
                Alert
            </span>
        </div>
    );
}

/** Bottom-right zoom buttons (replaces Leaflet's default control); rendered outside the map so clicks never reach it. */
export function ZoomControls({
    map,
    className,
}: {
    map: L.Map | null;
    className?: string;
}) {
    const btn =
        'grid size-11 place-items-center text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';

    return (
        <div
            className={cn(MAP_CARD, 'flex flex-col overflow-hidden', className)}
        >
            <button
                type="button"
                className={btn}
                aria-label="Perbesar peta"
                onClick={() => map?.zoomIn()}
            >
                <Plus className="size-4" />
            </button>
            <span className="border-t" aria-hidden />
            <button
                type="button"
                className={btn}
                aria-label="Perkecil peta"
                onClick={() => map?.zoomOut()}
            >
                <Minus className="size-4" />
            </button>
        </div>
    );
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function compass(deg: number): string {
    return COMPASS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/** Marker popup body: identity, telemetry grid, gateway footer. */
export function UnitPopupContent({
    device,
    canOpenDetails,
    publicView = false,
}: {
    device: DevicePosition;
    canOpenDetails: boolean;
    /** Shared live map: hide EUI, radio and gateway details. */
    publicView?: boolean;
}) {
    const cat = unitMeta(device.unit_type);
    const isOnline = device.status === 'online';
    const dash = '—';

    const allCells: { label: string; value: ReactNode; mono?: boolean }[] = [
        { label: 'Speed', value: `${device.speed_kmh.toFixed(1)} km/h` },
        {
            label: 'Heading',
            value:
                device.heading_deg !== null
                    ? `${device.heading_deg}° ${compass(device.heading_deg)}`
                    : dash,
        },
        {
            label: 'RSSI / SNR',
            mono: true,
            value: `${device.rssi !== null ? `${device.rssi} dBm` : dash} · ${device.snr !== null ? device.snr.toFixed(1) : dash}`,
        },
        {
            label: 'HDOP · Sats',
            mono: true,
            value: `${device.hdop !== null ? device.hdop.toFixed(1) : dash} · ${device.satellites ?? dash}`,
        },
    ];
    const cells = publicView ? allCells.slice(0, 2) : allCells;

    return (
        <div className="w-[280px] text-sm">
            <div className="flex items-center gap-3 border-b px-4 py-3">
                <UnitIcon type={cat.key} size={30} muted={!isOnline} />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                        {device.device_name}
                        {device.unit_model && ` ${device.unit_model}`}
                    </p>
                    {!publicView && (
                        <p className="truncate font-mono text-xs text-muted-foreground">
                            {device.dev_eui}
                        </p>
                    )}
                </div>
                <StatusBadge online={isOnline} />
            </div>

            {device.zone && (
                <div className="border-b px-4 py-2">
                    <ZoneBadge zone={device.zone} />
                    <span className="ml-2 text-xs text-muted-foreground">
                        {device.zone.name}
                    </span>
                </div>
            )}

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3">
                {cells.map((c) => (
                    <div key={c.label}>
                        <dt className="text-xs text-muted-foreground">
                            {c.label}
                        </dt>
                        <dd
                            className={cn(
                                'tabular-nums',
                                c.mono ? 'font-mono text-xs' : 'font-semibold',
                            )}
                        >
                            {c.value}
                        </dd>
                    </div>
                ))}
                <div className="col-span-2">
                    <dt className="text-xs text-muted-foreground">Position</dt>
                    <dd className="font-mono text-xs tabular-nums">
                        {device.latitude.toFixed(5)},{' '}
                        {device.longitude.toFixed(5)}
                    </dd>
                </div>
            </dl>

            <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground">
                <span className="truncate">
                    {device.gateway_id && !publicView
                        ? `via ${device.gateway_id} · `
                        : ''}
                    {device.recorded_at ? (
                        <LastSeen at={device.recorded_at} />
                    ) : (
                        'No GPS fix'
                    )}
                </span>
                {canOpenDetails && device.id !== undefined && (
                    <Link
                        href={deviceShow(device.id)}
                        className="inline-flex shrink-0 items-center gap-1 font-medium text-primary underline-offset-2 hover:underline"
                    >
                        Details <ArrowRight className="size-3" />
                    </Link>
                )}
            </div>
        </div>
    );
}
