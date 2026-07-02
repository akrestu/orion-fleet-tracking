import { Link, usePage } from '@inertiajs/react';
import {
    BarChart3,
    Bell,
    Cpu,
    Layers,
    LayoutGrid,
    Map,
    MapPinned,
    Settings2,
    SlidersHorizontal,
    Users,
} from 'lucide-react';
import { BrandLockup } from '@/components/brand-lockup';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import adminAlertThresholds from '@/routes/admin/alert-thresholds';
import adminAlerts from '@/routes/admin/alerts';
import adminDeviceGroups from '@/routes/admin/device-groups';
import adminDevices from '@/routes/admin/devices';
import adminGeofences from '@/routes/admin/geofences';
import adminReports from '@/routes/admin/reports';
import adminSystemSettings from '@/routes/admin/system-settings';
import adminUsers from '@/routes/admin/users';
import fleet from '@/routes/fleet';
import type { Auth, NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Fleet Map',
        href: fleet.map.url(),
        icon: Map,
    },
];

const adminNavItems: NavItem[] = [
    {
        title: 'User Management',
        href: adminUsers.index.url(),
        icon: Users,
    },
    {
        title: 'Device Management',
        href: adminDevices.index.url(),
        icon: Cpu,
    },
    {
        title: 'Device Groups',
        href: adminDeviceGroups.index.url(),
        icon: Layers,
    },
    {
        title: 'Alert Management',
        href: adminAlerts.index.url(),
        icon: Bell,
    },
    {
        title: 'Alert Thresholds',
        href: adminAlertThresholds.index.url(),
        icon: Settings2,
    },
    {
        title: 'Geofences',
        href: adminGeofences.index.url(),
        icon: MapPinned,
    },
    {
        title: 'Reports & Export',
        href: adminReports.index.url(),
        icon: BarChart3,
    },
    {
        title: 'System Settings',
        href: adminSystemSettings.index.url(),
        icon: SlidersHorizontal,
    },
];

export function AppSidebar() {
    const { auth } = usePage<{ auth: Auth }>().props;
    const isAdmin = auth.user.role === 'admin';

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link
                                href={dashboard()}
                                prefetch
                                className="flex items-center gap-0"
                            >
                                <BrandLockup size="sm" collapsible />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
                {isAdmin && <NavMain items={adminNavItems} label="Admin" />}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
