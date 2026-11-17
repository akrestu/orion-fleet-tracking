import { Head, Link, router } from '@inertiajs/react';
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import type {
    ColumnDef,
    RowSelectionState,
    SortingState,
} from '@tanstack/react-table';
import {
    ArrowDown,
    ArrowUp,
    ChevronDown,
    Eye,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    SearchX,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import DeviceController from '@/actions/App/Http/Controllers/Admin/DeviceController';
import {
    CONDITIONS,
    DeviceDialog,
    updatePayload,
} from '@/components/admin/device-form-dialog';
import type {
    AdminDevice,
    DeviceGroupRef,
    UnitCategoryMeta,
} from '@/components/admin/device-form-dialog';
import { ConditionBadge } from '@/components/orion/badges';
import { EmptyState, LastSeen } from '@/components/orion/misc';
import { UnitIcon } from '@/components/orion/unit-icon';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { BACKEND_UNIT_TYPES, unitMeta } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';
import adminDevices, {
    index as adminDevicesIndex,
} from '@/routes/admin/devices';

type PageProps = {
    devices: AdminDevice[];
    unitCategories: Record<string, UnitCategoryMeta>;
    groups: DeviceGroupRef[];
};

type Filters = {
    category: string;
    group: string;
    condition: string;
    gps: string;
};

const ALL = 'all';
const NO_GROUP = 'none';
const NO_FILTERS: Filters = {
    category: ALL,
    group: ALL,
    condition: ALL,
    gps: ALL,
};

function DeleteDeviceDialog({
    device,
    onClose,
}: {
    device: AdminDevice | null;
    onClose: () => void;
}) {
    const [processing, setProcessing] = useState(false);

    const handleDelete = () => {
        if (!device) {
            return;
        }

        router.delete(DeviceController.destroy.url(device.id), {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: onClose,
        });
    };

    return (
        <Dialog
            open={device !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Delete device</DialogTitle>
                    <DialogDescription>
                        Delete <strong>{device?.device_name}</strong>? The
                        tracker disappears from the map, dashboard and reports.
                        This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={processing}
                    >
                        Delete
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Toolbar & cells ──────────────────────────────────────────────────────────

function FilterPill({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    const active = value !== ALL;
    const current = options.find((o) => o.value === value)?.label ?? 'all';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={cn(
                    'inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    active
                        ? 'border-primary/30 bg-accent text-accent-foreground'
                        : 'border-dashed hover:bg-muted',
                )}
            >
                {label}: {current}
                <ChevronDown className="size-3.5 opacity-70" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-48">
                <DropdownMenuRadioGroup value={value} onValueChange={onChange}>
                    <DropdownMenuRadioItem value={ALL}>
                        All
                    </DropdownMenuRadioItem>
                    <DropdownMenuSeparator />
                    {options.map((o) => (
                        <DropdownMenuRadioItem key={o.value} value={o.value}>
                            {o.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function GpsStatus({ online }: { online: boolean }) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 text-sm whitespace-nowrap',
                online ? 'text-online' : 'text-offline',
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'size-1.5 rounded-full',
                    online ? 'bg-online' : 'bg-offline',
                )}
            />
            {online ? 'Online' : 'Offline'}
        </span>
    );
}

function DeviceActions({
    device,
    onEdit,
    onDelete,
}: {
    device: AdminDevice;
    onEdit: (device: AdminDevice) => void;
    onDelete: (device: AdminDevice) => void;
}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label={`Actions for ${device.device_name}`}
                className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
                <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                    <Link href={adminDevices.show.url(device.id)}>
                        <Eye /> View details
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(device)}>
                    <Pencil /> Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => onDelete(device)}
                >
                    <Trash2 /> Delete
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function DeviceCard({ device }: { device: AdminDevice }) {
    const cat = unitMeta(device.unit_type);
    const online = device.status === 'online';

    return (
        <Link
            href={adminDevices.show.url(device.id)}
            className="rounded-2xl border bg-card p-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
            <div className="flex items-center gap-3">
                <UnitIcon
                    type={cat.key}
                    variant="tile"
                    size={44}
                    muted={!online}
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                        {device.device_name}
                        {device.unit_model && ` ${device.unit_model}`}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                        {device.dev_eui}
                    </p>
                </div>
                <GpsStatus online={online} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="truncate">
                    {device.device_group?.name ?? 'No group'} ·{' '}
                    {device.last_seen_at ? (
                        <LastSeen at={device.last_seen_at} />
                    ) : (
                        'never'
                    )}
                </span>
                <ConditionBadge condition={device.operational_status} />
            </div>
        </Link>
    );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DevicesIndex({ devices, groups }: PageProps) {
    const [sorting, setSorting] = useState<SortingState>([
        { id: 'device_name', desc: false },
    ]);
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const [search, setSearch] = useState('');
    const [filters, setFilters] = useState<Filters>(NO_FILTERS);
    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 12,
    });
    const [dialogDevice, setDialogDevice] = useState<AdminDevice | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState<AdminDevice | null>(null);

    const resetPage = () => setPagination((p) => ({ ...p, pageIndex: 0 }));
    const setFilter = (key: keyof Filters) => (value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
        resetPage();
    };
    const hasFilters =
        search !== '' || Object.values(filters).some((v) => v !== ALL);
    const clearFilters = () => {
        setSearch('');
        setFilters(NO_FILTERS);
        resetPage();
    };

    const openCreate = () => {
        setDialogDevice(null);
        setDialogOpen(true);
    };
    const openEdit = (device: AdminDevice) => {
        setDialogDevice(device);
        setDialogOpen(true);
    };
    const toggleActive = (device: AdminDevice, isActive: boolean) => {
        router.put(
            DeviceController.update.url(device.id),
            { ...updatePayload(device), is_active: isActive },
            { preserveScroll: true, preserveState: true },
        );
    };

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();

        return devices.filter(
            (d) =>
                (needle === '' ||
                    d.device_name.toLowerCase().includes(needle) ||
                    d.dev_eui.toLowerCase().includes(needle) ||
                    (d.unit_model ?? '').toLowerCase().includes(needle)) &&
                (filters.category === ALL ||
                    d.unit_type === filters.category) &&
                (filters.group === ALL ||
                    (filters.group === NO_GROUP
                        ? d.device_group_id === null
                        : String(d.device_group_id) === filters.group)) &&
                (filters.condition === ALL ||
                    d.operational_status === filters.condition) &&
                (filters.gps === ALL || d.status === filters.gps),
        );
    }, [devices, search, filters]);

    const onlineCount = devices.filter((d) => d.status === 'online').length;
    const breakdownCount = devices.filter(
        (d) => d.operational_status === 'breakdown',
    ).length;
    const categoriesInUse = BACKEND_UNIT_TYPES.filter((t) =>
        devices.some((d) => d.unit_type === t),
    );

    const columns: ColumnDef<AdminDevice>[] = [
        {
            id: 'select',
            enableSorting: false,
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && 'indeterminate')
                    }
                    onCheckedChange={(v) =>
                        table.toggleAllPageRowsSelected(v === true)
                    }
                    aria-label="Select all devices on this page"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(v) => row.toggleSelected(v === true)}
                    aria-label={`Select ${row.original.device_name}`}
                />
            ),
        },
        {
            accessorKey: 'device_name',
            header: 'Device name',
            cell: ({ row }) => (
                <Link
                    href={adminDevices.show.url(row.original.id)}
                    className="font-semibold whitespace-nowrap underline-offset-2 hover:underline"
                >
                    {row.original.device_name}
                    {row.original.unit_model && ` ${row.original.unit_model}`}
                </Link>
            ),
        },
        {
            accessorKey: 'dev_eui',
            header: 'Device EUI',
            cell: ({ row }) => (
                <span className="font-mono text-xs text-muted-foreground">
                    {row.original.dev_eui}
                </span>
            ),
        },
        {
            accessorKey: 'unit_type',
            header: 'Category',
            cell: ({ row }) => {
                const cat = unitMeta(row.original.unit_type);

                return (
                    <span className="inline-flex items-center gap-2">
                        <UnitIcon type={cat.key} size={22} />
                        {cat.label}
                    </span>
                );
            },
        },
        {
            accessorKey: 'unit_model',
            header: 'Model',
            cell: ({ row }) => row.original.unit_model || '—',
        },
        {
            id: 'group',
            accessorFn: (d) => d.device_group?.name ?? '',
            header: 'Group',
            cell: ({ row }) =>
                row.original.device_group?.name ?? (
                    <span className="text-muted-foreground">—</span>
                ),
        },
        {
            accessorKey: 'operational_status',
            header: 'Condition',
            cell: ({ row }) => (
                <ConditionBadge condition={row.original.operational_status} />
            ),
        },
        {
            accessorKey: 'status',
            header: 'GPS',
            cell: ({ row }) => (
                <GpsStatus online={row.original.status === 'online'} />
            ),
        },
        {
            accessorKey: 'is_active',
            header: 'Active',
            cell: ({ row }) => (
                <Switch
                    checked={row.original.is_active}
                    onCheckedChange={(v) => toggleActive(row.original, v)}
                    aria-label={`${row.original.device_name} active`}
                />
            ),
        },
        {
            id: 'last_seen',
            accessorFn: (d) => d.last_seen_at ?? '',
            header: 'Last seen',
            cell: ({ row }) =>
                row.original.last_seen_at ? (
                    <LastSeen at={row.original.last_seen_at} />
                ) : (
                    <span className="text-muted-foreground">Never</span>
                ),
        },
        {
            id: 'actions',
            enableSorting: false,
            header: () => <span className="sr-only">Actions</span>,
            cell: ({ row }) => (
                <DeviceActions
                    device={row.original}
                    onEdit={openEdit}
                    onDelete={setDeleting}
                />
            ),
        },
    ];

    const table = useReactTable({
        data: filtered,
        columns,
        state: { sorting, rowSelection, pagination },
        onSortingChange: setSorting,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        getRowId: (d) => String(d.id),
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
    });

    const { pageIndex, pageSize } = pagination;
    const firstRow = filtered.length === 0 ? 0 : pageIndex * pageSize + 1;
    const lastRow = Math.min(filtered.length, (pageIndex + 1) * pageSize);
    const selectedCount = Object.keys(rowSelection).length;

    const noResults = (
        <EmptyState
            icon={<SearchX className="size-6" />}
            title={search ? `No devices match “${search}”` : 'No devices match'}
            actions={
                hasFilters && (
                    <Button variant="outline" onClick={clearFilters}>
                        Clear filters
                    </Button>
                )
            }
        >
            Try another name, EUI or filter.
        </EmptyState>
    );

    return (
        <>
            <Head title="Device Management" />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                            <span className="md:hidden">Devices</span>
                            <span className="hidden md:inline">
                                Device Management
                            </span>
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                            {devices.length} trackers · {onlineCount} online ·{' '}
                            {breakdownCount} breakdown
                        </p>
                    </div>
                    <Button
                        onClick={openCreate}
                        className="size-11 md:h-10 md:w-auto"
                        aria-label="Add device"
                    >
                        <Plus className="size-4" />
                        <span className="hidden md:inline">Add device</span>
                    </Button>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
                    <label className="relative block md:w-80">
                        <span className="sr-only">Search name or EUI</span>
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            type="search"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                resetPage();
                            }}
                            placeholder="Search name or EUI…"
                            className="h-11 pl-9 md:h-10"
                        />
                    </label>
                    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
                        <FilterPill
                            label="Category"
                            value={filters.category}
                            onChange={setFilter('category')}
                            options={categoriesInUse.map((t) => ({
                                value: t,
                                label: unitMeta(t).label,
                            }))}
                        />
                        <FilterPill
                            label="Group"
                            value={filters.group}
                            onChange={setFilter('group')}
                            options={[
                                ...groups.map((g) => ({
                                    value: String(g.id),
                                    label: g.name,
                                })),
                                { value: NO_GROUP, label: 'No group' },
                            ]}
                        />
                        <FilterPill
                            label="Condition"
                            value={filters.condition}
                            onChange={setFilter('condition')}
                            options={CONDITIONS}
                        />
                        <FilterPill
                            label="GPS"
                            value={filters.gps}
                            onChange={setFilter('gps')}
                            options={[
                                { value: 'online', label: 'Online' },
                                { value: 'offline', label: 'Offline' },
                            ]}
                        />
                    </div>
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
                    {filtered.length === 0 ? (
                        noResults
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-sidebar text-left text-muted-foreground">
                                    {table.getHeaderGroups().map((hg) => (
                                        <tr key={hg.id} className="h-[38px]">
                                            {hg.headers.map((header) => {
                                                const sorted =
                                                    header.column.getIsSorted();
                                                const right =
                                                    header.column.id ===
                                                    'last_seen';
                                                const content = flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                );

                                                return (
                                                    <th
                                                        key={header.id}
                                                        aria-sort={
                                                            sorted === 'asc'
                                                                ? 'ascending'
                                                                : sorted ===
                                                                    'desc'
                                                                  ? 'descending'
                                                                  : undefined
                                                        }
                                                        className={cn(
                                                            'px-3 font-medium whitespace-nowrap first:w-10 first:pl-4',
                                                            right &&
                                                                'text-right',
                                                        )}
                                                    >
                                                        {header.column.getCanSort() ? (
                                                            <button
                                                                type="button"
                                                                onClick={header.column.getToggleSortingHandler()}
                                                                className="inline-flex items-center gap-1 hover:text-foreground"
                                                            >
                                                                {content}
                                                                {sorted ===
                                                                    'asc' && (
                                                                    <ArrowDown className="size-3.5" />
                                                                )}
                                                                {sorted ===
                                                                    'desc' && (
                                                                    <ArrowUp className="size-3.5" />
                                                                )}
                                                            </button>
                                                        ) : (
                                                            content
                                                        )}
                                                    </th>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </thead>
                                <tbody>
                                    {table.getRowModel().rows.map((row) => (
                                        <tr
                                            key={row.id}
                                            className={cn(
                                                'h-11 border-t transition-colors hover:bg-muted/40',
                                                row.getIsSelected() &&
                                                    'bg-accent/50',
                                            )}
                                        >
                                            {row
                                                .getVisibleCells()
                                                .map((cell) => (
                                                    <td
                                                        key={cell.id}
                                                        className={cn(
                                                            'px-3 py-1.5 whitespace-nowrap first:pl-4',
                                                            cell.column.id ===
                                                                'last_seen' &&
                                                                'text-right',
                                                        )}
                                                    >
                                                        {flexRender(
                                                            cell.column
                                                                .columnDef.cell,
                                                            cell.getContext(),
                                                        )}
                                                    </td>
                                                ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="flex items-center justify-between gap-4 border-t px-4 py-3 text-sm text-muted-foreground">
                        <span className="tabular-nums">
                            Showing {firstRow}–{lastRow} of {filtered.length}
                            {selectedCount > 0 &&
                                ` · ${selectedCount} selected`}
                        </span>
                        <div className="flex items-center gap-2">
                            <span>Rows</span>
                            <Select
                                value={String(pageSize)}
                                onValueChange={(v) =>
                                    setPagination({
                                        pageIndex: 0,
                                        pageSize: Number(v),
                                    })
                                }
                            >
                                <SelectTrigger
                                    aria-label="Rows per page"
                                    className="h-9 w-[72px]"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[12, 25, 50, 100].map((n) => (
                                        <SelectItem key={n} value={String(n)}>
                                            {n}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                Previous
                            </Button>
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

                {/* Mobile cards */}
                <div className="-mx-4 flex flex-col gap-3 border-t bg-muted/40 px-4 pt-4 md:hidden">
                    {filtered.length === 0
                        ? noResults
                        : filtered.map((device) => (
                              <DeviceCard key={device.id} device={device} />
                          ))}
                </div>
            </div>

            <DeviceDialog
                key={dialogDevice?.id ?? 'new'}
                device={dialogDevice}
                groups={groups}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
            />
            <DeleteDeviceDialog
                device={deleting}
                onClose={() => setDeleting(null)}
            />
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
