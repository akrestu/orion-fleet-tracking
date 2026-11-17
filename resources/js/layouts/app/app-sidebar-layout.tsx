import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { BottomNav } from '@/components/orion/bottom-nav';
import type { BottomNavKey } from '@/components/orion/bottom-nav';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { AppLayoutProps } from '@/types';

const BOTTOM_NAV_PREFIXES: [string, BottomNavKey][] = [
    ['/dashboard', 'home'],
    ['/admin/alerts', 'alerts'],
    ['/fleet/map', 'map'],
    ['/admin/devices', 'devices'],
    ['/settings', 'account'],
];

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { currentUrl } = useCurrentUrl();
    const activeTab = BOTTOM_NAV_PREFIXES.find(([prefix]) =>
        currentUrl.startsWith(prefix),
    )?.[1];
    // The Fleet Map is full-bleed: its device panel / mobile top bar replace the shell header.
    const isFullBleed = activeTab === 'map';

    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent
                variant="sidebar"
                className={
                    isFullBleed
                        ? 'flex h-svh flex-col overflow-hidden'
                        : 'flex flex-col overflow-hidden pb-28 md:pb-0'
                }
            >
                {!isFullBleed && <AppSidebarHeader breadcrumbs={breadcrumbs} />}
                {children}
            </AppContent>
            <BottomNav active={activeTab} />
        </AppShell>
    );
}
