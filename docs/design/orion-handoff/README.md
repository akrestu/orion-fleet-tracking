# ORION handoff package

Copy the folders into the root of the Laravel + Inertia React project (paths already match the starter kit):

```
docs/design/ORION_DESIGN.md          → full UI spec per screen
CLAUDE.design.md                     → paste into your CLAUDE.md
resources/css/orion-tokens.css       → tokens (light + dark)
resources/js/lib/orion/unit-types.ts → 8 unit silhouettes + colours
resources/js/components/orion/*      → core ORION components
public/images/orion/*                → logo, hero photo, contour background
```

## Steps
1. Copy the files. In `resources/css/app.css` add `@import './orion-tokens.css';` after `@import 'tailwindcss';` and delete the old colour variables (`:root`, `.dark`, and the colour part of `@theme inline`).
2. `npm i leaflet @types/leaflet` (plus `@geoman-io/leaflet-geoman-free` for geofence drawing) if they are not installed yet; `recharts` and `lucide-react` are already in the starter kit or should be added.
3. Append `CLAUDE.design.md` to `CLAUDE.md`.
4. In VS Code, open Claude Code and start with, for example:

> Read docs/design/ORION_DESIGN.md and CLAUDE.md. Wire orion-tokens.css into app.css, then build the app shell (sidebar groups, header with ConnectionBadge, mobile BottomNav). Show me the plan first.

Then continue page by page ("Implement the Dashboard page per section 4.2 of ORION_DESIGN.md").

Visual reference: https://claude.ai/artifact/FWnB8NsQbpUdDTfXMVaG79 (private; share it with the team from the canvas Share menu if needed).
