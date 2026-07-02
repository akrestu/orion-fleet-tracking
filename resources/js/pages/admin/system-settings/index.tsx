import { Head, useForm, usePage } from '@inertiajs/react';
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { Copy, KeyRound, Plus, Server, Shield, Trash2 } from 'lucide-react';
import { useState } from 'react';
import InputError from '@/components/input-error';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import adminApiTokens from '@/routes/admin/api-tokens';
import adminSystemSettings from '@/routes/admin/system-settings';
import { index as systemSettingsIndex } from '@/routes/admin/system-settings';

type MqttSettings = {
    mqtt_host: string;
    mqtt_port: string;
    mqtt_username: string;
    mqtt_password: string;
    mqtt_topic_prefix: string;
    mqtt_use_tls: boolean;
};

type ApiToken = {
    id: number;
    name: string;
    token_preview: string;
    abilities: string[];
    last_used_at: string | null;
    expires_at: string | null;
    created_by: string | null;
    created_at: string;
};

type AuditEntry = {
    id: number;
    event: string;
    description: string;
    user: string;
    ip_address: string | null;
    created_at: string;
};

type AuditLogs = {
    data: AuditEntry[];
    total: number;
    current_page: number;
    last_page: number;
};

type PageProps = {
    mqttSettings: MqttSettings;
    apiTokens: ApiToken[];
    auditLogs: AuditLogs;
    flash?: { new_token?: string; success?: string };
};

const EVENT_VARIANT: Record<string, BadgeVariant> = {
    login: 'online',
    logout: 'offline',
    settings_updated: 'outline',
    api_token_created: 'warning',
    api_token_deleted: 'danger',
};

// ── MQTT Panel ────────────────────────────────────────────────────────────────

function MqttPanel({ settings }: { settings: MqttSettings }) {
    const { data, setData, put, processing, errors } = useForm({
        mqtt_host: settings.mqtt_host,
        mqtt_port: settings.mqtt_port,
        mqtt_username: settings.mqtt_username,
        mqtt_password: settings.mqtt_password,
        mqtt_topic_prefix: settings.mqtt_topic_prefix,
        mqtt_use_tls: settings.mqtt_use_tls,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(adminSystemSettings.update.url(), { preserveScroll: true });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>MQTT Broker</CardTitle>
                <CardDescription>Connection settings for the MQTT broker used to receive device telemetry.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="mqtt_host">Broker Host</Label>
                        <Input
                            id="mqtt_host"
                            value={data.mqtt_host}
                            onChange={(e) => setData('mqtt_host', e.target.value)}
                            placeholder="e.g. mqtt.example.com"
                            autoComplete="off"
                        />
                        <InputError message={errors.mqtt_host} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="mqtt_port">Port</Label>
                        <Input
                            id="mqtt_port"
                            type="number"
                            min={1}
                            max={65535}
                            value={data.mqtt_port}
                            onChange={(e) => setData('mqtt_port', e.target.value)}
                            placeholder="1883"
                        />
                        <InputError message={errors.mqtt_port} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="mqtt_username">Username <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                            id="mqtt_username"
                            value={data.mqtt_username}
                            onChange={(e) => setData('mqtt_username', e.target.value)}
                            autoComplete="off"
                        />
                        <InputError message={errors.mqtt_username} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="mqtt_password">Password <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                            id="mqtt_password"
                            type="password"
                            value={data.mqtt_password}
                            onChange={(e) => setData('mqtt_password', e.target.value)}
                            autoComplete="new-password"
                        />
                        <InputError message={errors.mqtt_password} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="mqtt_topic_prefix">Topic Prefix <span className="text-muted-foreground font-normal">(optional)</span></Label>
                        <Input
                            id="mqtt_topic_prefix"
                            value={data.mqtt_topic_prefix}
                            onChange={(e) => setData('mqtt_topic_prefix', e.target.value)}
                            placeholder="e.g. fleet/"
                            autoComplete="off"
                        />
                        <InputError message={errors.mqtt_topic_prefix} />
                    </div>

                    <div className="flex items-center gap-3">
                        <Switch
                            id="mqtt_use_tls"
                            checked={data.mqtt_use_tls}
                            onCheckedChange={(v) => setData('mqtt_use_tls', v)}
                        />
                        <Label htmlFor="mqtt_use_tls">Use TLS / SSL</Label>
                    </div>
                </CardContent>

                <CardFooter className="pt-2">
                    <Button type="submit" disabled={processing}>Save MQTT Settings</Button>
                </CardFooter>
            </form>
        </Card>
    );
}

// ── API Keys Panel ─────────────────────────────────────────────────────────────

function NewTokenBanner({ token, onDismiss }: { token: string; onDismiss: () => void }) {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(token);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="rounded-lg border border-status-warning/30 bg-status-warning-bg p-4 space-y-2">
            <p className="text-sm font-medium text-status-warning">
                Copy your new API token now — it won't be shown again.
            </p>
            <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-background px-3 py-2 font-mono text-xs break-all border">
                    {token}
                </code>
                <Button size="sm" variant="outline" onClick={copy}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    {copied ? 'Copied!' : 'Copy'}
                </Button>
            </div>
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={onDismiss}>
                Dismiss
            </Button>
        </div>
    );
}

function CreateTokenDialog() {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        expires_at: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(adminApiTokens.store.url(), {
            preserveScroll: true,
            onSuccess: () => { setOpen(false); reset(); },
        });
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Token
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create API Token</DialogTitle>
                        <DialogDescription>Generate a new API token for programmatic access.</DialogDescription>
                    </DialogHeader>

                    <form id="create-token-form" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid gap-2">
                            <Label htmlFor="token_name">Token Name</Label>
                            <Input
                                id="token_name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="e.g. CI Pipeline"
                                autoComplete="off"
                            />
                            <InputError message={errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="expires_at">Expires At <span className="text-muted-foreground font-normal">(optional)</span></Label>
                            <Input
                                id="expires_at"
                                type="date"
                                value={data.expires_at}
                                onChange={(e) => setData('expires_at', e.target.value)}
                            />
                            <InputError message={errors.expires_at} />
                        </div>
                    </form>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" form="create-token-form" disabled={processing}>
                            Generate Token
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DeleteTokenDialog({ token }: { token: ApiToken }) {
    const [open, setOpen] = useState(false);
    const { delete: destroy, processing } = useForm({});

    const handleDelete = () => {
        destroy(adminApiTokens.destroy.url(token.id), {
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
                <span className="sr-only">Revoke {token.name}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke Token</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to revoke <strong>{token.name}</strong>? Any apps using this token will lose access immediately.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={processing}>Revoke</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ApiTokensPanel({ tokens }: { tokens: ApiToken[] }) {
    const { flash } = usePage<{ flash: { new_token?: string } }>().props;
    const [dismissed, setDismissed] = useState(false);
    const newToken = flash?.new_token;

    const columns: ColumnDef<ApiToken>[] = [
        {
            accessorKey: 'name',
            header: 'Name',
        },
        {
            accessorKey: 'token_preview',
            header: 'Token',
            cell: ({ row }) => (
                <code className="font-mono text-xs text-muted-foreground">{row.original.token_preview}</code>
            ),
        },
        {
            accessorKey: 'created_by',
            header: 'Created By',
            cell: ({ row }) => <span className="text-sm">{row.original.created_by ?? '—'}</span>,
        },
        {
            accessorKey: 'last_used_at',
            header: 'Last Used',
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.last_used_at ?? 'Never'}</span>,
        },
        {
            accessorKey: 'expires_at',
            header: 'Expires',
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.expires_at ?? 'Never'}</span>,
        },
        {
            accessorKey: 'created_at',
            header: 'Created',
            cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.created_at}</span>,
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <DeleteTokenDialog token={row.original} />
                </div>
            ),
        },
    ];

    const table = useReactTable({
        data: tokens,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 15 } },
    });

    return (
        <div className="space-y-4">
            {newToken && !dismissed && (
                <NewTokenBanner token={newToken} onDismiss={() => setDismissed(true)} />
            )}

            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{tokens.length} token(s)</p>
                <CreateTokenDialog />
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    No tokens found. Create one to get started.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {table.getPageCount() > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
                    <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
                </div>
            )}
        </div>
    );
}

// ── Audit Log Panel ───────────────────────────────────────────────────────────

function AuditLogPanel({ logs }: { logs: AuditLogs }) {
    const columns: ColumnDef<AuditEntry>[] = [
        {
            accessorKey: 'created_at',
            header: 'Time',
            cell: ({ row }) => (
                <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{row.original.created_at}</span>
            ),
        },
        {
            accessorKey: 'event',
            header: 'Event',
            cell: ({ row }) => (
                <Badge variant={EVENT_VARIANT[row.original.event] ?? 'outline'}>
                    {row.original.event.replace(/_/g, ' ')}
                </Badge>
            ),
        },
        {
            accessorKey: 'user',
            header: 'User',
            cell: ({ row }) => <span className="text-sm font-medium">{row.original.user}</span>,
        },
        {
            accessorKey: 'description',
            header: 'Description',
            cell: ({ row }) => <span className="text-sm">{row.original.description}</span>,
        },
        {
            accessorKey: 'ip_address',
            header: 'IP',
            cell: ({ row }) => (
                <span className="font-mono text-xs text-muted-foreground">{row.original.ip_address ?? '—'}</span>
            ),
        },
    ];

    const table = useReactTable({
        data: logs.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        initialState: { pagination: { pageSize: 25 } },
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{logs.total} total entries</p>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
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
                                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                    No audit entries yet.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {table.getPageCount() > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button>
                    <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SystemSettingsIndex({ mqttSettings, apiTokens, auditLogs }: PageProps) {
    return (
        <>
            <Head title="System Settings" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div>
                    <h1 className="text-xl font-semibold tracking-tight">System Settings</h1>
                    <p className="text-sm text-muted-foreground">Configure MQTT, manage API tokens, and review the audit log.</p>
                </div>

                <Tabs defaultValue="mqtt">
                    <TabsList>
                        <TabsTrigger value="mqtt" className="gap-1.5">
                            <Server className="h-4 w-4" />
                            MQTT
                        </TabsTrigger>
                        <TabsTrigger value="api-keys" className="gap-1.5">
                            <KeyRound className="h-4 w-4" />
                            API Keys
                        </TabsTrigger>
                        <TabsTrigger value="audit-log" className="gap-1.5">
                            <Shield className="h-4 w-4" />
                            Audit Log
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="mqtt" className="mt-6 max-w-xl">
                        <MqttPanel settings={mqttSettings} />
                    </TabsContent>

                    <TabsContent value="api-keys" className="mt-6">
                        <ApiTokensPanel tokens={apiTokens} />
                    </TabsContent>

                    <TabsContent value="audit-log" className="mt-6">
                        <AuditLogPanel logs={auditLogs} />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
}

SystemSettingsIndex.layout = {
    breadcrumbs: [
        {
            title: 'System Settings',
            href: systemSettingsIndex(),
        },
    ],
};
