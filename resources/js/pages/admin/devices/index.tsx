import { Head, Link, useForm } from '@inertiajs/react';
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowUpDown, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import DeviceController from '@/actions/App/Http/Controllers/Admin/DeviceController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
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
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { UNIT_CATEGORIES, type UnitCategory } from '@/config/unit-types';
import adminDevices, { index as adminDevicesIndex } from '@/routes/admin/devices';

type DeviceGroupRef = {
    id: number;
    name: string;
    color: string;
};

type OperationalStatus = 'operational' | 'standby' | 'breakdown';

type AdminDevice = {
    id: number;
    device_group_id: number | null;
    device_group: DeviceGroupRef | null;
    dev_eui: string;
    join_eui: string | null;
    application_id: string;
    device_name: string;
    unit_type: UnitCategory;
    unit_model: string | null;
    is_active: boolean;
    operational_status: OperationalStatus;
    status: 'online' | 'offline';
    last_seen_at: string | null;
};

type UnitCategoryMeta = {
    label: string;
    models: readonly string[];
};

type PageProps = {
    devices: AdminDevice[];
    unitCategories: Record<string, UnitCategoryMeta>;
    groups: DeviceGroupRef[];
};

const STATUS_BADGE: Record<'online' | 'offline', string> = {
    online: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
    offline: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
};

const OPERATIONAL_STATUS_BADGE: Record<OperationalStatus, string> = {
    operational: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
    standby:     'bg-amber-500/15 text-amber-600 border-amber-500/20',
    breakdown:   'bg-red-500/15 text-red-600 border-red-500/20',
};

const OPERATIONAL_STATUS_LABEL: Record<OperationalStatus, string> = {
    operational: 'Operational',
    standby:     'Standby',
    breakdown:   'Breakdown',
};

// ── Shared form fields ───────────────────────────────────────────────────────

function DeviceFormFields({
    errors,
    values,
    onChange,
    showDevEui,
    groups,
}: {
    errors: Partial<Record<string, string>>;
    values: {
        dev_eui?: string;
        join_eui?: string;
        application_id: string;
        device_name: string;
        unit_type: string;
        unit_model: string;
        is_active: boolean;
        operational_status: string;
        device_group_id: number | null;
    };
    onChange: (field: string, value: string | boolean | number | null) => void;
    showDevEui: boolean;
    groups: DeviceGroupRef[];
}) {
    const unitTypeOptions: ComboboxOption[] = Object.entries(UNIT_CATEGORIES).map(([key, meta]) => ({
        value: key,
        label: meta.label,
        prefix: (
            <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: meta.color }}
            />
        ),
    }));

    const selectedCat = UNIT_CATEGORIES[values.unit_type as UnitCategory];
    const models = selectedCat?.models ?? [];

    const unitModelOptions: ComboboxOption[] = models.map((m) => ({ value: m, label: m }));

    const groupOptions: ComboboxOption[] = [
        { value: '__none__', label: '— No group —' },
        ...groups.map((g) => ({
            value: g.id.toString(),
            label: g.name,
            prefix: (
                <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: g.color }}
                />
            ),
        })),
    ];

    const handleUnitTypeChange = (v: string) => {
        onChange('unit_type', v);
        onChange('unit_model', '');
    };

    const handleGroupChange = (v: string) => {
        onChange('device_group_id', v === '__none__' ? null : parseInt(v, 10));
    };

    return (
        <div className="space-y-4">
            {showDevEui && (
                <div className="grid gap-2">
                    <Label htmlFor="dev_eui">Device EUI</Label>
                    <Input
                        id="dev_eui"
                        value={values.dev_eui ?? ''}
                        onChange={(e) => onChange('dev_eui', e.target.value)}
                        placeholder="e.g. 0004A30B001C5EBF"
                        autoComplete="off"
                        maxLength={16}
                        className="font-mono"
                    />
                    <InputError message={errors.dev_eui} />
                </div>
            )}

            <div className="grid gap-2">
                <Label htmlFor="join_eui">
                    Join EUI <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                    id="join_eui"
                    value={values.join_eui ?? ''}
                    onChange={(e) => onChange('join_eui', e.target.value)}
                    placeholder="e.g. 0000000000000000"
                    autoComplete="off"
                    maxLength={16}
                    className="font-mono"
                />
                <InputError message={errors.join_eui} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="device_name">Device Name</Label>
                <Input
                    id="device_name"
                    value={values.device_name}
                    onChange={(e) => onChange('device_name', e.target.value)}
                    placeholder="e.g. Hauler Unit 01"
                    autoComplete="off"
                />
                <InputError message={errors.device_name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="application_id">Application ID</Label>
                <Input
                    id="application_id"
                    value={values.application_id}
                    onChange={(e) => onChange('application_id', e.target.value)}
                    placeholder="e.g. fleet-tracker"
                    autoComplete="off"
                />
                <InputError message={errors.application_id} />
            </div>

            <div className="grid gap-2">
                <Label>Category</Label>
                <Combobox
                    options={unitTypeOptions}
                    value={values.unit_type}
                    onValueChange={handleUnitTypeChange}
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                />
                <InputError message={errors.unit_type} />
            </div>

            <div className="grid gap-2">
                <Label>
                    Model <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                {models.length > 0 ? (
                    <>
                        <Combobox
                            options={unitModelOptions}
                            value={values.unit_model}
                            onValueChange={(v) => onChange('unit_model', v)}
                            placeholder="Select model"
                            searchPlaceholder="Search model..."
                            emptyText="No preset models."
                        />
                        <Input
                            value={values.unit_model}
                            onChange={(e) => onChange('unit_model', e.target.value)}
                            placeholder="Or type custom model name..."
                            autoComplete="off"
                        />
                    </>
                ) : (
                    <Input
                        value={values.unit_model}
                        onChange={(e) => onChange('unit_model', e.target.value)}
                        placeholder="Model name (optional)"
                        autoComplete="off"
                    />
                )}
                <InputError message={errors.unit_model} />
            </div>

            <div className="flex items-center gap-2">
                <Checkbox
                    id="is_active"
                    checked={values.is_active}
                    onCheckedChange={(checked) => onChange('is_active', Boolean(checked))}
                />
                <Label htmlFor="is_active">Active</Label>
            </div>

            <div className="grid gap-2">
                <Label>Operational Status</Label>
                <Select value={values.operational_status} onValueChange={(v) => onChange('operational_status', v)}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="operational">Operational</SelectItem>
                        <SelectItem value="standby">Standby</SelectItem>
                        <SelectItem value="breakdown">Breakdown</SelectItem>
                    </SelectContent>
                </Select>
                <InputError message={errors.operational_status} />
                <p className="text-muted-foreground text-xs">
                    Standby & Breakdown otomatis dikecualikan dari laporan Fleet Utilization.
                </p>
            </div>

            {groups.length > 0 && (
                <div className="grid gap-2">
                    <Label>Group / Site</Label>
                    <Combobox
                        options={groupOptions}
                        value={values.device_group_id?.toString() ?? '__none__'}
                        onValueChange={handleGroupChange}
                        placeholder="No group"
                        searchPlaceholder="Search group..."
                    />
                    <InputError message={errors.device_group_id} />
                </div>
            )}
        </div>
    );
}

// ── Dialogs ──────────────────────────────────────────────────────────────────

function CreateDeviceDialog({ groups }: { groups: DeviceGroupRef[] }) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        dev_eui: '',
        join_eui: '',
        application_id: '',
        device_name: '',
        unit_type: 'oht',
        unit_model: '',
        is_active: true,
        operational_status: 'operational',
        device_group_id: null as number | null,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(DeviceController.store.url(), {
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
                Add Device
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add Device</DialogTitle>
                        <DialogDescription>Register a new device in the system.</DialogDescription>
                    </DialogHeader>

                    <form id="create-device-form" onSubmit={handleSubmit} className="py-2">
                        <DeviceFormFields
                            errors={errors}
                            values={data}
                            onChange={(field, value) => setData(field as keyof typeof data, value as never)}
                            showDevEui
                            groups={groups}
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="create-device-form" disabled={processing}>
                            Add Device
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function EditDeviceDialog({ device, groups }: { device: AdminDevice; groups: DeviceGroupRef[] }) {
    const [open, setOpen] = useState(false);

    const { data, setData, put, processing, errors, reset } = useForm({
        join_eui: device.join_eui ?? '',
        application_id: device.application_id,
        device_name: device.device_name,
        unit_type: device.unit_type,
        unit_model: device.unit_model ?? '',
        is_active: device.is_active,
        operational_status: device.operational_status,
        device_group_id: device.device_group_id as number | null,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(DeviceController.update.url(device.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                    setData({
                        join_eui: device.join_eui ?? '',
                        application_id: device.application_id,
                        device_name: device.device_name,
                        unit_type: device.unit_type,
                        unit_model: device.unit_model ?? '',
                        is_active: device.is_active,
                        operational_status: device.operational_status,
                        device_group_id: device.device_group_id as number | null,
                    });
                    setOpen(true);
                }}
            >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit {device.device_name}</span>
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Device</DialogTitle>
                        <DialogDescription>
                            Update {device.device_name}{' '}
                            <span className="font-mono text-xs">({device.dev_eui})</span>
                        </DialogDescription>
                    </DialogHeader>

                    <form id={`edit-device-form-${device.id}`} onSubmit={handleSubmit} className="py-2">
                        <DeviceFormFields
                            errors={errors}
                            values={data}
                            onChange={(field, value) => setData(field as keyof typeof data, value as never)}
                            showDevEui={false}
                            groups={groups}
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form={`edit-device-form-${device.id}`} disabled={processing}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DeleteDeviceDialog({ device }: { device: AdminDevice }) {
    const [open, setOpen] = useState(false);
    const { delete: destroy, processing } = useForm({});

    const handleDelete = () => {
        destroy(DeviceController.destroy.url(device.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => setOpen(true)}
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete {device.device_name}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Device</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{device.device_name}</strong>? This action cannot
                            be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={processing}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DevicesIndex({ devices, groups }: PageProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const columns: ColumnDef<AdminDevice>[] = [
        {
            accessorKey: 'device_name',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
        },
        {
            accessorKey: 'dev_eui',
            header: 'Device EUI',
            cell: ({ row }) => (
                <span className="font-mono text-xs">{row.original.dev_eui}</span>
            ),
        },
        {
            accessorKey: 'unit_type',
            header: 'Category',
            cell: ({ row }) => {
                const cat = UNIT_CATEGORIES[row.original.unit_type] ?? UNIT_CATEGORIES.other;
                return (
                    <span
                        className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold text-white"
                        style={{ backgroundColor: cat.color }}
                    >
                        {cat.abbr}
                    </span>
                );
            },
        },
        {
            accessorKey: 'unit_model',
            header: 'Model',
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground">
                    {row.original.unit_model || '—'}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'GPS',
            cell: ({ row }) => {
                const status = row.original.status;
                return (
                    <Badge variant="outline" className={STATUS_BADGE[status]}>
                        {status}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'operational_status',
            header: 'Kondisi',
            cell: ({ row }) => {
                const os = row.original.operational_status;
                return (
                    <Badge variant="outline" className={OPERATIONAL_STATUS_BADGE[os]}>
                        {OPERATIONAL_STATUS_LABEL[os]}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'is_active',
            header: 'Active',
            cell: ({ row }) =>
                row.original.is_active ? (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20">
                        Yes
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-slate-500/15 text-slate-500 border-slate-500/20">
                        No
                    </Badge>
                ),
        },
        {
            accessorKey: 'device_group',
            header: 'Group',
            cell: ({ row }) => {
                const g = row.original.device_group;
                if (!g) return <span className="text-muted-foreground text-xs">—</span>;
                return (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
                        {g.name}
                    </span>
                );
            },
        },
        {
            accessorKey: 'last_seen_at',
            header: 'Last Seen',
            cell: ({ row }) => (
                <span className="text-muted-foreground text-sm">{row.original.last_seen_at ?? '—'}</span>
            ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                        <Link href={adminDevices.show.url(row.original.id)}>
                            <Eye className="h-4 w-4" />
                            <span className="sr-only">View {row.original.device_name}</span>
                        </Link>
                    </Button>
                    <EditDeviceDialog device={row.original} groups={groups} />
                    <DeleteDeviceDialog device={row.original} />
                </div>
            ),
        },
    ];

    const table = useReactTable({
        data: devices,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 20 } },
    });

    return (
        <>
            <Head title="Device Management" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Device Management</h1>
                        <p className="text-sm text-muted-foreground">Manage registered tracking devices.</p>
                    </div>
                    <CreateDeviceDialog groups={groups} />
                </div>

                <div className="flex flex-col gap-4">
                    <Input
                        placeholder="Search by name, EUI, model..."
                        value={globalFilter}
                        onChange={(e) => setGlobalFilter(e.target.value)}
                        className="max-w-sm"
                    />

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((hg) => (
                                    <TableRow key={hg.id}>
                                        {hg.headers.map((header) => (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow key={row.id}>
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell
                                            colSpan={columns.length}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            No devices found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{table.getFilteredRowModel().rows.length} device(s) total</span>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                Previous
                            </Button>
                            <span>
                                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

DevicesIndex.layout = {
    breadcrumbs: [
        {
            title: 'Device Management',
            href: adminDevicesIndex(),
        },
    ],
};
