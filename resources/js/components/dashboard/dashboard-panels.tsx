import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { AlertTypeBadge } from '@/components/orion/badges';
import type { AlertType, Condition } from '@/components/orion/badges';
import { KpiTile } from '@/components/orion/kpi-tile';
import { UnitIcon } from '@/components/orion/unit-icon';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import type { ChartConfig } from '@/components/ui/chart';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useNow } from '@/hooks/use-tick';
import { signalQuality } from '@/lib/orion/telemetry';
import { unitMeta } from '@/lib/orion/unit-types';
import { formatRelativeTime } from '@/lib/time';
import { cn } from '@/lib/utils';
import adminAlerts from '@/routes/admin/alerts';
import type { Auth } from '@/types';
import type { UnitCategory } from '@/types/fleet';

/* ------------------------------------------------------------------ */
/* Types (mirror App\Services\DashboardService)                        */
/* ------------------------------------------------------------------ */

export type DashboardPeriod = 'today' | '7d' | '30d';
export type DashboardShift = 'all' | '1' | '2';

export type DashboardFilters = {
    group: number | null;
    period: DashboardPeriod;
    shift: DashboardShift;
    unit_type: UnitCategory | null;
    condition: Condition | null;
};

export type DashboardOptions = {
    groups: { id: number; name: string }[];
    unitTypes: { value: UnitCategory; label: string }[];
    conditions: Condition[];
};

export type DashboardHeroData = {
    total: number;
    online: number;
    site: string | null;
};

export type DashboardKpiData = {
    total: { value: number; delta: number; spark: number[] };
    online: { value: number; pct: number; spark: number[] };
    offline: { value: number; delta: number; spark: number[] };
    logs: { value: number; delta_pct: number | null; spark: number[] };
    lastHour: { value: number; rate_per_sec: number; spark: number[] };
};

export type DashboardSectionData = {
    tracking: { type: UnitCategory; online: number; total: number }[];
    safety: {
        counts: Record<AlertType, number>;
        topOverspeed: {
            device_name: string;
            events: number;
            max_speed: number | null;
        }[];
    };
    activeAlerts: {
        id: number;
        type: AlertType;
        device_name: string;
        speed_kmh: number | null;
        threshold_kmh: number | null;
        zone: string | null;
        event: string | null;
        triggered_at: string | null;
    }[];
    maintenance: {
        conditions: Record<Condition, number>;
        lowSignal: { device_name: string; avg_rssi: number; avg_snr: number }[];
    };
    productivity: {
        running_hours: number;
        idle_hours: number;
        utilization_pct: number | null;
        distance_km: number;
        avg_cycle_min: number | null;
    };
    infrastructure: {
        gateway_count: number;
        gateways: {
            gateway_id: string;
            avg_rssi: number;
            avg_snr: number;
            uplink_count: number;
        }[];
    };
    performance: { hour: string; avg_speed: number }[];
};

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

const NUMBER = new Intl.NumberFormat('en-US');
const DECIMAL = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmt = (n: number) => NUMBER.format(n);
const fmt1 = (n: number) => DECIMAL.format(n);
const signed = (n: number) =>
    n > 0 ? `+${fmt(n)}` : n < 0 ? `−${fmt(Math.abs(n))}` : '0';

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
    today: 'Hari ini',
    '7d': '7 hari',
    '30d': '30 hari',
};
const PERIOD_SEGMENT: Record<DashboardPeriod, string> = {
    today: 'Today',
    '7d': '7 days',
    '30d': '30 days',
};
const SHIFT_LABEL: Record<DashboardShift, string> = {
    all: 'Semua shift',
    '1': 'Shift 1',
    '2': 'Shift 2',
};
const CONDITION_LABEL: Record<Condition, string> = {
    operational: 'Operational',
    standby: 'Standby',
    breakdown: 'Breakdown',
};

const ALL = '__all';

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const WIB = 'Asia/Jakarta';

function greeting(now: number): string {
    const hour = Number(
        new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit',
            hour12: false,
            timeZone: WIB,
        }).format(now),
    );

    if (hour >= 4 && hour < 11) {
        return 'pagi';
    }

    if (hour >= 11 && hour < 15) {
        return 'siang';
    }

    if (hour >= 15 && hour < 18) {
        return 'sore';
    }

    return 'malam';
}

export function DashboardHero({ hero }: { hero: DashboardHeroData }) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const now = useNow(60_000);
    const date = new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: WIB,
    }).format(now);
    const firstName = auth.user.name.split(' ')[0];

    return (
        <section className="relative isolate h-[180px] overflow-hidden rounded-[20px] md:h-[260px]">
            <img
                src="/images/orion/hero-site.jpg"
                alt=""
                className="absolute inset-0 -z-10 size-full object-cover"
            />
            <div
                aria-hidden
                className="absolute inset-0 -z-10"
                style={{
                    background:
                        'linear-gradient(90deg, oklch(0.18 0.03 240 / 0.78), oklch(0.18 0.03 240 / 0) 75%), linear-gradient(0deg, oklch(0.18 0.03 240 / 0.5), oklch(0.18 0.03 240 / 0) 60%)',
                }}
            />
            <div className="flex h-full flex-col justify-end gap-1 p-5 text-white md:px-[54px] md:pb-12">
                <p className="text-[13px] font-medium md:text-sm">
                    {date} · {hero.site ?? 'Semua site'} · {fmt(hero.total)}{' '}
                    Unit
                </p>
                <h1 className="text-[32px] leading-tight font-bold tracking-tight md:text-[44px]">
                    Fleet Overview
                </h1>
                <p className="text-sm md:text-base">
                    Selamat {greeting(now)}, {firstName} ·{' '}
                    <span
                        aria-hidden
                        className="inline-block size-2 rounded-full bg-online align-middle"
                    />{' '}
                    <span className="tabular-nums">{fmt(hero.online)}</span>{' '}
                    unit online
                </p>
            </div>
        </section>
    );
}

/* ------------------------------------------------------------------ */
/* Filters                                                             */
/* ------------------------------------------------------------------ */

function FilterPill({
    label,
    active,
    value,
    options,
    onSelect,
    ariaLabel,
}: {
    label: string;
    active: boolean;
    value: string;
    options: { value: string; label: string }[];
    onSelect: (value: string) => void;
    ariaLabel: string;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={ariaLabel}
                className={cn(
                    'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none md:h-10',
                    active
                        ? 'bg-foreground text-background'
                        : 'border border-dashed border-input hover:bg-muted',
                )}
            >
                {label}
                <ChevronDown className="size-4 opacity-70" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
                <DropdownMenuRadioGroup value={value} onValueChange={onSelect}>
                    {options.map((option) => (
                        <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export function DashboardFilterBar({
    filters,
    options,
    onChange,
}: {
    filters: DashboardFilters;
    options: DashboardOptions;
    onChange: (patch: Partial<DashboardFilters>) => void;
}) {
    const site = options.groups.find((g) => g.id === filters.group);
    const unitLabel = filters.unit_type
        ? unitMeta(filters.unit_type).label
        : 'semua';
    const conditionLabel = filters.condition
        ? CONDITION_LABEL[filters.condition]
        : 'semua';

    return (
        <div className="flex items-center gap-3">
            <div className="-mx-4 flex min-w-0 flex-1 [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 md:pb-0">
                <FilterPill
                    ariaLabel="Filter site"
                    label={site?.name ?? 'Semua site'}
                    active={filters.group !== null}
                    value={filters.group === null ? ALL : String(filters.group)}
                    options={[
                        { value: ALL, label: 'Semua site' },
                        ...options.groups.map((g) => ({
                            value: String(g.id),
                            label: g.name,
                        })),
                    ]}
                    onSelect={(v) =>
                        onChange({ group: v === ALL ? null : Number(v) })
                    }
                />
                <FilterPill
                    ariaLabel="Periode"
                    label={PERIOD_LABEL[filters.period]}
                    active
                    value={filters.period}
                    options={(
                        Object.keys(PERIOD_LABEL) as DashboardPeriod[]
                    ).map((p) => ({
                        value: p,
                        label: PERIOD_LABEL[p],
                    }))}
                    onSelect={(v) => onChange({ period: v as DashboardPeriod })}
                />
                <FilterPill
                    ariaLabel="Filter shift"
                    label={SHIFT_LABEL[filters.shift]}
                    active={filters.shift !== 'all'}
                    value={filters.shift}
                    options={[
                        { value: 'all', label: 'Semua shift' },
                        { value: '1', label: 'Shift 1 · 06:00–18:00' },
                        { value: '2', label: 'Shift 2 · 18:00–06:00' },
                    ]}
                    onSelect={(v) => onChange({ shift: v as DashboardShift })}
                />
                <FilterPill
                    ariaLabel="Filter unit type"
                    label={`Unit type: ${unitLabel}`}
                    active={filters.unit_type !== null}
                    value={filters.unit_type ?? ALL}
                    options={[
                        { value: ALL, label: 'Semua unit type' },
                        ...options.unitTypes.map((u) => ({
                            value: u.value,
                            label: unitMeta(u.value).label,
                        })),
                    ]}
                    onSelect={(v) =>
                        onChange({
                            unit_type: v === ALL ? null : (v as UnitCategory),
                        })
                    }
                />
                <FilterPill
                    ariaLabel="Filter kondisi"
                    label={`Kondisi: ${conditionLabel}`}
                    active={filters.condition !== null}
                    value={filters.condition ?? ALL}
                    options={[
                        { value: ALL, label: 'Semua kondisi' },
                        ...options.conditions.map((c) => ({
                            value: c,
                            label: CONDITION_LABEL[c],
                        })),
                    ]}
                    onSelect={(v) =>
                        onChange({
                            condition: v === ALL ? null : (v as Condition),
                        })
                    }
                />
            </div>

            <ToggleGroup
                type="single"
                aria-label="Periode"
                value={filters.period}
                onValueChange={(v) =>
                    v && onChange({ period: v as DashboardPeriod })
                }
                className="hidden shrink-0 rounded-lg bg-muted p-1 lg:flex"
            >
                {(Object.keys(PERIOD_SEGMENT) as DashboardPeriod[]).map((p) => (
                    <ToggleGroupItem
                        key={p}
                        value={p}
                        className="h-8 rounded-md px-3 text-[13px] text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                    >
                        {PERIOD_SEGMENT[p]}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* KPIs                                                                */
/* ------------------------------------------------------------------ */

const KPI_GRID =
    'grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-5';

export function DashboardKpis({
    kpis,
    period,
}: {
    kpis: DashboardKpiData;
    period: DashboardPeriod;
}) {
    const { total, online, offline, logs, lastHour } = kpis;
    const logsLabel =
        period === 'today'
            ? "Today's Logs"
            : `Logs · ${PERIOD_SEGMENT[period]}`;

    return (
        <div className={KPI_GRID}>
            <KpiTile
                label="Total Devices"
                value={fmt(total.value)}
                delta={signed(total.delta)}
                sub="this month"
                dotClass="bg-primary"
            />
            <KpiTile
                label="Online"
                value={fmt(online.value)}
                delta={`${online.pct}%`}
                deltaTone="good"
                sub="of fleet"
                dotClass="bg-online"
                spark={online.spark}
            />
            <KpiTile
                label="Offline"
                value={fmt(offline.value)}
                delta={signed(offline.delta)}
                deltaTone={
                    offline.delta > 0
                        ? 'bad'
                        : offline.delta < 0
                          ? 'good'
                          : 'neutral'
                }
                sub="vs 1 h ago"
                dotClass="bg-offline"
                spark={offline.spark}
            />
            <KpiTile
                className="hidden md:flex"
                label={logsLabel}
                value={fmt(logs.value)}
                delta={
                    logs.delta_pct === null
                        ? undefined
                        : `${logs.delta_pct > 0 ? '+' : ''}${logs.delta_pct}%`
                }
                sub={period === 'today' ? 'vs yesterday' : 'vs previous period'}
                dotClass="bg-primary"
                spark={logs.spark}
            />
            <KpiTile
                label="Last Hour"
                value={fmt(lastHour.value)}
                delta={
                    lastHour.rate_per_sec >= 1
                        ? `${fmt1(lastHour.rate_per_sec)}/s`
                        : `${fmt1(lastHour.value / 60)}/min`
                }
                sub="uplink rate"
                dotClass="bg-primary"
                spark={lastHour.spark}
            />
        </div>
    );
}

export function DashboardKpisSkeleton() {
    return (
        <div className={KPI_GRID} aria-busy="true" aria-label="Loading KPIs">
            {Array.from({ length: 5 }, (_, i) => (
                <KpiTile
                    key={i}
                    label=""
                    value=""
                    loading
                    className={cn(
                        i === 3 && 'hidden md:flex',
                        'motion-safe:animate-pulse',
                    )}
                />
            ))}
        </div>
    );
}

/* ------------------------------------------------------------------ */
/* Section shell                                                       */
/* ------------------------------------------------------------------ */

function SectionCard({
    title,
    aside,
    children,
    className,
}: {
    title: string;
    aside?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'flex flex-col gap-4 rounded-2xl border bg-card p-5 md:rounded-xl md:p-6',
                className,
            )}
        >
            <header className="flex items-baseline justify-between gap-3">
                <h2 className="text-base font-semibold">{title}</h2>
                {aside && (
                    <div className="shrink-0 text-[13px] text-muted-foreground">
                        {aside}
                    </div>
                )}
            </header>
            {children}
        </section>
    );
}

function EmptyNote({ children }: { children: ReactNode }) {
    return (
        <p className="py-6 text-center text-sm text-muted-foreground">
            {children}
        </p>
    );
}

const SECTIONS_GRID =
    'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(360px,100%),1fr))]';

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function Tracking({ rows }: { rows: DashboardSectionData['tracking'] }) {
    return (
        <SectionCard title="Tracking & Monitoring" aside="Units by type">
            {rows.length === 0 ? (
                <EmptyNote>No units match these filters.</EmptyNote>
            ) : (
                <ul className="flex flex-col gap-3">
                    {rows.map((row) => {
                        const meta = unitMeta(row.type);
                        const onlinePct =
                            row.total > 0 ? (row.online / row.total) * 100 : 0;

                        return (
                            <li
                                key={row.type}
                                className="grid grid-cols-[24px_minmax(0,1fr)_minmax(64px,112px)_auto] items-center gap-3 text-sm"
                            >
                                <UnitIcon type={meta.key} size={22} />
                                <span className="truncate">{meta.label}</span>
                                <span
                                    className="flex h-2 overflow-hidden rounded-full bg-muted"
                                    role="img"
                                    aria-label={`${row.online} of ${row.total} online`}
                                >
                                    <span
                                        className="bg-online"
                                        style={{ width: `${onlinePct}%` }}
                                    />
                                    <span
                                        className="bg-offline/60"
                                        style={{ width: `${100 - onlinePct}%` }}
                                    />
                                </span>
                                <span className="text-right tabular-nums">
                                    <span className="font-semibold">
                                        {row.online}
                                    </span>
                                    <span className="text-muted-foreground">
                                        {' '}
                                        / {row.total}
                                    </span>
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
            <div className="mt-auto flex gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-online" /> Online
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-sm bg-offline/60" /> Offline
                </span>
            </div>
        </SectionCard>
    );
}

const ALERT_TILE: Record<AlertType, { label: string; cls: string }> = {
    overspeed: { label: 'Overspeed', cls: 'bg-danger-bg text-danger' },
    geofence: { label: 'Geofence', cls: 'bg-warning-bg text-warning' },
    offline: { label: 'Offline', cls: 'bg-offline-bg text-offline' },
    low_signal: { label: 'Low Signal', cls: 'bg-warning-bg text-warning' },
};

function Safety({
    data,
    period,
    isAdmin,
}: {
    data: DashboardSectionData['safety'];
    period: DashboardPeriod;
    isAdmin: boolean;
}) {
    return (
        <SectionCard
            title="Safety Monitoring"
            aside={
                isAdmin ? (
                    <Link
                        href={adminAlerts.index.url()}
                        className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                        All alerts{' '}
                        <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                ) : undefined
            }
        >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(Object.keys(ALERT_TILE) as AlertType[]).map((type) => (
                    <div
                        key={type}
                        className={cn(
                            'flex flex-col gap-0.5 rounded-xl p-3',
                            ALERT_TILE[type].cls,
                        )}
                    >
                        <span className="text-2xl leading-none font-semibold tabular-nums">
                            {fmt(data.counts[type])}
                        </span>
                        <span className="text-[13px]">
                            {ALERT_TILE[type].label}
                        </span>
                    </div>
                ))}
            </div>
            <div>
                <p className="mb-2 text-[13px] text-muted-foreground">
                    Top overspeed units · {PERIOD_LABEL[period].toLowerCase()}
                </p>
                {data.topOverspeed.length === 0 ? (
                    <EmptyNote>No overspeed events.</EmptyNote>
                ) : (
                    <ol>
                        {data.topOverspeed.map((row, i) => (
                            <li
                                key={row.device_name}
                                className="grid grid-cols-[28px_minmax(0,1fr)_auto_auto] items-center gap-3 border-t py-2.5 text-sm"
                            >
                                <span className="font-mono text-xs text-muted-foreground">
                                    {String(i + 1).padStart(2, '0')}
                                </span>
                                <span className="truncate">
                                    {row.device_name}
                                </span>
                                <span className="tabular-nums">
                                    {row.events}{' '}
                                    {row.events === 1 ? 'event' : 'events'}
                                </span>
                                <span className="text-right font-semibold text-danger tabular-nums">
                                    {row.max_speed === null
                                        ? '—'
                                        : `${fmt1(row.max_speed)} km/h`}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </SectionCard>
    );
}

const CONDITION_SWATCH: Record<Condition, string> = {
    operational: 'bg-online',
    standby: 'bg-offline/60',
    breakdown: 'bg-danger',
};

function Maintenance({ data }: { data: DashboardSectionData['maintenance'] }) {
    const total = Object.values(data.conditions).reduce((a, b) => a + b, 0);
    const conditions = Object.keys(CONDITION_SWATCH) as Condition[];

    return (
        <SectionCard title="Maintenance Insight">
            <div
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label="Units by condition"
            >
                {total > 0 &&
                    conditions.map((c) => (
                        <span
                            key={c}
                            className={CONDITION_SWATCH[c]}
                            style={{
                                width: `${(data.conditions[c] / total) * 100}%`,
                            }}
                        />
                    ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
                {conditions.map((c) => (
                    <div key={c} className="flex flex-col gap-1">
                        <span className="text-2xl leading-none font-semibold tabular-nums">
                            {fmt(data.conditions[c])}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
                            <span
                                className={cn(
                                    'size-2 rounded-sm',
                                    CONDITION_SWATCH[c],
                                )}
                            />
                            {CONDITION_LABEL[c]}
                        </span>
                    </div>
                ))}
            </div>
            <div>
                <p className="mb-2 text-[13px] text-muted-foreground">
                    Low-signal units
                </p>
                {data.lowSignal.length === 0 ? (
                    <EmptyNote>All units have good signal.</EmptyNote>
                ) : (
                    <ul>
                        {data.lowSignal.map((row) => (
                            <li
                                key={row.device_name}
                                className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 border-t py-2.5 text-sm"
                            >
                                <span className="truncate">
                                    {row.device_name}
                                </span>
                                <span className="text-right font-mono text-xs text-warning tabular-nums">
                                    {row.avg_rssi} dBm
                                </span>
                                <span className="w-14 text-right font-mono text-xs text-muted-foreground tabular-nums">
                                    {fmt1(row.avg_snr)} dB
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </SectionCard>
    );
}

function Productivity({
    data,
}: {
    data: DashboardSectionData['productivity'];
}) {
    const pct = data.utilization_pct ?? 0;
    const radius = 52;
    const circumference = 2 * Math.PI * radius;

    return (
        <SectionCard title="Productivity" aside="Running vs idle hours">
            <div className="flex flex-col items-center gap-6 sm:flex-row">
                <div className="relative size-[150px] shrink-0">
                    <svg
                        viewBox="0 0 128 128"
                        className="size-full -rotate-90"
                        role="img"
                        aria-label={`${pct}% utilization`}
                    >
                        <circle
                            cx="64"
                            cy="64"
                            r={radius}
                            fill="none"
                            stroke="var(--muted)"
                            strokeWidth="14"
                        />
                        <circle
                            cx="64"
                            cy="64"
                            r={radius}
                            fill="none"
                            stroke="var(--primary)"
                            strokeWidth="14"
                            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
                        />
                    </svg>
                    <div className="absolute inset-0 grid place-content-center text-center">
                        <span className="text-[26px] leading-none font-semibold tabular-nums">
                            {data.utilization_pct === null ? '—' : `${pct}%`}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                            utilization
                        </span>
                    </div>
                </div>
                <dl className="grid w-full gap-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                        <dt className="inline-flex items-center gap-2">
                            <span className="size-2.5 rounded-sm bg-primary" />{' '}
                            Running
                        </dt>
                        <dd className="font-semibold tabular-nums">
                            {fmt1(data.running_hours)} h
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="inline-flex items-center gap-2">
                            <span className="size-2.5 rounded-sm border bg-muted" />{' '}
                            Idle
                        </dt>
                        <dd className="font-semibold tabular-nums">
                            {fmt1(data.idle_hours)} h
                        </dd>
                    </div>
                    <div className="mt-1 flex justify-between gap-3 border-t pt-3">
                        <dt className="text-muted-foreground">Distance</dt>
                        <dd className="font-semibold tabular-nums">
                            {fmt1(data.distance_km)} km
                        </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">
                            Avg cycle time
                        </dt>
                        <dd className="font-semibold tabular-nums">
                            {data.avg_cycle_min === null
                                ? '—'
                                : `${fmt1(data.avg_cycle_min)} min`}
                        </dd>
                    </div>
                </dl>
            </div>
        </SectionCard>
    );
}

const SIGNAL_DOT = {
    good: 'bg-online',
    fair: 'bg-warning',
    poor: 'bg-danger',
} as const;

function Infrastructure({
    data,
}: {
    data: DashboardSectionData['infrastructure'];
}) {
    return (
        <SectionCard
            title="Infrastructure Coverage"
            aside={`${data.gateway_count} gateways`}
        >
            {data.gateways.length === 0 ? (
                <EmptyNote>No gateway traffic in this period.</EmptyNote>
            ) : (
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[13px] text-muted-foreground">
                            <th className="pb-2 font-normal">Gateway</th>
                            <th className="pb-2 text-right font-normal">
                                Avg RSSI
                            </th>
                            <th className="pb-2 text-right font-normal">SNR</th>
                            <th className="pb-2 text-right font-normal">
                                Uplinks
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.gateways.map((g) => {
                            const quality = signalQuality(g.avg_rssi);

                            return (
                                <tr key={g.gateway_id} className="border-t">
                                    <td className="py-3">
                                        <span className="inline-flex items-center gap-2 font-mono text-[13px]">
                                            <span
                                                className={cn(
                                                    'size-2 rounded-full',
                                                    SIGNAL_DOT[quality],
                                                )}
                                            />
                                            <span className="sr-only">
                                                {quality} signal
                                            </span>
                                            {g.gateway_id}
                                        </span>
                                    </td>
                                    <td
                                        className={cn(
                                            'py-3 text-right font-mono text-xs',
                                            quality !== 'good' &&
                                                'text-warning',
                                        )}
                                    >
                                        {g.avg_rssi} dBm
                                    </td>
                                    <td className="py-3 text-right font-mono text-xs">
                                        {fmt1(g.avg_snr)}
                                    </td>
                                    <td className="py-3 text-right">
                                        {fmt(g.uplink_count)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </SectionCard>
    );
}

const speedConfig = {
    avg_speed: { label: 'Avg speed (km/h)', color: 'var(--chart-1)' },
} satisfies ChartConfig;

function Performance({ data }: { data: DashboardSectionData['performance'] }) {
    return (
        <SectionCard
            title="Performance Analysis"
            aside="Avg speed by hour · km/h"
        >
            {data.length === 0 ? (
                <EmptyNote>No movement recorded in this period.</EmptyNote>
            ) : (
                <ChartContainer
                    config={speedConfig}
                    className="aspect-auto h-[200px] w-full"
                >
                    <AreaChart
                        data={data}
                        margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                    >
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis
                            dataKey="hour"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            fontSize={11}
                        />
                        <YAxis
                            width={28}
                            tickLine={false}
                            axisLine={false}
                            fontSize={11}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area
                            dataKey="avg_speed"
                            type="monotone"
                            stroke="var(--color-avg_speed)"
                            strokeWidth={2}
                            fill="var(--accent)"
                            fillOpacity={1}
                            isAnimationActive={false}
                        />
                    </AreaChart>
                </ChartContainer>
            )}
        </SectionCard>
    );
}

function alertDetail(
    alert: DashboardSectionData['activeAlerts'][number],
): string {
    switch (alert.type) {
        case 'overspeed':
            return alert.speed_kmh !== null && alert.threshold_kmh !== null
                ? `${fmt1(alert.speed_kmh)} / ${fmt1(alert.threshold_kmh)} km/h`
                : 'Over speed limit';
        case 'geofence':
            return `${alert.event === 'exit' ? 'Exited' : 'Entered'} ${alert.zone ?? 'zone'}`;
        case 'offline':
            return 'No uplink';
        default:
            return 'Weak signal';
    }
}

function ActiveAlerts({
    alerts,
    isAdmin,
}: {
    alerts: DashboardSectionData['activeAlerts'];
    isAdmin: boolean;
}) {
    return (
        <SectionCard
            className="md:hidden"
            title="Active alerts"
            aside={
                isAdmin ? (
                    <Link
                        href={adminAlerts.index.url()}
                        className="text-primary underline underline-offset-4"
                    >
                        View all
                    </Link>
                ) : undefined
            }
        >
            {alerts.length === 0 ? (
                <EmptyNote>No active alerts.</EmptyNote>
            ) : (
                <ul>
                    {alerts.map((alert) => (
                        <li
                            key={alert.id}
                            className="flex items-center gap-3 border-t py-3"
                        >
                            <AlertTypeBadge
                                type={alert.type}
                                className="shrink-0"
                            />
                            <div className="min-w-0">
                                <p className="truncate text-sm font-medium">
                                    {alert.device_name}
                                </p>
                                <p className="truncate text-[13px] text-muted-foreground">
                                    {alertDetail(alert)}
                                    {alert.triggered_at &&
                                        ` · ${formatRelativeTime(alert.triggered_at)}`}
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function DashboardSections({
    sections,
    period,
    isAdmin,
}: {
    sections: DashboardSectionData;
    period: DashboardPeriod;
    isAdmin: boolean;
}) {
    return (
        <>
            <ActiveAlerts alerts={sections.activeAlerts} isAdmin={isAdmin} />
            <div className={SECTIONS_GRID}>
                <Tracking rows={sections.tracking} />
                <Safety
                    data={sections.safety}
                    period={period}
                    isAdmin={isAdmin}
                />
                <Maintenance data={sections.maintenance} />
                <Productivity data={sections.productivity} />
                <Infrastructure data={sections.infrastructure} />
                <Performance data={sections.performance} />
            </div>
        </>
    );
}

export function DashboardSectionsSkeleton() {
    return (
        <div
            className={SECTIONS_GRID}
            aria-busy="true"
            aria-label="Loading dashboard sections"
        >
            {Array.from({ length: 6 }, (_, i) => (
                <div
                    key={i}
                    className="flex h-[300px] flex-col gap-4 rounded-xl border bg-card p-6 motion-safe:animate-pulse"
                >
                    <div className="h-4 w-1/3 rounded bg-muted" />
                    <div className="h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-5/6 rounded bg-muted" />
                    <div className="h-3 w-2/3 rounded bg-muted" />
                    <div className="mt-auto h-24 w-full rounded-lg bg-muted" />
                </div>
            ))}
        </div>
    );
}
