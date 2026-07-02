// Orion map marker — "Tag" direction: a horizontal chip that keeps the unit
// ID always visible. Encoding rule for the whole system:
//   fill     = unit type   (identity)
//   left bar = device status  (safety)
// The equipment icon repeats the class as a shape, so it reads without color
// (colorblind-safe). Danger pulses via Tailwind's animate-ping.
//
// Colors are applied with inline CSS vars (unit category color / status var)
// rather than dynamic Tailwind class names, so the JIT never purges them.
//
// For use outside the Leaflet canvas (legends, pinned-unit lists, popovers) —
// the live map itself uses lib/device-icon.ts, whose badge+heading-cone
// marker already handles rotation/animation that a DOM component can't.

import * as React from 'react';
import { UnitTypeIcon } from '@/components/icons/unit-type-icon';
import { UNIT_CATEGORIES } from '@/config/unit-types';
import type { UnitCategory } from '@/config/unit-types';
import { STATUS_COLOR_VAR, STATUS_LABEL } from '@/lib/status-colors';
import type { DeviceStatus } from '@/lib/status-colors';
import { cn } from '@/lib/utils';

export interface MapMarkerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    unitType: UnitCategory;
    status: DeviceStatus;
    label: string;
    selected?: boolean;
}

export function MapMarker({
    unitType,
    status,
    label,
    selected = false,
    className,
    ...props
}: MapMarkerProps) {
    const cat = UNIT_CATEGORIES[unitType] ?? UNIT_CATEGORIES.other;
    const isDanger = status === 'danger';

    return (
        <button
            type="button"
            aria-label={`${cat.abbr} ${label} — ${STATUS_LABEL[status]}`}
            className={cn(
                'group inline-flex h-[26px] w-fit items-center overflow-hidden rounded-md border border-border bg-card font-mono shadow-md',
                'transition-shadow hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                selected && 'ring-2 ring-ring',
                className,
            )}
            {...props}
        >
            {/* status bar */}
            <span
                className="relative h-full w-1 shrink-0"
                style={{ background: STATUS_COLOR_VAR[status] }}
            >
                {isDanger && (
                    <span
                        className="absolute inset-0 animate-ping opacity-60"
                        style={{ background: STATUS_COLOR_VAR[status] }}
                    />
                )}
            </span>

            {/* unit-type fill + icon */}
            <span
                className="flex h-full w-6 shrink-0 items-center justify-center text-white"
                style={{ background: cat.color }}
            >
                <UnitTypeIcon type={unitType} className="size-[15px]" />
            </span>

            {/* label */}
            <span className="px-2 text-[10px] font-semibold whitespace-nowrap text-foreground">
                {label}
            </span>
        </button>
    );
}
