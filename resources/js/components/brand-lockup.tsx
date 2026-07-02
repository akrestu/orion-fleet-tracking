import AppLogoIcon from '@/components/app-logo-icon';

interface BrandLockupProps {
    /** `sm` matches the collapsed app sidebar; `lg` matches auth/marketing screens. */
    size?: 'sm' | 'lg';
    /** Hides the client logo + divider when an ancestor Sidebar collapses to icon-only. */
    collapsible?: boolean;
    className?: string;
}

/**
 * Client logo + "by ORION" divider + Orion wordmark, shared by the app
 * sidebar, auth screens, and the welcome page. Purely visual — callers wrap
 * it in whatever interactive element (Link, SidebarMenuButton) fits their
 * context, since some contexts nest it inside asChild-driven components that
 * require a single interactive child.
 */
export function BrandLockup({
    size = 'lg',
    collapsible = false,
    className,
}: BrandLockupProps) {
    const isSmall = size === 'sm';
    const hideOnCollapse = collapsible
        ? 'group-data-[collapsible=icon]:hidden'
        : '';

    return (
        <div className={`flex items-center ${className ?? ''}`}>
            <img
                src="/wbk.png"
                alt="PT. WBK"
                className={`${
                    isSmall
                        ? 'h-5 w-5 shrink-0 rounded-md object-cover'
                        : 'h-11 w-11 shrink-0 rounded-xl object-cover'
                } ${hideOnCollapse}`}
            />

            <div
                className={`flex flex-col items-center gap-0.5 select-none ${isSmall ? 'mx-1.5' : 'mx-4'} ${hideOnCollapse}`}
            >
                <div
                    className={`w-px bg-border ${isSmall ? 'h-2.5' : 'h-5'}`}
                />
                <span
                    className={`leading-none font-medium tracking-widest text-muted-foreground/40 uppercase ${isSmall ? 'text-[7px]' : 'text-[9px]'}`}
                >
                    by
                </span>
                <div
                    className={`w-px bg-border ${isSmall ? 'h-2.5' : 'h-5'}`}
                />
            </div>

            <div
                className={`flex shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 ${isSmall ? 'h-6 w-6' : 'h-11 w-11'}`}
            >
                <AppLogoIcon className={isSmall ? 'h-3.5 w-3.5' : 'h-5 w-5'} />
            </div>
            <div className={isSmall ? 'ml-1 text-left' : 'ml-2.5 text-left'}>
                <p
                    className={`font-bold tracking-widest text-primary ${isSmall ? 'text-xs' : 'text-base'}`}
                >
                    ORION
                </p>
                {!isSmall && (
                    <p className="text-xs tracking-wide text-muted-foreground">
                        Fleet Intelligence
                    </p>
                )}
            </div>
        </div>
    );
}
