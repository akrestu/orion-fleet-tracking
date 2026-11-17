import { Deferred, Head, router, usePage } from '@inertiajs/react';
import {
    DashboardFilterBar,
    DashboardHero,
    DashboardKpis,
    DashboardKpisSkeleton,
    DashboardSections,
    DashboardSectionsSkeleton,
} from '@/components/dashboard/dashboard-panels';
import type {
    DashboardFilters,
    DashboardHeroData,
    DashboardKpiData,
    DashboardOptions,
    DashboardSectionData,
} from '@/components/dashboard/dashboard-panels';
import { dashboard } from '@/routes';
import type { Auth } from '@/types';

type Props = {
    filters: DashboardFilters;
    options: DashboardOptions;
    hero: DashboardHeroData;
    kpis?: DashboardKpiData;
    sections?: DashboardSectionData;
};

/** Query string for a filter set; defaults are omitted to keep URLs short. */
function toQuery(filters: DashboardFilters): Record<string, string | number> {
    const query: Record<string, string | number> = {};

    if (filters.group !== null) {
        query.group = filters.group;
    }

    if (filters.period !== 'today') {
        query.period = filters.period;
    }

    if (filters.shift !== 'all') {
        query.shift = filters.shift;
    }

    if (filters.unit_type !== null) {
        query.unit_type = filters.unit_type;
    }

    if (filters.condition !== null) {
        query.condition = filters.condition;
    }

    return query;
}

export default function Dashboard({
    filters,
    options,
    hero,
    kpis,
    sections,
}: Props) {
    const { auth } = usePage<{ auth: Auth }>().props;
    const isAdmin = auth.user.role === 'admin';

    const applyFilters = (patch: Partial<DashboardFilters>) => {
        router.get(dashboard.url(), toQuery({ ...filters, ...patch }), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    };

    return (
        <>
            <Head title="Dashboard" />

            <div className="flex flex-col gap-4 p-4 md:gap-5 md:p-7">
                <DashboardHero hero={hero} />

                <DashboardFilterBar
                    filters={filters}
                    options={options}
                    onChange={applyFilters}
                />

                <Deferred data="kpis" fallback={<DashboardKpisSkeleton />}>
                    {kpis && (
                        <DashboardKpis kpis={kpis} period={filters.period} />
                    )}
                </Deferred>

                <Deferred
                    data="sections"
                    fallback={<DashboardSectionsSkeleton />}
                >
                    {sections && (
                        <DashboardSections
                            sections={sections}
                            period={filters.period}
                            isAdmin={isAdmin}
                        />
                    )}
                </Deferred>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
