import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    Bell,
    ChevronRight,
    FileText,
    Fingerprint,
    Hexagon,
    Layers,
    Moon,
    Settings,
    Shield,
    SlidersHorizontal,
    UserRound,
    Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { RoleBadge } from '@/components/orion/badges';
import type { Role } from '@/components/orion/badges';
import { useAppearance } from '@/hooks/use-appearance';
import { initials } from '@/layouts/settings/layout';
import { account, logout } from '@/routes';
import adminRoutes from '@/routes/admin';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { Auth } from '@/types';

type Props = {
    twoFactorEnabled: boolean;
    passkeyCount: number;
};

type Row = {
    label: string;
    icon: LucideIcon;
    href: string;
    value?: string;
};

const APPEARANCE_LABEL = { light: 'Terang', dark: 'Gelap', system: 'Sistem' };

function Section({ title, rows }: { title: string; rows: Row[] }) {
    return (
        <section>
            <h2 className="mb-2 px-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {title}
            </h2>
            <ul className="overflow-hidden rounded-2xl border bg-card">
                {rows.map((row) => (
                    <li key={row.label} className="border-t first:border-t-0">
                        <Link
                            href={row.href}
                            className="flex min-h-14 items-center gap-3 px-4 py-2 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                        >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
                                <row.icon className="size-[18px]" />
                            </span>
                            <span className="flex-1 font-medium">
                                {row.label}
                            </span>
                            {row.value && (
                                <span className="truncate text-sm text-muted-foreground">
                                    {row.value}
                                </span>
                            )}
                            <ChevronRight
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export default function Account({ twoFactorEnabled, passkeyCount }: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const { appearance } = useAppearance();
    const user = auth.user;
    const isAdmin = user.role === 'admin';

    const accountRows: Row[] = [
        { label: 'Profil', icon: UserRound, href: editProfile.url() },
        {
            label: 'Keamanan',
            icon: Shield,
            href: editSecurity.url(),
            value: twoFactorEnabled ? '2FA aktif' : '2FA belum aktif',
        },
        {
            label: 'Passkeys',
            icon: Fingerprint,
            href: editSecurity.url(),
            value: `${passkeyCount} perangkat`,
        },
    ];
    const preferenceRows: Row[] = [
        {
            label: 'Tampilan',
            icon: Moon,
            href: editAppearance.url(),
            value: APPEARANCE_LABEL[appearance],
        },
    ];
    const adminRows: Row[] = [
        {
            label: 'User Management',
            icon: Users,
            href: adminRoutes.users.index.url(),
        },
        {
            label: 'Device Groups',
            icon: Layers,
            href: adminRoutes.deviceGroups.index.url(),
        },
        {
            label: 'Alert Thresholds',
            icon: SlidersHorizontal,
            href: adminRoutes.alertThresholds.index.url(),
        },
        {
            label: 'Geofences',
            icon: Hexagon,
            href: adminRoutes.geofences.index.url(),
        },
        {
            label: 'Reports & Export',
            icon: FileText,
            href: adminRoutes.reports.index.url(),
        },
        {
            label: 'System Settings',
            icon: Settings,
            href: adminRoutes.systemSettings.index.url(),
        },
    ];

    return (
        <>
            <Head title="Akun" />

            <div className="mx-auto flex w-full max-w-xl flex-col gap-6 p-4 md:p-7">
                <h1 className="text-[28px] font-semibold tracking-tight">
                    Akun
                </h1>

                <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
                    <span className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-lg font-semibold text-accent-foreground">
                        {initials(user.name)}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate text-lg font-semibold">
                            {user.name}
                        </span>
                        <span className="block truncate text-sm text-muted-foreground">
                            {user.email}
                        </span>
                        <RoleBadge role={user.role as Role} className="mt-1" />
                    </span>
                </div>

                <Section title="Akun" rows={accountRows} />
                <Section title="Preferensi" rows={preferenceRows} />
                {isAdmin && <Section title="Admin" rows={adminRows} />}

                <p className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
                    <Bell className="size-4 shrink-0" aria-hidden />
                    Notifikasi WhatsApp memakai nomor di Profil.
                </p>

                <button
                    type="button"
                    onClick={() => {
                        router.flushAll();
                        router.post(logout());
                    }}
                    className="h-14 rounded-2xl border border-danger/30 bg-card font-semibold text-danger hover:bg-danger-bg focus-visible:outline-2 focus-visible:outline-ring"
                >
                    Log out
                </button>
            </div>
        </>
    );
}

Account.layout = {
    breadcrumbs: [{ title: 'Akun', href: account() }],
};
