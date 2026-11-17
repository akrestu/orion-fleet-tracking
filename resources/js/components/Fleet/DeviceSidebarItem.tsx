import { LastSeen } from '@/components/orion/misc';
import { UnitIcon } from '@/components/orion/unit-icon';
import { unitMeta } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';
import type { DevicePosition } from '@/types/fleet';

interface DeviceSidebarItemProps {
    device: DevicePosition;
    isSelected: boolean;
    onClick: () => void;
}

/** Fleet Map device row: UnitIcon · name / last seen · speed · status dot (52 px). */
export function DeviceSidebarItem({
    device,
    isSelected,
    onClick,
}: DeviceSidebarItemProps) {
    const isOnline = device.status === 'online';
    const cat = unitMeta(device.unit_type);
    const statusLabel = device.has_alert
        ? 'Alert'
        : isOnline
          ? 'Online'
          : 'Offline';

    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={isSelected}
            aria-label={`${device.device_name}, ${statusLabel}`}
            className={cn(
                'flex min-h-[52px] w-full items-center gap-3 border-b px-4 py-2 text-left transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                isSelected && 'bg-accent shadow-[inset_3px_0_0_var(--primary)]',
            )}
        >
            <UnitIcon type={cat.key} size={26} muted={!isOnline} />

            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-foreground">
                    {device.device_name}
                    {device.unit_model && ` ${device.unit_model}`}
                </span>
                <span className="block text-xs">
                    {device.recorded_at ? (
                        <LastSeen at={device.recorded_at} />
                    ) : (
                        <span className="text-muted-foreground">
                            No GPS fix
                        </span>
                    )}
                </span>
            </span>

            <span className="shrink-0 text-sm text-foreground tabular-nums">
                {isOnline ? `${device.speed_kmh.toFixed(1)} km/h` : '—'}
            </span>

            <span
                aria-hidden
                className={cn(
                    'size-2 shrink-0 rounded-full',
                    device.has_alert
                        ? 'bg-danger'
                        : isOnline
                          ? 'bg-online'
                          : 'bg-offline',
                )}
            />
        </button>
    );
}
