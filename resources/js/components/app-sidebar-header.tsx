import { Breadcrumbs } from '@/components/breadcrumbs';
import { ConnectionBadge } from '@/components/orion/badges';
import { OrionLockup } from '@/components/orion/misc';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useLiveConnection } from '@/hooks/use-live-connection';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { currentUrl } = useCurrentUrl();
    const connection = useLiveConnection();
    const isAdminArea = currentUrl.startsWith('/admin');

    return (
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-7">
            <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger
                    className="-ml-1 size-9 md:size-7"
                    aria-label="Toggle sidebar"
                />
                <OrionLockup size={24} compact className="md:hidden" />
                <div className="hidden min-w-0 md:block">
                    <Breadcrumbs
                        breadcrumbs={breadcrumbs}
                        prefix={isAdminArea ? ['ORION', 'Admin'] : ['ORION']}
                    />
                </div>
            </div>
            <ConnectionBadge state={connection} />
        </header>
    );
}
