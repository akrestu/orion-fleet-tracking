import { CalendarDays, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { UnitIcon } from '@/components/orion/unit-icon';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { unitMeta } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';
import adminReports from '@/routes/admin/reports';

export type ReportDevice = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
};

type UtilizationRow = {
    dev_eui: string;
    device_name: string;
    unit_type: string;
    running_hours: number;
    idle_hours: number;
    distance_km: number;
};

type TripRow = {
    unit_type: string;
    load_start: string;
    load_end: string;
    dump_start: string | null;
    dump_end: string | null;
    cycle_duration_min: number | null;
    haul_duration_min: number | null;
    return_duration_min: number | null;
};

type TripSummary = { trip_count: number; avg_cycle_min: number | null };
type StopSummary = { waiting_count: number; waiting_min: number };

function query(params: Record<string, string>): string {
    const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== '' && v !== 'all'),
    ).toString();

    return qs ? `?${qs}` : '';
}

async function getJson<T>(url: string): Promise<T> {
    const res = await fetch(url, {
        headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    return (await res.json()) as T;
}

/** "1 Nov – 16 Nov 2026" from two YYYY-MM-DD strings. */
export function formatRange(from: string, to: string): string {
    const fmt = (iso: string, withYear: boolean) =>
        new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'short',
            ...(withYear ? { year: 'numeric' } : {}),
        });

    return `${fmt(from, false)} – ${fmt(to, true)}`;
}

const minutesBetween = (a: string | null, b: string | null): number | null =>
    a && b ? Math.max(0, (Date.parse(b) - Date.parse(a)) / 60_000) : null;

const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/* ---------- Date range ---------- */

export function DateRangeButton({
    from,
    to,
    onChange,
}: {
    from: string;
    to: string;
    onChange: (from: string, to: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [draftFrom, setDraftFrom] = useState(from);
    const [draftTo, setDraftTo] = useState(to);
    const invalid = draftFrom === '' || draftTo === '' || draftFrom > draftTo;

    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                setOpen(v);

                if (v) {
                    setDraftFrom(from);
                    setDraftTo(to);
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button variant="outline" className="h-11 gap-2 md:h-10">
                    <CalendarDays className="size-4" />
                    <span className="tabular-nums">
                        {formatRange(from, to)}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
                <form
                    className="grid gap-3"
                    onSubmit={(e) => {
                        e.preventDefault();

                        if (!invalid) {
                            onChange(draftFrom, draftTo);
                            setOpen(false);
                        }
                    }}
                >
                    <div className="grid gap-1.5">
                        <Label htmlFor="range-from">From</Label>
                        <Input
                            id="range-from"
                            type="date"
                            value={draftFrom}
                            max={draftTo}
                            onChange={(e) => setDraftFrom(e.target.value)}
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="range-to">To</Label>
                        <Input
                            id="range-to"
                            type="date"
                            value={draftTo}
                            min={draftFrom}
                            onChange={(e) => setDraftTo(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Up to 90 days. Applies to every tab.
                    </p>
                    <Button type="submit" disabled={invalid}>
                        Apply range
                    </Button>
                </form>
            </PopoverContent>
        </Popover>
    );
}

/* ---------- Productivity overview ---------- */

function KpiCard({
    label,
    value,
    sub,
}: {
    label: string;
    value: string;
    sub?: ReactNode;
}) {
    return (
        <div className="rounded-xl border bg-card px-5 py-4">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums md:text-[28px]">
                {value}
            </p>
            {sub && (
                <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>
            )}
        </div>
    );
}

const STAGES = [
    { key: 'load', label: 'Load', cls: 'bg-unit-excavator text-white' },
    { key: 'haul', label: 'Haul', cls: 'bg-primary text-primary-foreground' },
    { key: 'dump', label: 'Dump', cls: 'bg-unit-dump-truck text-white' },
    { key: 'return', label: 'Return', cls: 'bg-speed-slow text-foreground' },
] as const;
type StageKey = (typeof STAGES)[number]['key'];

type Overview = {
    utilization: UtilizationRow[];
    trips: TripRow[];
    tripSummary: TripSummary[];
    stopSummary: StopSummary[];
};

export function ProductivityOverview({
    from,
    to,
    devEui,
}: {
    from: string;
    to: string;
    devEui: string;
}) {
    const [result, setResult] = useState<{
        key: string;
        data: Overview | null;
    } | null>(null);
    const requestKey = `${from}|${to}|${devEui}`;

    useEffect(() => {
        let cancelled = false;
        const qs = query({ from, to, dev_eui: devEui });

        Promise.all([
            getJson<{ data: UtilizationRow[] }>(
                adminReports.fleetUtilization.url() + qs,
            ),
            getJson<{ trips: TripRow[]; summary: TripSummary[] }>(
                adminReports.cycleTime.url() + qs,
            ),
            getJson<{ summary: StopSummary[] }>(
                adminReports.delayWaiting.url() + qs,
            ),
        ])
            .then(([u, c, d]) => {
                if (!cancelled) {
                    setResult({
                        key: requestKey,
                        data: {
                            utilization: u.data ?? [],
                            trips: c.trips ?? [],
                            tripSummary: c.summary ?? [],
                            stopSummary: d.summary ?? [],
                        },
                    });
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setResult({ key: requestKey, data: null });
                }
            });

        return () => {
            cancelled = true;
        };
    }, [from, to, devEui, requestKey]);

    if (!result || result.key !== requestKey) {
        return (
            <div className="grid gap-5" aria-busy="true">
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                    {Array.from({ length: 4 }, (_, i) => (
                        <Skeleton key={i} className="h-[104px] rounded-xl" />
                    ))}
                </div>
                <Skeleton className="h-56 rounded-xl" />
                <Skeleton className="h-72 rounded-xl" />
            </div>
        );
    }

    if (!result.data) {
        return (
            <p className="rounded-xl border bg-card p-6 text-sm text-danger">
                Could not load productivity data. Try a shorter date range.
            </p>
        );
    }

    const { utilization, trips, tripSummary, stopSummary } = result.data;

    const tripCount = tripSummary.reduce((s, r) => s + r.trip_count, 0);
    const avgCycle =
        tripCount > 0
            ? tripSummary.reduce(
                  (s, r) => s + (r.avg_cycle_min ?? 0) * r.trip_count,
                  0,
              ) / tripCount
            : null;
    const running = utilization.reduce((s, r) => s + r.running_hours, 0);
    const idle = utilization.reduce((s, r) => s + r.idle_hours, 0);
    const utilPct =
        running + idle > 0 ? (running / (running + idle)) * 100 : null;
    const distance = utilization.reduce((s, r) => s + r.distance_km, 0);
    const waitCount = stopSummary.reduce((s, r) => s + r.waiting_count, 0);
    const waitMin = stopSummary.reduce((s, r) => s + r.waiting_min, 0);

    // Average stage durations per unit type, over completed cycles only.
    const byType = new Map<string, { n: number } & Record<StageKey, number>>();

    for (const t of trips) {
        if (t.cycle_duration_min === null) {
            continue;
        }

        const acc = byType.get(t.unit_type) ?? {
            n: 0,
            load: 0,
            haul: 0,
            dump: 0,
            return: 0,
        };
        acc.n += 1;
        acc.load += minutesBetween(t.load_start, t.load_end) ?? 0;
        acc.haul += t.haul_duration_min ?? 0;
        acc.dump += minutesBetween(t.dump_start, t.dump_end) ?? 0;
        acc.return += t.return_duration_min ?? 0;
        byType.set(t.unit_type, acc);
    }

    const breakdown = [...byType.entries()].map(([type, acc]) => {
        const stages = Object.fromEntries(
            STAGES.map((s) => [s.key, acc[s.key] / acc.n]),
        ) as Record<StageKey, number>;
        const total = STAGES.reduce((s, st) => s + stages[st.key], 0);

        return { type, stages, total };
    });
    const longest = Math.max(1, ...breakdown.map((b) => b.total));

    const topUnits = utilization
        .map((r) => ({
            ...r,
            pct:
                r.running_hours + r.idle_hours > 0
                    ? (r.running_hours / (r.running_hours + r.idle_hours)) * 100
                    : 0,
        }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 8);

    return (
        <div className="grid gap-5">
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
                <KpiCard
                    label="Avg cycle time"
                    value={
                        avgCycle === null ? '—' : `${Math.round(avgCycle)} min`
                    }
                    sub={`${tripCount} cycles`}
                />
                <KpiCard
                    label="Fleet utilization"
                    value={utilPct === null ? '—' : `${Math.round(utilPct)}%`}
                    sub={`${nf.format(running)} h running`}
                />
                <KpiCard
                    label="Total distance"
                    value={`${Math.round(distance).toLocaleString('en-US')} km`}
                    sub={`${utilization.length} units`}
                />
                <KpiCard
                    label="Waiting stops"
                    value={waitCount.toLocaleString('en-US')}
                    sub={
                        waitCount > 0
                            ? `avg ${nf.format(waitMin / waitCount)} min each`
                            : undefined
                    }
                />
            </div>

            <section className="rounded-xl border bg-card p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-semibold">
                        Cycle time breakdown · avg per unit type
                    </h2>
                    <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {STAGES.map((s) => (
                            <li
                                key={s.key}
                                className="flex items-center gap-1.5"
                            >
                                <span
                                    aria-hidden
                                    className={cn('size-3 rounded-sm', s.cls)}
                                />
                                {s.label}
                            </li>
                        ))}
                    </ul>
                </div>
                {breakdown.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No completed load → dump cycles in this range. Cycles
                        need active loading and dumping geofences.
                    </p>
                ) : (
                    <ul className="grid gap-3">
                        {breakdown.map((b) => (
                            <li
                                key={b.type}
                                className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_4rem] items-center gap-4"
                            >
                                <span className="flex min-w-0 items-center gap-2 text-sm">
                                    <UnitIcon
                                        type={unitMeta(b.type).key}
                                        size={22}
                                    />
                                    <span className="truncate">
                                        {unitMeta(b.type).label}
                                    </span>
                                </span>
                                <span
                                    className="flex h-7 overflow-hidden rounded-md"
                                    style={{
                                        width: `${(b.total / longest) * 100}%`,
                                    }}
                                    role="img"
                                    aria-label={STAGES.map(
                                        (s) =>
                                            `${s.label} ${Math.round(b.stages[s.key])} min`,
                                    ).join(', ')}
                                >
                                    {STAGES.map((s) => (
                                        <span
                                            key={s.key}
                                            className={cn(
                                                'flex items-center overflow-hidden px-1.5 text-xs font-medium whitespace-nowrap',
                                                s.cls,
                                            )}
                                            style={{
                                                width: `${b.total > 0 ? (b.stages[s.key] / b.total) * 100 : 0}%`,
                                            }}
                                        >
                                            {b.stages[s.key] >= 1
                                                ? `${Math.round(b.stages[s.key])}m`
                                                : ''}
                                        </span>
                                    ))}
                                </span>
                                <span className="text-right font-semibold tabular-nums">
                                    {Math.round(b.total)} min
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="overflow-hidden rounded-xl border bg-card">
                <h2 className="px-5 py-4 font-semibold">
                    Fleet utilization · top units
                </h2>
                {topUnits.length === 0 ? (
                    <p className="border-t px-5 py-4 text-sm text-muted-foreground">
                        No GPS activity in this range.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm whitespace-nowrap">
                            <thead className="bg-sidebar text-muted-foreground">
                                <tr className="h-[38px] text-right [&>th]:px-4 [&>th]:font-medium">
                                    <th className="pl-5! text-left">Unit</th>
                                    <th>Running</th>
                                    <th>Idle</th>
                                    <th>Distance</th>
                                    <th className="pr-5! text-left">
                                        Utilization
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {topUnits.map((u) => (
                                    <tr
                                        key={u.dev_eui}
                                        className="h-12 border-t text-right tabular-nums [&>td]:px-4"
                                    >
                                        <td className="pl-5! text-left font-medium">
                                            <span className="inline-flex items-center gap-2">
                                                <UnitIcon
                                                    type={
                                                        unitMeta(u.unit_type)
                                                            .key
                                                    }
                                                    size={20}
                                                />
                                                {u.device_name}
                                            </span>
                                        </td>
                                        <td>{nf.format(u.running_hours)} h</td>
                                        <td className="text-muted-foreground">
                                            {nf.format(u.idle_hours)} h
                                        </td>
                                        <td>
                                            {Math.round(
                                                u.distance_km,
                                            ).toLocaleString('en-US')}{' '}
                                            km
                                        </td>
                                        <td className="pr-5!">
                                            <span className="flex items-center gap-3">
                                                <span className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
                                                    <span
                                                        className="block h-full rounded-full bg-primary"
                                                        style={{
                                                            width: `${u.pct}%`,
                                                        }}
                                                    />
                                                </span>
                                                <span className="w-10 text-right font-semibold">
                                                    {Math.round(u.pct)}%
                                                </span>
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

/* ---------- Quick export ---------- */

export function QuickExport({
    devices,
    from,
    to,
    devEui,
    onDevEuiChange,
}: {
    devices: ReportDevice[];
    from: string;
    to: string;
    devEui: string;
    onDevEuiChange: (devEui: string) => void;
}) {
    const qs = query({ from, to, dev_eui: devEui });
    const items: {
        format: 'CSV' | 'XLSX';
        title: string;
        hint: string;
        href: string;
    }[] = [
        {
            format: 'CSV',
            title: 'Raw GPS data',
            hint: 'Every uplink · streamed',
            href: adminReports.export.gpsLogs.url() + qs,
        },
        {
            format: 'XLSX',
            title: 'Productivity summary',
            hint: 'Running, idle, distance per unit',
            href: adminReports.export.fleetUtilization.url() + qs,
        },
        {
            format: 'XLSX',
            title: 'Cycle time',
            hint: 'Load → haul → dump → return trips',
            href: adminReports.export.cycleTime.url() + qs,
        },
        {
            format: 'CSV',
            title: 'Alert history',
            hint: 'All alert types',
            href: adminReports.export.alerts.url() + qs,
        },
        {
            format: 'XLSX',
            title: 'Gateway reliability',
            hint: 'Uplinks & signal per gateway',
            href:
                adminReports.export.gatewayReliability.url() +
                query({ from, to }),
        },
    ];

    return (
        <aside className="rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">Quick export</h2>
            <p className="text-sm text-muted-foreground">
                Uses the date range above
            </p>

            <div className="mt-4 grid gap-1.5">
                <Label>Devices</Label>
                <Combobox
                    value={devEui}
                    onValueChange={(v) => onDevEuiChange(v || 'all')}
                    placeholder={`All devices (${devices.length})`}
                    searchPlaceholder="Search device..."
                    options={[
                        {
                            value: 'all',
                            label: `All devices (${devices.length})`,
                        },
                        ...devices.map((d) => ({
                            value: d.dev_eui,
                            label: d.device_name,
                        })),
                    ]}
                />
            </div>

            <ul className="mt-4 grid gap-3">
                {items.map((item) => (
                    <li
                        key={item.title}
                        className="flex min-w-0 items-center gap-3 rounded-xl border p-3"
                    >
                        <span
                            className={cn(
                                'grid size-11 shrink-0 place-items-center rounded-lg font-mono text-[11px] font-semibold',
                                item.format === 'CSV'
                                    ? 'bg-accent text-accent-foreground'
                                    : 'bg-online-bg text-online',
                            )}
                        >
                            {item.format}
                        </span>
                        <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                                {item.title}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                                {item.hint}
                            </span>
                        </span>
                        <Button
                            variant="outline"
                            size="icon"
                            asChild
                            className="size-10 shrink-0"
                        >
                            <a
                                href={item.href}
                                aria-label={`Download ${item.title} (${item.format})`}
                            >
                                <Download className="size-4" />
                            </a>
                        </Button>
                    </li>
                ))}
            </ul>
        </aside>
    );
}
