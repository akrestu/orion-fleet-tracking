import { useConnectionStatus } from '@laravel/echo-react';
import type { ConnectionState } from '@/components/orion/badges';

/** Maps the Echo/Reverb socket status onto the three ORION connection states. */
export function useLiveConnection(): ConnectionState {
    const status = useConnectionStatus();

    if (status === 'connected') {
        return 'connected';
    }

    if (status === 'connecting' || status === 'reconnecting') {
        return 'reconnecting';
    }

    return 'offline';
}
