import { AlertTriangle, Copy, Check, Lock } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { useNow } from '@/hooks/use-tick';
import { cn } from '@/lib/utils';

/* ---------- Co-branded lockup: client logo │ by ORION ---------- */
export function OrionLockup({
    size = 28,
    compact,
    collapsible,
    className,
}: {
    size?: number;
    compact?: boolean;
    /** Hide everything but the client logo when an ancestor shadcn Sidebar collapses to icons. */
    collapsible?: boolean;
    className?: string;
}) {
    const hide = collapsible
        ? 'group-data-[collapsible=icon]:hidden'
        : undefined;

    return (
        <span className={cn('inline-flex items-center gap-2.5', className)}>
            <img
                src="/images/orion/wbk-logo.png"
                alt="PT. WBK"
                width={size}
                height={size}
                className="shrink-0"
            />
            <span className={cn('h-5 w-px bg-border', hide)} />
            {!compact && (
                <span className={cn('text-xs text-muted-foreground', hide)}>
                    by
                </span>
            )}
            <span
                className={cn('text-[13px] font-bold tracking-[0.16em]', hide)}
            >
                ORION
            </span>
        </span>
    );
}

/* ---------- Empty state (incl. scoped-access) ---------- */
export function EmptyState({
    icon,
    title,
    children,
    actions,
    className,
}: {
    icon?: ReactNode;
    title: string;
    children?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'mx-auto flex max-w-sm flex-col items-center gap-3 py-12 text-center',
                className,
            )}
        >
            <span className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
                {icon ?? <Lock className="size-6" />}
            </span>
            <div className="text-lg font-semibold">{title}</div>
            {children && (
                <div className="leading-relaxed text-muted-foreground">
                    {children}
                </div>
            )}
            {actions && <div className="mt-1 flex gap-2">{actions}</div>}
        </div>
    );
}

/* ---------- One-time secret reveal (API token) ---------- */
export function SecretReveal({
    secret,
    note,
}: {
    secret: string;
    note?: string;
}) {
    const [copied, setCopied] = useState(false);

    return (
        <div className="flex flex-col gap-2.5 rounded-xl border border-warning/40 bg-warning-bg p-4">
            <div className="flex items-center gap-2 font-semibold text-warning">
                <AlertTriangle className="size-4" /> Copy this token now — it
                won't be shown again
            </div>
            <div className="flex gap-2">
                <code className="flex-1 truncate rounded-lg border bg-card px-3 py-2 font-mono text-[13px]">
                    {secret}
                </code>
                <Button
                    variant="outline"
                    onClick={async () => {
                        await navigator.clipboard.writeText(secret);
                        setCopied(true);
                    }}
                >
                    {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy'}
                </Button>
            </div>
            {note && <div className="text-xs text-warning">{note}</div>}
        </div>
    );
}

/* ---------- Freshness label: "12 s ago", turns warning after staleAfter ---------- */
export function LastSeen({
    at,
    staleAfterSec = 300,
}: {
    at: Date | string;
    staleAfterSec?: number;
}) {
    const now = useNow();
    const d = typeof at === 'string' ? new Date(at) : at;
    const s = Math.max(0, Math.round((now - d.getTime()) / 1000));
    const label =
        s < 60
            ? `${s} s ago`
            : s < 3600
              ? `${Math.round(s / 60)} min ago`
              : s < 86400
                ? `${Math.round(s / 3600)} h ago`
                : `${Math.round(s / 86400)} d ago`;

    return (
        <time
            dateTime={d.toISOString()}
            title={d.toLocaleString('id-ID')}
            className={cn(
                'tabular-nums',
                s > staleAfterSec ? 'text-warning' : 'text-muted-foreground',
            )}
        >
            {label}
        </time>
    );
}
