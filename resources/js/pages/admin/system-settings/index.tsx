import { Head, useForm, usePage } from '@inertiajs/react';
import { KeyRound, Plus, Shield } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { EmptyState, LastSeen, SecretReveal } from '@/components/orion/misc';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import adminApiTokens from '@/routes/admin/api-tokens';
import adminSystemSettings from '@/routes/admin/system-settings';
import { index as systemSettingsIndex } from '@/routes/admin/system-settings';

type MqttSettings = {
    mqtt_host: string;
    mqtt_port: number;
    mqtt_client_id: string;
    mqtt_username: string;
    mqtt_password: string;
    mqtt_password_is_set: boolean;
    mqtt_clean_session: boolean;
    mqtt_auto_reconnect: boolean;
    mqtt_reconnect_max_attempts: number;
    mqtt_reconnect_delay: number;
    mqtt_use_tls: boolean;
    mqtt_tls_verify_peer: boolean;
    mqtt_tls_verify_peer_name: boolean;
    mqtt_tls_allow_self_signed: boolean;
    chirpstack_app_id: string;
    mqtt_topic_prefix: string;
};

type MqttMeta = {
    /** True once settings were saved in ORION; false = values shown come from .env. */
    saved: boolean;
    default_topic: string;
};

type ApiToken = {
    id: number;
    name: string;
    token_preview: string;
    abilities: string[];
    device_group_ids: number[] | null;
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

type DeviceGroupOption = {
    id: number;
    name: string;
};

type PageProps = {
    mqttSettings: MqttSettings;
    mqttMeta: MqttMeta;
    apiTokens: ApiToken[];
    deviceGroups: DeviceGroupOption[];
    auditLogs: AuditLogs;
    flash?: { new_token?: string; success?: string };
};

/** Absolute date in WIB, e.g. "16 Nov 2026". */
function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
        timeZone: 'Asia/Jakarta',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
}

/** "2026-11-17 13:27" in WIB. */
function formatDateTime(iso: string): string {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    const time = d.toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
    });

    return `${date} ${time}`;
}

function Chip({ children }: { children: ReactNode }) {
    return (
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs whitespace-nowrap">
            {children}
        </span>
    );
}

function Field({
    id,
    label,
    optional,
    error,
    className,
    children,
}: {
    id: string;
    label: string;
    optional?: boolean;
    error?: string;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('grid content-start gap-1.5', className)}>
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
            <InputError message={error} />
        </div>
    );
}

// ── MQTT Panel ────────────────────────────────────────────────────────────────

function FormSection({
    title,
    description,
    children,
}: {
    title: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <fieldset className="grid gap-5 border-t px-6 py-5 sm:grid-cols-2">
            <legend className="sr-only">{title}</legend>
            <div className="sm:col-span-2">
                <h3 className="font-semibold">{title}</h3>
                {description && (
                    <p className="text-sm text-muted-foreground">
                        {description}
                    </p>
                )}
            </div>
            {children}
        </fieldset>
    );
}

function SwitchRow({
    id,
    label,
    hint,
    checked,
    disabled,
    onChange,
}: {
    id: string;
    label: string;
    hint?: string;
    checked: boolean;
    disabled?: boolean;
    onChange: (value: boolean) => void;
}) {
    return (
        <div className="flex min-h-11 items-start gap-3">
            <Switch
                id={id}
                checked={checked}
                disabled={disabled}
                onCheckedChange={onChange}
                className="mt-0.5"
                aria-describedby={hint ? `${id}-hint` : undefined}
            />
            <div>
                <Label htmlFor={id}>{label}</Label>
                {hint && (
                    <p
                        id={`${id}-hint`}
                        className="text-xs text-muted-foreground"
                    >
                        {hint}
                    </p>
                )}
            </div>
        </div>
    );
}

function MqttPanel({
    settings,
    meta,
}: {
    settings: MqttSettings;
    meta: MqttMeta;
}) {
    const { data, setData, put, processing, errors, isDirty } = useForm({
        mqtt_host: settings.mqtt_host,
        mqtt_port: settings.mqtt_port,
        mqtt_client_id: settings.mqtt_client_id,
        mqtt_username: settings.mqtt_username,
        mqtt_password: '',
        mqtt_password_clear: false,
        mqtt_clean_session: settings.mqtt_clean_session,
        mqtt_auto_reconnect: settings.mqtt_auto_reconnect,
        mqtt_reconnect_max_attempts: settings.mqtt_reconnect_max_attempts,
        mqtt_reconnect_delay: settings.mqtt_reconnect_delay,
        mqtt_use_tls: settings.mqtt_use_tls,
        mqtt_tls_verify_peer: settings.mqtt_tls_verify_peer,
        mqtt_tls_verify_peer_name: settings.mqtt_tls_verify_peer_name,
        mqtt_tls_allow_self_signed: settings.mqtt_tls_allow_self_signed,
        chirpstack_app_id: settings.chirpstack_app_id,
        mqtt_topic_prefix: settings.mqtt_topic_prefix,
    });
    const configured = settings.mqtt_host !== '';
    const topicPreview =
        data.mqtt_topic_prefix.trim() ||
        `application/${data.chirpstack_app_id.trim() || '{CHIRPSTACK_APP_ID}'}/device/+/event/up`;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(adminSystemSettings.update.url(), {
            preserveScroll: true,
            onSuccess: () => setData('mqtt_password', ''),
        });
    };

    return (
        <section className="max-w-3xl rounded-xl border bg-card">
            <header className="flex flex-wrap items-start justify-between gap-4 px-6 py-5">
                <div>
                    <h2 className="text-lg font-semibold">MQTT broker</h2>
                    <p className="text-sm text-muted-foreground">
                        Connection used by{' '}
                        <code className="font-mono text-xs">
                            mqtt:subscribe
                        </code>{' '}
                        to receive ChirpStack uplinks.
                    </p>
                </div>
                <span
                    className={cn(
                        'inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
                        configured
                            ? 'bg-online-bg text-online'
                            : 'bg-offline-bg text-offline',
                    )}
                >
                    <span
                        aria-hidden
                        className={cn(
                            'size-1.5 rounded-full',
                            configured ? 'bg-online' : 'bg-offline',
                        )}
                    />
                    {configured ? 'Configured' : 'Not configured'}
                </span>
                <p className="w-full rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                    {meta.saved
                        ? 'Managed in ORION — these values override .env.'
                        : 'Showing values from .env. Save once to manage them here.'}{' '}
                    The running subscriber picks up saved changes automatically
                    within a few seconds — no restart needed.
                </p>
            </header>

            <form onSubmit={handleSubmit}>
                <FormSection title="Broker">
                    <div className="grid gap-5 sm:col-span-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                        <Field
                            id="mqtt_host"
                            label="Host"
                            error={errors.mqtt_host}
                        >
                            <Input
                                id="mqtt_host"
                                value={data.mqtt_host}
                                onChange={(e) =>
                                    setData('mqtt_host', e.target.value)
                                }
                                placeholder="mqtt.example.com"
                                autoComplete="off"
                                className="font-mono"
                            />
                        </Field>
                        <Field
                            id="mqtt_port"
                            label="Port"
                            error={errors.mqtt_port}
                        >
                            <Input
                                id="mqtt_port"
                                type="number"
                                min={1}
                                max={65535}
                                value={data.mqtt_port}
                                onChange={(e) =>
                                    setData('mqtt_port', Number(e.target.value))
                                }
                                className="font-mono"
                            />
                        </Field>
                    </div>
                    <Field
                        id="mqtt_client_id"
                        label="Client ID"
                        error={errors.mqtt_client_id}
                    >
                        <Input
                            id="mqtt_client_id"
                            value={data.mqtt_client_id}
                            onChange={(e) =>
                                setData('mqtt_client_id', e.target.value)
                            }
                            placeholder="orion-subscriber"
                            autoComplete="off"
                            className="font-mono"
                        />
                    </Field>
                    <Field
                        id="chirpstack_app_id"
                        label="ChirpStack application ID"
                        error={errors.chirpstack_app_id}
                    >
                        <Input
                            id="chirpstack_app_id"
                            value={data.chirpstack_app_id}
                            onChange={(e) =>
                                setData('chirpstack_app_id', e.target.value)
                            }
                            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                            autoComplete="off"
                            className="font-mono"
                        />
                    </Field>
                    <Field
                        id="mqtt_topic_prefix"
                        label="Topic override"
                        optional
                        error={errors.mqtt_topic_prefix}
                        className="sm:col-span-2"
                    >
                        <Input
                            id="mqtt_topic_prefix"
                            value={data.mqtt_topic_prefix}
                            onChange={(e) =>
                                setData('mqtt_topic_prefix', e.target.value)
                            }
                            placeholder={meta.default_topic}
                            autoComplete="off"
                            className="font-mono"
                            aria-describedby="topic-preview"
                        />
                        <p
                            id="topic-preview"
                            className="text-xs text-muted-foreground"
                        >
                            Subscribes to{' '}
                            <code className="font-mono break-all">
                                {topicPreview}
                            </code>
                        </p>
                    </Field>
                </FormSection>

                <FormSection title="Authentication">
                    <Field
                        id="mqtt_username"
                        label="Username"
                        optional
                        error={errors.mqtt_username}
                    >
                        <Input
                            id="mqtt_username"
                            value={data.mqtt_username}
                            onChange={(e) =>
                                setData('mqtt_username', e.target.value)
                            }
                            autoComplete="off"
                        />
                    </Field>
                    <Field
                        id="mqtt_password"
                        label="Password"
                        optional
                        error={errors.mqtt_password}
                    >
                        <Input
                            id="mqtt_password"
                            type="password"
                            value={data.mqtt_password}
                            onChange={(e) => {
                                setData('mqtt_password', e.target.value);
                                setData('mqtt_password_clear', false);
                            }}
                            autoComplete="new-password"
                            placeholder={
                                settings.mqtt_password_is_set
                                    ? '•••••••• (leave blank to keep)'
                                    : 'Not set'
                            }
                        />
                        {settings.mqtt_password_is_set && (
                            <label className="flex min-h-9 items-center gap-2 text-xs text-muted-foreground">
                                <Checkbox
                                    checked={data.mqtt_password_clear}
                                    onCheckedChange={(v) => {
                                        setData(
                                            'mqtt_password_clear',
                                            v === true,
                                        );
                                        setData('mqtt_password', '');
                                    }}
                                />
                                Remove the saved password
                            </label>
                        )}
                    </Field>
                </FormSection>

                <FormSection
                    title="Connection"
                    description="Session and reconnect behaviour of the subscriber."
                >
                    <SwitchRow
                        id="mqtt_clean_session"
                        label="Clean session"
                        hint="Off keeps queued QoS 1 uplinks while ORION is offline."
                        checked={data.mqtt_clean_session}
                        onChange={(v) => setData('mqtt_clean_session', v)}
                    />
                    <SwitchRow
                        id="mqtt_auto_reconnect"
                        label="Auto reconnect"
                        hint="Reconnect automatically when the broker drops."
                        checked={data.mqtt_auto_reconnect}
                        onChange={(v) => setData('mqtt_auto_reconnect', v)}
                    />
                    <Field
                        id="mqtt_reconnect_max_attempts"
                        label="Max reconnect attempts"
                        error={errors.mqtt_reconnect_max_attempts}
                    >
                        <Input
                            id="mqtt_reconnect_max_attempts"
                            type="number"
                            min={0}
                            value={data.mqtt_reconnect_max_attempts}
                            disabled={!data.mqtt_auto_reconnect}
                            onChange={(e) =>
                                setData(
                                    'mqtt_reconnect_max_attempts',
                                    Number(e.target.value),
                                )
                            }
                            className="font-mono"
                        />
                    </Field>
                    <Field
                        id="mqtt_reconnect_delay"
                        label="Delay between attempts (seconds)"
                        error={errors.mqtt_reconnect_delay}
                    >
                        <Input
                            id="mqtt_reconnect_delay"
                            type="number"
                            min={1}
                            value={data.mqtt_reconnect_delay}
                            disabled={!data.mqtt_auto_reconnect}
                            onChange={(e) =>
                                setData(
                                    'mqtt_reconnect_delay',
                                    Number(e.target.value),
                                )
                            }
                            className="font-mono"
                        />
                    </Field>
                </FormSection>

                <FormSection
                    title="TLS"
                    description="Required when the broker is reached over the internet (usually port 8883)."
                >
                    <SwitchRow
                        id="mqtt_use_tls"
                        label="Use TLS / SSL"
                        checked={data.mqtt_use_tls}
                        onChange={(v) => setData('mqtt_use_tls', v)}
                    />
                    <SwitchRow
                        id="mqtt_tls_verify_peer"
                        label="Verify certificate"
                        checked={data.mqtt_tls_verify_peer}
                        disabled={!data.mqtt_use_tls}
                        onChange={(v) => setData('mqtt_tls_verify_peer', v)}
                    />
                    <SwitchRow
                        id="mqtt_tls_verify_peer_name"
                        label="Verify host name"
                        checked={data.mqtt_tls_verify_peer_name}
                        disabled={!data.mqtt_use_tls}
                        onChange={(v) =>
                            setData('mqtt_tls_verify_peer_name', v)
                        }
                    />
                    <SwitchRow
                        id="mqtt_tls_allow_self_signed"
                        label="Allow self-signed certificate"
                        hint="Only for brokers with their own CA."
                        checked={data.mqtt_tls_allow_self_signed}
                        disabled={!data.mqtt_use_tls}
                        onChange={(v) =>
                            setData('mqtt_tls_allow_self_signed', v)
                        }
                    />
                </FormSection>

                <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
                    {isDirty && (
                        <span className="text-xs text-muted-foreground">
                            Unsaved changes
                        </span>
                    )}
                    <Button type="submit" disabled={processing}>
                        Save
                    </Button>
                </div>
            </form>
        </section>
    );
}

function NewTokenBanner({
    token,
    onDismiss,
}: {
    token: string;
    onDismiss: () => void;
}) {
    return (
        <div className="grid gap-2">
            <SecretReveal secret={token} />
            <Button
                size="sm"
                variant="ghost"
                className="justify-self-start text-xs text-muted-foreground"
                onClick={onDismiss}
            >
                I’ve stored it — dismiss
            </Button>
        </div>
    );
}

function CreateTokenDialog({
    deviceGroups,
}: {
    deviceGroups: DeviceGroupOption[];
}) {
    const [open, setOpen] = useState(false);
    const { data, setData, post, processing, errors, reset } = useForm<{
        name: string;
        expires_at: string;
        device_group_ids: number[];
    }>({
        name: '',
        expires_at: '',
        device_group_ids: [],
    });

    const toggleGroup = (groupId: number, checked: boolean) => {
        setData(
            'device_group_ids',
            checked
                ? [...data.device_group_ids, groupId]
                : data.device_group_ids.filter((id) => id !== groupId),
        );
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(adminApiTokens.store.url(), {
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
                Create token
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
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create API Token</DialogTitle>
                        <DialogDescription>
                            Generate a new API token for programmatic access.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="create-token-form"
                        onSubmit={handleSubmit}
                        className="space-y-4"
                    >
                        <div className="grid gap-2">
                            <Label htmlFor="token_name">Token Name</Label>
                            <Input
                                id="token_name"
                                value={data.name}
                                onChange={(e) =>
                                    setData('name', e.target.value)
                                }
                                placeholder="e.g. CI Pipeline"
                                autoComplete="off"
                            />
                            <InputError message={errors.name} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="expires_at">
                                Expires At{' '}
                                <span className="font-normal text-muted-foreground">
                                    (optional)
                                </span>
                            </Label>
                            <Input
                                id="expires_at"
                                type="date"
                                value={data.expires_at}
                                onChange={(e) =>
                                    setData('expires_at', e.target.value)
                                }
                            />
                            <InputError message={errors.expires_at} />
                        </div>

                        {deviceGroups.length > 0 && (
                            <div className="grid gap-2">
                                <Label>
                                    Device Groups{' '}
                                    <span className="font-normal text-muted-foreground">
                                        (none selected = all devices)
                                    </span>
                                </Label>
                                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-md border p-3">
                                    {deviceGroups.map((group) => (
                                        <label
                                            key={group.id}
                                            className="flex items-center gap-2 text-sm"
                                        >
                                            <Checkbox
                                                checked={data.device_group_ids.includes(
                                                    group.id,
                                                )}
                                                onCheckedChange={(checked) =>
                                                    toggleGroup(
                                                        group.id,
                                                        checked === true,
                                                    )
                                                }
                                            />
                                            {group.name}
                                        </label>
                                    ))}
                                </div>
                                <InputError message={errors.device_group_ids} />
                            </div>
                        )}
                    </form>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            form="create-token-form"
                            disabled={processing}
                        >
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
                variant="outline"
                size="sm"
                className="border-danger/40 text-danger hover:bg-danger-bg hover:text-danger"
                onClick={() => setOpen(true)}
                aria-label={`Revoke ${token.name}`}
            >
                Revoke
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Revoke Token</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to revoke{' '}
                            <strong>{token.name}</strong>? Any apps using this
                            token will lose access immediately.
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
                            Revoke
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function ApiTokensPanel({
    tokens,
    deviceGroups,
}: {
    tokens: ApiToken[];
    deviceGroups: DeviceGroupOption[];
}) {
    const groupNames = new Map(
        deviceGroups.map((group) => [group.id, group.name]),
    );
    const { flash } = usePage<{ flash: { new_token?: string } }>().props;
    const [dismissed, setDismissed] = useState(false);
    const newToken = flash?.new_token;
    const anyExpiry = tokens.some((t) => t.expires_at !== null);

    return (
        <div className="grid max-w-5xl gap-5">
            {newToken && !dismissed && (
                <NewTokenBanner
                    token={newToken}
                    onDismiss={() => setDismissed(true)}
                />
            )}

            <section className="overflow-hidden rounded-xl border bg-card">
                <header className="flex items-center justify-between gap-4 px-6 py-4">
                    <h2 className="text-lg font-semibold">API keys</h2>
                    <CreateTokenDialog deviceGroups={deviceGroups} />
                </header>

                {tokens.length === 0 ? (
                    <EmptyState
                        icon={<KeyRound className="size-6" />}
                        title="No API keys yet"
                        className="border-t"
                    >
                        Create a token for BI tools or dispatch systems that
                        read fleet data.
                    </EmptyState>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-sidebar text-left text-muted-foreground">
                                <tr className="h-[38px] [&>th]:px-4 [&>th]:font-medium [&>th]:whitespace-nowrap">
                                    <th className="pl-6!">Name</th>
                                    <th>Token</th>
                                    <th>Group scope</th>
                                    <th>Last used</th>
                                    {anyExpiry && <th>Expires</th>}
                                    <th>Created</th>
                                    <th>
                                        <span className="sr-only">Actions</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tokens.map((token) => {
                                    const ids = token.device_group_ids;

                                    return (
                                        <tr
                                            key={token.id}
                                            className="h-14 border-t [&>td]:px-4"
                                        >
                                            <td className="pl-6! font-medium">
                                                {token.name}
                                            </td>
                                            <td className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                                                {token.token_preview}
                                            </td>
                                            <td>
                                                <span className="flex flex-wrap gap-1.5">
                                                    {ids === null ||
                                                    ids.length === 0 ? (
                                                        <Chip>All groups</Chip>
                                                    ) : (
                                                        ids.map((id) => (
                                                            <Chip key={id}>
                                                                {groupNames.get(
                                                                    id,
                                                                ) ?? `#${id}`}
                                                            </Chip>
                                                        ))
                                                    )}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap">
                                                {token.last_used_at ? (
                                                    <LastSeen
                                                        at={token.last_used_at}
                                                        staleAfterSec={
                                                            Number.MAX_SAFE_INTEGER
                                                        }
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        Never
                                                    </span>
                                                )}
                                            </td>
                                            {anyExpiry && (
                                                <td className="whitespace-nowrap text-muted-foreground">
                                                    {token.expires_at ??
                                                        'Never'}
                                                </td>
                                            )}
                                            <td className="whitespace-nowrap text-muted-foreground tabular-nums">
                                                {formatDate(token.created_at)}
                                            </td>
                                            <td className="pr-6! text-right">
                                                <DeleteTokenDialog
                                                    token={token}
                                                />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

// ── Audit Log Panel ───────────────────────────────────────────────────────────

const AUDIT_PAGE_SIZE = 25;

function AuditLogPanel({ logs }: { logs: AuditLogs }) {
    const [page, setPage] = useState(0);
    const pageCount = Math.max(
        1,
        Math.ceil(logs.data.length / AUDIT_PAGE_SIZE),
    );
    const rows = logs.data.slice(
        page * AUDIT_PAGE_SIZE,
        (page + 1) * AUDIT_PAGE_SIZE,
    );

    return (
        <section className="max-w-5xl overflow-hidden rounded-xl border bg-card">
            <header className="flex items-center justify-between gap-4 px-6 py-4">
                <h2 className="text-lg font-semibold">Audit log</h2>
                <span className="text-sm text-muted-foreground tabular-nums">
                    {logs.total} entries
                </span>
            </header>

            {rows.length === 0 ? (
                <EmptyState
                    icon={<Shield className="size-6" />}
                    title="No audit entries yet"
                    className="border-t"
                />
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-sidebar text-left text-muted-foreground">
                            <tr className="h-[38px] [&>th]:px-4 [&>th]:font-medium [&>th]:whitespace-nowrap">
                                <th className="pl-6!">Time</th>
                                <th>User</th>
                                <th>Event</th>
                                <th>Target</th>
                                <th className="pr-6!">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((entry) => (
                                <tr
                                    key={entry.id}
                                    className="h-11 border-t [&>td]:px-4"
                                >
                                    <td className="pl-6! whitespace-nowrap text-muted-foreground tabular-nums">
                                        {formatDateTime(entry.created_at)}
                                    </td>
                                    <td className="font-medium whitespace-nowrap">
                                        {entry.user}
                                    </td>
                                    <td>
                                        <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs whitespace-nowrap">
                                            {entry.event}
                                        </code>
                                    </td>
                                    <td className="max-w-md truncate">
                                        {entry.description}
                                    </td>
                                    <td className="pr-6! font-mono text-xs text-muted-foreground">
                                        {entry.ip_address ?? '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {pageCount > 1 && (
                <div className="flex items-center justify-between gap-4 border-t px-6 py-3 text-sm text-muted-foreground">
                    <span className="tabular-nums">
                        Page {page + 1} of {pageCount}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page - 1)}
                            disabled={page === 0}
                        >
                            Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPage(page + 1)}
                            disabled={page >= pageCount - 1}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SystemSettingsIndex({
    mqttSettings,
    mqttMeta,
    apiTokens,
    deviceGroups,
    auditLogs,
}: PageProps) {
    return (
        <>
            <Head title="System Settings" />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                        System Settings
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Integrations, access tokens and audit trail.
                    </p>
                </div>

                <Tabs defaultValue="mqtt">
                    <TabsList className="h-11 w-fit [&>button]:min-h-9 [&>button]:px-4">
                        <TabsTrigger value="mqtt">MQTT</TabsTrigger>
                        <TabsTrigger value="api-keys">API Keys</TabsTrigger>
                        <TabsTrigger value="audit-log">Audit Log</TabsTrigger>
                    </TabsList>

                    <TabsContent value="mqtt" className="mt-5">
                        <MqttPanel settings={mqttSettings} meta={mqttMeta} />
                    </TabsContent>

                    <TabsContent value="api-keys" className="mt-5">
                        <ApiTokensPanel
                            tokens={apiTokens}
                            deviceGroups={deviceGroups}
                        />
                    </TabsContent>

                    <TabsContent value="audit-log" className="mt-5">
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
