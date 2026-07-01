import 'leaflet/dist/leaflet.css';

import { Head, useForm } from '@inertiajs/react';
import { MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LayersControl, MapContainer, Polygon, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import GeofenceController from '@/actions/App/Http/Controllers/Admin/GeofenceController';
import type { Tileset } from '@/components/Fleet/MapTileUpload';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
};

type PageProps = {
    geofences: GeofenceRow[];
    tilesets: Tileset[];
};

const BASE_LAYER_STORAGE_KEY = 'orion-map-base-layer';
const DEFAULT_BASE_LAYER = 'Satelit (Esri)';

const ZONE_TYPE_LABELS: Record<ZoneType, string> = {
    none: 'General',
    loading: 'Loading Zone',
    dumping: 'Dumping Zone',
    parking: 'Parking Zone',
};

const ZONE_TYPE_BADGE: Record<ZoneType, string> = {
    none: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    loading: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
    dumping: 'bg-red-500/15 text-red-400 border-red-500/20',
    parking: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
};

// ---- Calls invalidateSize after map mounts inside a dialog ----
function MapInvalidator() {
    const map = useMap();
    useEffect(() => {
        const id = setTimeout(() => map.invalidateSize(), 100);

        return () => clearTimeout(id);
    }, [map]);

    return null;
}

// ---- Map click handler for polygon drawing ----
function PolygonDrawer({
    points,
    onPointAdded,
}: {
    points: LatLng[];
    onPointAdded: (p: LatLng) => void;
}) {
    useMapEvents({
        click(e) {
            onPointAdded({ lat: e.latlng.lat, lng: e.latlng.lng });
        },
    });

    if (points.length === 0) {
return null;
}

    return (
        <Polygon
            positions={points.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#f59e0b', fillOpacity: 0.2 }}
        />
    );
}

// ---- Polygon map dialog ----
const DEFAULT_CENTER: [number, number] = [-3.779223, 103.67939];

function PolygonMapDialog({
    open,
    initialPoints,
    color,
    tilesets,
    onClose,
    onConfirm,
}: {
    open: boolean;
    initialPoints: LatLng[];
    color: string;
    tilesets: Tileset[];
    onClose: () => void;
    onConfirm: (points: LatLng[]) => void;
}) {
    const [points, setPoints] = useState<LatLng[]>(initialPoints);

    useEffect(() => {
        if (open) {
setPoints(initialPoints);
}
    }, [open]);

    const activeBaseLayer = (() => {
        const saved = localStorage.getItem(BASE_LAYER_STORAGE_KEY) ?? DEFAULT_BASE_LAYER;
        const available = ['Satelit (Esri)', 'OpenStreetMap', ...tilesets.map((t) => t.name)];

        return available.includes(saved) ? saved : DEFAULT_BASE_LAYER;
    })();

    const handleConfirm = () => {
        if (points.length < 3) {
return;
}

        onConfirm(points);
    };

    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-3xl p-0 gap-0 overflow-hidden">
                <DialogHeader className="px-6 pt-6 pb-4">
                    <DialogTitle>Draw Geofence Zone</DialogTitle>
                    <DialogDescription>
                        Click on the map to add polygon vertices. Minimum 3 points required.
                    </DialogDescription>
                </DialogHeader>

                <div className="relative" style={{ height: 420 }}>
                    <MapContainer
                        center={DEFAULT_CENTER}
                        zoom={14}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl
                    >
                        <LayersControl position="topright">
                            <LayersControl.BaseLayer
                                checked={activeBaseLayer === 'Satelit (Esri)'}
                                name="Satelit (Esri)"
                            >
                                <TileLayer
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                    attribution="Tiles &copy; Esri"
                                    maxZoom={19}
                                />
                            </LayersControl.BaseLayer>

                            <LayersControl.BaseLayer
                                checked={activeBaseLayer === 'OpenStreetMap'}
                                name="OpenStreetMap"
                            >
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                />
                            </LayersControl.BaseLayer>

                            {tilesets.map((tileset) => (
                                <LayersControl.BaseLayer
                                    key={tileset.id}
                                    checked={activeBaseLayer === tileset.name}
                                    name={tileset.name}
                                >
                                    <TileLayer
                                        url={tileset.tile_url}
                                        attribution={`Peta kustom: ${tileset.name}`}
                                        minZoom={tileset.min_zoom}
                                        maxZoom={tileset.max_zoom}
                                    />
                                </LayersControl.BaseLayer>
                            ))}
                        </LayersControl>
                        <MapInvalidator />
                        <PolygonDrawer
                            points={points}
                            onPointAdded={(p) => setPoints((prev) => [...prev, p])}
                        />
                    </MapContainer>

                    <div className="absolute bottom-3 left-3 z-[1000] rounded-md bg-black/60 px-2 py-1 text-xs text-white">
                        {points.length} point{points.length !== 1 ? 's' : ''}
                        {points.length < 3 && ' (need at least 3)'}
                    </div>

                    {points.length > 0 && (
                        <button
                            type="button"
                            onClick={() => setPoints((prev) => prev.slice(0, -1))}
                            className="absolute top-3 right-3 z-[1000] flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/80"
                        >
                            <X className="h-3 w-3" />
                            Undo
                        </button>
                    )}
                </div>

                <DialogFooter className="px-6 py-4 border-t">
                    <Button variant="outline" onClick={() => setPoints([])}>
                        Clear
                    </Button>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm} disabled={points.length < 3}>
                        Use This Zone ({points.length} pts)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---- Shared form fields ----
type GeofenceFormData = {
    name: string;
    description: string;
    color: string;
    polygon: LatLng[];
    is_active: boolean;
    zone_type: ZoneType;
};

function GeofenceFormFields({
    data,
    setData,
    errors,
    onDrawClick,
}: {
    data: GeofenceFormData;
    setData: (key: keyof GeofenceFormData, value: unknown) => void;
    errors: Partial<Record<string, string>>;
    onDrawClick: () => void;
}) {
    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={data.name}
                    onChange={(e) => setData('name', e.target.value)}
                    placeholder="e.g. Pit Area A"
                />
                <InputError message={errors.name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input
                    id="description"
                    value={data.description}
                    onChange={(e) => setData('description', e.target.value)}
                    placeholder="Optional description"
                />
                <InputError message={errors.description} />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="color">Zone Color</Label>
                    <div className="flex items-center gap-2">
                        <input
                            id="color"
                            type="color"
                            value={data.color}
                            onChange={(e) => setData('color', e.target.value)}
                            className="h-9 w-14 cursor-pointer rounded-md border border-input bg-background p-1"
                        />
                        <span className="text-sm text-muted-foreground font-mono">{data.color}</span>
                    </div>
                    <InputError message={errors.color} />
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="zone_type">Zone Type</Label>
                    <Select value={data.zone_type} onValueChange={(v) => setData('zone_type', v)}>
                        <SelectTrigger id="zone_type">
                            <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">General</SelectItem>
                            <SelectItem value="loading">Loading Zone</SelectItem>
                            <SelectItem value="dumping">Dumping Zone</SelectItem>
                            <SelectItem value="parking">Parking Zone</SelectItem>
                        </SelectContent>
                    </Select>
                    <InputError message={errors.zone_type} />
                </div>
            </div>

            <div className="grid gap-2">
                <Label>Polygon Zone</Label>
                <Button type="button" variant="outline" onClick={onDrawClick} className="w-full justify-start gap-2">
                    <MapPin className="h-4 w-4" />
                    {data.polygon.length >= 3
                        ? `Zone set (${data.polygon.length} vertices) — click to redraw`
                        : 'Draw zone on map'}
                </Button>
                <InputError message={errors.polygon} />
            </div>

            <div className="flex items-center gap-2">
                <Checkbox
                    id="is_active"
                    checked={data.is_active}
                    onCheckedChange={(v) => setData('is_active', Boolean(v))}
                />
                <Label htmlFor="is_active">Active</Label>
            </div>
        </div>
    );
}

// ---- Create dialog ----
function CreateGeofenceDialog({ tilesets }: { tilesets: Tileset[] }) {
    const [open, setOpen] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm<GeofenceFormData>({
        name: '',
        description: '',
        color: '#f59e0b',
        polygon: [],
        is_active: true,
        zone_type: 'none',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(GeofenceController.store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Zone
            </Button>

            <PolygonMapDialog
                open={mapOpen}
                initialPoints={data.polygon}
                color={data.color}
                tilesets={tilesets}
                onClose={() => {
 setMapOpen(false); setOpen(true); 
}}
                onConfirm={(pts) => {
                    setData('polygon', pts);
                    setMapOpen(false);
                    setOpen(true);
                }}
            />

            <Dialog open={open} onOpenChange={(v) => {
 setOpen(v);

 if (!v) {
reset();
} 
}}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Geofence Zone</DialogTitle>
                        <DialogDescription>Draw a polygon zone and configure alert triggers.</DialogDescription>
                    </DialogHeader>

                    <form id="create-geofence-form" onSubmit={handleSubmit}>
                        <GeofenceFormFields
                            data={data}
                            setData={(k, v) => setData(k, v as never)}
                            errors={errors}
                            onDrawClick={() => {
 setOpen(false); setMapOpen(true); 
}}
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" form="create-geofence-form" disabled={processing}>
                            Create Zone
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ---- Edit dialog ----
function EditGeofenceDialog({ geofence, tilesets }: { geofence: GeofenceRow; tilesets: Tileset[] }) {
    const [open, setOpen] = useState(false);
    const [mapOpen, setMapOpen] = useState(false);

    const { data, setData, put, processing, errors, reset } = useForm<GeofenceFormData>({
        name: geofence.name,
        description: geofence.description ?? '',
        color: geofence.color,
        polygon: geofence.polygon,
        is_active: geofence.is_active,
        zone_type: geofence.zone_type,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(GeofenceController.update.url(geofence.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    const handleOpen = () => {
        setData({
            name: geofence.name,
            description: geofence.description ?? '',
            color: geofence.color,
            polygon: geofence.polygon,
            is_active: geofence.is_active,
            zone_type: geofence.zone_type,
        });
        setOpen(true);
    };

    return (
        <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleOpen}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit</span>
            </Button>

            <PolygonMapDialog
                open={mapOpen}
                initialPoints={data.polygon}
                color={data.color}
                tilesets={tilesets}
                onClose={() => {
 setMapOpen(false); setOpen(true); 
}}
                onConfirm={(pts) => {
                    setData('polygon', pts);
                    setMapOpen(false);
                    setOpen(true);
                }}
            />

            <Dialog open={open} onOpenChange={(v) => {
 setOpen(v);

 if (!v) {
reset();
} 
}}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Geofence Zone</DialogTitle>
                        <DialogDescription>Update zone configuration for <strong>{geofence.name}</strong>.</DialogDescription>
                    </DialogHeader>

                    <form id={`edit-geofence-form-${geofence.id}`} onSubmit={handleSubmit}>
                        <GeofenceFormFields
                            data={data}
                            setData={(k, v) => setData(k, v as never)}
                            errors={errors}
                            onDrawClick={() => {
 setOpen(false); setMapOpen(true); 
}}
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" form={`edit-geofence-form-${geofence.id}`} disabled={processing}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ---- Delete dialog ----
function DeleteGeofenceDialog({ geofence }: { geofence: GeofenceRow }) {
    const [open, setOpen] = useState(false);
    const { delete: destroy, processing } = useForm({});

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setOpen(true)}
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Zone</DialogTitle>
                        <DialogDescription>
                            Delete geofence zone <strong>{geofence.name}</strong>? All device states for this zone will also be removed. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            disabled={processing}
                            onClick={() =>
                                destroy(GeofenceController.destroy.url(geofence.id), {
                                    preserveScroll: true,
                                    onSuccess: () => setOpen(false),
                                })
                            }
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ---- Page ----
export default function GeofencesIndex({ geofences, tilesets }: PageProps) {
    return (
        <>
            <Head title="Geofences" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Geofence Zones</h1>
                        <p className="text-sm text-muted-foreground">
                            Draw polygon zones on the map. Set zone type (Loading/Dumping/Parking) to enable Cycle Time detection.
                        </p>
                    </div>
                    <CreateGeofenceDialog tilesets={tilesets} />
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Zone</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Color</TableHead>
                                <TableHead>Vertices</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {geofences.length ? (
                                geofences.map((g) => (
                                    <TableRow key={g.id}>
                                        <TableCell>
                                            <div className="font-medium">{g.name}</div>
                                            {g.description && (
                                                <div className="text-xs text-muted-foreground">{g.description}</div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant="outline"
                                                className={ZONE_TYPE_BADGE[g.zone_type] ?? ZONE_TYPE_BADGE.none}
                                            >
                                                {ZONE_TYPE_LABELS[g.zone_type] ?? 'General'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="inline-block h-4 w-4 rounded-sm border"
                                                    style={{ background: g.color }}
                                                />
                                                <span className="font-mono text-xs text-muted-foreground">{g.color}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{g.vertex_count}</TableCell>
                                        <TableCell>
                                            {g.is_active ? (
                                                <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/15 text-emerald-600">
                                                    Active
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="border-slate-500/20 bg-slate-500/15 text-slate-500">
                                                    Inactive
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-1">
                                                <EditGeofenceDialog geofence={g} tilesets={tilesets} />
                                                <DeleteGeofenceDialog geofence={g} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No geofence zones configured. Add one to start monitoring device boundaries.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </>
    );
}

GeofencesIndex.layout = {
    breadcrumbs: [
        { title: 'Geofences', href: adminGeofencesIndex() },
    ],
};
