import { cn } from '@/lib/utils';

interface KpiTileProps {
    label: string;
    value: string | number;
    /** e.g. "+4 vs 1h ago"; colour it by meaning, not sign */
    delta?: string;
    deltaTone?: 'good' | 'bad' | 'neutral';
    sub?: string;
    /** status dot colour class, e.g. "bg-online" */
    dotClass?: string;
    /** last N values for a sparkline */
    spark?: number[];
    loading?: boolean;
    className?: string;
}

export function KpiTile({ label, value, delta, deltaTone = 'neutral', sub, dotClass = 'bg-primary', spark, loading, className }: KpiTileProps) {
    if (loading) {
        return (
            <div className={cn('flex flex-col gap-2.5 rounded-xl border bg-card p-4', className)}>
                <div className="h-2.5 w-1/2 rounded bg-muted" />
                <div className="h-7 w-2/3 rounded-md bg-muted" />
            </div>
        );
    }
    let path = '';
    if (spark && spark.length > 1) {
        const min = Math.min(...spark);
        const max = Math.max(...spark);
        const r = max - min || 1;
        path = spark.map((v, i) => `${i ? 'L' : 'M'}${(i / (spark.length - 1)) * 72} ${24 - ((v - min) / r) * 20}`).join(' ');
    }
    return (
        <div className={cn('flex flex-col gap-1.5 rounded-xl border bg-card p-4', className)}>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className={cn('size-1.5 rounded-full', dotClass)} />
                {label}
            </div>
            <div className="flex items-end justify-between">
                <span className="text-[28px] leading-none font-semibold tracking-tight tabular-nums">{value}</span>
                {path && (
                    <svg width="72" height="26" viewBox="0 0 72 26" aria-hidden>
                        <path d={path} fill="none" stroke="var(--primary)" strokeWidth="1.5" />
                    </svg>
                )}
            </div>
            {(delta || sub) && (
                <div className="text-xs text-muted-foreground">
                    {delta && (
                        <span className={cn('font-medium', deltaTone === 'good' && 'text-online', deltaTone === 'bad' && 'text-danger', deltaTone === 'neutral' && 'text-foreground')}>
                            {delta}
                        </span>
                    )}{' '}
                    {sub}
                </div>
            )}
        </div>
    );
}
