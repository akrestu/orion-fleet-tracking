# ORION Fleet Intelligence — Design Spec for Implementation

Source of truth (visual): ORION design canvas — https://claude.ai/artifact/FWnB8NsQbpUdDTfXMVaG79
Stack: Laravel + Inertia + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui (Radix), Recharts, Leaflet.

This document tells you (Claude Code) **what to build and the rules to follow**. When a detail is not specified here, open the matching artboard on the canvas and match it.

---

## 0. Files in this package

| Path | Purpose |
|---|---|
| `resources/css/orion-tokens.css` | All colour/type/radius tokens, light + dark. Import from `app.css`; delete the starter kit's old `:root`/`.dark`/`@theme inline` colour blocks. |
| `resources/js/lib/orion/unit-types.ts` | 8 unit types: label, code, colour, SVG silhouette path. `toUnitType()` maps backend strings. |
| `resources/js/components/orion/unit-icon.tsx` | `<UnitIcon type size variant="plain|tile" muted />` |
| `resources/js/components/orion/badges.tsx` | `StatusBadge`, `ConditionBadge`, `AlertTypeBadge`, `RoleBadge`, `ConnectionBadge` |
| `resources/js/components/orion/kpi-tile.tsx` | KPI stat tile with delta, sparkline, skeleton |
| `resources/js/components/orion/map-marker.ts` | Leaflet `unitMarkerIcon()`, `speedBandColor()`, `ZONE_COLORS` |
| `resources/js/components/orion/bottom-nav.tsx` | Mobile floating bottom nav with centre Map button |
| `resources/js/components/orion/misc.tsx` | `OrionLockup`, `EmptyState`, `SecretReveal`, `LastSeen` |
| `public/images/orion/*` | `wbk-logo.png`, `hero-site.jpg` (dashboard hero + login), `contour-bg.png` (login background) |

Adjust route `href`s in `bottom-nav.tsx` to the real route names (use Ziggy `route()` if the project does).

---

## 1. Principles (do not break)

1. **Information first.** Borders over shadows. Shadows only for popovers, dialogs, the login card, the floating bottom nav and map markers.
2. **Three colour channels that never collide**
   - *Status*: `online / offline / warning / danger` (+ `-bg`). The **only** place green, amber or red appear.
   - *Speed*: `speed-slow / speed-mod / speed-fast`, a single cerulean ramp. A fast unit must never look like a fault.
   - *Unit type*: `unit-*` (8 hues, 195–340). Always shown **with** its silhouette, never colour alone.
3. **Never rely on colour alone.** Status = dot + label. Offline marker = dashed ring + 50 % opacity. Alert rows also carry a type badge.
4. **Tabular numerals** in every table, KPI and telemetry value (`tabular-nums`). Numbers are right-aligned in tables.
5. **Mono** (`font-mono`) for Device EUI, coordinates, RSSI/SNR, tokens, topics, IPs.
6. **Dark mode is first-class.** Use only tokens (`bg-card`, `text-muted-foreground`, `bg-danger-bg text-danger` …). Never hard-code hex/oklch in pages; the only exceptions are Leaflet markers and polylines (see `map-marker.ts`).
7. **Motion** 150 ms hover / 200 ms panels, ease-out. Live pulse uses `animate-live-pulse`. Respect `prefers-reduced-motion` and the user's "Reduce motion" setting.
8. **Accessibility**: WCAG 2.2 AA in both themes, visible focus rings (`ring`), real `<button>`/`<a>`, `aria-label` on icon-only buttons, touch targets ≥ 44 px on mobile.

---

## 2. Foundations

- **Font**: Geist (UI) + Geist Mono. Loaded in `orion-tokens.css`.
- **Type scale (px)**: 12 (labels, badges) · 13 (compact table cells, breadcrumbs) · 14 (body, default) · 16 (card titles) · 20 (section titles) · 24 (page H1) · 32/44 (hero titles).
- **Spacing**: 4 px grid. Page padding 28 px desktop / 16 px mobile. Card padding 16–20 px. Gap between cards 12–16 px.
- **Radius**: `rounded-md` 6 inputs/badges · `rounded-lg` 8 buttons · `rounded-xl` 12 cards · `rounded-2xl` 16 mobile cards · `rounded-3xl` 24 bottom nav · hero 20.
- **Heights**: buttons 36 px desktop / 44–50 px mobile · inputs 36–38 / 48 · table rows 36–44 (compact) and 52 (comfortable).
- **Primary** buttons = `bg-primary` (cerulean). Destructive = `variant="destructive"` or outline with `text-danger`. Login is the only screen using a black pill button (`bg-foreground text-background rounded-full`).

### Unit types

| key | code | label | token |
|---|---|---|---|
| `oht` | OHT | Off-Highway Truck | `--unit-oht` |
| `dump_truck` | DT | Dump Truck (articulated silhouette) | `--unit-dump-truck` |
| `dozer` | DZ | Dozer | `--unit-dozer` |
| `excavator` | EX | Excavator | `--unit-excavator` |
| `grader` | GR | Grader | `--unit-grader` |
| `compactor` | CP | Compactor | `--unit-compactor` |
| `driller` | DR | Driller | `--unit-driller` |
| `other` | OT | Other / Service | `--unit-other` |

Use `UnitIcon variant="plain"` in tables/lists (22–26 px), `variant="tile"` in cards and headers (36–64 px).

---

## 3. App shell

- **Desktop sidebar** (shadcn `Sidebar`, collapsible to icons): lockup at top → group **MAIN** (Dashboard, Fleet Map) → group **ADMIN** (admin only: User Management, Device Management, Device Groups, Alert Management, Alert Thresholds, Geofences, Reports & Export, System Settings) → footer user menu (Profile, Security, Appearance, Log out). Active item: `bg-sidebar-accent font-semibold`. Items 34 px tall, 13 px text, Lucide icons 16 px / 1.5 stroke.
- **Header** 56 px: breadcrumbs (`ORION / Admin / Page`) left, `ConnectionBadge` right (driven by the Echo/WebSocket connection state).
- **Mobile** (< md): no sidebar; compact header; `BottomNav` fixed at the bottom; page content needs `pb-28` so nothing hides behind the nav. Tabs: Home · Alerts · **Map (centre)** · Devices · Akun. Admin-only pages not in the tabs are reached from Akun.
- **Theme**: `light / dark / system` from the Appearance page, stored like the starter kit's `useAppearance` hook (class `.dark` on `<html>`).

---

## 4. Screens (artboard name → route)

For each screen below, match the canvas artboard of the same name. Light and dark exist for every desktop screen; mobile where noted.

### 4.1 Login — `Login`, `Login — Desktop Dark`, `Login — Mobile`
- Page bg `--background` with `contour-bg.png` full-cover, `mix-blend-mode: multiply; opacity .6` (dark: `screen; opacity .18`). Contours **outside** the card only.
- Centered split card max-w 1040, `rounded-[28px]`, soft shadow. Left: `hero-site.jpg` cover + pill lockup (white, rounded-full) top-left + "Site Lahat" bottom-right. Right: H1 "Masuk ke ORION" 36/700, sub, fields **NRP** (id-card icon) and **Kata sandi** (lock icon + show/hide), filled inputs (`bg-muted rounded-2xl h-[52px]`, no border), "Ingat perangkat ini" + "Lupa kata sandi?", primary black pill "Masuk" h-14, outline pill "Masuk dengan passkey" (WebAuthn), help text.
- 2FA step replaces the form: 6 single-digit inputs 52×60, "Verifikasi", back + recovery code.
- Mobile: photo top 360 px fading into background, lockup pill, form below; inputs 50 px.

### 4.2 Dashboard — `Dashboard — Light/Dark/Mobile`  (route `/dashboard`)
1. **Hero** 260 px (`rounded-[20px]`), `hero-site.jpg` cover, overlay `linear-gradient(90deg, oklch(.18 .03 240/.78), …/0 75%)` + bottom gradient. Text white: date · site · unit count (14/500), H1 "Fleet Overview" 44/700, "Selamat {pagi|siang|sore|malam}, {firstName} · ● {online} unit online".
2. **Filter pills**: Semua site · Hari ini · Shift 1 · Unit type · Kondisi (active = `bg-foreground text-background`, inactive = dashed border).
3. **KPI row** (5): Total Devices, Online, Offline, Today's Logs, Last Hour → `KpiTile`.
4. **Sections grid** (`auto-fit minmax(360px,1fr)`): Tracking & Monitoring (bars per unit type online/offline), Safety Monitoring (4 alert counters + top overspeed list), Maintenance Insight (stacked condition bar + low-signal list), Productivity (donut utilization + running/idle/distance/cycle), Infrastructure Coverage (gateway table RSSI/SNR/uplinks), Performance Analysis (Recharts `AreaChart` avg speed by hour, `--chart-1`, fill `--accent`).
- Mobile: hero 180 px, horizontal-scroll pills, 2-col KPIs, cards stacked, `BottomNav active="home"`.
- Deferred props → skeletons (see States).

### 4.3 Fleet Map — `Fleet Map — Light/Dark/Mobile`  (route `/map`)
- Full-height layout: 56 px icon rail + 320 px device panel + map.
- Device panel: header breadcrumb + ConnectionBadge; search (name/EUI); segmented `Semua / Online / Offline` with counts; rows 52 px: `UnitIcon` · name · last seen · speed (right) · status dot. Selected row `bg-accent` + 3 px inset left bar `primary`.
- Map (Leaflet): base layers Satelit / OpenStreetMap / custom site tiles; overlays Geofence, Heatmap sinyal. Markers via `unitMarkerIcon()` (rotate notch by heading, icon upright). Geofence polygons dashed 1.5 px with 14–20 % fill (`ZONE_COLORS`). Selected unit route: polyline split into segments coloured by `speedBandColor()`, 5 px, round caps; time toggle 1h/3h/6h/24h (top-left floating card). Popup: unit icon + name + EUI + status badge; grid Speed, Heading, RSSI/SNR, HDOP·Sats, Position (mono); footer "via {gateway} · {lastSeen}" + Details link.
- Legend bottom-left (speed bands + ring meanings), zoom bottom-right.
- Mobile: full-screen map, top bar (menu, search, layers 44 px), bottom sheet (shadcn `Drawer`) with the device list above `BottomNav active="map"`.
- Live updates: move markers with a 200 ms transition; pulse ring on update (disabled under reduced motion).

### 4.4 Device Management — `Device Management` (+Dark) & `Devices — Mobile`
- H1 + summary line; actions Import CSV (outline) / Add device (primary).
- Toolbar: search + filter pills (Category, Group, Condition, GPS).
- shadcn data table (TanStack): checkbox, Device name (link to detail, 600), EUI (mono 12), Category (`UnitIcon` + label), Model, Group, Condition (`ConditionBadge`), GPS (dot + label), Active (Switch), Last seen (right, `LastSeen`), row actions (`DropdownMenu`). Rows 44 px, header 38 px `bg-sidebar`. Pagination footer.
- Add/Edit device `Dialog` 520 px, 2-col form; EUI must be 16 hex chars (show "14/16" error under field); Active switch in footer.
- Mobile: cards (`UnitIcon tile` 44 · name · EUI · GPS status / group · last seen · condition badge), search + filter chips, add button 44 px.

### 4.5 Device Detail — `Device Detail` (+Dark, Mobile)  (route `/devices/{id}`)
Header with `UnitIcon tile` 64, name, Status + Condition badges, meta line; actions Show on map / Edit. 6 stat tiles. Grid: Device info list (EUI mono, category, model, group, condition, active, last gateway, registered) | Route mini-map (3h default, speed-band polyline, current marker). Recent GPS logs table: Recorded at, Coordinates, Speed (over-limit = `text-danger` 600), Heading, HDOP, Sats, RSSI, SNR, Gateway; Export CSV.

### 4.6 Alert Management — `Alert Management` (+Dark) & `Alerts — Mobile`
4 summary cards (icon tile in alert-type colours + active count). Filter chips Type (Semua, Overspeed, Geofence, Offline, Low signal) and Status (Active, Resolved, Semua). Table: checkbox, `AlertTypeBadge`, device (`UnitIcon` + name), detail, value / threshold (mono, value coloured by type), triggered at, status (dot + label), Resolve button (active only). Selected rows `bg-accent/50`; bulk "Resolve selected (n)". Mobile: alert cards with 3 px left accent in type colour and two 44 px buttons "Lihat di peta" / "Resolve".

### 4.7 Alert Thresholds — `Alert Thresholds` (+Dark)
Rules grouped in three cards: **GLOBAL**, **UNIT TYPE**, **DEVICE** (precedence note: Device › Unit type › Global). Row: target (icon for unit/device), type badge, `op value unit` (mono), on/off switch, Edit. Right side panel (sticky on desktop, `Sheet` on smaller screens): scope segmented control, target select, alert type, threshold input with unit suffix, helper text showing what it overrides, "Trigger after N seconds", Save.

### 4.8 Geofences — `Geofences` (+Dark)
Left list (360 px): colour swatch, name, type · vertices · units inside, enable switch; selected row accent. Map: drawing toolbar (polygon / edit vertices / undo), vertices as white dots with zone-colour border, live closing segment dashed. "New zone" floating dialog: vertices + area, name, type chips, colour swatches, "Alert on enter / exit" checkbox, Cancel / Save. Use `leaflet-draw` or `@geoman-io/leaflet-geoman-free`.

### 4.9 Reports & Export — `Reports & Export` (+Dark)
Date range button; underline tabs: Tracking, Safety, Maintenance, Productivity, Infrastructure, Performance, Raw GPS Data, Export. Productivity tab: 4 KPI tiles; cycle-time stacked bars per unit type (Load `--unit-excavator`, Haul `--primary`, Dump `--unit-dump-truck`, Return `--speed-slow`); utilization table with inline bar. Right "Quick export" panel: device scope select + download cards (CSV/XLSX badge, title, size hint, download icon button).

### 4.10 System Settings — `System Settings` (+Dark)
Segmented tabs MQTT · API Keys · Audit Log.
- MQTT: status pill (Connected · msg/s), host, port, username, password, topic (mono), TLS switch, Test connection / Save.
- API Keys: `SecretReveal` banner right after creating a token; table name, masked token (mono), group-scope chips, last used, created, Revoke (outline danger).
- Audit Log: time, user, event (mono chip e.g. `token.create`), target, IP; pagination.

### 4.11 Device Groups — `Device Groups` (+Dark)
Card grid (`auto-fill minmax(260px,1fr)`): 4 px top border in group colour, name, location, unit count, assigned-user avatars, "n users assigned". New group button.

### 4.12 User Management — `User Management` (+Dark)
3 role cards (Admin / Operator / Viewer with count + access description). Users table: avatar initials + name + email, `RoleBadge`, group chips, 2FA (Enabled = `text-online`, Not set = `text-warning`), last active, actions. Search + Invite user.

### 4.13 Account — `Account Settings` (+Dark), `Akun — Mobile` (+Dark)
Left sub-nav Profile / Security / Appearance + Log out (danger). 
- Profile: full name, NRP (disabled, mono), email, WhatsApp phone, assigned groups.
- Security: change password with 4-segment strength meter; 2FA card (status, recovery codes, disable); Passkeys list + Add passkey; Active sessions with Sign out.
- Appearance: Light / Dark / System preview cards (2 px primary border when selected), table density Compact/Comfortable, Bahasa English/Indonesia, Reduce motion switch.
- Mobile Akun: profile card + grouped list rows (56 px) + Log out; `BottomNav active="account"`.

---

## 5. States (artboard `System States`)
- **No group assigned** (operator/viewer with zero groups): `EmptyState` lock icon, "You have no device groups assigned", body text, Contact admin / Refresh. Render instead of dashboard/map content.
- **Live connection lost**: amber banner `bg-warning-bg border-warning/40` "Reconnecting to live feed… (attempt n)" + "Positions shown are from HH:MM · x min ago", Retry now; markers switch to offline style; `ConnectionBadge state="reconnecting"`.
- **Loading**: skeletons with `bg-muted` blocks mirroring the layout (hero, KPI tiles, table rows). Use Inertia deferred props + `<Deferred fallback={…}>`.
- **Empty result**: search icon, "No devices match "…"", Clear filters.
- **Server error**: danger icon tile, message + error ref, Try again.

---

## 6. Copy & language
UI mostly English; Indonesian where shown on the canvas (e.g. "Semua", "Kondisi", "Masuk", "Kata sandi", "Lihat di peta", "Akun", map layer labels). Allow +30 % string length. Dates `id-ID` (e.g. "Senin, 16 Nov 2026"), times 24 h WIB.

## 7. Implementation order (suggested)
1. Tokens + fonts → verify starter kit pages still render in light/dark.
2. `components/orion/*` + `UnitIcon` gallery page (temporary) to eyeball all 8 icons.
3. App shell (sidebar groups, header ConnectionBadge, mobile BottomNav).
4. Dashboard → Fleet Map → Device Management/Detail → Alerts → Thresholds → Geofences → Reports → Settings → Groups → Users → Account.
5. States everywhere (deferred skeletons, empty, error, reconnecting).
6. Accessibility pass (keyboard, focus, contrast in dark) and mobile pass at 390 px.


---

## 8. Mockup images
Rendered from the canvas at 2× (desktop 1440 px wide, mobile 390 × 844). Open the image for the screen you are building and match it; this spec wins if they disagree on behaviour, the image wins on visual details.

| Artboard | File |
|---|---|
| Foundations & Tokens | `mockups/00-foundations.png` |
| Components | `mockups/00-components.png` |
| Login — Desktop | `mockups/login-light.png` |
| Login — Mobile | `mockups/login-mobile.png` |
| Dashboard — Light | `mockups/dashboard-light.png` |
| Dashboard — Dark | `mockups/dashboard-dark.png` |
| Dashboard — Mobile | `mockups/dashboard-mobile.png` |
| Fleet Map — Light | `mockups/fleet-map-light.png` |
| Fleet Map — Dark | `mockups/fleet-map-dark.png` |
| Fleet Map — Mobile | `mockups/fleet-map-mobile.png` |
| Device Management | `mockups/device-management-light.png` |
| Device Detail | `mockups/device-detail-light.png` |
| Alert Management | `mockups/alert-management-light.png` |
| Alert Thresholds | `mockups/alert-thresholds-light.png` |
| Device Management — Dark | `mockups/device-management-dark.png` |
| Device Detail — Dark | `mockups/device-detail-dark.png` |
| Alert Management — Dark | `mockups/alert-management-dark.png` |
| Alert Thresholds — Dark | `mockups/alert-thresholds-dark.png` |
| Geofences | `mockups/geofences-light.png` |
| Reports & Export | `mockups/reports-light.png` |
| System Settings | `mockups/system-settings-light.png` |
| Device Groups | `mockups/groups-users-light.png` |
| Geofences — Dark | `mockups/geofences-dark.png` |
| Reports & Export — Dark | `mockups/reports-dark.png` |
| System Settings — Dark | `mockups/system-settings-dark.png` |
| Device Groups — Dark | `mockups/groups-users-dark.png` |
| Devices — Mobile | `mockups/devices-mobile.png` |
| Device Detail — Mobile | `mockups/device-detail-mobile.png` |
| Alerts — Mobile | `mockups/alerts-mobile.png` |
| Dashboard — Mobile Dark | `mockups/dashboard-mobile-dark.png` |
| Fleet Map — Mobile Dark | `mockups/fleet-map-mobile-dark.png` |
| Devices — Mobile Dark | `mockups/devices-mobile-dark.png` |
| Device Detail — Mobile Dark | `mockups/device-detail-mobile-dark.png` |
| Alerts — Mobile Dark | `mockups/alerts-mobile-dark.png` |
| Account Settings | `mockups/account-settings-light.png` |
| Account Settings — Dark | `mockups/account-settings-dark.png` |
| Akun — Mobile | `mockups/account-mobile.png` |
| Akun — Mobile Dark | `mockups/account-mobile-dark.png` |
| System States | `mockups/99-system-states.png` |
| User Management | `mockups/user-management-light.png` |
| User Management — Dark | `mockups/user-management-dark.png` |
| Login — Desktop Dark | `mockups/login-dark.png` |
