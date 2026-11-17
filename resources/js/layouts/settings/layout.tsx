import { Link, router, usePage } from '@inertiajs/react';
import { ChevronLeft, LogOut, Moon, Shield, UserRound } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { RoleBadge } from '@/components/orion/badges';
import type { Role } from '@/components/orion/badges';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { account, logout } from '@/routes';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { Auth } from '@/types';

const NAV = [
    { title: 'Profile', href: edit(), icon: UserRound },
    { title: 'Security', href: editSecurity(), icon: Shield },
    { title: 'Appearance', href: editAppearance(), icon: Moon },
];

export function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

/** Account settings shell: user card + sub-nav on desktop, back-to-Akun link on mobile. */
export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { auth } = usePage<{ auth: Auth }>().props;
    const user = auth.user;

    return (
        <div className="flex flex-col gap-6 p-4 md:flex-row md:gap-10 md:p-7">
            <Link
                href={account()}
                className="-ml-1 inline-flex min-h-11 items-center gap-1 self-start text-sm text-muted-foreground md:hidden"
            >
                <ChevronLeft className="size-4" /> Akun
            </Link>

            <aside className="hidden w-60 shrink-0 md:block">
                <div className="flex items-center gap-3 px-2 pb-6">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                        {initials(user.name)}
                    </span>
                    <span className="min-w-0">
                        <span className="block truncate font-semibold">
                            {user.name}
                        </span>
                        <RoleBadge
                            role={user.role as Role}
                            className="mt-0.5"
                        />
                    </span>
                </div>
                <nav className="flex flex-col gap-1" aria-label="Account">
                    {NAV.map((item) => {
                        const active = isCurrentOrParentUrl(item.href);

                        return (
                            <Link
                                key={toUrl(item.href)}
                                href={item.href}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring',
                                    active && 'bg-muted font-semibold',
                                )}
                            >
                                <item.icon className="size-4" />
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>
                <button
                    type="button"
                    onClick={() => {
                        router.flushAll();
                        router.post(logout());
                    }}
                    className="mt-6 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-sm text-danger hover:bg-danger-bg focus-visible:outline-2 focus-visible:outline-ring"
                >
                    <LogOut className="size-4" /> Log out
                </button>
            </aside>

            <div className="flex max-w-3xl min-w-0 flex-1 flex-col gap-6">
                {children}
            </div>
        </div>
    );
}
