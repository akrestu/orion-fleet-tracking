import 'leaflet/dist/leaflet.css';

import { Head, router, useForm } from '@inertiajs/react';
import L from 'leaflet';
import { Hexagon, Pencil, Plus, Search, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    CircleMarker,
    MapContainer,
    Marker,
    Polygon,
    Polyline,
    TileLayer,
    Tooltip,
    useMap,
    useMapEvents,
} from 'react-leaflet';
import GeofenceController from '@/actions/App/Http/Controllers/Admin/GeofenceController';
import { MAP_CARD } from '@/components/Fleet/map-overlays';
import type { Tileset } from '@/components/Fleet/MapTileUpload';
import InputError from '@/components/input-error';
import {
    GEOFENCE_SWATCHES,
    ZONE_TYPE_SWATCH,
} from '@/components/orion/map-marker';
import { EmptyState } from '@/components/orion/misc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { index as adminGeofencesIndex } from '@/routes/admin/geofences';

type LatLng = { lat: number; lng: number };
type ZoneType = 'none' | 'loading' | 'dumping' | 'parking';

type GeofenceRow = {
    id: number;
    name: string;
    description: string | null;
    color: string;
    polygon: LatLng[];
    is_active: boolean;
    zone_type: ZoneType;
    vertex_count: number;
    units_inside: number;
};

type PageProps = {
    geofences: GeofenceRow[];
    tilesets: Tileset[];
};

type ZoneForm = {
    name: string;
    description: string;
    color: string;
    polygon: LatLng[];
    is_active: boolean;
    zone_type: ZoneType;
};

/** Editor session: a zone being drawn/edited. `id` null = new zone. */
type Draft = { id: number | null } | null;
type Tool = 'draw' | 'edit' | null;

const ZONE_TYPES: { value: ZoneType; label: string }[] = [
    { value: 'loading', label: 'Loading' },
    { value: 'dumping', label: 'Dumping' },
    { value: 'parking', label: 'Parking' },
    { value: 'none', label: 'General' },
];
const TYPE_LABEL: Record<ZoneType, string> = {
    loading: 'Loading',
    dumping: 'Dumping',
    parking: 'Parking',
    none: 'General',
};
const EMPTY_ZONE: ZoneForm = {
    name: '',
    description: '',
    color: ZONE_TYPE_SWATCH.loading,
    polygon: [],
    is_active: true,
    zone_type: 'loading',
};
const DEFAULT_CENTER: [number, number] = [-3.779223, 103.67939];
const EARTH_RADIUS_M = 6_371_008;

/** Polygon area in hectares (local equirectangular projection — fine at site scale). */
function areaHa(points: LatLng[]): number {
    if (points.length < 3) {
        return 0;
    }

    const lat0 = (points[0].lat * Math.PI) / 180;
    const xy = points.map((p) => [
        ((p.lng * Math.PI) / 180) * EARTH_RADIUS_M * Math.cos(lat0),
        ((p.lat * Math.PI) / 180) * EARTH_RADIUS_M,
    ]);
    let sum = 0;

    for (let i = 0; i < xy.length; i++) {
        const [x1, y1] = xy[i];
        const [x2, y2] = xy[(i + 1) % xy.length];
        sum += x1 * y2 - x2 * y1;
    }

    return Math.abs(sum) / 2 / 10_000;
}

function toLatLngs(points: LatLng[]): [number, number][] {
    return points.map((p) => [p.lat, p.lng]);
}

/** Draggable vertex handle: white dot with a zone-colour border. */
function vertexIcon(color: string): L.DivIcon {
    return L.divIcon({
        className: 'orion-marker',
        html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#fff;border:2px solid ${color};box-shadow:0 1px 2px rgb(0 0 0 / .35)"></span>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
    });
}

/** Frames all zones once on load. */
function FitZones({ zones }: { zones: GeofenceRow[] }) {
    const map = useMap();
    const done = useRef(false);

    useEffect(() => {
        const points = zones.flatMap((z) => toLatLngs(z.polygon));

        if (done.current || points.length === 0) {
            return;
        }

        done.current = true;
        map.fitBounds(L.latLngBounds(points), {
            padding: [48, 48],
            maxZoom: 17,
        });
    }, [map, zones]);

    return null;
}

/** Flies to the selected zone. */
function FocusZone({ zone }: { zone: GeofenceRow | undefined }) {
    const map = useMap();

    useEffect(() => {
        if (zone && zone.polygon.length > 0) {
            map.flyToBounds(L.latLngBounds(toLatLngs(zone.polygon)), {
                padding: [80, 80],
                maxZoom: 18,
                duration: 0.6,
            });
        }
    }, [map, zone]);

    return null;
}

/** Click adds a vertex, double-click closes; tracks the cursor for the dashed closing segment. */
function DrawHandler({
    active,
    onAdd,
    onClose,
    onCursor,
}: {
    active: boolean;
    onAdd: (p: LatLng) => void;
    onClose: () => void;
    onCursor: (p: LatLng | null) => void;
}) {
    const map = useMap();

    useEffect(() => {
        if (!active) {
            return;
        }

        const container = map.getContainer();
        map.doubleClickZoom.disable();
        container.style.cursor = 'crosshair';

        return () => {
            map.doubleClickZoom.enable();
            container.style.cursor = '';
        };
    }, [map, active]);

    useMapEvents({
        click(e) {
            if (active) {
                onAdd({ lat: e.latlng.lat, lng: e.latlng.lng });
            }
        },
        dblclick() {
            if (active) {
                onClose();
            }
        },
        mousemove(e) {
            if (active) {
                onCursor({ lat: e.latlng.lat, lng: e.latlng.lng });
            }
        },
        mouseout() {
            onCursor(null);
        },
    });

    return null;
}

function ZoneEditor({
    zone,
    form,
    tool,
    onCancel,
    onSaved,
}: {
    zone: GeofenceRow | null;
    form: ReturnType<typeof useForm<ZoneForm>>;
    tool: Tool;
    onCancel: () => void;
    onSaved: () => void;
}) {
    const { data, setData, post, put, processing, errors } = form;
    const vertices = data.polygon.length;

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onSaved };

        if (zone) {
            put(GeofenceController.update.url(zone.id), options);
        } else {
            post(GeofenceController.store.url(), options);
        }
    };

    const remove = () => {
        if (zone && window.confirm(`Delete zone “${zone.name}”?`)) {
            router.delete(GeofenceController.destroy.url(zone.id), {
                preserveScroll: true,
                onSuccess: onSaved,
            });
        }
    };

    let help = 'Use the toolbar to draw or edit vertices';

    if (tool === 'draw') {
        help = 'Click the map to add vertices · double-click to close';
    } else if (tool === 'edit') {
        help = 'Drag the white vertices to reshape the zone';
    }

    return (
        <form
            onSubmit={submit}
            className={cn(MAP_CARD, 'flex w-[320px] flex-col gap-4 p-5')}
        >
            <div>
                <h2 className="font-semibold">
                    {zone ? 'Edit zone' : 'New zone'}
                </h2>
                <p className="text-xs text-muted-foreground">{help}</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted px-3 py-2 text-sm">
                <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Vertices</dt>
                    <dd className="font-semibold tabular-nums">{vertices}</dd>
                </div>
                <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Area</dt>
                    <dd className="font-semibold tabular-nums">
                        {areaHa(data.polygon).toFixed(1)} ha
                    </dd>
                </div>
            </dl>
            {errors.polygon && <InputError message={errors.polygon} />}

            <div className="grid gap-1.5">
                <Label htmlFor="zone-name">Zone name</Label>
                <Input
                    id="zone-name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="Loading · Pit N2"
                />
                <InputError message={errors.name} />
            </div>

            <fieldset>
                <legend className="mb-1.5 text-sm font-medium">
                    Zone type
                </legend>
                <div className="flex flex-wrap gap-1.5">
                    {ZONE_TYPES.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            aria-pressed={data.zone_type === t.value}
                            onClick={() =>
                                setData((d) => ({
                                    ...d,
                                    zone_type: t.value,
                                    // Follow the type's colour unless one was picked by hand.
                                    color:
                                        d.color ===
                                        ZONE_TYPE_SWATCH[d.zone_type]
                                            ? ZONE_TYPE_SWATCH[t.value]
                                            : d.color,
                                }))
                            }
                            className={cn(
                                'h-9 rounded-full border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring',
                                data.zone_type === t.value
                                    ? 'border-foreground bg-foreground text-background'
                                    : 'hover:bg-muted',
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <InputError message={errors.zone_type} />
            </fieldset>

            <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Color</legend>
                <div className="flex flex-wrap gap-2">
                    {GEOFENCE_SWATCHES.map((hex) => (
                        <button
                            key={hex}
                            type="button"
                            aria-label={`Colour ${hex}`}
                            aria-pressed={data.color === hex}
                            onClick={() => setData('color', hex)}
                            className={cn(
                                'size-8 rounded-full ring-offset-2 ring-offset-card focus-visible:outline-2 focus-visible:outline-ring',
                                data.color === hex && 'ring-2 ring-foreground',
                            )}
                            style={{ background: hex }}
                        />
                    ))}
                </div>
                <InputError message={errors.color} />
            </fieldset>

            <label className="flex min-h-9 items-center gap-2.5 text-sm">
                <Switch
                    checked={data.is_active}
                    onCheckedChange={(v) => setData('is_active', v)}
                />
                Active · alert on enter / exit
            </label>

            <div className="flex items-center gap-2">
                {zone && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={remove}
                        aria-label="Delete zone"
                        className="text-danger hover:text-danger"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
                <div className="ml-auto flex gap-2">
                    <Button type="button" variant="outline" onClick={onCancel}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={processing || vertices < 3}>
                        Save zone
                    </Button>
                </div>
            </div>
        </form>
    );
}

export default function GeofencesIndex({ geofences }: PageProps) {
    const [search, setSearch] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [draft, setDraft] = useState<Draft>(null);
    const [tool, setTool] = useState<Tool>(null);
    const [history, setHistory] = useState<LatLng[][]>([]);
    const [cursor, setCursor] = useState<LatLng | null>(null);

    const form = useForm<ZoneForm>(EMPTY_ZONE);
    const points = form.data.polygon;
    const color = form.data.color;
    const drafting = draft !== null;
    const lastPoint = points.at(-1);

    const selected = geofences.find((g) => g.id === selectedId);
    const editingZone =
        draft?.id != null
            ? (geofences.find((g) => g.id === draft.id) ?? null)
            : null;
    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return geofences.filter(
            (g) => needle === '' || g.name.toLowerCase().includes(needle),
        );
    }, [geofences, search]);

    const setPolygon = (next: LatLng[]) => {
        setHistory((h) => [...h, points]);
        form.setData('polygon', next);
    };

    const startNew = () => {
        form.clearErrors();
        form.setData(EMPTY_ZONE);
        setHistory([]);
        setSelectedId(null);
        setDraft({ id: null });
        setTool('draw');
    };

    const startEdit = (zone: GeofenceRow) => {
        form.clearErrors();
        form.setData({
            name: zone.name,
            description: zone.description ?? '',
            color: zone.color,
            polygon: zone.polygon,
            is_active: zone.is_active,
            zone_type: zone.zone_type,
        });
        setHistory([]);
        setSelectedId(zone.id);
        setDraft({ id: zone.id });
        setTool(null);
    };

    const stopEditing = () => {
        setDraft(null);
        setTool(null);
        setCursor(null);
    };

    const undo = () => {
        const previous = history.at(-1);

        if (previous) {
            setHistory((h) => h.slice(0, -1));
            form.setData('polygon', previous);
        }
    };

    const toggleActive = (zone: GeofenceRow, isActive: boolean) => {
        router.put(
            GeofenceController.update.url(zone.id),
            {
                name: zone.name,
                description: zone.description ?? '',
                color: zone.color,
                polygon: zone.polygon,
                zone_type: zone.zone_type,
                is_active: isActive,
            },
            { preserveScroll: true, preserveState: true },
        );
    };

    const toolButton =
        'grid size-10 place-items-center rounded-lg text-foreground hover:bg-muted disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:bg-accent aria-pressed:text-accent-foreground';

    return (
        <>
            <Head title="Geofences" />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                            Geofences
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                            {geofences.length} zone
                            {geofences.length === 1 ? '' : 's'} ·{' '}
                            {geofences.filter((g) => g.is_active).length} active
                        </p>
                    </div>
                    <Button
                        onClick={startNew}
                        className="h-11 shrink-0 md:h-10"
                    >
                        <Plus className="size-4" /> Draw new zone
                    </Button>
                </div>

                <div className="grid gap-5 lg:h-[calc(100svh-15rem)] lg:min-h-[560px] lg:grid-cols-[360px_minmax(0,1fr)]">
                    {/* Zone list */}
                    <section className="flex max-h-[50svh] min-h-0 flex-col overflow-hidden rounded-xl border bg-card lg:max-h-none">
                        <div className="border-b p-4">
                            <label className="relative block">
                                <span className="sr-only">Search zones</span>
                                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                <Input
                                    type="search"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search zones…"
                                    className="h-10 pl-9"
                                />
                            </label>
                        </div>
                        <ul className="min-h-0 flex-1 overflow-y-auto">
                            {geofences.length === 0 ? (
                                <li>
                                    <EmptyState
                                        icon={<Hexagon className="size-6" />}
                                        title="No zones yet"
                                    >
                                        Draw loading, dumping and parking zones
                                        to unlock cycle-time reports.
                                    </EmptyState>
                                </li>
                            ) : (
                                filtered.map((zone) => (
                                    <li
                                        key={zone.id}
                                        className={cn(
                                            'flex items-center gap-3 border-b px-4 py-3',
                                            selectedId === zone.id &&
                                                'bg-accent shadow-[inset_3px_0_0_var(--primary)]',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => startEdit(zone)}
                                            className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
                                        >
                                            <span
                                                aria-hidden
                                                className="size-8 shrink-0 rounded-lg border-2"
                                                style={{
                                                    borderColor: zone.color,
                                                    background: `color-mix(in oklch, ${zone.color} 22%, transparent)`,
                                                }}
                                            />
                                            <span className="min-w-0">
                                                <span className="block truncate font-semibold">
                                                    {zone.name}
                                                </span>
                                                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                                                    {TYPE_LABEL[zone.zone_type]}{' '}
                                                    · {zone.vertex_count}{' '}
                                                    vertices ·{' '}
                                                    {zone.units_inside} units
                                                    inside
                                                </span>
                                            </span>
                                        </button>
                                        <Switch
                                            checked={zone.is_active}
                                            onCheckedChange={(v) =>
                                                toggleActive(zone, v)
                                            }
                                            aria-label={`${zone.name} active`}
                                        />
                                    </li>
                                ))
                            )}
                        </ul>
                    </section>

                    {/* Map */}
                    <section className="relative isolate h-[70svh] overflow-hidden rounded-xl border bg-muted lg:h-auto">
                        <MapContainer
                            center={DEFAULT_CENTER}
                            zoom={15}
                            zoomControl={false}
                            style={{ position: 'absolute', inset: 0 }}
                        >
                            <TileLayer
                                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                attribution="Tiles &copy; Esri"
                                maxZoom={19}
                            />
                            <FitZones zones={geofences} />
                            <FocusZone zone={selected} />
                            <DrawHandler
                                active={tool === 'draw'}
                                onAdd={(p) => setPolygon([...points, p])}
                                onClose={() => setTool(null)}
                                onCursor={setCursor}
                            />

                            {geofences
                                .filter((z) => z.id !== draft?.id)
                                .map((zone) => (
                                    <Polygon
                                        key={zone.id}
                                        positions={toLatLngs(zone.polygon)}
                                        pathOptions={{
                                            color: zone.color,
                                            fillColor: zone.color,
                                            fillOpacity: zone.is_active
                                                ? 0.18
                                                : 0.06,
                                            weight:
                                                selectedId === zone.id
                                                    ? 2.5
                                                    : 1.5,
                                            dashArray: '6 4',
                                            opacity: zone.is_active ? 1 : 0.5,
                                        }}
                                        eventHandlers={{
                                            click: () => {
                                                if (!drafting) {
                                                    startEdit(zone);
                                                }
                                            },
                                        }}
                                    >
                                        <Tooltip
                                            sticky
                                            className="orion-zone-label"
                                        >
                                            {zone.name}
                                        </Tooltip>
                                    </Polygon>
                                ))}

                            {drafting && points.length >= 3 && (
                                <Polygon
                                    positions={toLatLngs(points)}
                                    pathOptions={{
                                        color,
                                        fillColor: color,
                                        fillOpacity: 0.22,
                                        weight: 2,
                                    }}
                                    interactive={false}
                                />
                            )}
                            {drafting && points.length === 2 && (
                                <Polyline
                                    positions={toLatLngs(points)}
                                    pathOptions={{ color, weight: 2 }}
                                    interactive={false}
                                />
                            )}
                            {tool === 'draw' && cursor && lastPoint && (
                                <Polyline
                                    positions={[
                                        [lastPoint.lat, lastPoint.lng],
                                        [cursor.lat, cursor.lng],
                                    ]}
                                    pathOptions={{
                                        color,
                                        weight: 1.5,
                                        dashArray: '4 4',
                                    }}
                                    interactive={false}
                                />
                            )}
                            {drafting &&
                                tool !== 'edit' &&
                                points.map((p, i) => (
                                    <CircleMarker
                                        key={i}
                                        center={[p.lat, p.lng]}
                                        radius={i === points.length - 1 ? 7 : 5}
                                        pathOptions={{
                                            color,
                                            weight: 2,
                                            fillColor: '#fff',
                                            fillOpacity: 1,
                                        }}
                                        interactive={false}
                                    />
                                ))}
                            {drafting &&
                                tool === 'edit' &&
                                points.map((p, i) => (
                                    <Marker
                                        key={`${i}-${p.lat}-${p.lng}`}
                                        position={[p.lat, p.lng]}
                                        icon={vertexIcon(color)}
                                        draggable
                                        eventHandlers={{
                                            dragend: (e) => {
                                                const ll = (
                                                    e.target as L.Marker
                                                ).getLatLng();
                                                setPolygon(
                                                    points.map((q, j) =>
                                                        j === i
                                                            ? {
                                                                  lat: ll.lat,
                                                                  lng: ll.lng,
                                                              }
                                                            : q,
                                                    ),
                                                );
                                            },
                                        }}
                                    />
                                ))}
                        </MapContainer>

                        {drafting && (
                            <div
                                role="toolbar"
                                aria-label="Drawing tools"
                                className={cn(
                                    MAP_CARD,
                                    'absolute top-4 left-4 z-[1000] flex gap-1 p-1',
                                )}
                            >
                                <button
                                    type="button"
                                    className={toolButton}
                                    aria-pressed={tool === 'draw'}
                                    aria-label="Draw polygon (click to add vertices)"
                                    onClick={() =>
                                        setTool(tool === 'draw' ? null : 'draw')
                                    }
                                >
                                    <Hexagon className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    className={toolButton}
                                    aria-pressed={tool === 'edit'}
                                    aria-label="Edit vertices (drag to move)"
                                    disabled={points.length === 0}
                                    onClick={() =>
                                        setTool(tool === 'edit' ? null : 'edit')
                                    }
                                >
                                    <Pencil className="size-4" />
                                </button>
                                <button
                                    type="button"
                                    className={toolButton}
                                    aria-label="Undo last change"
                                    disabled={history.length === 0}
                                    onClick={undo}
                                >
                                    <Undo2 className="size-4" />
                                </button>
                            </div>
                        )}

                        {drafting && (
                            <div className="absolute top-4 right-4 bottom-4 z-[1000] max-w-[calc(100%-2rem)] overflow-y-auto max-lg:top-auto max-lg:right-2 max-lg:bottom-2 max-lg:left-2 max-lg:max-h-[65%] max-lg:[&>form]:w-full">
                                <ZoneEditor
                                    key={draft.id ?? 'new'}
                                    zone={editingZone}
                                    form={form}
                                    tool={tool}
                                    onCancel={stopEditing}
                                    onSaved={stopEditing}
                                />
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}

GeofencesIndex.layout = {
    breadcrumbs: [{ title: 'Geofences', href: adminGeofencesIndex() }],
};
