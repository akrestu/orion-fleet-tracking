import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Gauge,
    Hexagon,
    SignalLow,
    WifiOff,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useNow } from '@/hooks/use-tick';
import { cn } from '@/lib/utils';
import type { DwellZone } from '@/types/fleet';

/** "45 s" / "12 min" / "1 h 05 min" — elapsed dwell time. */
export function formatDwell(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));

    if (s < 60) {
        return `${s} s`;
    }

    const m = Math.floor(s / 60);

    return m < 60
        ? `${m} min`
        : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
}

const ZONE_META: Record<
    DwellZone['type'],
    { label: string; icon: LucideIcon }
> = {
    loading: { label: 'Loading', icon: ArrowDownToLine },
    dumping: { label: 'Dumping', icon: ArrowUpFromLine },
};

/* ---------- Live loading/dumping dwell (haulers) — icon + label + running timer ---------- */
export function ZoneBadge({
    zone,
    className,
}: {
    zone: DwellZone;
    className?: string;
}) {
    const now = useNow(5_000);
    const meta = ZONE_META[zone.type];
    const Icon = meta.icon;
    const elapsed = (now - new Date(zone.entered_at).getTime()) / 1000;

    return (
        <span
            title={`${meta.label} · ${zone.name}`}
            className={cn(
                'inline-flex items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-accent-foreground tabular-nums',
                className,
            )}
        >
            <Icon className="size-3" aria-hidden />
            {meta.label} · {formatDwell(elapsed)}
        </span>
    );
}

/* ---------- Status (online / offline) — always dot + label, never colour alone ---------- */
export function StatusBadge({
    online,
    className,
}: {
    online: boolean;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                online
                    ? 'bg-online-bg text-online'
                    : 'bg-offline-bg text-offline',
                className,
            )}
        >
            <span
                className={cn(
                    'size-1.5 rounded-full',
                    online ? 'bg-online' : 'bg-offline',
                )}
            />
            {online ? 'Online' : 'Offline'}
        </span>
    );
}

/* ---------- Operational condition ---------- */
export type Condition = 'operational' | 'standby' | 'breakdown';
const CONDITION: Record<Condition, { label: string; cls: string }> = {
    operational: { label: 'Operational', cls: 'bg-online-bg text-online' },
    standby: { label: 'Standby', cls: 'bg-offline-bg text-offline' },
    breakdown: { label: 'Breakdown', cls: 'bg-danger-bg text-danger' },
};
export function ConditionBadge({
    condition,
    className,
}: {
    condition: Condition;
    className?: string;
}) {
    const c = CONDITION[condition];

    return (
        <span
            className={cn(
                'inline-flex rounded-md px-2 py-0.5 text-xs font-medium',
                c.cls,
                className,
            )}
        >
            {c.label}
        </span>
    );
}

/* ---------- Alert type ---------- */
export type AlertType = 'overspeed' | 'geofence' | 'offline' | 'low_signal';
const ALERT: Record<
    AlertType,
    { label: string; cls: string; icon: LucideIcon }
> = {
    overspeed: {
        label: 'Overspeed',
        cls: 'bg-danger-bg text-danger',
        icon: Gauge,
    },
    geofence: {
        label: 'Geofence',
        cls: 'bg-warning-bg text-warning',
        icon: Hexagon,
    },
    offline: {
        label: 'Offline',
        cls: 'bg-offline-bg text-offline',
        icon: WifiOff,
    },
    low_signal: {
        label: 'Low signal',
        cls: 'bg-warning-bg text-warning',
        icon: SignalLow,
    },
};
export function AlertTypeBadge({
    type,
    suffix,
    className,
}: {
    type: AlertType;
    suffix?: string;
    className?: string;
}) {
    const a = ALERT[type];
    const Icon = a.icon;

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                a.cls,
                className,
            )}
        >
            <Icon className="size-3" strokeWidth={2} aria-hidden />
            {a.label}
            {suffix ? ` ${suffix}` : null}
        </span>
    );
}

/* ---------- Role ---------- */
export type Role = 'admin' | 'operator' | 'viewer';
const ROLE: Record<Role, string> = {
    admin: 'bg-foreground text-background',
    operator: 'bg-accent text-accent-foreground',
    viewer: 'border border-input text-muted-foreground',
};
export function RoleBadge({
    role,
    className,
}: {
    role: Role;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize',
                ROLE[role],
                className,
            )}
        >
            {role}
        </span>
    );
}

/* ---------- Live connection (WebSocket) ---------- */
export type ConnectionState = 'connected' | 'reconnecting' | 'offline';
export function ConnectionBadge({
    state,
    updatedLabel,
}: {
    state: ConnectionState;
    updatedLabel?: string;
}) {
    return (
        <span
            role="status"
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                state === 'reconnecting' && 'text-warning',
                state === 'offline' && 'text-offline',
            )}
        >
            {state === 'connected' && (
                <span className="size-[7px] animate-live-pulse rounded-full bg-online" />
            )}
            {state === 'reconnecting' && (
                <span className="size-[7px] animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
            )}
            {state === 'offline' && (
                <span className="size-[7px] rounded-full border-[1.5px] border-current" />
            )}
            {state === 'connected'
                ? `Live${updatedLabel ? ` · ${updatedLabel}` : ''}`
                : state === 'reconnecting'
                  ? 'Reconnecting…'
                  : 'Offline'}
        </span>
    );
}
