import { Head, router, useForm } from '@inertiajs/react';
import { Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import AlertThresholdController from '@/actions/App/Http/Controllers/Admin/AlertThresholdController';
import { Segmented } from '@/components/Fleet/map-overlays';
import InputError from '@/components/input-error';
import { AlertTypeBadge } from '@/components/orion/badges';
import type { AlertType } from '@/components/orion/badges';
import { EmptyState } from '@/components/orion/misc';
import { UnitIcon } from '@/components/orion/unit-icon';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import type { ComboboxOption } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { unitMeta } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';
import { index as adminAlertThresholdsIndex } from '@/routes/admin/alert-thresholds';
import type { UnitCategory } from '@/types/fleet';

type Scope = 'global' | 'unit_type' | 'device';

type AlertTypeOption = {
    value: AlertType;
    label: string;
    unit: string | null;
};

type DeviceOption = {
    dev_eui: string;
    device_name: string;
    unit_type: UnitCategory;
    unit_model: string | null;
};

type UnitTypeOption = {
    value: UnitCategory;
    label: string;
};

type ThresholdRow = {
    id: number;
    alert_type: AlertType;
    alert_type_label: string;
    threshold_unit: string | null;
    dev_eui: string | null;
    device_name: string | null;
    device_unit_type: UnitCategory | null;
    device_unit_model: string | null;
    unit_type: UnitCategory | null;
    threshold_value: number;
    is_active: boolean;
    scope: Scope;
};

type PageProps = {
    thresholds: ThresholdRow[];
    devices: DeviceOption[];
    alertTypes: AlertTypeOption[];
    unitTypes: UnitTypeOption[];
    unitTypeCounts: Partial<Record<UnitCategory, number>>;
};

/** Editor state: a new rule, an existing rule, or closed. */
type Editing = { mode: 'create' } | { mode: 'edit'; rule: ThresholdRow } | null;

const GROUPS: { scope: Scope; tag: string; title: string }[] = [
    { scope: 'global', tag: 'Global', title: 'All units' },
    { scope: 'unit_type', tag: 'Unit type', title: 'Per unit type' },
    { scope: 'device', tag: 'Device', title: 'Per device' },
];

const SHORT_UNIT: Partial<Record<AlertType, string>> = {
    overspeed: 'km/h',
    offline: 'min',
    low_signal: 'dBm RSSI',
};

/** Low signal fires *below* the RSSI limit; everything else fires above it. */
function operator(type: AlertType): string {
    return type === 'low_signal' ? '<' : '>';
}

function deviceLabel(name: string | null, model: string | null): string {
    return `${name ?? '—'}${model ? ` ${model}` : ''}`;
}

function RuleTarget({ rule }: { rule: ThresholdRow }) {
    if (rule.scope === 'global') {
        return <span>All units</span>;
    }

    const type =
        rule.scope === 'unit_type' ? rule.unit_type : rule.device_unit_type;
    const label =
        rule.scope === 'unit_type' && rule.unit_type
            ? unitMeta(rule.unit_type).label
            : deviceLabel(rule.device_name, rule.device_unit_model);

    return (
        <span className="inline-flex min-w-0 items-center gap-2">
            {type && <UnitIcon type={unitMeta(type).key} size={22} />}
            <span className="truncate">{label}</span>
        </span>
    );
}

function RuleEditor({
    editing,
    thresholds,
    devices,
    alertTypes,
    unitTypes,
    unitTypeCounts,
    onClose,
}: {
    editing: Exclude<Editing, null>;
    thresholds: ThresholdRow[];
    devices: DeviceOption[];
    alertTypes: AlertTypeOption[];
    unitTypes: UnitTypeOption[];
    unitTypeCounts: PageProps['unitTypeCounts'];
    onClose: () => void;
}) {
    const rule = editing.mode === 'edit' ? editing.rule : null;
    const locked = rule !== null;
    const [scope, setScope] = useState<Scope>(rule?.scope ?? 'global');
    const { data, setData, post, put, processing, errors } = useForm({
        alert_type: rule?.alert_type ?? alertTypes[0]?.value ?? 'overspeed',
        unit_type: rule?.unit_type ?? '',
        dev_eui: rule?.dev_eui ?? '',
        threshold_value: rule ? String(rule.threshold_value) : '',
        is_active: rule?.is_active ?? true,
    });

    const changeScope = (next: Scope) => {
        // Only the target of the chosen scope may be sent.
        setScope(next);
        setData((d) => ({ ...d, unit_type: '', dev_eui: '' }));
    };

    const unit = SHORT_UNIT[data.alert_type] ?? '';
    const typeLabel =
        alertTypes.find((t) => t.value === data.alert_type)?.label ??
        data.alert_type;
    const activeRule = (s: Scope, target?: string) =>
        thresholds.find(
            (t) =>
                t.alert_type === data.alert_type &&
                t.is_active &&
                t.scope === s &&
                (s === 'global' ||
                    (s === 'unit_type'
                        ? t.unit_type === target
                        : t.dev_eui === target)),
        );

    /** Explains which broader rule this one overrides, and for how many units. */
    const hint = (): string | null => {
        const global = activeRule('global');
        const globalText = global
            ? `Global default is ${global.threshold_value} ${unit}`
            : 'No global default yet';

        if (scope === 'unit_type' && data.unit_type) {
            const count = unitTypeCounts[data.unit_type as UnitCategory] ?? 0;
            const label = unitMeta(data.unit_type).label;

            return `${globalText}. This rule overrides it for ${count} ${label} unit${count === 1 ? '' : 's'}.`;
        }

        if (scope === 'device' && data.dev_eui) {
            const device = devices.find((d) => d.dev_eui === data.dev_eui);
            const typeRule = device
                ? activeRule('unit_type', device.unit_type)
                : undefined;

            return typeRule?.unit_type
                ? `${unitMeta(typeRule.unit_type).label} rule is ${typeRule.threshold_value} ${unit}. This rule overrides it for this device only.`
                : `${globalText}. This rule overrides it for this device only.`;
        }

        return scope === 'global'
            ? 'Applies to every unit without a more specific rule.'
            : null;
    };

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: onClose };

        if (rule) {
            put(AlertThresholdController.update.url(rule.id), options);
        } else {
            post(AlertThresholdController.store.url(), options);
        }
    };

    const remove = () => {
        if (rule) {
            router.delete(AlertThresholdController.destroy.url(rule.id), {
                preserveScroll: true,
                onSuccess: onClose,
            });
        }
    };

    const unitTypeOptions: ComboboxOption[] = unitTypes.map((u) => ({
        value: u.value,
        label: unitMeta(u.value).label,
        prefix: <UnitIcon type={unitMeta(u.value).key} size={18} />,
    }));
    const deviceOptions: ComboboxOption[] = devices.map((d) => ({
        value: d.dev_eui,
        label: deviceLabel(d.device_name, d.unit_model),
        prefix: <UnitIcon type={unitMeta(d.unit_type).key} size={18} />,
    }));
    let targetLabel = 'All units';

    if (rule?.scope === 'unit_type' && rule.unit_type) {
        targetLabel = unitMeta(rule.unit_type).label;
    } else if (rule?.scope === 'device') {
        targetLabel = deviceLabel(rule.device_name, rule.device_unit_model);
    }

    return (
        <form onSubmit={submit} className="flex flex-col gap-5">
            <div>
                <h2 className="text-lg font-semibold">
                    {rule ? 'Edit rule' : 'New rule'}
                </h2>
                <p className="text-sm text-muted-foreground">
                    {rule
                        ? `${typeLabel} · ${targetLabel}`
                        : 'Set a trigger value for one alert type.'}
                </p>
            </div>

            <div className="grid gap-1.5">
                <Label>Scope</Label>
                {locked ? (
                    <p className="text-sm text-muted-foreground">
                        {GROUPS.find((g) => g.scope === scope)?.tag} — scope and
                        target can’t change; delete and re-add instead.
                    </p>
                ) : (
                    <Segmented
                        label="Rule scope"
                        value={scope}
                        onChange={changeScope}
                        options={[
                            { value: 'global', label: 'Global' },
                            { value: 'unit_type', label: 'Unit type' },
                            { value: 'device', label: 'Device' },
                        ]}
                        className="[&>button]:min-h-9"
                    />
                )}
            </div>

            {!locked && scope === 'unit_type' && (
                <div className="grid gap-1.5">
                    <Label>Unit type</Label>
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

            {!locked && scope === 'device' && (
                <div className="grid gap-1.5">
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

            {!locked && (
                <div className="grid gap-1.5">
                    <Label>Alert type</Label>
                    <Combobox
                        options={alertTypes.map((t) => ({
                            value: t.value,
                            label: t.label,
                        }))}
                        value={data.alert_type}
                        onValueChange={(v) =>
                            setData('alert_type', v as AlertType)
                        }
                        placeholder="Select alert type"
                        searchPlaceholder="Search alert type..."
                    />
                    <InputError message={errors.alert_type} />
                </div>
            )}

            <div className="grid gap-1.5">
                <Label htmlFor="threshold_value">Threshold</Label>
                <div className="flex overflow-hidden rounded-md border focus-within:ring-2 focus-within:ring-ring">
                    <Input
                        id="threshold_value"
                        type="number"
                        step="any"
                        inputMode="decimal"
                        value={data.threshold_value}
                        onChange={(e) =>
                            setData('threshold_value', e.target.value)
                        }
                        className="rounded-none border-0 font-mono shadow-none focus-visible:ring-0"
                        aria-describedby="threshold-hint"
                    />
                    {unit && (
                        <span className="grid place-items-center bg-muted px-3 text-sm whitespace-nowrap text-muted-foreground">
                            {unit}
                        </span>
                    )}
                </div>
                <InputError message={errors.threshold_value} />
                <p
                    id="threshold-hint"
                    className="text-xs text-muted-foreground"
                >
                    {hint()}
                </p>
            </div>

            <label className="flex min-h-11 items-center gap-2.5 text-sm">
                <Switch
                    checked={data.is_active}
                    onCheckedChange={(v) => setData('is_active', v)}
                />
                Rule active
            </label>

            <div className="flex items-center gap-2">
                {rule && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={remove}
                        aria-label="Delete rule"
                        className="text-danger hover:text-danger"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                )}
                <div className="ml-auto flex gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button type="submit" disabled={processing}>
                        Save rule
                    </Button>
                </div>
            </div>
        </form>
    );
}

export default function AlertThresholdsIndex({
    thresholds,
    devices,
    alertTypes,
    unitTypes,
    unitTypeCounts,
}: PageProps) {
    const [editing, setEditing] = useState<Editing>(null);
    const isNarrow = useIsMobile();
    const selectedId = editing?.mode === 'edit' ? editing.rule.id : null;

    const toggleActive = (rule: ThresholdRow, isActive: boolean) => {
        router.put(
            AlertThresholdController.update.url(rule.id),
            { threshold_value: rule.threshold_value, is_active: isActive },
            { preserveScroll: true, preserveState: true },
        );
    };

    const editor = editing && (
        <RuleEditor
            key={editing.mode === 'edit' ? editing.rule.id : 'new'}
            editing={editing}
            thresholds={thresholds}
            devices={devices}
            alertTypes={alertTypes}
            unitTypes={unitTypes}
            unitTypeCounts={unitTypeCounts}
            onClose={() => setEditing(null)}
        />
    );

    let panel: ReactNode;

    if (isNarrow) {
        panel = (
            <Sheet
                open={editing !== null}
                onOpenChange={(open) => !open && setEditing(null)}
            >
                <SheetContent
                    side="bottom"
                    className="max-h-[90svh] overflow-y-auto rounded-t-2xl p-5"
                >
                    <SheetTitle className="sr-only">Alert rule</SheetTitle>
                    <SheetDescription className="sr-only">
                        Edit an alert threshold rule.
                    </SheetDescription>
                    {editor}
                </SheetContent>
            </Sheet>
        );
    } else {
        panel = (
            <aside className="rounded-xl border bg-card p-6 lg:sticky lg:top-6">
                {editor ?? (
                    <EmptyState
                        icon={<SlidersHorizontal className="size-6" />}
                        title="Select a rule"
                        className="py-6"
                    >
                        Pick a rule to edit it, or add a new one.
                    </EmptyState>
                )}
            </aside>
        );
    }

    return (
        <>
            <Head title="Alert Thresholds" />

            <div className="grid items-start gap-6 p-4 md:p-7 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div className="flex min-w-0 flex-col gap-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                                Alert Thresholds
                            </h1>
                            <p className="mt-1 text-sm text-muted-foreground">
                                The most specific rule wins: Device › Unit type
                                › Global.
                            </p>
                        </div>
                        <Button
                            onClick={() => setEditing({ mode: 'create' })}
                            className="h-11 shrink-0 md:h-10"
                        >
                            <Plus className="size-4" /> Add rule
                        </Button>
                    </div>

                    {GROUPS.map((group) => {
                        const rules = thresholds.filter(
                            (t) => t.scope === group.scope,
                        );

                        return (
                            <section
                                key={group.scope}
                                className="overflow-hidden rounded-xl border bg-card"
                            >
                                <header className="flex items-center justify-between gap-3 border-b px-5 py-3">
                                    <h2 className="flex items-center gap-3 font-semibold">
                                        <span className="rounded-md bg-accent px-2 py-0.5 text-xs font-semibold tracking-wider text-accent-foreground uppercase">
                                            {group.tag}
                                        </span>
                                        {group.title}
                                    </h2>
                                    <span className="text-sm text-muted-foreground tabular-nums">
                                        {rules.length} rule
                                        {rules.length === 1 ? '' : 's'}
                                    </span>
                                </header>
                                {rules.length === 0 ? (
                                    <p className="px-5 py-4 text-sm text-muted-foreground">
                                        No {group.tag.toLowerCase()} rules.
                                    </p>
                                ) : (
                                    <ul>
                                        {rules.map((rule) => (
                                            <li
                                                key={rule.id}
                                                className={cn(
                                                    'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-t px-5 py-3 first:border-t-0 md:grid-cols-[minmax(0,1.3fr)_8rem_minmax(0,1fr)_5rem_auto]',
                                                    selectedId === rule.id &&
                                                        'bg-accent/50',
                                                )}
                                            >
                                                <RuleTarget rule={rule} />
                                                <span className="justify-self-end md:justify-self-start">
                                                    <AlertTypeBadge
                                                        type={rule.alert_type}
                                                    />
                                                </span>
                                                <span className="font-mono text-sm tabular-nums">
                                                    {operator(rule.alert_type)}{' '}
                                                    <span className="font-semibold">
                                                        {rule.threshold_value}
                                                    </span>{' '}
                                                    <span className="text-muted-foreground">
                                                        {SHORT_UNIT[
                                                            rule.alert_type
                                                        ] ?? ''}
                                                    </span>
                                                </span>
                                                <label className="flex min-h-11 items-center gap-2 justify-self-end text-sm text-muted-foreground md:min-h-0 md:justify-self-start">
                                                    <Switch
                                                        checked={rule.is_active}
                                                        onCheckedChange={(v) =>
                                                            toggleActive(
                                                                rule,
                                                                v,
                                                            )
                                                        }
                                                        aria-label={`${rule.alert_type_label} rule active`}
                                                    />
                                                    {rule.is_active
                                                        ? 'On'
                                                        : 'Off'}
                                                </label>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="col-span-2 md:col-span-1"
                                                    aria-label={`Edit ${rule.alert_type_label} rule`}
                                                    onClick={() =>
                                                        setEditing({
                                                            mode: 'edit',
                                                            rule,
                                                        })
                                                    }
                                                >
                                                    Edit
                                                </Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                </div>

                {panel}
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
