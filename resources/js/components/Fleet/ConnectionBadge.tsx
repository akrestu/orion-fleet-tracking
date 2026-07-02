import { StatusBadge } from '@/components/ui/badge';

interface ConnectionBadgeProps {
    connected: boolean;
}

export function ConnectionBadge({ connected }: ConnectionBadgeProps) {
    return (
        <StatusBadge status={connected ? 'online' : 'offline'}>
            {connected ? 'Live' : 'Disconnected'}
        </StatusBadge>
    );
}
