import { Head, useForm } from '@inertiajs/react';
import { FolderOpen, Layers, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import DeviceGroupController from '@/actions/App/Http/Controllers/Admin/DeviceGroupController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { index as adminDeviceGroupsIndex } from '@/routes/admin/device-groups';

type GroupUser = {
    id: number;
    name: string;
    email: string;
    role: string;
};

type GroupDevice = {
    id: number;
    dev_eui: string;
    device_name: string;
    unit_type: string;
    device_group_id: number | null;
};

type DeviceGroup = {
    id: number;
    name: string;
    location: string | null;
    description: string | null;
    color: string;
    devices_count: number;
    users: GroupUser[];
};

type PageProps = {
    groups: DeviceGroup[];
    ungroupedCount: number;
    operators: GroupUser[];
    allDevices: GroupDevice[];
};

const ROLE_BADGE: Record<string, string> = {
    admin: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    operator: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    viewer: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

// ── Group form fields ─────────────────────────────────────────────────────────

function GroupFormFields({
    errors,
    values,
    onChange,
    operators,
    allDevices,
    groupId,
}: {
    errors: Partial<Record<string, string>>;
    values: {
        name: string;
        location: string;
        description: string;
        color: string;
        user_ids: number[];
        device_ids: number[];
    };
    onChange: (field: string, value: unknown) => void;
    operators: GroupUser[];
    allDevices: GroupDevice[];
    groupId?: number;
}) {
    const toggleUser = (id: number) => {
        const next = values.user_ids.includes(id)
            ? values.user_ids.filter((u) => u !== id)
            : [...values.user_ids, id];
        onChange('user_ids', next);
    };

    const toggleDevice = (id: number) => {
        const next = values.device_ids.includes(id)
            ? values.device_ids.filter((d) => d !== id)
            : [...values.device_ids, id];
        onChange('device_ids', next);
    };

    const availableDevices = allDevices.filter(
        (d) => d.device_group_id === null || d.device_group_id === groupId,
    );

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="name">Group Name</Label>
                <Input
                    id="name"
                    value={values.name}
                    onChange={(e) => onChange('name', e.target.value)}
                    placeholder="e.g. Pit A — North Block"
                    autoComplete="off"
                />
                <InputError message={errors.name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="location">
                    Location <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                    id="location"
                    value={values.location}
                    onChange={(e) => onChange('location', e.target.value)}
                    placeholder="e.g. Balikpapan, Kalimantan"
                    autoComplete="off"
                />
                <InputError message={errors.location} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="description">
                    Description <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                    id="description"
                    value={values.description}
                    onChange={(e) => onChange('description', e.target.value)}
                    placeholder="Short description of this site"
                    autoComplete="off"
                />
                <InputError message={errors.description} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="color">Group Color</Label>
                <div className="flex items-center gap-3">
                    <input
                        id="color"
                        type="color"
                        value={values.color}
                        onChange={(e) => onChange('color', e.target.value)}
                        className="h-9 w-14 cursor-pointer rounded border p-0.5"
                    />
                    <span className="text-muted-foreground font-mono text-sm">{values.color}</span>
                </div>
                <InputError message={errors.color} />
            </div>

            {/* Devices */}
            <div className="grid gap-2">
                <Label>Assign Devices</Label>
                {availableDevices.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No available (ungrouped) devices.</p>
                ) : (
                    <ScrollArea className="h-44 rounded-md border p-2">
                        <div className="space-y-2">
                            {availableDevices.map((d) => (
                                <div key={d.id} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`dev-${d.id}`}
                                        checked={values.device_ids.includes(d.id)}
                                        onCheckedChange={() => toggleDevice(d.id)}
                                    />
                                    <Label htmlFor={`dev-${d.id}`} className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                                        <span>{d.device_name}</span>
                                        <span className="text-muted-foreground font-mono text-xs">{d.dev_eui}</span>
                                        <Badge variant="outline" className="ml-auto text-xs">
                                            {d.unit_type}
                                        </Badge>
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                )}
                <InputError message={errors.device_ids} />
            </div>

            {/* Users */}
            <div className="grid gap-2">
                <Label>Access — Operators & Admins</Label>
                {operators.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No operators available.</p>
                ) : (
                    <div className="space-y-2 rounded-md border p-2">
                        {operators.map((u) => (
                            <div key={u.id} className="flex items-center gap-2">
                                <Checkbox
                                    id={`user-${u.id}`}
                                    checked={values.user_ids.includes(u.id)}
                                    onCheckedChange={() => toggleUser(u.id)}
                                />
                                <Label htmlFor={`user-${u.id}`} className="flex flex-1 cursor-pointer items-center gap-2 font-normal">
                                    <span>{u.name}</span>
                                    <span className="text-muted-foreground text-xs">{u.email}</span>
                                    <Badge variant="outline" className={`ml-auto text-xs ${ROLE_BADGE[u.role]}`}>
                                        {u.role}
                                    </Badge>
                                </Label>
                            </div>
                        ))}
                    </div>
                )}
                <InputError message={errors.user_ids} />
            </div>
        </div>
    );
}

// ── Create dialog ─────────────────────────────────────────────────────────────

function CreateGroupDialog({
    operators,
    allDevices,
}: {
    operators: GroupUser[];
    allDevices: GroupDevice[];
}) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        location: '',
        description: '',
        color: '#3b82f6',
        user_ids: [] as number[],
        device_ids: [] as number[],
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(DeviceGroupController.store.url(), {
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
                New Group
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Device Group</DialogTitle>
                        <DialogDescription>Group devices by site or project, and control operator access.</DialogDescription>
                    </DialogHeader>

                    <form id="create-group-form" onSubmit={handleSubmit}>
                        <GroupFormFields
                            errors={errors}
                            values={data}
                            onChange={(f, v) => setData(f as keyof typeof data, v as never)}
                            operators={operators}
                            allDevices={allDevices}
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" form="create-group-form" disabled={processing}>Create Group</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ── Edit dialog ───────────────────────────────────────────────────────────────

function EditGroupDialog({
    group,
    operators,
    allDevices,
}: {
    group: DeviceGroup;
    operators: GroupUser[];
    allDevices: GroupDevice[];
}) {
    const [open, setOpen] = useState(false);

    const currentDeviceIds = allDevices
        .filter((d) => d.device_group_id === group.id)
        .map((d) => d.id);

    const { data, setData, put, processing, errors, reset } = useForm({
        name: group.name,
        location: group.location ?? '',
        description: group.description ?? '',
        color: group.color,
        user_ids: group.users.map((u) => u.id),
        device_ids: currentDeviceIds,
    });

    useEffect(() => {
        if (open) {
            setData({
                name: group.name,
                location: group.location ?? '',
                description: group.description ?? '',
                color: group.color,
                user_ids: group.users.map((u) => u.id),
                device_ids: currentDeviceIds,
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(DeviceGroupController.update.url(group.id), {
            preserveScroll: true,
            onSuccess: () => setOpen(false),
        });
    };

    return (
        <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(true)}>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit {group.name}</span>
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Group</DialogTitle>
                        <DialogDescription>
                            Update <strong>{group.name}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <form id={`edit-group-form-${group.id}`} onSubmit={handleSubmit}>
                        <GroupFormFields
                            errors={errors}
                            values={data}
                            onChange={(f, v) => setData(f as keyof typeof data, v as never)}
                            operators={operators}
                            allDevices={allDevices}
                            groupId={group.id}
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button type="submit" form={`edit-group-form-${group.id}`} disabled={processing}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ── Delete dialog ─────────────────────────────────────────────────────────────

function DeleteGroupDialog({ group }: { group: DeviceGroup }) {
    const [open, setOpen] = useState(false);
    const { delete: destroy, processing } = useForm({});

    const handleDelete = () => {
        destroy(DeviceGroupController.destroy.url(group.id), {
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
                <span className="sr-only">Delete {group.name}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Group</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{group.name}</strong>? Devices in this group will become ungrouped.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={processing}>Delete</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function DeviceGroupsIndex({ groups, ungroupedCount, operators, allDevices }: PageProps) {
    return (
        <>
            <Head title="Device Groups" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Device Groups</h1>
                        <p className="text-muted-foreground text-sm">Organise devices by site or project and control operator access per group.</p>
                    </div>
                    <CreateGroupDialog operators={operators} allDevices={allDevices} />
                </div>

                {/* Summary cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total Groups</p>
                                    <p className="mt-1 text-3xl font-bold">{groups.length}</p>
                                </div>
                                <div className="bg-muted rounded-lg p-2">
                                    <Layers className="text-muted-foreground h-5 w-5" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Grouped Devices</p>
                                    <p className="mt-1 text-3xl font-bold text-status-online">
                                        {groups.reduce((sum, g) => sum + g.devices_count, 0)}
                                    </p>
                                </div>
                                <div className="rounded-lg bg-status-online-bg p-2">
                                    <FolderOpen className="h-5 w-5 text-status-online" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Ungrouped Devices</p>
                                    <p className="mt-1 text-3xl font-bold text-status-warning">{ungroupedCount}</p>
                                </div>
                                <div className="rounded-lg bg-status-warning-bg p-2">
                                    <FolderOpen className="h-5 w-5 text-status-warning" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Groups table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Layers className="text-muted-foreground h-4 w-4" />
                            All Groups
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {groups.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Layers className="text-muted-foreground/40 mb-2 h-10 w-10" />
                                <p className="text-muted-foreground text-sm font-medium">No groups yet</p>
                                <p className="text-muted-foreground/60 mt-1 text-xs">Create a group to organise your fleet by site or project.</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Group</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>Devices</TableHead>
                                        <TableHead>Access</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groups.map((group) => (
                                        <TableRow key={group.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-3 w-3 flex-shrink-0 rounded-full"
                                                        style={{ backgroundColor: group.color }}
                                                    />
                                                    <span className="font-medium">{group.name}</span>
                                                </div>
                                                {group.description && (
                                                    <p className="text-muted-foreground mt-0.5 ml-5 text-xs">{group.description}</p>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {group.location ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {group.devices_count} device{group.devices_count !== 1 ? 's' : ''}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {group.users.length === 0 ? (
                                                    <span className="text-muted-foreground text-xs">No restriction</span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {group.users.map((u) => (
                                                            <Badge
                                                                key={u.id}
                                                                variant="outline"
                                                                className={`text-xs ${ROLE_BADGE[u.role]}`}
                                                            >
                                                                <Users className="mr-1 h-3 w-3" />
                                                                {u.name}
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1">
                                                    <EditGroupDialog group={group} operators={operators} allDevices={allDevices} />
                                                    <DeleteGroupDialog group={group} />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

DeviceGroupsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Device Groups',
            href: adminDeviceGroupsIndex(),
        },
    ],
};
