import { Head, useForm } from '@inertiajs/react';
import { Layers, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import DeviceGroupController from '@/actions/App/Http/Controllers/Admin/DeviceGroupController';
import InputError from '@/components/input-error';
import { RoleBadge } from '@/components/orion/badges';
import type { Role } from '@/components/orion/badges';
import { GEOFENCE_SWATCHES } from '@/components/orion/map-marker';
import { EmptyState } from '@/components/orion/misc';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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
                    Location{' '}
                    <span className="font-normal text-muted-foreground">
                        (optional)
                    </span>
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
                    Description{' '}
                    <span className="font-normal text-muted-foreground">
                        (optional)
                    </span>
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

            <fieldset className="grid gap-2">
                <legend className="mb-2 text-sm font-medium">
                    Group colour
                </legend>
                <div className="flex flex-wrap gap-2">
                    {GEOFENCE_SWATCHES.map((hex) => (
                        <button
                            key={hex}
                            type="button"
                            aria-label={`Colour ${hex}`}
                            aria-pressed={values.color === hex}
                            onClick={() => onChange('color', hex)}
                            className={cn(
                                'size-8 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-2 focus-visible:outline-ring',
                                values.color === hex &&
                                    'ring-2 ring-foreground',
                            )}
                            style={{ background: hex }}
                        />
                    ))}
                </div>
                <InputError message={errors.color} />
            </fieldset>

            {/* Devices */}
            <div className="grid gap-2">
                <Label>Assign Devices</Label>
                {availableDevices.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No available (ungrouped) devices.
                    </p>
                ) : (
                    <ScrollArea className="h-44 rounded-md border p-2">
                        <div className="space-y-2">
                            {availableDevices.map((d) => (
                                <div
                                    key={d.id}
                                    className="flex items-center gap-2"
                                >
                                    <Checkbox
                                        id={`dev-${d.id}`}
                                        checked={values.device_ids.includes(
                                            d.id,
                                        )}
                                        onCheckedChange={() =>
                                            toggleDevice(d.id)
                                        }
                                    />
                                    <Label
                                        htmlFor={`dev-${d.id}`}
                                        className="flex flex-1 cursor-pointer items-center gap-2 font-normal"
                                    >
                                        <span>{d.device_name}</span>
                                        <span className="font-mono text-xs text-muted-foreground">
                                            {d.dev_eui}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className="ml-auto text-xs"
                                        >
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
                    <p className="text-sm text-muted-foreground">
                        No operators available.
                    </p>
                ) : (
                    <div className="space-y-2 rounded-md border p-2">
                        {operators.map((u) => (
                            <div key={u.id} className="flex items-center gap-2">
                                <Checkbox
                                    id={`user-${u.id}`}
                                    checked={values.user_ids.includes(u.id)}
                                    onCheckedChange={() => toggleUser(u.id)}
                                />
                                <Label
                                    htmlFor={`user-${u.id}`}
                                    className="flex flex-1 cursor-pointer items-center gap-2 font-normal"
                                >
                                    <span>{u.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {u.email}
                                    </span>
                                    <RoleBadge
                                        role={u.role as Role}
                                        className="ml-auto"
                                    />
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
        color: GEOFENCE_SWATCHES[4],
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

            <Dialog
                open={open}
                onOpenChange={(v) => {
                    setOpen(v);

                    if (!v) {
                        reset();
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Device Group</DialogTitle>
                        <DialogDescription>
                            Group devices by site or project, and control
                            operator access.
                        </DialogDescription>
                    </DialogHeader>

                    <form id="create-group-form" onSubmit={handleSubmit}>
                        <GroupFormFields
                            errors={errors}
                            values={data}
                            onChange={(f, v) =>
                                setData(f as keyof typeof data, v as never)
                            }
                            operators={operators}
                            allDevices={allDevices}
                        />
                    </form>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="create-group-form"
                            disabled={processing}
                        >
                            Create Group
                        </Button>
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
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(true)}
            >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit {group.name}</span>
            </Button>

            <Dialog
                open={open}
                onOpenChange={(v) => {
                    setOpen(v);

                    if (!v) {
                        reset();
                    }
                }}
            >
                <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Group</DialogTitle>
                        <DialogDescription>
                            Update <strong>{group.name}</strong>
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id={`edit-group-form-${group.id}`}
                        onSubmit={handleSubmit}
                    >
                        <GroupFormFields
                            errors={errors}
                            values={data}
                            onChange={(f, v) =>
                                setData(f as keyof typeof data, v as never)
                            }
                            operators={operators}
                            allDevices={allDevices}
                            groupId={group.id}
                        />
                    </form>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            type="button"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form={`edit-group-form-${group.id}`}
                            disabled={processing}
                        >
                            Save Changes
                        </Button>
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
                            Are you sure you want to delete{' '}
                            <strong>{group.name}</strong>? Devices in this group
                            will become ungrouped.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
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
        </>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

const MAX_AVATARS = 4;

export default function DeviceGroupsIndex({
    groups,
    ungroupedCount,
    operators,
    allDevices,
}: PageProps) {
    return (
        <>
            <Head title="Device Groups" />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                            Device Groups
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Groups scope what operators and viewers can see.
                            {ungroupedCount > 0 && (
                                <span className="text-warning">
                                    {' '}
                                    {ungroupedCount} device
                                    {ungroupedCount === 1 ? ' is' : 's are'} not
                                    in any group.
                                </span>
                            )}
                        </p>
                    </div>
                    <CreateGroupDialog
                        operators={operators}
                        allDevices={allDevices}
                    />
                </div>

                {groups.length === 0 ? (
                    <div className="rounded-xl border bg-card">
                        <EmptyState
                            icon={<Layers className="size-6" />}
                            title="No groups yet"
                        >
                            Create a group per site or pit, then assign
                            operators and viewers to it.
                        </EmptyState>
                    </div>
                ) : (
                    <div className="grid [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))] gap-4">
                        {groups.map((group) => {
                            const extra = group.users.length - MAX_AVATARS;

                            return (
                                <article
                                    key={group.id}
                                    className="flex flex-col rounded-xl border border-t-4 bg-card"
                                    style={{ borderTopColor: group.color }}
                                >
                                    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
                                        <div className="min-w-0">
                                            <h2 className="truncate font-semibold">
                                                {group.name}
                                            </h2>
                                            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                                                <MapPin
                                                    className="size-3.5 shrink-0"
                                                    aria-hidden
                                                />
                                                {group.location ??
                                                    group.description ??
                                                    'No location'}
                                            </p>
                                        </div>
                                        <p className="shrink-0 text-right">
                                            <span className="text-2xl font-semibold tabular-nums">
                                                {group.devices_count}
                                            </span>{' '}
                                            <span className="text-sm text-muted-foreground">
                                                units
                                            </span>
                                        </p>
                                    </div>
                                    <div className="mx-5 flex items-center justify-between gap-3 border-t py-3">
                                        <span className="flex -space-x-1.5">
                                            {group.users
                                                .slice(0, MAX_AVATARS)
                                                .map((u) => (
                                                    <span
                                                        key={u.id}
                                                        title={u.name}
                                                        className="grid size-8 place-items-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground ring-2 ring-card"
                                                    >
                                                        {initials(u.name)}
                                                    </span>
                                                ))}
                                            {extra > 0 && (
                                                <span className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-semibold ring-2 ring-card">
                                                    +{extra}
                                                </span>
                                            )}
                                        </span>
                                        <span className="text-sm text-muted-foreground tabular-nums">
                                            {group.users.length} user
                                            {group.users.length === 1
                                                ? ''
                                                : 's'}{' '}
                                            assigned
                                        </span>
                                    </div>
                                    <div className="mt-auto flex justify-end gap-1 border-t px-3 py-2">
                                        <EditGroupDialog
                                            group={group}
                                            operators={operators}
                                            allDevices={allDevices}
                                        />
                                        <DeleteGroupDialog group={group} />
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
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
