import { echo, useConnectionStatus } from '@laravel/echo-react';
import { useCallback, useEffect, useState } from 'react';
import type { DevicePosition, DwellZone } from '@/types/fleet';

/**
 * Resolves which private channels carry this user's authorized device updates.
 * `accessibleGroupIds === null` means unrestricted (admin only).
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
    const isConnected = useConnectionStatus() === 'connected';

    const handlePositionUpdate = useCallback((data: DevicePosition) => {
        setPositions((prev) =>
            // Merge so fields the broadcast omits (unit_model, has_alert) survive live updates.
            new Map(prev).set(data.dev_eui, {
                ...prev.get(data.dev_eui),
                ...data,
            }),
        );
    }, []);

    const handleZoneChange = useCallback(
        (data: { dev_eui: string; zone: DwellZone | null }) => {
            setPositions((prev) => {
                const current = prev.get(data.dev_eui);

                return current
                    ? new Map(prev).set(data.dev_eui, {
                          ...current,
                          zone: data.zone,
                      })
                    : prev;
            });
        },
        [],
    );

    useEffect(() => {
        const channelNames = resolveChannelNames(accessibleGroupIds);

        channelNames.forEach((name) => {
            echo()
                .private(name)
                .listen('.device.position.updated', handlePositionUpdate)
                .listen('.device.zone.changed', handleZoneChange);
        });

        return () => {
            channelNames.forEach((name) => echo().leave(name));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        JSON.stringify(accessibleGroupIds),
        handlePositionUpdate,
        handleZoneChange,
    ]);

    return {
        positions,
        positionList: Array.from(positions.values()),
        isConnected,
    };
}
