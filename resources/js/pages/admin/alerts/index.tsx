import { Head, Link, router } from '@inertiajs/react';
import {
    BellOff,
    Download,
    Gauge,
    Hexagon,
    Map as MapIcon,
    SignalLow,
    WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import AlertController from '@/actions/App/Http/Controllers/Admin/AlertController';
import { AlertTypeBadge } from '@/components/orion/badges';
import type { AlertType } from '@/components/orion/badges';
import { EmptyState, LastSeen } from '@/components/orion/misc';
import { UnitIcon } from '@/components/orion/unit-icon';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { unitMeta } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';
import { index as adminAlertsIndex } from '@/routes/admin/alerts';
import { alerts as exportAlerts } from '@/routes/admin/reports/export';
import fleet from '@/routes/fleet';
import type { UnitCategory } from '@/types/fleet';

type AdminAlert = {
    id: number;
    dev_eui: string;
    device_name: string | null;
    unit_type: UnitCategory | null;
    unit_model: string | null;
    alert_type: AlertType;
    triggered_at: string;
    resolved_at: string | null;
    is_resolved: boolean;
    meta: Record<string, unknown> | null;
};

type PageProps = {
    alerts: AdminAlert[];
    summary: Record<AlertType, number>;
    resolvedLast7Days: number;
};

type TypeFilter = 'all' | AlertType;
type StatusFilter = 'active' | 'resolved' | 'all';

const ALERT_TYPES: AlertType[] = [
    'overspeed',
    'geofence',
    'offline',
    'low_signal',
];

/** Alert-type channel: label, icon, summary tile, value text and mobile accent bar. */
const TYPE: Record<
    AlertType,
    { label: string; icon: LucideIcon; tile: string; text: string; bar: string }
> = {
    overspeed: {
        label: 'Overspeed',
        icon: Gauge,
        tile: 'bg-danger-bg text-danger',
        text: 'text-danger',
        bar: 'bg-danger',
    },
    geofence: {
        label: 'Geofence',
        icon: Hexagon,
        tile: 'bg-warning-bg text-warning',
        text: 'text-warning',
        bar: 'bg-warning',
    },
    offline: {
        label: 'Offline',
        icon: WifiOff,
        tile: 'bg-offline-bg text-offline',
        text: 'text-offline',
        bar: 'bg-offline',
    },
    low_signal: {
        label: 'Low signal',
        icon: SignalLow,
        tile: 'bg-warning-bg text-warning',
        text: 'text-warning',
        bar: 'bg-warning',
    },
};
const PAGE_SIZE = 10;
/** LastSeen turns amber when stale; an alert's age is not a freshness problem. */
const NEVER_STALE = Number.MAX_SAFE_INTEGER;

function num(v: unknown): number | null {
    const n = typeof v === 'string' ? Number(v) : v;

    return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
    return typeof v === 'string' && v !== '' ? v : null;
}

function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);

    return h > 0 ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`;
}

/** Human detail + "value / threshold" pair derived from the alert's meta payload. */
function describe(alert: AdminAlert): {
    detail: string;
    value: string | null;
    threshold: string | null;
} {
    const meta = alert.meta ?? {};
    const place = str(meta.zone) ?? str(meta.location);

    switch (alert.alert_type) {
        case 'overspeed': {
            const speed = num(meta.speed_kmh);
            const limit = num(meta.threshold) ?? num(meta.threshold_kmh);

            return {
                detail: place ?? 'Speed limit exceeded',
                value: speed === null ? null : `${speed.toFixed(1)} km/h`,
                threshold: limit === null ? null : `${limit} km/h`,
            };
        }

        case 'geofence': {
            const event = str(meta.event);
            const name = str(meta.geofence_name) ?? 'zone';

            return {
                detail: `${event === 'exit' ? 'Exited' : 'Entered'} ${name}`,
                value: event,
                threshold: `zone ${name}`,
            };
        }

        case 'offline': {
            const minutes = num(meta.offline_minutes);
            const limit = num(meta.threshold);

            return {
                detail: place ?? 'No uplink',
                value: minutes === null ? null : formatDuration(minutes),
                threshold: limit === null ? null : `${limit} min`,
            };
        }

        case 'low_signal': {
            const rssi = num(meta.rssi);
            const limit = num(meta.threshold);

            return {
                detail: place ?? 'Weak LoRa signal',
                value: rssi === null ? null : `${rssi} dBm`,
                threshold: limit === null ? null : `${limit} dBm`,
            };
        }
    }
}

/** 24 h WIB clock, e.g. 14:31. */
function clock(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function Chip({
    selected,
    onClick,
    className,
    children,
}: {
    selected: boolean;
    onClick: () => void;
    className?: string;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            onClick={onClick}
            className={cn(
                'inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                selected
                    ? 'border-foreground bg-foreground text-background'
                    : 'bg-card hover:bg-muted',
                className,
            )}
        >
            {children}
        </button>
    );
}

function ValueThreshold({ alert }: { alert: AdminAlert }) {
    const { value, threshold } = describe(alert);

    if (value === null && threshold === null) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span className="font-mono text-xs">
            <span
                className={cn(
                    'font-semibold',
                    !alert.is_resolved && TYPE[alert.alert_type].text,
                )}
            >
                {value ?? '—'}
            </span>
            {threshold && (
                <span className="text-muted-foreground"> / {threshold}</span>
            )}
        </span>
    );
}

function AlertStatus({ resolved }: { resolved: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-sm',
                resolved ? 'text-online' : 'text-danger',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 rounded-full',
                    resolved ? 'bg-online' : 'bg-danger',
                )}
            />
            {resolved ? 'Resolved' : 'Active'}
        </span>
    );
}

function deviceLabel(alert: AdminAlert): string {
    return `${alert.device_name ?? alert.dev_eui}${alert.unit_model ? ` ${alert.unit_model}` : ''}`;
}

export default function AlertsIndex({
    alerts,
    summary,
    resolvedLast7Days,
}: PageProps) {
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [page, setPage] = useState(0);
    const [busy, setBusy] = useState(false);

    const activeTotal = ALERT_TYPES.reduce((sum, t) => sum + summary[t], 0);

    const filtered = useMemo(
        () =>
            alerts.filter(
                (a) =>
                    (typeFilter === 'all' || a.alert_type === typeFilter) &&
                    (statusFilter === 'all' ||
                        (statusFilter === 'active') === !a.is_resolved),
            ),
        [alerts, typeFilter, statusFilter],
    );
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount - 1);
    const pageRows = filtered.slice(
        currentPage * PAGE_SIZE,
        (currentPage + 1) * PAGE_SIZE,
    );
    const selectableOnPage = pageRows.filter((a) => !a.is_resolved);
    const selectedActive = alerts.filter(
        (a) => selected.has(a.id) && !a.is_resolved,
    );
    const allOnPageSelected =
        selectableOnPage.length > 0 &&
        selectableOnPage.every((a) => selected.has(a.id));

    const changeFilter = (apply: () => void) => {
        apply();
        setPage(0);
        setSelected(new Set());
    };

    const toggle = (id: number, on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);

            if (on) {
                next.add(id);
            } else {
                next.delete(id);
            }

            return next;
        });

    const togglePage = (on: boolean) =>
        setSelected((prev) => {
            const next = new Set(prev);
            selectableOnPage.forEach((a) =>
                on ? next.add(a.id) : next.delete(a.id),
            );

            return next;
        });

    const visitOptions = {
        preserveScroll: true,
        onStart: () => setBusy(true),
        onFinish: () => setBusy(false),
    };

    const resolveOne = (alert: AdminAlert) => {
        router.patch(
            AlertController.resolve.url(alert.id),
            {},
            { ...visitOptions, onSuccess: () => toggle(alert.id, false) },
        );
    };

    const resolveSelected = () => {
        router.post(
            AlertController.resolveMany.url(),
            { ids: selectedActive.map((a) => a.id) },
            { ...visitOptions, onSuccess: () => setSelected(new Set()) },
        );
    };

    const firstRow = filtered.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
    const lastRow = Math.min(filtered.length, (currentPage + 1) * PAGE_SIZE);
    const empty = (
        <EmptyState
            icon={<BellOff className="size-6" />}
            title={
                statusFilter === 'active'
                    ? 'No active alerts'
                    : 'No alerts match'
            }
        >
            {statusFilter === 'active'
                ? 'Every alert has been handled.'
                : 'Try another type or status.'}
        </EmptyState>
    );

    return (
        <>
            <Head title="Alert Management" />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                            <span className="md:hidden">Alerts</span>
                            <span className="hidden md:inline">
                                Alert Management
                            </span>
                        </h1>
                        <p className="mt-1 hidden text-sm text-muted-foreground tabular-nums md:block">
                            {activeTotal} active · {resolvedLast7Days} resolved
                            in the last 7 days
                        </p>
                    </div>
                    <span className="pt-2 text-sm text-muted-foreground tabular-nums md:hidden">
                        {activeTotal} active
                    </span>
                    <div className="hidden gap-2 md:flex">
                        <Button variant="outline" asChild>
                            <a href={exportAlerts.url()}>
                                <Download className="size-4" /> Export
                            </a>
                        </Button>
                        <Button
                            onClick={resolveSelected}
                            disabled={selectedActive.length === 0 || busy}
                        >
                            Resolve selected ({selectedActive.length})
                        </Button>
                    </div>
                </div>

                {/* Summary cards (desktop) — click to filter */}
                <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
                    {ALERT_TYPES.map((type) => {
                        const Icon = TYPE[type].icon;

                        return (
                            <button
                                key={type}
                                type="button"
                                aria-pressed={
                                    typeFilter === type &&
                                    statusFilter === 'active'
                                }
                                onClick={() =>
                                    changeFilter(() => {
                                        setTypeFilter(type);
                                        setStatusFilter('active');
                                    })
                                }
                                className="flex items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary/40"
                            >
                                <span
                                    className={cn(
                                        'grid size-11 shrink-0 place-items-center rounded-xl',
                                        TYPE[type].tile,
                                    )}
                                >
                                    <Icon className="size-5" aria-hidden />
                                </span>
                                <span>
                                    <span className="block text-2xl font-semibold tabular-nums">
                                        {summary[type]}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                        {TYPE[type].label} · active
                                    </span>
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* Filters */}
                <div className="-mx-4 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0 [&::-webkit-scrollbar]:hidden">
                    <span className="hidden text-sm text-muted-foreground md:inline">
                        Type
                    </span>
                    <Chip
                        selected={typeFilter === 'all'}
                        onClick={() => changeFilter(() => setTypeFilter('all'))}
                    >
                        <span className="md:hidden">Active</span>
                        <span className="hidden md:inline">Semua</span>
                    </Chip>
                    {ALERT_TYPES.map((type) => (
                        <Chip
                            key={type}
                            selected={typeFilter === type}
                            onClick={() =>
                                changeFilter(() => setTypeFilter(type))
                            }
                        >
                            {TYPE[type].label}
                            <span className="ml-1.5 md:hidden">
                                {summary[type]}
                            </span>
                        </Chip>
                    ))}
                    <span
                        aria-hidden
                        className="mx-1 hidden h-6 border-l md:inline"
                    />
                    <span className="hidden text-sm text-muted-foreground md:inline">
                        Status
                    </span>
                    {(
                        [
                            ['active', 'Active'],
                            ['resolved', 'Resolved'],
                            ['all', 'Semua'],
                        ] as const
                    ).map(([value, label]) => (
                        <Chip
                            key={value}
                            selected={statusFilter === value}
                            onClick={() =>
                                changeFilter(() => setStatusFilter(value))
                            }
                            className="hidden md:inline-flex"
                        >
                            {label}
                        </Chip>
                    ))}
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                    {filtered.length === 0 ? (
                        empty
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-sidebar text-left text-muted-foreground">
                                    <tr className="h-[38px] [&>th]:px-3 [&>th]:font-medium [&>th]:whitespace-nowrap">
                                        <th className="w-10 pl-4!">
                                            <Checkbox
                                                checked={allOnPageSelected}
                                                disabled={
                                                    selectableOnPage.length ===
                                                    0
                                                }
                                                onCheckedChange={(v) =>
                                                    togglePage(v === true)
                                                }
                                                aria-label="Select all active alerts on this page"
                                            />
                                        </th>
                                        <th>Type</th>
                                        <th>Device</th>
                                        <th>Detail</th>
                                        <th className="text-right">
                                            Value / threshold
                                        </th>
                                        <th aria-sort="descending">
                                            Triggered
                                        </th>
                                        <th>Status</th>
                                        <th>
                                            <span className="sr-only">
                                                Actions
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((alert) => (
                                        <tr
                                            key={alert.id}
                                            className={cn(
                                                'h-14 border-t transition-colors hover:bg-muted/40 [&>td]:px-3',
                                                selected.has(alert.id) &&
                                                    'bg-accent/50',
                                            )}
                                        >
                                            <td className="pl-4!">
                                                <Checkbox
                                                    checked={selected.has(
                                                        alert.id,
                                                    )}
                                                    disabled={alert.is_resolved}
                                                    onCheckedChange={(v) =>
                                                        toggle(
                                                            alert.id,
                                                            v === true,
                                                        )
                                                    }
                                                    aria-label={`Select ${TYPE[alert.alert_type].label} alert for ${deviceLabel(alert)}`}
                                                />
                                            </td>
                                            <td>
                                                <AlertTypeBadge
                                                    type={alert.alert_type}
                                                />
                                            </td>
                                            <td>
                                                <span className="inline-flex items-center gap-2 font-semibold whitespace-nowrap">
                                                    {alert.unit_type && (
                                                        <UnitIcon
                                                            type={
                                                                unitMeta(
                                                                    alert.unit_type,
                                                                ).key
                                                            }
                                                            size={22}
                                                        />
                                                    )}
                                                    {deviceLabel(alert)}
                                                </span>
                                            </td>
                                            <td className="max-w-64 truncate">
                                                {describe(alert).detail}
                                            </td>
                                            <td className="text-right whitespace-nowrap">
                                                <ValueThreshold alert={alert} />
                                            </td>
                                            <td className="whitespace-nowrap tabular-nums">
                                                {clock(alert.triggered_at)} ·{' '}
                                                <LastSeen
                                                    at={alert.triggered_at}
                                                    staleAfterSec={NEVER_STALE}
                                                />
                                            </td>
                                            <td>
                                                <AlertStatus
                                                    resolved={alert.is_resolved}
                                                />
                                            </td>
                                            <td className="pr-4! text-right">
                                                {!alert.is_resolved && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        disabled={busy}
                                                        onClick={() =>
                                                            resolveOne(alert)
                                                        }
                                                    >
                                                        Resolve
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-muted-foreground">
                        <span className="tabular-nums">
                            Showing {firstRow}–{lastRow} of {filtered.length}
                            {statusFilter === 'all' ? '' : ` ${statusFilter}`}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(currentPage - 1)}
                                disabled={currentPage === 0}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPage(currentPage + 1)}
                                disabled={currentPage >= pageCount - 1}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Mobile cards (active alerts) */}
                <div className="-mx-4 flex flex-col gap-3 border-t bg-muted/40 px-4 pt-4 md:hidden">
                    {filtered.length === 0
                        ? empty
                        : filtered.map((alert) => (
                              <article
                                  key={alert.id}
                                  className="relative overflow-hidden rounded-2xl border bg-card p-4 pl-5"
                              >
                                  <span
                                      aria-hidden
                                      className={cn(
                                          'absolute inset-y-0 left-0 w-[3px]',
                                          TYPE[alert.alert_type].bar,
                                      )}
                                  />
                                  <div className="flex items-center justify-between gap-2">
                                      <AlertTypeBadge type={alert.alert_type} />
                                      <span className="text-sm">
                                          <LastSeen
                                              at={alert.triggered_at}
                                              staleAfterSec={NEVER_STALE}
                                          />
                                      </span>
                                  </div>
                                  <div className="mt-3 flex items-center gap-3">
                                      {alert.unit_type && (
                                          <UnitIcon
                                              type={
                                                  unitMeta(alert.unit_type).key
                                              }
                                              variant="tile"
                                              size={40}
                                          />
                                      )}
                                      <div className="min-w-0 flex-1">
                                          <p className="truncate font-semibold">
                                              {deviceLabel(alert)}
                                          </p>
                                          <p className="truncate text-sm text-muted-foreground">
                                              {describe(alert).detail}
                                          </p>
                                      </div>
                                      <span className="max-w-[40%] text-right">
                                          <ValueThreshold alert={alert} />
                                      </span>
                                  </div>
                                  <div className="mt-4 grid grid-cols-2 gap-3">
                                      <Button
                                          variant="outline"
                                          asChild
                                          className="h-11"
                                      >
                                          <Link
                                              href={fleet.map.url({
                                                  query: {
                                                      device: alert.dev_eui,
                                                  },
                                              })}
                                          >
                                              <MapIcon className="size-4" />
                                              Lihat di peta
                                          </Link>
                                      </Button>
                                      {alert.is_resolved ? (
                                          <span className="grid h-11 place-items-center">
                                              <AlertStatus resolved />
                                          </span>
                                      ) : (
                                          <Button
                                              className="h-11"
                                              disabled={busy}
                                              onClick={() => resolveOne(alert)}
                                          >
                                              Resolve
                                          </Button>
                                      )}
                                  </div>
                              </article>
                          ))}
                </div>
            </div>
        </>
    );
}

AlertsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Alert Management',
            href: adminAlertsIndex(),
        },
    ],
};
