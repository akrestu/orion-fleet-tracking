// resources/js/lib/fleet.ts
// Single source of truth for Orion fleet domain enums + token maps.
// The *-VAR maps point at the CSS custom properties added in app.css
// (see orion-tokens.css). Use these for inline fills where a Tailwind
// utility can't be statically named (e.g. a marker colored per unit type).

export type UnitType =
  | "oht"
  | "dump"
  | "excavator"
  | "dozer"
  | "grader"
  | "compactor"
  | "driller";

export type DeviceStatus = "online" | "offline" | "warning" | "danger";

export const UNIT_LABEL: Record<UnitType, string> = {
  oht: "OHT",
  dump: "Dump Truck",
  excavator: "Excavator",
  dozer: "Dozer",
  grader: "Grader",
  compactor: "Compactor",
  driller: "Driller",
};

export const UNIT_COLOR_VAR: Record<UnitType, string> = {
  oht: "var(--unit-oht)",
  dump: "var(--unit-dump)",
  excavator: "var(--unit-excavator)",
  dozer: "var(--unit-dozer)",
  grader: "var(--unit-grader)",
  compactor: "var(--unit-compactor)",
  driller: "var(--unit-driller)",
};

export const STATUS_LABEL: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  warning: "Warning",
  danger: "Danger",
};

// foreground (line/text) color per status
export const STATUS_COLOR_VAR: Record<DeviceStatus, string> = {
  online: "var(--status-online)",
  offline: "var(--status-offline)",
  warning: "var(--status-warning)",
  danger: "var(--status-danger)",
};

// Semantics — keep these definitions identical across map, table, badge, alert:
//   online  = telemetry reporting < 60s
//   offline = no signal
//   warning = threshold breach (speed/geofence/alert-thresholds)
//   danger  = critical fault
