// resources/js/components/map/map-marker.tsx
// Orion map marker — "Tag" direction (option C): a horizontal chip that keeps
// the unit ID always visible. Encoding rule for the whole system:
//   fill  = unit type   (identity)
//   left bar = device status  (safety)
// The equipment icon repeats the class as a shape, so it reads without color
// (colorblind-safe). Danger pulses via Tailwind's animate-ping.
//
// Colors are applied with inline CSS vars (var(--unit-*) / var(--status-*))
// rather than dynamic Tailwind class names, so the JIT never purges them.
//
// Usage inside a Leaflet/Mapbox overlay, an absolutely-positioned layer, etc:
//   <MapMarker unitType="oht" status="warning" label="OHT-207" onClick={...} />

import * as React from "react";
import { cn } from "@/lib/utils";
import { UnitTypeIcon } from "@/components/icons/unit-type-icon";
import {
  UNIT_COLOR_VAR,
  STATUS_COLOR_VAR,
  STATUS_LABEL,
  UNIT_LABEL,
  type UnitType,
  type DeviceStatus,
} from "@/lib/fleet";

export interface MapMarkerProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  unitType: UnitType;
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
  const isDanger = status === "danger";

  return (
    <button
      type="button"
      aria-label={`${UNIT_LABEL[unitType]} ${label} — ${STATUS_LABEL[status]}`}
      className={cn(
        "group inline-flex h-[26px] w-fit items-center overflow-hidden rounded-md border border-border bg-card font-mono shadow-md",
        "transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected && "ring-2 ring-ring",
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
        style={{ background: UNIT_COLOR_VAR[unitType] }}
      >
        <UnitTypeIcon type={unitType} className="size-[15px]" />
      </span>

      {/* label */}
      <span className="whitespace-nowrap px-2 text-[10px] font-semibold text-foreground">
        {label}
      </span>
    </button>
  );
}
