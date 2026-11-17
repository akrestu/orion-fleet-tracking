import { Link, usePage } from '@inertiajs/react';
import { Bell, Cpu, House, Map, UserRound } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import adminAlerts from '@/routes/admin/alerts';
import adminDevices from '@/routes/admin/devices';
import fleet from '@/routes/fleet';
import profile from '@/routes/profile';
import type { Auth } from '@/types';

/**
 * Mobile floating bottom navigation (< md only).
 * Pill bar 16px from the edges, 20px above the bottom (+ safe-area),
 * raised circular Map button in the centre. Active tab = accent colour + 4px dot (no pill background).
 * Themes automatically through tokens (bg-card / border / text-primary).
 * Alerts and Devices are admin-only routes, so operators/viewers get Home · Map · Akun.
 */
export type BottomNavKey = 'home' | 'alerts' | 'map' | 'devices' | 'account';

interface Item {
    key: BottomNavKey;
    label: string;
    href: string;
    icon: LucideIcon;
    adminOnly?: boolean;
}
const ITEMS: Item[] = [
    { key: 'home', label: 'Home', href: dashboard.url(), icon: House },
    {
        key: 'alerts',
        label: 'Alerts',
        href: adminAlerts.index.url(),
        icon: Bell,
        adminOnly: true,
    },
    { key: 'map', label: 'Map', href: fleet.map.url(), icon: Map },
    {
        key: 'devices',
        label: 'Devices',
        href: adminDevices.index.url(),
        icon: Cpu,
        adminOnly: true,
    },
    {
        key: 'account',
        label: 'Akun',
        href: profile.edit.url(),
        icon: UserRound,
    },
];

export function BottomNav({
    active,
    alertCount = 0,
}: {
    active?: BottomNavKey;
    alertCount?: number;
}) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const isAdmin = auth.user?.role === 'admin';
    const items = ITEMS.filter((it) => isAdmin || !it.adminOnly);

    return (
        <nav
            aria-label="Main"
            className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex px-4 pb-[calc(20px+env(safe-area-inset-bottom))] md:hidden"
        >
            <div
                className="pointer-events-auto grid h-16 flex-1 items-center rounded-3xl border bg-card px-1.5 shadow-[0_12px_32px_oklch(0.3_0.03_250/0.14)] dark:shadow-[0_12px_32px_oklch(0_0_0/0.5)]"
                style={{
                    gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))`,
                }}
            >
                {items.map((it) => {
                    const on = it.key === active;
                    const Icon = it.icon;

                    if (it.key === 'map') {
                        return (
                            <Link
                                key={it.key}
                                href={it.href}
                                aria-label="Fleet Map"
                                aria-current={on ? 'page' : undefined}
                                className="-mt-[30px] grid size-[60px] place-items-center justify-self-center rounded-full bg-primary text-primary-foreground shadow-[0_0_0_5px_var(--background),0_8px_20px_color-mix(in_oklch,var(--primary)_45%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                            >
                                <Icon
                                    className="size-[26px]"
                                    strokeWidth={1.8}
                                />
                            </Link>
                        );
                    }

                    return (
                        <Link
                            key={it.key}
                            href={it.href}
                            aria-current={on ? 'page' : undefined}
                            className={cn(
                                'relative flex h-[52px] flex-col items-center justify-center gap-[3px] rounded-2xl text-[10px] focus-visible:outline-2 focus-visible:outline-ring',
                                on
                                    ? 'font-semibold text-primary'
                                    : 'font-medium text-muted-foreground',
                            )}
                        >
                            <Icon className="size-[22px]" strokeWidth={1.7} />
                            {it.label}
                            {on && (
                                <span className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-current" />
                            )}
                            {it.key === 'alerts' && alertCount > 0 && (
                                <span className="absolute top-1 left-1/2 ml-1 grid h-4 min-w-4 place-items-center rounded-full border-2 border-card bg-destructive px-1 text-[10px] font-semibold text-white">
                                    {alertCount > 99 ? '99+' : alertCount}
                                </span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
