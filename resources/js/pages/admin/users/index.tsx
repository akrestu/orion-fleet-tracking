import { Head, useForm, usePage } from '@inertiajs/react';
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
import { ArrowUpDown, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import UserController from '@/actions/App/Http/Controllers/Admin/UserController';
import InputError from '@/components/input-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { index as adminUsersIndex } from '@/routes/admin/users';
import type { Auth } from '@/types';

type UserRole = 'admin' | 'operator' | 'viewer';

type AdminUser = {
    id: number;
    name: string;
    email: string;
    role: UserRole;
    role_label: string;
    created_at: string;
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

const ROLE_BADGE: Record<UserRole, string> = {
    admin: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    operator: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    viewer: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

function UserFormFields({
    errors,
    values,
    onChange,
    roles,
    showPassword,
}: {
    errors: Partial<Record<string, string>>;
    values: { name: string; email: string; role: string; password?: string; password_confirmation?: string };
    onChange: (field: string, value: string) => void;
    roles: RoleOption[];
    showPassword: boolean;
}) {
    const roleOptions: ComboboxOption[] = roles.map((r) => ({ value: r.value, label: r.label }));

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
                            onChange={(e) => onChange('password', e.target.value)}
                            placeholder="••••••••"
                            autoComplete="new-password"
                        />
                        <InputError message={errors.password} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="password_confirmation">Confirm Password</Label>
                        <Input
                            id="password_confirmation"
                            type="password"
                            value={values.password_confirmation ?? ''}
                            onChange={(e) => onChange('password_confirmation', e.target.value)}
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

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Create User</DialogTitle>
                        <DialogDescription>Add a new user to the system.</DialogDescription>
                    </DialogHeader>

                    <form id="create-user-form" onSubmit={handleSubmit} className="py-2">
                        <UserFormFields
                            errors={errors}
                            values={data}
                            onChange={(field, value) => setData(field as keyof typeof data, value)}
                            roles={roles}
                            showPassword
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="create-user-form" disabled={processing}>
                            Create User
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function EditUserDialog({ user, roles }: { user: AdminUser; roles: RoleOption[] }) {
    const [open, setOpen] = useState(false);

    const { data, setData, put, processing, errors, reset } = useForm({
        name: user.name,
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
                    setData({ name: user.name, email: user.email, role: user.role });
                    setOpen(true);
                }}
            >
                <Pencil className="h-4 w-4" />
                <span className="sr-only">Edit {user.name}</span>
            </Button>

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>Update {user.name}'s information.</DialogDescription>
                    </DialogHeader>

                    <form id={`edit-user-form-${user.id}`} onSubmit={handleSubmit} className="py-2">
                        <UserFormFields
                            errors={errors}
                            values={data}
                            onChange={(field, value) => setData(field as keyof typeof data, value)}
                            roles={roles}
                            showPassword={false}
                        />
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form={`edit-user-form-${user.id}`} disabled={processing}>
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

            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>
                            Set a new password for <strong>{user.name}</strong>. They will need to use this password
                            on their next login.
                        </DialogDescription>
                    </DialogHeader>

                    <form id={`reset-password-form-${user.id}`} onSubmit={handleSubmit} className="py-2">
                        <div className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor={`new-password-${user.id}`}>New Password</Label>
                                <Input
                                    id={`new-password-${user.id}`}
                                    type="password"
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor={`new-password-confirm-${user.id}`}>Confirm New Password</Label>
                                <Input
                                    id={`new-password-confirm-${user.id}`}
                                    type="password"
                                    value={data.password_confirmation}
                                    onChange={(e) => setData('password_confirmation', e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="new-password"
                                />
                            </div>
                        </div>
                    </form>

                    <DialogFooter>
                        <Button variant="outline" type="button" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form={`reset-password-form-${user.id}`} disabled={processing}>
                            Reset Password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

function DeleteUserDialog({ user, currentUserId }: { user: AdminUser; currentUserId: number }) {
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
                title={isSelf ? 'Cannot delete your own account' : `Delete ${user.name}`}
            >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Delete {user.name}</span>
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>{user.name}</strong>? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={processing}>
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default function UsersIndex({ users, roles }: { users: AdminUser[]; roles: RoleOption[] }) {
    const { auth } = usePage<PageProps>().props;
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');

    const roleFilterOptions: ComboboxOption[] = [
        { value: 'all', label: 'All roles' },
        ...roles.map((r) => ({ value: r.value, label: r.label })),
    ];

    const filteredUsers = roleFilter === 'all' ? users : users.filter((u) => u.role === roleFilter);

    const columns: ColumnDef<AdminUser>[] = [
        {
            accessorKey: 'name',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
        },
        {
            accessorKey: 'email',
            header: 'Email',
        },
        {
            accessorKey: 'role',
            header: 'Role',
            cell: ({ row }) => {
                const role = row.original.role;
                return (
                    <Badge variant="outline" className={ROLE_BADGE[role]}>
                        {row.original.role_label}
                    </Badge>
                );
            },
        },
        {
            accessorKey: 'created_at',
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    className="-ml-3 h-8"
                    onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                >
                    Joined
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
        },
        {
            id: 'actions',
            header: '',
            cell: ({ row }) => (
                <div className="flex items-center justify-end gap-1">
                    <ResetPasswordDialog user={row.original} />
                    <EditUserDialog user={row.original} roles={roles} />
                    <DeleteUserDialog user={row.original} currentUserId={auth.user.id} />
                </div>
            ),
        },
    ];

    const table = useReactTable({
        data: filteredUsers,
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

    return (
        <>
            <Head title="User Management" />

            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">User Management</h1>
                        <p className="text-sm text-muted-foreground">Manage system users and their roles.</p>
                    </div>
                    <CreateUserDialog roles={roles} />
                </div>

                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <Input
                            placeholder="Search by name or email..."
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            className="max-w-sm"
                        />
                        <Combobox
                            options={roleFilterOptions}
                            value={roleFilter}
                            onValueChange={(v) => setRoleFilter(v || 'all')}
                            placeholder="Filter by role"
                            searchPlaceholder="Search role..."
                            className="w-44"
                        />
                    </div>

                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
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
                                        <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                            No users found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{table.getFilteredRowModel().rows.length} user(s) total</span>
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

UsersIndex.layout = {
    breadcrumbs: [
        {
            title: 'User Management',
            href: adminUsersIndex(),
        },
    ],
};
