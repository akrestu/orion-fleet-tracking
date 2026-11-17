# ORION UI — rules for Claude Code
(Append this section to the project's CLAUDE.md.)

## Design system
- The full UI spec is `docs/design/ORION_DESIGN.md`. Read it before building or changing any page, and match the named canvas artboard.
- Colours come only from tokens in `resources/css/orion-tokens.css` (Tailwind classes such as `bg-card`, `text-muted-foreground`, `bg-danger-bg text-danger`, `text-unit-oht`). Never hard-code colours in pages/components. Exceptions: Leaflet markers/polylines in `components/orion/map-marker.ts`.
- Green/amber/red = status only. Speed uses the cerulean `speed-*` ramp. Unit identity uses `unit-*` + `<UnitIcon>`; never show a unit colour without its silhouette.
- Reuse `components/orion/*` (UnitIcon, StatusBadge, ConditionBadge, AlertTypeBadge, RoleBadge, ConnectionBadge, KpiTile, BottomNav, EmptyState, SecretReveal, LastSeen, OrionLockup) and shadcn/ui before writing new UI.
- Fonts: Geist / Geist Mono. Mono for EUI, coordinates, telemetry, tokens. `tabular-nums` for numbers; right-align numeric table columns.
- Every page must work in light and dark, and at 390 px wide (mobile shows `BottomNav`, content gets `pb-28`).
- Accessibility: real buttons/links, `aria-label` on icon-only controls, visible focus ring, ≥ 44 px touch targets on mobile, respect `prefers-reduced-motion`.
- Map unit types from the backend with `toUnitType()` from `lib/orion/unit-types.ts`.
