import { Head, useForm } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import AlertThresholdController from '@/actions/App/Http/Controllers/Admin/AlertThresholdController';
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
import { index as adminAlertThresholdsIndex } from '@/routes/admin/alert-thresholds';

type AlertTypeOption = {
    value: string;
    label: string;
    unit: string | null;
};

type DeviceOption = {
    dev_eui: string;
    device_name: string;
};

type UnitTypeOption = {
    value: string;
    label: string;
};

type ThresholdRow = {
    id: number;
    alert_type: string;
    alert_type_label: string;
    threshold_unit: string | null;
    dev_eui: string | null;
    device_name: string | null;
    unit_type: string | null;
    threshold_value: number;
    is_active: boolean;
    scope: 'device' | 'unit_type' | 'global';
};

type PageProps = {
    thresholds: ThresholdRow[];
    devices: DeviceOption[];
    alertTypes: AlertTypeOption[];
    unitTypes: UnitTypeOption[];
};

const SCOPE_BADGE: Record<ThresholdRow['scope'], string> = {
    device: 'bg-sky-500/15 text-sky-600 border-sky-500/20',
    unit_type: 'bg-violet-500/15 text-violet-600 border-violet-500/20',
    global: 'bg-slate-500/15 text-slate-500 border-slate-500/20',
};

const SCOPE_LABEL: Record<ThresholdRow['scope'], string> = {
    device: 'Device',
    unit_type: 'Unit Type',
    global: 'Global',
};

type ScopeValue = 'global' | 'unit_type' | 'device';

const SCOPE_OPTIONS: ComboboxOption[] = [
    { value: 'global', label: 'Global (applies to all)' },
    { value: 'unit_type', label: 'Unit Type' },
    { value: 'device', label: 'Specific Device' },
];

function CreateThresholdDialog({
    alertTypes,
    devices,
    unitTypes,
}: {
    alertTypes: AlertTypeOption[];
    devices: DeviceOption[];
    unitTypes: UnitTypeOption[];
}) {
    const [open, setOpen] = useState(false);
    const [scope, setScope] = useState<ScopeValue>('global');

    const { data, setData, post, processing, errors, reset } = useForm({
        alert_type: alertTypes[0]?.value ?? '',
        dev_eui: '',
        unit_type: '',
        threshold_value: '',
        is_active: true,
    });

    const alertTypeOptions: ComboboxOption[] = alertTypes.map((t) => ({
        value: t.value,
        label: t.label,
    }));

    const unitTypeOptions: ComboboxOption[] = unitTypes.map((u) => ({
        value: u.value,
        label: u.label,
    }));

    const deviceOptions: ComboboxOption[] = devices.map((d) => ({
        value: d.dev_eui,
        label: d.device_name,
    }));

    const selectedType = alertTypes.find((t) => t.value === data.alert_type);

    const handleScopeChange = (v: string) => {
        setScope(v as ScopeValue);
        setData({ ...data, dev_eui: '', unit_type: '' });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(AlertThresholdController.store.url(), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
                setScope('global');
            },
        });
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Threshold
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { reset(); setScope('global'); } }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Add Alert Threshold</DialogTitle>
                        <DialogDescription>Configure a trigger threshold for an alert type.</DialogDescription>
                    </DialogHeader>

                    <form id="create-threshold-form" onSubmit={handleSubmit} className="py-2">
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Alert Type</Label>
                                <Combobox
                                    options={alertTypeOptions}
                                    value={data.alert_type}
                                    onValueChange={(v) => setData('alert_type', v)}
                                    placeholder="Select alert type"
                                    searchPlaceholder="Search alert type..."
                                />
                                <InputError message={errors.alert_type} />
                            </div>

                            <div className="grid gap-2">
                                <Label>Scope</Label>
                                <Combobox
                                    options={SCOPE_OPTIONS}
                                    value={scope}
                                    onValueChange={handleScopeChange}
                                    placeholder="Select scope"
                                    searchPlaceholder="Search scope..."
                                />
                            </div>

                            {scope === 'unit_type' && (
                                <div className="grid gap-2">
                                    <Label>Unit Type</Label>
                                    <Combobox
                                        options={unitTypeOptions}
                                        value={data.unit_type}
                                        onValueChange={(v) => setData('unit_type', v)}
                                        placeholder="Select unit type"
                                        searchPlaceholder="Search unit type..."
                                    />
                                    <InputError message={errors.unit_type} />
                                </div>
                            )}

                            {scope === 'device' && (
                                <div className="grid gap-2">
                                    <Label>Device</Label>
                                    <Combobox
                                        options={deviceOptions}
                                        value={data.dev_eui}
                                        onValueChange={(v) => setData('dev_eui', v)}
                                        placeholder="Select device"
                                        searchPlaceholder="Search device..."
                                    />
                                    <InputError message={errors.dev_eui} />
                                </div>
                            )}

                            <div className="grid gap-2">
                                <Label htmlFor="threshold_value">
                                    Threshold Value
                                    {selectedType?.unit && (
                                        <span className="ml-1 font-normal text-muted-foreground">
                                            ({selectedType.unit})
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    id="threshold_value"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.threshold_value}
                                    onChange={(e) => setData('threshold_value', e.target.value)}
                                    placeholder="e.g. 80"
                                />
                                <InputError message={errors.threshold_value} />
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
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="create-threshold-form" disabled={processing}>
                            Add Threshold
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function EditThresholdDialog({ threshold }: { threshold: ThresholdRow }) {
    const [open, setOpen] = useState(false);

    const { data, setData, put, processing, errors, reset } = useForm({
        threshold_value: String(threshold.threshold_value),
        is_active: threshold.is_active,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(AlertThresholdController.update.url(threshold.id), {
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
                    setData({ threshold_value: String(threshold.threshold_value), is_active: threshold.is_active });
                    setOpen(true);
                }}
            >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit threshold</span>
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Edit Threshold</DialogTitle>
                        <DialogDescription>
                            Update the threshold value for{' '}
                            <strong>{threshold.alert_type_label}</strong>
                            {threshold.device_name && ` — ${threshold.device_name}`}
                            {threshold.unit_type && ` — ${threshold.unit_type}`}.
                        </DialogDescription>
                    </DialogHeader>

                    <form id={`edit-threshold-form-${threshold.id}`} onSubmit={handleSubmit} className="py-2">
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor={`value-${threshold.id}`}>
                                    Threshold Value
                                    {threshold.threshold_unit && (
                                        <span className="ml-1 font-normal text-muted-foreground">
                                            ({threshold.threshold_unit})
                                        </span>
                                    )}
                                </Label>
                                <Input
                                    id={`value-${threshold.id}`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={data.threshold_value}
                                    onChange={(e) => setData('threshold_value', e.target.value)}
                                />
                                <InputError message={errors.threshold_value} />
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id={`active-${threshold.id}`}
                                    checked={data.is_active}
                                    onCheckedChange={(v) => setData('is_active', Boolean(v))}
                                />
                                <Label htmlFor={`active-${threshold.id}`}>Active</Label>
                            </div>
                        </div>
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form={`edit-threshold-form-${threshold.id}`} disabled={processing}>
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DeleteThresholdDialog({ threshold }: { threshold: ThresholdRow }) {
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
                <span className="sr-only">Delete threshold</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Threshold</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the{' '}
                            <strong>{threshold.alert_type_label}</strong> threshold? This action cannot be undone.
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
                                destroy(AlertThresholdController.destroy.url(threshold.id), {
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

export default function AlertThresholdsIndex({ thresholds, devices, alertTypes, unitTypes }: PageProps) {
    return (
        <>
            <Head title="Alert Thresholds" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Alert Thresholds</h1>
                        <p className="text-sm text-muted-foreground">
                            Configure trigger values for overspeed, offline, and low signal alerts.
                        </p>
                    </div>
                    <CreateThresholdDialog alertTypes={alertTypes} devices={devices} unitTypes={unitTypes} />
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Alert Type</TableHead>
                                <TableHead>Scope</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Threshold</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {thresholds.length ? (
                                thresholds.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell className="font-medium">{t.alert_type_label}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={SCOPE_BADGE[t.scope]}>
                                                {SCOPE_LABEL[t.scope]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {t.scope === 'device' && (
                                                <div>
                                                    <div>{t.device_name ?? '—'}</div>
                                                    <div className="font-mono text-xs text-muted-foreground">{t.dev_eui}</div>
                                                </div>
                                            )}
                                            {t.scope === 'unit_type' && (
                                                <span className="text-sm">{t.unit_type}</span>
                                            )}
                                            {t.scope === 'global' && (
                                                <span className="text-sm text-muted-foreground">All devices</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="tabular-nums">
                                            {t.threshold_value}
                                            {t.threshold_unit && (
                                                <span className="ml-1 text-muted-foreground">{t.threshold_unit}</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {t.is_active ? (
                                                <Badge variant="online">Active</Badge>
                                            ) : (
                                                <Badge variant="offline">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-end gap-1">
                                                <EditThresholdDialog threshold={t} />
                                                <DeleteThresholdDialog threshold={t} />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No thresholds configured.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                <p className="text-xs text-muted-foreground">
                    Priority order: Device-specific &gt; Unit Type &gt; Global. The most specific threshold applies.
                </p>
            </div>
        </>
    );
}

AlertThresholdsIndex.layout = {
    breadcrumbs: [
        {
            title: 'Alert Thresholds',
            href: adminAlertThresholdsIndex(),
        },
    ],
};
