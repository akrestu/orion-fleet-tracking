import { Badge } from '@/components/ui/badge';

interface ConnectionBadgeProps {
    connected: boolean;
}

export function ConnectionBadge({ connected }: ConnectionBadgeProps) {
    return (
        <Badge
            variant={connected ? 'default' : 'secondary'}
            className={connected ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-slate-500/20 text-slate-400 border-slate-500/30'}
        >
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-slate-400'}`} />
            {connected ? 'Live' : 'Disconnected'}
        </Badge>
    );
}
