import { Head, useForm } from '@inertiajs/react';
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
import { ArrowUpDown, CheckCircle, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import AlertController from '@/actions/App/Http/Controllers/Admin/AlertController';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { index as adminAlertsIndex } from '@/routes/admin/alerts';

type AlertType = 'overspeed' | 'geofence' | 'offline' | 'low_signal';

type AdminAlert = {
    id: number;
    dev_eui: string;
    device_name: string | null;
    alert_type: AlertType;
    triggered_at: string | null;
    triggered_at_human: string | null;
    resolved_at: string | null;
    is_resolved: boolean;
    meta: Record<string, unknown> | null;
};

type DeviceOption = {
    dev_eui: string;
    device_name: string;
};

type PageProps = {
    alerts: AdminAlert[];
    devices: DeviceOption[];
};

// Alert type carries severity via the same 4-state Orion status vocabulary
// used for device status everywhere else — overspeed/geofence are threshold
// breaches (warning), offline matches the status literally, and low signal
// is a degraded (not yet failed) connection, also a warning.
const ALERT_TYPE_VARIANT: Record<AlertType, BadgeVariant> = {
    overspeed: 'warning',
    geofence: 'warning',
    offline: 'offline',
    low_signal: 'warning',
};

const ALERT_TYPE_LABEL: Record<AlertType, string> = {
    overspeed: 'Overspeed',
    geofence: 'Geofence',
    offline: 'Offline',
    low_signal: 'Low Signal',
};

function ResolveAlertButton({ alert }: { alert: AdminAlert }) {
    const { patch, processing } = useForm({});

    if (alert.is_resolved) return null;

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-status-online hover:text-status-online"
            onClick={() => patch(AlertController.resolve.url(alert.id), { preserveScroll: true })}
            disabled={processing}
            title="Resolve alert"
        >
            <CheckCircle className="h-4 w-4" />
            <span className="sr-only">Resolve alert</span>
        </Button>
    );
}

function DeleteAlertDialog({ alert }: { alert: AdminAlert }) {
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
                <span className="sr-only">Delete alert</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Alert</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this{' '}
                            <strong>{ALERT_TYPE_LABEL[alert.alert_type]}</strong> alert? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={processing}
                            onClick={() =>
                                destroy(AlertController.destroy.url(alert.id), {
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

export default function AlertsIndex({ alerts, devices }: PageProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'resolved'>('all');
    const [deviceFilter, setDeviceFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const hasActiveFilters = statusFilter !== 'all' || deviceFilter !== 'all' || dateFrom !== '' || dateTo !== '' || globalFilter !== '';

    const filteredAlerts = useMemo(() => {
        return alerts.filter((a) => {
            if (statusFilter === 'active' && a.is_resolved) return false;
            if (statusFilter === 'resolved' && !a.is_resolved) return false;
            if (deviceFilter !== 'all' && a.dev_eui !== deviceFilter) return false;
            if (dateFrom && a.triggered_at && a.triggered_at < dateFrom) return false;
            if (dateTo && a.triggered_at && a.triggered_at > dateTo + 'T23:59:59') return false;
            return true;
        });
    }, [alerts, statusFilter, deviceFilter, dateFrom, dateTo]);

    const clearFilters = () => {
        setStatusFilter('all');
        setDeviceFilter('all');
        setDateFrom('');
        setDateTo('');
        setGlobalFilter('');
    };

    const columns: ColumnDef<AdminAlert>[] = [
        {
            accessorKey: 'alert_type',
            header: 'Type',
            cell: ({ row }) => (
                <Badge variant={ALERT_TYPE_VARIANT[row.original.alert_type]}>
                    {ALERT_TYPE_LABEL[row.original.alert_type]}
                </Badge>
            ),
        },
        {
            accessorKey: 'device_name',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Device
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <div>
                    <div className="font-medium">{row.original.device_name ?? '—'}</div>
                    <div className="font-mono text-xs text-muted-foreground">{row.original.dev_eui}</div>
                </div>
            ),
        },
        {
            accessorKey: 'triggered_at',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Triggered
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="text-sm text-muted-foreground" title={row.original.triggered_at ?? ''}>
                    {row.original.triggered_at_human ?? '—'}
                </span>
            ),
        },
        {
            accessorKey: 'is_resolved',
            header: 'Status',
            cell: ({ row }) =>
                row.original.is_resolved ? (
                    <div>
                        <Badge variant="online">Resolved</Badge>
                        {row.original.resolved_at && (
                            <div className="mt-0.5 text-xs text-muted-foreground">{row.original.resolved_at}</div>
                        )}
                    </div>
                ) : (
                    <Badge variant="danger">Active</Badge>
                ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <ResolveAlertButton alert={row.original} />
                    <DeleteAlertDialog alert={row.original} />
                </div>
            ),
        },
    ];

    const table = useReactTable({
        data: filteredAlerts,
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

    const activeCount = alerts.filter((a) => !a.is_resolved).length;

    return (
        <>
            <Head title="Alert Management" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Alert Management</h1>
                        <p className="text-sm text-muted-foreground">
                            {activeCount > 0 ? (
                                <>
                                    <span className="font-medium text-status-danger">{activeCount} active</span> alert
                                    {activeCount !== 1 ? 's' : ''} requiring attention.
                                </>
                            ) : (
                                'All alerts have been resolved.'
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {/* Filters */}
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">Search</Label>
                            <Input
                                placeholder="Search by device, type..."
                                value={globalFilter}
                                onChange={(e) => setGlobalFilter(e.target.value)}
                                className="w-52"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                                <SelectTrigger className="w-36">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All statuses</SelectItem>
                                    <SelectItem value="active">Active only</SelectItem>
                                    <SelectItem value="resolved">Resolved only</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">Device</Label>
                            <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All devices</SelectItem>
                                    {devices.map((d) => (
                                        <SelectItem key={d.dev_eui} value={d.dev_eui}>
                                            {d.device_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">From date</Label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-40"
                            />
                        </div>

                        <div className="flex flex-col gap-1">
                            <Label className="text-xs text-muted-foreground">To date</Label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-40"
                            />
                        </div>

                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 self-end">
                                <X className="h-3.5 w-3.5" />
                                Clear filters
                            </Button>
                        )}
                    </div>

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
                                            No alerts found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{table.getFilteredRowModel().rows.length} alert(s) shown</span>
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

AlertsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Alert Management',
            href: adminAlertsIndex(),
        },
    ],
};
