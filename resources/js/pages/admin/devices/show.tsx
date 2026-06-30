import { Head, Link } from '@inertiajs/react';
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
} from '@tanstack/react-table';
import { ArrowLeft, ArrowUpDown } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { UNIT_CATEGORIES, type UnitCategory } from '@/config/unit-types';
import { index as adminDevicesIndex } from '@/routes/admin/devices';

type AdminDevice = {
    id: number;
    dev_eui: string;
    join_eui: string | null;
    application_id: string;
    device_name: string;
    unit_type: UnitCategory;
    unit_model: string | null;
    is_active: boolean;
    status: 'online' | 'offline';
    last_seen_at: string | null;
};

type GpsLogRow = {
    recorded_at: string | null;
    latitude: number | null;
    longitude: number | null;
    speed_kmh: number | null;
    heading_deg: number | null;
    rssi: number | null;
    snr: number | null;
    satellites: number | null;
    hdop: number | null;
};

type PageProps = {
    device: AdminDevice;
    gpsLogs: GpsLogRow[];
};

const STATUS_BADGE: Record<'online' | 'offline', string> = {
    online: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/20',
    offline: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
};

function DeviceInfoCard({ device }: { device: AdminDevice }) {
    const cat = UNIT_CATEGORIES[device.unit_type] ?? UNIT_CATEGORIES.other;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">Device Info</CardTitle>
            </CardHeader>
            <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
                    <div>
                        <dt className="text-muted-foreground">Device EUI</dt>
                        <dd className="font-mono font-medium">{device.dev_eui}</dd>
                    </div>
                    {device.join_eui && (
                        <div>
                            <dt className="text-muted-foreground">Join EUI</dt>
                            <dd className="font-mono">{device.join_eui}</dd>
                        </div>
                    )}
                    <div>
                        <dt className="text-muted-foreground">Application ID</dt>
                        <dd>{device.application_id}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Category</dt>
                        <dd>
                            <span
                                className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold text-white"
                                style={{ backgroundColor: cat.color }}
                            >
                                {cat.abbr}
                            </span>{' '}
                            <span className="text-muted-foreground">{cat.label}</span>
                        </dd>
                    </div>
                    {device.unit_model && (
                        <div>
                            <dt className="text-muted-foreground">Model</dt>
                            <dd>{device.unit_model}</dd>
                        </div>
                    )}
                    <div>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd>
                            <Badge variant="outline" className={STATUS_BADGE[device.status]}>
                                {device.status}
                            </Badge>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Active</dt>
                        <dd>
                            <Badge
                                variant="outline"
                                className={
                                    device.is_active
                                        ? 'border-emerald-500/20 bg-emerald-500/15 text-emerald-600'
                                        : 'border-slate-500/20 bg-slate-500/15 text-slate-500'
                                }
                            >
                                {device.is_active ? 'Yes' : 'No'}
                            </Badge>
                        </dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Last Seen</dt>
                        <dd>{device.last_seen_at ?? '—'}</dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}

function GpsHistoryTable({ gpsLogs }: { gpsLogs: GpsLogRow[] }) {
    const [sorting, setSorting] = useState<SortingState>([]);

    const columns: ColumnDef<GpsLogRow>[] = [
        {
            accessorKey: 'recorded_at',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Time
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <span className="text-sm tabular-nums">{row.original.recorded_at ?? '—'}</span>
            ),
        },
        {
            id: 'coordinates',
            header: 'Coordinates',
            cell: ({ row }) => {
                const { latitude: lat, longitude: lng } = row.original;
                if (lat == null || lng == null) return <span className="text-muted-foreground">—</span>;
                return (
                    <span className="font-mono text-xs tabular-nums">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                    </span>
                );
            },
        },
        {
            accessorKey: 'speed_kmh',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Speed
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const v = row.original.speed_kmh;
                return (
                    <span className="tabular-nums">
                        {v != null ? `${v.toFixed(1)} km/h` : '—'}
                    </span>
                );
            },
        },
        {
            accessorKey: 'heading_deg',
            header: 'Heading',
            cell: ({ row }) => {
                const v = row.original.heading_deg;
                return <span className="tabular-nums">{v != null ? `${v.toFixed(0)}°` : '—'}</span>;
            },
        },
        {
            accessorKey: 'rssi',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    RSSI
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                const v = row.original.rssi;
                return <span className="tabular-nums">{v != null ? `${v} dBm` : '—'}</span>;
            },
        },
        {
            accessorKey: 'snr',
            header: 'SNR',
            cell: ({ row }) => {
                const v = row.original.snr;
                return <span className="tabular-nums">{v != null ? `${v.toFixed(1)} dB` : '—'}</span>;
            },
        },
        {
            accessorKey: 'satellites',
            header: 'Sats',
            cell: ({ row }) => (
                <span className="tabular-nums">{row.original.satellites ?? '—'}</span>
            ),
        },
        {
            accessorKey: 'hdop',
            header: 'HDOP',
            cell: ({ row }) => {
                const v = row.original.hdop;
                return <span className="tabular-nums">{v != null ? v.toFixed(2) : '—'}</span>;
            },
        },
    ];

    const table = useReactTable({
        data: gpsLogs,
        columns,
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 25 } },
    });

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base">
                    GPS History{' '}
                    <span className="text-sm font-normal text-muted-foreground">
                        (last {gpsLogs.length} records)
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="rounded-b-md border-t">
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
                                table.getRowModel().rows.map((row, i) => (
                                    <TableRow key={i}>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                        No GPS records found.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
                    <span>{gpsLogs.length} record(s) total</span>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                            Previous
                        </Button>
                        <span>
                            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                        </span>
                        <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                            Next
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function DeviceShow({ device, gpsLogs }: PageProps) {
    return (
        <>
            <Head title={`${device.device_name} – Device Detail`} />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" asChild>
                        <Link href={adminDevicesIndex()}>
                            <ArrowLeft className="h-4 w-4" />
                            <span className="sr-only">Back to Device Management</span>
                        </Link>
                    </Button>
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">{device.device_name}</h1>
                        <p className="font-mono text-sm text-muted-foreground">{device.dev_eui}</p>
                    </div>
                </div>

                <DeviceInfoCard device={device} />
                <GpsHistoryTable gpsLogs={gpsLogs} />
            </div>
        </>
    );
}

DeviceShow.layout = {
    breadcrumbs: [
        { title: 'Device Management', href: adminDevicesIndex() },
        { title: 'Device Detail' },
    ],
};
