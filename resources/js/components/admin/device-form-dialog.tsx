import { useForm, usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import DeviceController from '@/actions/App/Http/Controllers/Admin/DeviceController';
import InputError from '@/components/input-error';
import type { Condition } from '@/components/orion/badges';
import { UnitIcon } from '@/components/orion/unit-icon';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
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
import { Switch } from '@/components/ui/switch';
import { BACKEND_UNIT_TYPES, unitMeta } from '@/lib/orion/unit-types';
import type { UnitCategory } from '@/types/fleet';

/* Add / edit device dialog shared by Device Management and Device Detail.
   Needs the page to provide the `unitCategories` prop. */

const EUI_LENGTH = 16;
export const CONDITIONS: { value: Condition; label: string }[] = [
    { value: 'operational', label: 'Operational' },
    { value: 'standby', label: 'Standby' },
    { value: 'breakdown', label: 'Breakdown' },
];

export type DeviceGroupRef = {
    id: number;
    name: string;
    color: string;
};

export type AdminDevice = {
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
    operational_status: Condition;
    status: 'online' | 'offline';
    last_seen_at: string | null;
};

export type UnitCategoryMeta = {
    label: string;
    models: readonly string[];
};

type DeviceFormPageProps = {
    unitCategories: Record<string, UnitCategoryMeta>;
    groups: DeviceGroupRef[];
};

export type DeviceFormValues = {
    dev_eui?: string;
    join_eui: string;
    application_id: string;
    device_name: string;
    unit_type: string;
    unit_model: string;
    is_active: boolean;
    operational_status: string;
    device_group_id: number | null;
};

/** Payload for PUT /admin/devices/{id}: the full editable record (the endpoint validates every field). */
export function updatePayload(device: AdminDevice): DeviceFormValues {
    return {
        join_eui: device.join_eui ?? '',
        application_id: device.application_id,
        device_name: device.device_name,
        unit_type: device.unit_type,
        unit_model: device.unit_model ?? '',
        is_active: device.is_active,
        operational_status: device.operational_status,
        device_group_id: device.device_group_id,
    };
}

function Field({
    id,
    label,
    optional,
    error,
    hint,
    children,
}: {
    id?: string;
    label: string;
    optional?: boolean;
    error?: string;
    hint?: ReactNode;
    children: ReactNode;
}) {
    return (
        <div className="grid content-start gap-1.5">
            <Label htmlFor={id}>
                {label}
                {optional && (
                    <span className="font-normal text-muted-foreground">
                        {' '}
                        (optional)
                    </span>
                )}
            </Label>
            {children}
            {error ? (
                <InputError message={error} />
            ) : (
                hint && <p className="text-xs text-muted-foreground">{hint}</p>
            )}
        </div>
    );
}

function DeviceFormFields({
    errors,
    values,
    onChange,
    showDevEui,
    groups,
}: {
    errors: Partial<Record<string, string>>;
    values: DeviceFormValues;
    onChange: (field: string, value: string | boolean | number | null) => void;
    showDevEui: boolean;
    groups: DeviceGroupRef[];
}) {
    const { unitCategories } = usePage<DeviceFormPageProps>().props;
    const unitTypeOptions: ComboboxOption[] = BACKEND_UNIT_TYPES.map((key) => ({
        value: key,
        label: unitCategories[key]?.label ?? unitMeta(key).label,
        prefix: <UnitIcon type={unitMeta(key).key} size={18} />,
    }));
    const models = unitCategories[values.unit_type]?.models ?? [];
    const groupOptions: ComboboxOption[] = [
        { value: '__none__', label: '— No group —' },
        ...groups.map((g) => ({
            value: g.id.toString(),
            label: g.name,
            prefix: (
                <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: g.color }}
                />
            ),
        })),
    ];

    const eui = values.dev_eui ?? '';
    const euiInvalid =
        eui.length > 0 &&
        (eui.length !== EUI_LENGTH || !/^[0-9a-fA-F]+$/.test(eui));
    const euiHint = `${eui.length}/${EUI_LENGTH}`;

    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {showDevEui && (
                <Field
                    id="dev_eui"
                    label="Device EUI"
                    error={
                        errors.dev_eui ??
                        (euiInvalid
                            ? `${euiHint} — must be ${EUI_LENGTH} hex characters`
                            : undefined)
                    }
                    hint={`${euiHint} hex characters`}
                >
                    <Input
                        id="dev_eui"
                        value={eui}
                        onChange={(e) =>
                            onChange('dev_eui', e.target.value.trim())
                        }
                        placeholder="0004A30B001C5EBF"
                        autoComplete="off"
                        maxLength={EUI_LENGTH}
                        aria-invalid={euiInvalid || undefined}
                        className="font-mono"
                    />
                </Field>
            )}

            <Field
                id="join_eui"
                label="Join EUI"
                optional
                error={errors.join_eui}
            >
                <Input
                    id="join_eui"
                    value={values.join_eui}
                    onChange={(e) => onChange('join_eui', e.target.value)}
                    placeholder="0000000000000000"
                    autoComplete="off"
                    maxLength={EUI_LENGTH}
                    className="font-mono"
                />
            </Field>

            <Field
                id="device_name"
                label="Device name"
                error={errors.device_name}
            >
                <Input
                    id="device_name"
                    value={values.device_name}
                    onChange={(e) => onChange('device_name', e.target.value)}
                    placeholder="OHT-07"
                    autoComplete="off"
                />
            </Field>

            <Field
                id="application_id"
                label="Application ID"
                error={errors.application_id}
            >
                <Input
                    id="application_id"
                    value={values.application_id}
                    onChange={(e) => onChange('application_id', e.target.value)}
                    placeholder="fleet-tracker"
                    autoComplete="off"
                />
            </Field>

            <Field label="Category" error={errors.unit_type}>
                <Combobox
                    options={unitTypeOptions}
                    value={values.unit_type}
                    onValueChange={(v) => {
                        onChange('unit_type', v);
                        onChange('unit_model', '');
                    }}
                    placeholder="Select category"
                    searchPlaceholder="Search category..."
                />
            </Field>

            <Field
                id="unit_model"
                label="Model"
                optional
                error={errors.unit_model}
            >
                <Input
                    id="unit_model"
                    list="unit-model-presets"
                    value={values.unit_model}
                    onChange={(e) => onChange('unit_model', e.target.value)}
                    placeholder={models[0] ?? 'Model name'}
                    autoComplete="off"
                />
                <datalist id="unit-model-presets">
                    {models.map((m) => (
                        <option key={m} value={m} />
                    ))}
                </datalist>
            </Field>

            <Field
                label="Condition"
                error={errors.operational_status}
                hint="Standby & Breakdown dikecualikan dari laporan utilisasi."
            >
                <Select
                    value={values.operational_status}
                    onValueChange={(v) => onChange('operational_status', v)}
                >
                    <SelectTrigger aria-label="Condition">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {CONDITIONS.map((c) => (
                            <SelectItem key={c.value} value={c.value}>
                                {c.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </Field>

            <Field label="Group / site" error={errors.device_group_id}>
                <Combobox
                    options={groupOptions}
                    value={values.device_group_id?.toString() ?? '__none__'}
                    onValueChange={(v) =>
                        onChange(
                            'device_group_id',
                            v === '__none__' ? null : parseInt(v, 10),
                        )
                    }
                    placeholder="No group"
                    searchPlaceholder="Search group..."
                />
            </Field>
        </div>
    );
}

export function DeviceDialog({
    device,
    groups,
    open,
    onOpenChange,
}: {
    device: AdminDevice | null;
    groups: DeviceGroupRef[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { data, setData, post, put, processing, errors, reset, clearErrors } =
        useForm<DeviceFormValues>(
            device
                ? updatePayload(device)
                : {
                      dev_eui: '',
                      join_eui: '',
                      application_id: '',
                      device_name: '',
                      unit_type: 'oht',
                      unit_model: '',
                      is_active: true,
                      operational_status: 'operational',
                      device_group_id: null,
                  },
        );

    const close = () => {
        onOpenChange(false);
        reset();
        clearErrors();
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: close };

        if (device) {
            put(DeviceController.update.url(device.id), options);
        } else {
            post(DeviceController.store.url(), options);
        }
    };

    const formId = device ? `edit-device-${device.id}` : 'create-device';

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => (v ? onOpenChange(v) : close())}
        >
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle>
                        {device ? 'Edit device' : 'Add device'}
                    </DialogTitle>
                    <DialogDescription>
                        {device ? (
                            <>
                                {device.device_name} ·{' '}
                                <span className="font-mono text-xs">
                                    {device.dev_eui}
                                </span>
                            </>
                        ) : (
                            'Register a LoRaWAN GPS tracker.'
                        )}
                    </DialogDescription>
                </DialogHeader>

                <form id={formId} onSubmit={handleSubmit}>
                    <DeviceFormFields
                        errors={errors}
                        values={data}
                        onChange={(field, value) =>
                            setData(
                                field as keyof DeviceFormValues,
                                value as never,
                            )
                        }
                        showDevEui={device === null}
                        groups={groups}
                    />
                </form>

                <DialogFooter className="items-center sm:justify-between">
                    <label className="flex min-h-11 items-center gap-2.5 text-sm">
                        <Switch
                            checked={data.is_active}
                            onCheckedChange={(v) => setData('is_active', v)}
                        />
                        Active
                    </label>
                    <div className="flex gap-2">
                        <Button variant="outline" type="button" onClick={close}>
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form={formId}
                            disabled={processing}
                        >
                            {device ? 'Save changes' : 'Add device'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
