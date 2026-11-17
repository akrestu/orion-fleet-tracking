import { UnitIcon } from '@/components/orion/unit-icon';
import { StatusBadge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useTick } from '@/hooks/use-tick';
import { unitMeta } from '@/lib/orion/unit-types';
import { formatRelativeTime, isStale } from '@/lib/time';
import type { DevicePosition } from '@/types/fleet';

interface DeviceSidebarItemProps {
    device: DevicePosition;
    isSelected: boolean;
    onClick: () => void;
}

export function DeviceSidebarItem({
    device,
    isSelected,
    onClick,
}: DeviceSidebarItemProps) {
    useTick();
    const isOnline = device.status === 'online';
    const cat = unitMeta(device.unit_type);
    const lastUpdate = formatRelativeTime(device.recorded_at);
    const stale = isOnline && isStale(device.recorded_at);

    return (
        <>
            <button
                onClick={onClick}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${isSelected ? 'border-l-2 border-primary bg-primary/10' : 'border-l-2 border-transparent'}`}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">
                        {device.device_name}
                    </span>
                    <StatusBadge
                        status={isOnline ? 'online' : 'offline'}
                        className="shrink-0"
                    />
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    {/* Category badge with category color */}
                    <UnitIcon type={cat.key} size={22} muted={!isOnline} />
                    {device.unit_model ? (
                        <span className="text-xs font-medium text-muted-foreground">
                            {device.unit_model}
                        </span>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            {cat.label}
                        </span>
                    )}
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{device.speed_kmh.toFixed(1)} km/h</span>
                    {device.heading_deg !== null && (
                        <span>{device.heading_deg}°</span>
                    )}
                    <span className="truncate font-mono text-xs opacity-60">
                        {device.dev_eui}
                    </span>
                </div>

                {lastUpdate && (
                    <div className="mt-1 flex items-center gap-1">
                        <span
                            className={`text-xs ${stale ? 'font-medium text-warning' : 'text-muted-foreground'}`}
                        >
                            {stale && '⚠ '}
                            Update terakhir: {lastUpdate}
                        </span>
                    </div>
                )}
            </button>
            <Separator />
        </>
    );
}
