import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { UNIT_CATEGORIES } from '@/config/unit-types';
import type { DevicePosition } from '@/types/fleet';

interface DeviceSidebarItemProps {
    device: DevicePosition;
    isSelected: boolean;
    onClick: () => void;
}

export function DeviceSidebarItem({ device, isSelected, onClick }: DeviceSidebarItemProps) {
    const isOnline = device.status === 'online';
    const cat = UNIT_CATEGORIES[device.unit_type] ?? UNIT_CATEGORIES.other;

    return (
        <>
            <button
                onClick={onClick}
                className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 ${isSelected ? 'bg-sky-500/10 border-l-2 border-sky-500' : 'border-l-2 border-transparent'}`}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{device.device_name}</span>
                    <Badge
                        variant="outline"
                        className={`shrink-0 text-xs ${isOnline ? 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' : 'border-muted-foreground/30 text-muted-foreground'}`}
                    >
                        <span className={`mr-1 inline-block h-1.5 w-1.5 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
                        {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                </div>

                <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    {/* Category badge with category color */}
                    <span
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: cat.color }}
                    >
                        {cat.abbr}
                    </span>
                    {device.unit_model ? (
                        <span className="text-xs text-muted-foreground font-medium">{device.unit_model}</span>
                    ) : (
                        <span className="text-xs text-muted-foreground">{cat.label.split('–')[0].trim()}</span>
                    )}
                </div>

                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{device.speed_kmh.toFixed(1)} km/h</span>
                    {device.heading_deg !== null && <span>{device.heading_deg}°</span>}
                    <span className="font-mono text-xs truncate opacity-60">{device.dev_eui}</span>
                </div>
            </button>
            <Separator />
        </>
    );
}
