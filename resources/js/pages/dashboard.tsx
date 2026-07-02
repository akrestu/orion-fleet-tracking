import { Head, Link } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    BellOff,
    Gauge,
    Map,
    MapPin,
    Radio,
    Satellite,
    TrendingUp,
    Wifi,
    WifiOff,
    Zap,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    XAxis,
    YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from '@/components/ui/chart';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { UNIT_CATEGORIES } from '@/config/unit-types';
import { getSignalColor } from '@/lib/status-colors';
import { dashboard } from '@/routes';
import admin from '@/routes/admin';
import adminReports from '@/routes/admin/reports';
import fleet from '@/routes/fleet';

/** Falls back to the "other" category for any unit_type value not in the canonical config. */
function unitCategory(type: string) {
    return (
        UNIT_CATEGORIES[type as keyof typeof UNIT_CATEGORIES] ??
        UNIT_CATEGORIES.other
    );
}

const ALERT_META: Record<
    string,
    {
        label: string;
        icon: React.ComponentType<{ className?: string }>;
        color: string;
        cls: string;
    }
> = {
    overspeed: {
        label: 'Overspeed',
        icon: Gauge,
        color: 'var(--color-status-danger)',
        cls: 'bg-status-danger/10 text-status-danger border-status-danger/30',
    },
    geofence: {
        label: 'Geofence',
        icon: MapPin,
        color: 'var(--color-accent)',
        cls: 'bg-accent/10 text-accent border-accent/30',
    },
    offline: {
        label: 'Offline',
        icon: WifiOff,
        color: 'var(--color-status-offline)',
        cls: 'bg-status-offline/10 text-status-offline border-status-offline/30',
    },
    low_signal: {
        label: 'Low Signal',
        icon: Radio,
        color: 'var(--color-status-warning)',
        cls: 'bg-status-warning/10 text-status-warning border-status-warning/30',
    },
};

const speedTrendConfig = {
    avg_speed: {
        label: 'Avg Speed',
        color: 'var(--chart-1)',
    },
} satisfies ChartConfig;

const compositionConfig: ChartConfig = Object.fromEntries(
    Object.entries(UNIT_CATEGORIES).map(([key, cat]) => [
        key,
        { label: cat.abbr, color: cat.color },
    ]),
);

const safetyConfig = {
    overspeed: { label: 'Overspeed', color: ALERT_META.overspeed.color },
    geofence: { label: 'Geofence', color: ALERT_META.geofence.color },
    offline: { label: 'Offline', color: ALERT_META.offline.color },
    low_signal: { label: 'Low Signal', color: ALERT_META.low_signal.color },
} satisfies ChartConfig;

const maintenanceConfig = {
    running: { label: 'Running', color: 'var(--color-status-online)' },
    idle: { label: 'Idle', color: 'var(--color-status-warning)' },
} satisfies ChartConfig;

const speedByDeviceConfig = {
    avg_speed: { label: 'Avg Speed', color: 'var(--chart-1)' },
} satisfies ChartConfig;

const gatewayConfig = {
    avg_rssi: { label: 'Avg RSSI', color: 'var(--chart-2)' },
} satisfies ChartConfig;

interface Stats {
    totalDevices: number;
    onlineDevices: number;
    offlineDevices: number;
    todayLogs: number;
    lastHourLogs: number;
}

interface ActivityItem {
    device_name: string;
    unit_type: string;
    speed_kmh: number;
    latitude: number;
    longitude: number;
    rssi: number | null;
    recorded_at: string;
}

interface SpeedItem {
    device_name: string;
    avg_speed: number;
    max_speed: number;
    log_count: number;
}

interface SpeedTrendPoint {
    hour: string;
    avg_speed: number;
    log_count: number;
}

interface Productivity {
    total_distance_km: number;
    total_op_hours: number;
}

interface Maintenance {
    running_hours: number;
    idle_hours: number;
}

interface GatewaySignalItem {
    gateway_id: string;
    avg_rssi: number;
    avg_snr: number;
    uplink_count: number;
}

interface Props {
    stats: Stats;
    unitTypeCounts: Record<string, number>;
    recentActivity: ActivityItem[];
    speedByDevice: SpeedItem[];
    alertSummary: Record<string, number>;
    productivity: Productivity;
    speedTrend: SpeedTrendPoint[];
    maintenance: Maintenance;
    gatewaySignal: GatewaySignalItem[];
}

function StatCard({
    label,
    value,
    icon: Icon,
    iconClass,
    valueClass,
    sub,
}: {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    iconClass: string;
    valueClass: string;
    sub?: string;
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                    <div className="space-y-1">
                        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                            {label}
                        </p>
                        <p className={`text-3xl font-bold ${valueClass}`}>
                            {value}
                        </p>
                        {sub && (
                            <p className="text-xs text-muted-foreground">
                                {sub}
                            </p>
                        )}
                    </div>
                    <div className={`rounded-lg p-2 ${iconClass}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function CategoryHeader({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
}) {
    return (
        <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {title}
            </CardTitle>
            <CardDescription>{description}</CardDescription>
        </CardHeader>
    );
}

function DonutCenterLabel({
    value,
    label,
}: {
    value: string | number;
    label: string;
}) {
    return (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
        </div>
    );
}

export default function Dashboard({
    stats,
    unitTypeCounts,
    recentActivity,
    speedByDevice,
    alertSummary,
    productivity,
    speedTrend,
    maintenance,
    gatewaySignal,
}: Props) {
    const totalUnits = Object.values(unitTypeCounts).reduce((a, b) => a + b, 0);
    const onlinePct =
        stats.totalDevices > 0
            ? Math.round((stats.onlineDevices / stats.totalDevices) * 100)
            : 0;
    const totalAlerts = Object.values(alertSummary).reduce((a, b) => a + b, 0);

    const compositionData = Object.entries(unitTypeCounts).map(
        ([type, count]) => ({ type, count }),
    );

    const alertData = Object.entries(ALERT_META).map(([type, meta]) => ({
        type,
        label: meta.label,
        count: alertSummary[type] ?? 0,
    }));

    const totalOpHoursToday =
        maintenance.running_hours + maintenance.idle_hours;
    const utilizationPct =
        totalOpHoursToday > 0
            ? Math.round((maintenance.running_hours / totalOpHoursToday) * 100)
            : 0;
    const maintenanceData = [
        { name: 'running', value: maintenance.running_hours },
        { name: 'idle', value: maintenance.idle_hours },
    ];

    const topSpeedByDevice = speedByDevice
        .slice()
        .sort((a, b) => b.avg_speed - a.avg_speed)
        .slice(0, 6);

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-auto p-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Fleet Overview</h1>
                        <p className="text-sm text-muted-foreground">
                            Real-time monitoring dashboard
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" asChild>
                            <Link href={adminReports.index.url()}>
                                Reports & Export
                            </Link>
                        </Button>
                        <Button asChild>
                            <Link href={fleet.map.url()}>
                                <Map className="h-4 w-4" />
                                Open Fleet Map
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Stats row */}
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                    <StatCard
                        label="Total Devices"
                        value={stats.totalDevices}
                        icon={Satellite}
                        iconClass="bg-muted text-muted-foreground"
                        valueClass="text-foreground"
                        sub="Registered units"
                    />
                    <StatCard
                        label="Online"
                        value={stats.onlineDevices}
                        icon={Wifi}
                        iconClass="bg-status-online/10 text-status-online"
                        valueClass="text-status-online"
                        sub={`${onlinePct}% availability`}
                    />
                    <StatCard
                        label="Offline"
                        value={stats.offlineDevices}
                        icon={WifiOff}
                        iconClass="bg-destructive/10 text-destructive"
                        valueClass="text-destructive"
                        sub="Last seen > 10 min"
                    />
                    <StatCard
                        label="Today's Logs"
                        value={stats.todayLogs.toLocaleString('en-US')}
                        icon={Activity}
                        iconClass="bg-primary/10 text-primary"
                        valueClass="text-primary"
                        sub="GPS points received"
                    />
                    <StatCard
                        label="Last Hour"
                        value={stats.lastHourLogs.toLocaleString('en-US')}
                        icon={Zap}
                        iconClass="bg-accent/10 text-accent"
                        valueClass="text-accent"
                        sub="Recent uplinks"
                    />
                </div>

                {/* Row 1 — Tracking & Monitoring / Safety Monitoring / Maintenance Insight */}
                <div className="grid gap-4 xl:grid-cols-3">
                    {/* Tracking & Monitoring */}
                    <Card>
                        <CategoryHeader
                            icon={Radio}
                            title="Tracking & Monitoring"
                            description="Fleet composition by unit type"
                        />
                        <CardContent>
                            {totalUnits === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    No devices registered
                                </p>
                            ) : (
                                <>
                                    <div className="relative">
                                        <ChartContainer
                                            config={compositionConfig}
                                            className="mx-auto aspect-square max-h-[160px]"
                                        >
                                            <PieChart>
                                                <ChartTooltip
                                                    content={
                                                        <ChartTooltipContent
                                                            hideLabel
                                                            nameKey="type"
                                                        />
                                                    }
                                                />
                                                <Pie
                                                    data={compositionData}
                                                    dataKey="count"
                                                    nameKey="type"
                                                    innerRadius={52}
                                                    outerRadius={78}
                                                    strokeWidth={2}
                                                >
                                                    {compositionData.map(
                                                        (entry) => (
                                                            <Cell
                                                                key={entry.type}
                                                                fill={
                                                                    unitCategory(
                                                                        entry.type,
                                                                    ).color
                                                                }
                                                            />
                                                        ),
                                                    )}
                                                </Pie>
                                            </PieChart>
                                        </ChartContainer>
                                        <DonutCenterLabel
                                            value={totalUnits}
                                            label="units"
                                        />
                                    </div>
                                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                                        {compositionData.map(
                                            ({ type, count }) => {
                                                const cat = unitCategory(type);

                                                return (
                                                    <Badge
                                                        key={type}
                                                        variant="outline"
                                                        className="gap-1 border-transparent"
                                                        style={{
                                                            backgroundColor: `color-mix(in oklch, ${cat.color} 15%, transparent)`,
                                                            color: cat.color,
                                                        }}
                                                    >
                                                        <span
                                                            className="h-1.5 w-1.5 rounded-full"
                                                            style={{
                                                                backgroundColor:
                                                                    cat.color,
                                                            }}
                                                        />
                                                        {count}× {cat.abbr}
                                                    </Badge>
                                                );
                                            },
                                        )}
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    {/* Safety Monitoring */}
                    <Card>
                        <div className="flex items-center justify-between pr-6">
                            <CategoryHeader
                                icon={AlertTriangle}
                                title="Safety Monitoring"
                                description="Unresolved alerts today, by type"
                            />
                            {totalAlerts > 0 && (
                                <Badge
                                    variant="destructive"
                                    className="text-xs"
                                >
                                    {totalAlerts} unresolved
                                </Badge>
                            )}
                        </div>
                        <CardContent>
                            {totalAlerts === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                                    <BellOff className="h-8 w-8 text-muted-foreground/40" />
                                    <p className="text-sm text-muted-foreground">
                                        No active alerts today
                                    </p>
                                </div>
                            ) : (
                                <ChartContainer
                                    config={safetyConfig}
                                    className="max-h-[160px] w-full"
                                >
                                    <BarChart
                                        data={alertData}
                                        layout="vertical"
                                        margin={{
                                            left: 0,
                                            right: 12,
                                            top: 0,
                                            bottom: 0,
                                        }}
                                    >
                                        <CartesianGrid
                                            horizontal={false}
                                            strokeDasharray="3 3"
                                        />
                                        <XAxis
                                            type="number"
                                            hide
                                            allowDecimals={false}
                                        />
                                        <YAxis
                                            dataKey="label"
                                            type="category"
                                            tickLine={false}
                                            axisLine={false}
                                            width={80}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    hideLabel
                                                    nameKey="label"
                                                />
                                            }
                                        />
                                        <Bar dataKey="count" radius={4}>
                                            {alertData.map((entry) => (
                                                <Cell
                                                    key={entry.type}
                                                    fill={
                                                        ALERT_META[entry.type]
                                                            .color
                                                    }
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                            <Link
                                href={admin.alerts.index.url()}
                                className="mt-3 block text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                            >
                                View all alerts
                            </Link>
                        </CardContent>
                    </Card>

                    {/* Maintenance Insight */}
                    <Card>
                        <CategoryHeader
                            icon={Wifi}
                            title="Maintenance Insight"
                            description="Running vs idle hours today"
                        />
                        <CardContent>
                            {totalOpHoursToday === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    No operating data today
                                </p>
                            ) : (
                                <>
                                    <div className="relative">
                                        <ChartContainer
                                            config={maintenanceConfig}
                                            className="mx-auto aspect-square max-h-[160px]"
                                        >
                                            <PieChart>
                                                <ChartTooltip
                                                    content={
                                                        <ChartTooltipContent
                                                            hideLabel
                                                            nameKey="name"
                                                        />
                                                    }
                                                />
                                                <Pie
                                                    data={maintenanceData}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    innerRadius={52}
                                                    outerRadius={78}
                                                    strokeWidth={2}
                                                >
                                                    <Cell
                                                        fill={
                                                            maintenanceConfig
                                                                .running.color
                                                        }
                                                    />
                                                    <Cell
                                                        fill={
                                                            maintenanceConfig
                                                                .idle.color
                                                        }
                                                    />
                                                </Pie>
                                            </PieChart>
                                        </ChartContainer>
                                        <DonutCenterLabel
                                            value={`${utilizationPct}%`}
                                            label="utilization"
                                        />
                                    </div>
                                    <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs">
                                        <div>
                                            <p className="font-semibold text-status-online">
                                                {maintenance.running_hours} h
                                            </p>
                                            <p className="text-muted-foreground">
                                                Running
                                            </p>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-status-warning">
                                                {maintenance.idle_hours} h
                                            </p>
                                            <p className="text-muted-foreground">
                                                Idle
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Row 2 — Productivity / Infrastructure Coverage */}
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Productivity */}
                    <Card>
                        <CategoryHeader
                            icon={TrendingUp}
                            title="Productivity"
                            description="Distance traveled and estimated operating hours today"
                        />
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 rounded-lg bg-primary/5 p-4">
                                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Total Distance
                                    </p>
                                    <p className="text-3xl font-bold text-primary">
                                        {productivity.total_distance_km.toLocaleString(
                                            'en-US',
                                        )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        kilometers
                                    </p>
                                </div>
                                <div className="space-y-1 rounded-lg bg-status-online/5 p-4">
                                    <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                        Op. Hours
                                    </p>
                                    <p className="text-3xl font-bold text-status-online">
                                        {productivity.total_op_hours}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        estimated hours
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Infrastructure Coverage */}
                    <Card>
                        <CategoryHeader
                            icon={Satellite}
                            title="Infrastructure Coverage"
                            description="Average signal quality per gateway today"
                        />
                        <CardContent>
                            {gatewaySignal.length === 0 ? (
                                <p className="py-10 text-center text-sm text-muted-foreground">
                                    No gateway traffic today
                                </p>
                            ) : (
                                <ChartContainer
                                    config={gatewayConfig}
                                    className="max-h-[160px] w-full"
                                >
                                    <BarChart
                                        data={gatewaySignal}
                                        layout="vertical"
                                        margin={{
                                            left: 0,
                                            right: 12,
                                            top: 0,
                                            bottom: 0,
                                        }}
                                    >
                                        <CartesianGrid
                                            horizontal={false}
                                            strokeDasharray="3 3"
                                        />
                                        <XAxis
                                            type="number"
                                            unit=" dBm"
                                            tick={{ fontSize: 11 }}
                                        />
                                        <YAxis
                                            dataKey="gateway_id"
                                            type="category"
                                            tickLine={false}
                                            axisLine={false}
                                            width={80}
                                            tick={{ fontSize: 11 }}
                                        />
                                        <ChartTooltip
                                            content={
                                                <ChartTooltipContent
                                                    hideLabel
                                                    nameKey="gateway_id"
                                                    formatter={(
                                                        value,
                                                        _name,
                                                        item,
                                                    ) => [
                                                        `${value} dBm (${item.payload.uplink_count} uplinks)`,
                                                        'Avg RSSI',
                                                    ]}
                                                />
                                            }
                                        />
                                        <Bar dataKey="avg_rssi" radius={4}>
                                            {gatewaySignal.map((entry) => (
                                                <Cell
                                                    key={entry.gateway_id}
                                                    fill={getSignalColor(
                                                        entry.avg_rssi,
                                                    )}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ChartContainer>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Row 3 — Performance Analysis */}
                <Card>
                    <CategoryHeader
                        icon={Activity}
                        title="Performance Analysis"
                        description="Fleet speed trend and per-device averages"
                    />
                    <CardContent>
                        <div className="grid gap-4 lg:grid-cols-2">
                            <div>
                                <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Speed Trend — Last 8 Hours
                                </p>
                                {speedTrend.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center">
                                        <Activity className="mb-2 h-8 w-8 text-muted-foreground/40" />
                                        <p className="text-sm text-muted-foreground">
                                            No movement data in the last 8 hours
                                        </p>
                                    </div>
                                ) : (
                                    <ChartContainer
                                        config={speedTrendConfig}
                                        className="h-[200px] w-full"
                                    >
                                        <AreaChart
                                            data={speedTrend}
                                            margin={{
                                                left: 0,
                                                right: 12,
                                                top: 8,
                                                bottom: 0,
                                            }}
                                        >
                                            <CartesianGrid
                                                vertical={false}
                                                strokeDasharray="3 3"
                                            />
                                            <XAxis
                                                dataKey="hour"
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                tickMargin={8}
                                                tick={{ fontSize: 11 }}
                                                unit=" km/h"
                                                width={70}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        labelFormatter={(v) =>
                                                            `Jam ${v}`
                                                        }
                                                        formatter={(value) => [
                                                            `${value} km/h`,
                                                            'Avg Speed',
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="avg_speed"
                                                stroke="var(--color-avg_speed)"
                                                fill="var(--color-avg_speed)"
                                                fillOpacity={0.15}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ChartContainer>
                                )}
                            </div>

                            <div>
                                <p className="mb-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                                    Speed by Device — Last Hour
                                </p>
                                {topSpeedByDevice.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 text-center">
                                        <Zap className="mb-2 h-8 w-8 text-muted-foreground/40" />
                                        <p className="text-sm text-muted-foreground">
                                            No movement data in the last hour
                                        </p>
                                    </div>
                                ) : (
                                    <ChartContainer
                                        config={speedByDeviceConfig}
                                        className="h-[200px] w-full"
                                    >
                                        <BarChart
                                            data={topSpeedByDevice}
                                            layout="vertical"
                                            margin={{
                                                left: 0,
                                                right: 12,
                                                top: 0,
                                                bottom: 0,
                                            }}
                                        >
                                            <CartesianGrid
                                                horizontal={false}
                                                strokeDasharray="3 3"
                                            />
                                            <XAxis
                                                type="number"
                                                unit=" km/h"
                                                tick={{ fontSize: 11 }}
                                            />
                                            <YAxis
                                                dataKey="device_name"
                                                type="category"
                                                tickLine={false}
                                                axisLine={false}
                                                width={90}
                                                tick={{ fontSize: 11 }}
                                            />
                                            <ChartTooltip
                                                content={
                                                    <ChartTooltipContent
                                                        hideLabel
                                                        formatter={(
                                                            value,
                                                            _name,
                                                            item,
                                                        ) => [
                                                            `${value} km/h avg · ${item.payload.max_speed} km/h max`,
                                                            item.payload
                                                                .device_name,
                                                        ]}
                                                    />
                                                }
                                            />
                                            <Bar
                                                dataKey="avg_speed"
                                                fill="var(--color-avg_speed)"
                                                radius={4}
                                            />
                                        </BarChart>
                                    </ChartContainer>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Recent activity table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            Recent Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Satellite className="mb-2 h-8 w-8 text-muted-foreground/40" />
                                <p className="text-sm text-muted-foreground">
                                    Waiting for GPS uplinks...
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground/60">
                                    Run{' '}
                                    <code className="text-muted-foreground">
                                        php artisan mqtt:subscribe
                                    </code>{' '}
                                    to start ingesting data
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Device</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Speed</TableHead>
                                        <TableHead>Location</TableHead>
                                        <TableHead>RSSI</TableHead>
                                        <TableHead>Time</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {recentActivity.map((item, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="font-medium">
                                                {item.device_name}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className="border-transparent"
                                                    style={{
                                                        backgroundColor: `color-mix(in oklch, ${unitCategory(item.unit_type).color} 15%, transparent)`,
                                                        color: unitCategory(
                                                            item.unit_type,
                                                        ).color,
                                                    }}
                                                >
                                                    {
                                                        unitCategory(
                                                            item.unit_type,
                                                        ).abbr
                                                    }
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="font-mono font-semibold text-primary">
                                                {item.speed_kmh} km/h
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {item.latitude.toFixed(4)},{' '}
                                                {item.longitude.toFixed(4)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {item.rssi !== null
                                                    ? `${item.rssi} dBm`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {item.recorded_at}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
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
