import { cn } from '@/lib/utils';
import { Gauge, Hexagon, SignalLow, WifiOff, type LucideIcon } from 'lucide-react';

/* ---------- Status (online / offline) — always dot + label, never colour alone ---------- */
export function StatusBadge({ online, className }: { online: boolean; className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium',
                online ? 'bg-online-bg text-online' : 'bg-offline-bg text-offline',
                className,
            )}
        >
            <span className={cn('size-1.5 rounded-full', online ? 'bg-online' : 'bg-offline')} />
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
export function ConditionBadge({ condition, className }: { condition: Condition; className?: string }) {
    const c = CONDITION[condition];
    return <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium', c.cls, className)}>{c.label}</span>;
}

/* ---------- Alert type ---------- */
export type AlertType = 'overspeed' | 'geofence' | 'offline' | 'low_signal';
const ALERT: Record<AlertType, { label: string; cls: string; icon: LucideIcon }> = {
    overspeed: { label: 'Overspeed', cls: 'bg-danger-bg text-danger', icon: Gauge },
    geofence: { label: 'Geofence', cls: 'bg-warning-bg text-warning', icon: Hexagon },
    offline: { label: 'Offline', cls: 'bg-offline-bg text-offline', icon: WifiOff },
    low_signal: { label: 'Low signal', cls: 'bg-warning-bg text-warning', icon: SignalLow },
};
export function AlertTypeBadge({ type, suffix, className }: { type: AlertType; suffix?: string; className?: string }) {
    const a = ALERT[type];
    const Icon = a.icon;
    return (
        <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium', a.cls, className)}>
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
export function RoleBadge({ role, className }: { role: Role; className?: string }) {
    return (
        <span className={cn('inline-flex rounded-md px-2 py-0.5 text-xs font-medium capitalize', ROLE[role], className)}>{role}</span>
    );
}

/* ---------- Live connection (WebSocket) ---------- */
export type ConnectionState = 'connected' | 'reconnecting' | 'offline';
export function ConnectionBadge({ state, updatedLabel }: { state: ConnectionState; updatedLabel?: string }) {
    return (
        <span
            role="status"
            className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                state === 'reconnecting' && 'text-warning',
                state === 'offline' && 'text-offline',
            )}
        >
            {state === 'connected' && <span className="animate-live-pulse size-[7px] rounded-full bg-online" />}
            {state === 'reconnecting' && <span className="size-[7px] animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />}
            {state === 'offline' && <span className="size-[7px] rounded-full border-[1.5px] border-current" />}
            {state === 'connected' ? `Live${updatedLabel ? ` · ${updatedLabel}` : ''}` : state === 'reconnecting' ? 'Reconnecting…' : 'Offline'}
        </span>
    );
}
