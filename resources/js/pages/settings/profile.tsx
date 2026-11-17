import { Form, Head, Link, usePage } from '@inertiajs/react';
import ProfileController from '@/actions/App/Http/Controllers/Settings/ProfileController';
import DeleteUser from '@/components/delete-user';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit } from '@/routes/profile';
import { send } from '@/routes/verification';
import type { Auth } from '@/types';

type PageProps = {
    auth: Auth;
};

function GroupList({ groups }: { groups: string[] | null }) {
    if (groups === null) {
        return (
            <span className="rounded-md bg-muted px-2 py-0.5 text-sm">
                All groups (admin)
            </span>
        );
    }

    if (groups.length === 0) {
        return (
            <span className="text-sm text-warning">
                No group yet — ask an admin to assign you.
            </span>
        );
    }

    return (
        <>
            {groups.map((g) => (
                <span
                    key={g}
                    className="rounded-md bg-muted px-2 py-0.5 text-sm"
                >
                    {g}
                </span>
            ))}
        </>
    );
}

export default function Profile({
    mustVerifyEmail,
    status,
    groups,
}: {
    mustVerifyEmail: boolean;
    status?: string;
    /** Assigned device groups; null for admins (they see every group). */
    groups: string[] | null;
}) {
    const { auth } = usePage<PageProps>().props;
    const user = auth.user as Auth['user'] & {
        unique_id: string;
        phone: string | null;
    };

    return (
        <>
            <Head title="Profile" />

            <section className="rounded-xl border bg-card">
                <header className="border-b px-6 py-5">
                    <h1 className="text-lg font-semibold">Profile</h1>
                    <p className="text-sm text-muted-foreground">
                        Your name and contact details.
                    </p>
                </header>

                <Form
                    {...ProfileController.update.form()}
                    options={{ preserveScroll: true }}
                >
                    {({ processing, errors }) => (
                        <>
                            <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
                                <div className="grid gap-1.5 sm:col-span-2">
                                    <Label htmlFor="name">Full name</Label>
                                    <Input
                                        id="name"
                                        defaultValue={user.name}
                                        name="name"
                                        required
                                        autoComplete="name"
                                    />
                                    <InputError message={errors.name} />
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="unique_id">Unique ID</Label>
                                    <Input
                                        id="unique_id"
                                        value={user.unique_id}
                                        disabled
                                        readOnly
                                        className="font-mono"
                                        aria-describedby="unique-id-hint"
                                    />
                                    <p
                                        id="unique-id-hint"
                                        className="text-xs text-muted-foreground"
                                    >
                                        Used to sign in. Only an admin can
                                        change it.
                                    </p>
                                </div>

                                <div className="grid gap-1.5">
                                    <Label htmlFor="phone">
                                        WhatsApp phone
                                    </Label>
                                    <Input
                                        id="phone"
                                        type="tel"
                                        inputMode="tel"
                                        name="phone"
                                        defaultValue={user.phone ?? ''}
                                        autoComplete="tel"
                                        placeholder="+62 812-3456-7890"
                                    />
                                    <InputError message={errors.phone} />
                                </div>

                                <div className="grid gap-1.5 sm:col-span-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        defaultValue={user.email}
                                        name="email"
                                        required
                                        autoComplete="email"
                                    />
                                    <InputError message={errors.email} />

                                    {mustVerifyEmail &&
                                        user.email_verified_at === null && (
                                            <p className="text-sm text-muted-foreground">
                                                Your email address is
                                                unverified.{' '}
                                                <Link
                                                    href={send()}
                                                    as="button"
                                                    className="font-medium text-primary underline-offset-4 hover:underline"
                                                >
                                                    Re-send the verification
                                                    email.
                                                </Link>
                                                {status ===
                                                    'verification-link-sent' && (
                                                    <span className="mt-1 block font-medium text-online">
                                                        A new verification link
                                                        has been sent.
                                                    </span>
                                                )}
                                            </p>
                                        )}
                                </div>

                                <div className="grid gap-1.5 sm:col-span-2">
                                    <span className="text-sm font-medium">
                                        Assigned groups
                                    </span>
                                    <span className="flex flex-wrap gap-1.5">
                                        <GroupList groups={groups} />
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end border-t px-6 py-4">
                                <Button
                                    disabled={processing}
                                    data-test="update-profile-button"
                                >
                                    Save changes
                                </Button>
                            </div>
                        </>
                    )}
                </Form>
            </section>

            <section className="rounded-xl border border-danger/30 bg-card px-6 py-5">
                <DeleteUser />
            </section>
        </>
    );
}

Profile.layout = {
    breadcrumbs: [{ title: 'Profile', href: edit() }],
};
