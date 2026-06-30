import { echo } from '@laravel/echo-react';
import { useCallback, useEffect, useState } from 'react';
import type { DevicePosition } from '@/types/fleet';

/**
 * Resolves which private channels carry this user's authorized device updates.
 * `accessibleGroupIds === null` means unrestricted (admin or ungrouped operator).
 */
function resolveChannelNames(accessibleGroupIds: number[] | null): string[] {
    if (accessibleGroupIds === null) {
        return ['fleet-tracking.all'];
    }

    return accessibleGroupIds.map((id) => `fleet-tracking.group.${id}`);
}

export function useFleetTracking(
    initialPositions: DevicePosition[] = [],
    accessibleGroupIds: number[] | null = null,
) {
    const [positions, setPositions] = useState<Map<string, DevicePosition>>(
        () => new Map(initialPositions.map((p) => [p.dev_eui, p])),
    );
    const [isConnected, setIsConnected] = useState(false);

    const handlePositionUpdate = useCallback((data: DevicePosition) => {
        setPositions((prev) => new Map(prev).set(data.dev_eui, data));
    }, []);

    useEffect(() => {
        const channelNames = resolveChannelNames(accessibleGroupIds);

        channelNames.forEach((name) => {
            echo()
                .private(name)
                .listen('.device.position.updated', handlePositionUpdate);
        });

        return () => {
            channelNames.forEach((name) => echo().leave(name));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(accessibleGroupIds), handlePositionUpdate]);

    useEffect(() => {
        const ws = (
            window as unknown as {
                Echo?: { connector?: { pusher?: WebSocket } };
            }
        ).Echo?.connector?.pusher;

        if (!ws) {
            return;
        }

        const onOpen = () => setIsConnected(true);
        const onClose = () => setIsConnected(false);
        const onError = () => setIsConnected(false);

        if (ws.readyState === WebSocket.OPEN) {
            setIsConnected(true);
        }

        ws.addEventListener('open', onOpen);
        ws.addEventListener('close', onClose);
        ws.addEventListener('error', onError);

        return () => {
            ws.removeEventListener('open', onOpen);
            ws.removeEventListener('close', onClose);
            ws.removeEventListener('error', onError);
        };
    }, []);

    return {
        positions,
        positionList: Array.from(positions.values()),
        isConnected,
    };
}
