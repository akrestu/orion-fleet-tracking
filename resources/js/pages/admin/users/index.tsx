import { Head, useForm, usePage } from '@inertiajs/react';
import { KeyRound, Pencil, Plus, Search, SearchX, Trash2 } from 'lucide-react';
import { useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import InputError from '@/components/input-error';
import { RoleBadge } from '@/components/orion/badges';
import { EmptyState, LastSeen } from '@/components/orion/misc';
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
import { cn } from '@/lib/utils';
import { index as adminUsersIndex } from '@/routes/admin/users';
import type { Auth } from '@/types';

type UserRole = 'admin' | 'operator' | 'viewer';

type AdminUser = {
    id: number;
    name: string;
    unique_id: string;
    email: string;
    role: UserRole;
    role_label: string;
    created_at: string;
    groups: string[];
    two_factor_enabled: boolean;
    last_active_at: string | null;
};

type RoleOption = {
    value: string;
    label: string;
};

type PageProps = {
    auth: Auth;
    users: AdminUser[];
    roles: RoleOption[];
};

const ROLE_DESCRIPTION: Record<UserRole, string> = {
    admin: 'Full access: users, devices, alerts, settings.',
    operator: 'Monitors dashboard & map, resolves alerts in assigned groups.',
    viewer: 'Read-only access to assigned groups.',
};
const ROLES: UserRole[] = ['admin', 'operator', 'viewer'];
const NEVER_STALE = Number.MAX_SAFE_INTEGER;

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

function UserFormFields({
    errors,
    values,
    onChange,
    roles,
    showPassword,
}: {
    errors: Partial<Record<string, string>>;
    values: {
        name: string;
        unique_id: string;
        email: string;
        role: string;
        password?: string;
        password_confirmation?: string;
    };
    onChange: (field: string, value: string) => void;
    roles: RoleOption[];
    showPassword: boolean;
}) {
    const roleOptions: ComboboxOption[] = roles.map((r) => ({
        value: r.value,
        label: r.label,
    }));

    return (
        <div className="space-y-4">
            <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                    id="name"
                    value={values.name}
                    onChange={(e) => onChange('name', e.target.value)}
                    placeholder="Full name"
                    autoComplete="off"
                />
                <InputError message={errors.name} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="unique_id">Unique ID</Label>
                <Input
                    id="unique_id"
                    value={values.unique_id}
                    onChange={(e) => onChange('unique_id', e.target.value)}
                    placeholder="e.g. WBK-0457"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                    Used to sign in. Letters, numbers, dot, dash or underscore.
                </p>
                <InputError message={errors.unique_id} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                    id="email"
                    type="email"
                    value={values.email}
                    onChange={(e) => onChange('email', e.target.value)}
                    placeholder="user@example.com"
                    autoComplete="off"
                />
                <InputError message={errors.email} />
            </div>

            <div className="grid gap-2">
                <Label>Role</Label>
                <Combobox
                    options={roleOptions}
                    value={values.role}
                    onValueChange={(val) => onChange('role', val)}
                    placeholder="Select role"
                    searchPlaceholder="Search role..."
                />
                <InputError message={errors.role} />
            </div>

            {showPassword && (
                <>
                    <div className="grid gap-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                            id="password"
                            type="password"
                            value={values.password ?? ''}
                            onChange={(e) =>
                                onChange('password', e.target.value)
                            }
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                        <InputError message={errors.password} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password_confirmation">
                            Confirm Password
                        </Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            value={values.password_confirmation ?? ''}
                            onChange={(e) =>
                                onChange(
                                    'password_confirmation',
                                    e.target.value,
                                )
                            }
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                    </div>
                </>
            )}
        </div>
    );
}

function CreateUserDialog({ roles }: { roles: RoleOption[] }) {
    const [open, setOpen] = useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        unique_id: '',
        email: '',
        role: 'viewer',
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(UserController.store.url(), {
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
                Add User
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
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create User</DialogTitle>
                        <DialogDescription>
                            Add a new user to the system.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id="create-user-form"
                        onSubmit={handleSubmit}
                        className="py-2"
                    >
                        <UserFormFields
                            errors={errors}
                            values={data}
                            onChange={(field, value) =>
                                setData(field as keyof typeof data, value)
                            }
                            roles={roles}
                            showPassword
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
                            form="create-user-form"
                            disabled={processing}
                        >
                            Create User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function EditUserDialog({
    user,
    roles,
}: {
    user: AdminUser;
    roles: RoleOption[];
}) {
    const [open, setOpen] = useState(false);

    const { data, setData, put, processing, errors, reset } = useForm({
        name: user.name,
        unique_id: user.unique_id,
        email: user.email,
        role: user.role,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        put(UserController.update.url(user.id), {
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
                    setData({
                        name: user.name,
                        unique_id: user.unique_id,
                        email: user.email,
                        role: user.role,
                    });
                    setOpen(true);
                }}
            >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit {user.name}</span>
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
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update {user.name}'s information.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id={`edit-user-form-${user.id}`}
                        onSubmit={handleSubmit}
                        className="py-2"
                    >
                        <UserFormFields
                            errors={errors}
                            values={data}
                            onChange={(field, value) =>
                                setData(field as keyof typeof data, value)
                            }
                            roles={roles}
                            showPassword={false}
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
                            form={`edit-user-form-${user.id}`}
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

function ResetPasswordDialog({ user }: { user: AdminUser }) {
    const [open, setOpen] = useState(false);

    const { data, setData, patch, processing, errors, reset } = useForm({
        password: '',
        password_confirmation: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        patch(UserController.resetPassword.url(user.id), {
            preserveScroll: true,
            onSuccess: () => {
                setOpen(false);
                reset();
            },
        });
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(true)}
                title={`Reset password for ${user.name}`}
            >
                <KeyRound className="h-4 w-4" />
                <span className="sr-only">Reset password for {user.name}</span>
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
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                            Set a new password for <strong>{user.name}</strong>.
                            They will need to use this password on their next
                            login.
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        id={`reset-password-form-${user.id}`}
                        onSubmit={handleSubmit}
                        className="py-2"
                    >
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor={`new-password-${user.id}`}>
                                    New Password
                                </Label>
                                <Input
                                    id={`new-password-${user.id}`}
                                    type="password"
                                    value={data.password}
                                    onChange={(e) =>
                                        setData('password', e.target.value)
                                    }
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label
                                    htmlFor={`new-password-confirm-${user.id}`}
                                >
                                    Confirm New Password
                                </Label>
                                <Input
                                    id={`new-password-confirm-${user.id}`}
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) =>
                                        setData(
                                            'password_confirmation',
                                            e.target.value,
                                        )
                                    }
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
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
                            form={`reset-password-form-${user.id}`}
                            disabled={processing}
                        >
                            Reset Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DeleteUserDialog({
    user,
    currentUserId,
}: {
    user: AdminUser;
    currentUserId: number;
}) {
    const [open, setOpen] = useState(false);
    const { delete: destroy, processing } = useForm({});

    const isSelf = user.id === currentUserId;

    const handleDelete = () => {
        destroy(UserController.destroy.url(user.id), {
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
                disabled={isSelf}
                title={
                    isSelf
                        ? 'Cannot delete your own account'
                        : `Delete ${user.name}`
                }
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete {user.name}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete{' '}
                            <strong>{user.name}</strong>? This action cannot be
                            undone.
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

function GroupChips({ user }: { user: AdminUser }) {
    if (user.role === 'admin') {
        return (
            <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                All groups
            </span>
        );
    }

    if (user.groups.length === 0) {
        return <span className="text-xs text-warning">No group</span>;
    }

    return (
        <>
            {user.groups.map((g) => (
                <span
                    key={g}
                    className="rounded-md bg-muted px-2 py-0.5 text-xs whitespace-nowrap"
                >
                    {g}
                </span>
            ))}
        </>
    );
}

export default function UsersIndex({
    users,
    roles,
}: {
    users: AdminUser[];
    roles: RoleOption[];
}) {
    const { auth } = usePage<PageProps>().props;
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | null>(null);

    const counts = Object.fromEntries(
        ROLES.map((r) => [r, users.filter((u) => u.role === r).length]),
    ) as Record<UserRole, number>;
    const needle = search.trim().toLowerCase();
    const visible = users.filter(
        (u) =>
            (roleFilter === null || u.role === roleFilter) &&
            (needle === '' ||
                u.name.toLowerCase().includes(needle) ||
                u.email.toLowerCase().includes(needle) ||
                u.unique_id.toLowerCase().includes(needle)),
    );

    return (
        <>
            <Head title="User Management" />

            <div className="flex flex-col gap-5 p-4 md:p-7">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">
                            User Management
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                            {users.length} users · {counts.admin} admins ·{' '}
                            {counts.operator} operators · {counts.viewer}{' '}
                            viewers
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <label className="relative block flex-1 md:w-72">
                            <span className="sr-only">Search users</span>
                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="search"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search users…"
                                className="h-11 pl-9 md:h-10"
                            />
                        </label>
                        <CreateUserDialog roles={roles} />
                    </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                    {ROLES.map((role) => (
                        <button
                            key={role}
                            type="button"
                            aria-pressed={roleFilter === role}
                            onClick={() =>
                                setRoleFilter((r) => (r === role ? null : role))
                            }
                            className="flex flex-col justify-start rounded-xl border bg-card p-5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring aria-pressed:border-primary/50"
                        >
                            <span className="flex items-center justify-between">
                                <RoleBadge role={role} />
                                <span className="text-2xl font-semibold tabular-nums">
                                    {counts[role]}
                                </span>
                            </span>
                            <span className="mt-3 block text-sm text-muted-foreground">
                                {ROLE_DESCRIPTION[role]}
                            </span>
                        </button>
                    ))}
                </div>

                <div className="overflow-hidden rounded-xl border bg-card">
                    {visible.length === 0 ? (
                        <EmptyState
                            icon={<SearchX className="size-6" />}
                            title="No users match"
                        >
                            Try another name, email or role.
                        </EmptyState>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-sidebar text-left text-muted-foreground">
                                    <tr className="h-[38px] [&>th]:px-4 [&>th]:font-medium [&>th]:whitespace-nowrap">
                                        <th className="pl-5!">User</th>
                                        <th>Unique ID</th>
                                        <th>Role</th>
                                        <th>Groups</th>
                                        <th>2FA</th>
                                        <th>Last active</th>
                                        <th>
                                            <span className="sr-only">
                                                Actions
                                            </span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {visible.map((user) => (
                                        <tr
                                            key={user.id}
                                            className="h-16 border-t [&>td]:px-4"
                                        >
                                            <td className="pl-5!">
                                                <span className="flex items-center gap-3">
                                                    <span
                                                        aria-hidden
                                                        className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground"
                                                    >
                                                        {initials(user.name)}
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block truncate font-semibold">
                                                            {user.name}
                                                        </span>
                                                        <span className="block truncate text-xs text-muted-foreground">
                                                            {user.email}
                                                        </span>
                                                    </span>
                                                </span>
                                            </td>
                                            <td className="font-mono text-xs whitespace-nowrap">
                                                {user.unique_id}
                                            </td>
                                            <td>
                                                <RoleBadge role={user.role} />
                                            </td>
                                            <td>
                                                <span className="flex flex-wrap gap-1.5">
                                                    <GroupChips user={user} />
                                                </span>
                                            </td>
                                            <td
                                                className={cn(
                                                    'font-medium whitespace-nowrap',
                                                    user.two_factor_enabled
                                                        ? 'text-online'
                                                        : 'text-warning',
                                                )}
                                            >
                                                {user.two_factor_enabled
                                                    ? 'Enabled'
                                                    : 'Not set'}
                                            </td>
                                            <td className="whitespace-nowrap">
                                                {user.last_active_at ? (
                                                    <LastSeen
                                                        at={user.last_active_at}
                                                        staleAfterSec={
                                                            NEVER_STALE
                                                        }
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        Never
                                                    </span>
                                                )}
                                            </td>
                                            <td className="pr-4! text-right">
                                                <span className="inline-flex items-center gap-1">
                                                    <ResetPasswordDialog
                                                        user={user}
                                                    />
                                                    <EditUserDialog
                                                        user={user}
                                                        roles={roles}
                                                    />
                                                    <DeleteUserDialog
                                                        user={user}
                                                        currentUserId={
                                                            auth.user.id
                                                        }
                                                    />
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

UsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'User Management',
            href: adminUsersIndex(),
        },
    ],
};
