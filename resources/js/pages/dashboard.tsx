import { Head, Link } from '@inertiajs/react';
import { Activity, AlertTriangle, BellOff, Gauge, Map, MapPin, Radio, Satellite, TrendingUp, Wifi, WifiOff, Zap } from 'lucide-react';
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { dashboard } from '@/routes';
import admin from '@/routes/admin';
import fleet from '@/routes/fleet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const UNIT_COLORS: Record<string, string> = {
    hauler: '#38bdf8',
    dozer: '#f59e0b',
    excavator: '#a78bfa',
    grader: '#34d399',
    other: '#94a3b8',
};

const UNIT_BADGE_CLASS: Record<string, string> = {
    hauler: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    dozer: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    excavator: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    grader: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    other: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

const ALERT_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
    overspeed: { label: 'Overspeed', icon: Gauge, cls: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30' },
    geofence: { label: 'Geofence', icon: MapPin, cls: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30' },
    offline: { label: 'Offline', icon: WifiOff, cls: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/30' },
    low_signal: { label: 'Low Signal', icon: Radio, cls: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30' },
};

const speedTrendConfig = {
    avg_speed: {
        label: 'Avg Speed',
        color: 'var(--chart-1)',
    },
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

interface Props {
    stats: Stats;
    unitTypeCounts: Record<string, number>;
    recentActivity: ActivityItem[];
    speedByDevice: SpeedItem[];
    alertSummary: Record<string, number>;
    productivity: Productivity;
    speedTrend: SpeedTrendPoint[];
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
                        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
                        <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
                        {sub && <p className="text-muted-foreground text-xs">{sub}</p>}
                    </div>
                    <div className={`rounded-lg p-2 ${iconClass}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

function UnitTypeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
                <span className="text-foreground capitalize">{label}</span>
                <span className="text-muted-foreground font-medium">{count} unit</span>
            </div>
            <div className="bg-muted h-2 w-full rounded-full">
                <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
}

function SpeedGauge({ value, max, color }: { value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
    return (
        <div className="bg-muted h-1.5 w-full rounded-full">
            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
        </div>
    );
}

export default function Dashboard({ stats, unitTypeCounts, recentActivity, speedByDevice, alertSummary, productivity, speedTrend }: Props) {
    const totalUnits = Object.values(unitTypeCounts).reduce((a, b) => a + b, 0);
    const onlinePct = stats.totalDevices > 0 ? Math.round((stats.onlineDevices / stats.totalDevices) * 100) : 0;
    const maxSpeed = Math.max(...speedByDevice.map((d) => d.max_speed), 1);
    const totalAlerts = Object.values(alertSummary).reduce((a, b) => a + b, 0);

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-auto p-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Fleet Overview</h1>
                        <p className="text-muted-foreground text-sm">Real-time monitoring dashboard</p>
                    </div>
                    <Button asChild>
                        <Link href={fleet.map.url()}>
                            <Map className="h-4 w-4" />
                            Open Fleet Map
                        </Link>
                    </Button>
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
                        iconClass="bg-emerald-500/10 text-emerald-400"
                        valueClass="text-emerald-400"
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

                {/* Alert Summary + Productivity */}
                <div className="grid gap-4 lg:grid-cols-2">

                    {/* Alert Summary */}
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                    <AlertTriangle className="text-muted-foreground h-4 w-4" />
                                    Active Alerts Today
                                </CardTitle>
                                {totalAlerts > 0 && (
                                    <Badge variant="destructive" className="text-xs">
                                        {totalAlerts} unresolved
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>Unresolved alerts grouped by type</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(ALERT_META).map(([type, meta]) => {
                                    const count = alertSummary[type] ?? 0;
                                    const Icon = meta.icon;
                                    return (
                                        <Link key={type} href={admin.alerts.index.url()}>
                                            <div className={`flex items-center gap-3 rounded-lg border p-3 transition-opacity ${count === 0 ? 'opacity-40' : 'hover:bg-muted/50'} ${meta.cls}`}>
                                                <div className="rounded-md p-1.5">
                                                    <Icon className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-medium">{meta.label}</p>
                                                    <p className="text-2xl font-bold">{count}</p>
                                                </div>
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                            {totalAlerts === 0 && (
                                <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                    <BellOff className="h-3.5 w-3.5" />
                                    No active alerts today
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Fleet Productivity */}
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                <TrendingUp className="text-muted-foreground h-4 w-4" />
                                Fleet Productivity — Today
                            </CardTitle>
                            <CardDescription>Distance traveled and estimated operating hours</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 rounded-lg bg-primary/5 p-4">
                                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Total Distance</p>
                                    <p className="text-primary text-3xl font-bold">{productivity.total_distance_km.toLocaleString('en-US')}</p>
                                    <p className="text-muted-foreground text-xs">kilometers</p>
                                </div>
                                <div className="space-y-1 rounded-lg bg-emerald-500/5 p-4">
                                    <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">Op. Hours</p>
                                    <p className="text-3xl font-bold text-emerald-400">{productivity.total_op_hours}</p>
                                    <p className="text-muted-foreground text-xs">estimated hours</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Speed Trend Chart */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Activity className="text-muted-foreground h-4 w-4" />
                            Speed Trend — Last 8 Hours
                        </CardTitle>
                        <CardDescription>Average fleet speed per hour</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {speedTrend.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Activity className="text-muted-foreground/40 mb-2 h-8 w-8" />
                                <p className="text-muted-foreground text-sm">No movement data in the last 8 hours</p>
                            </div>
                        ) : (
                            <ChartContainer config={speedTrendConfig} className="h-[220px] w-full">
                                <LineChart data={speedTrend} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
                                                labelFormatter={(v) => `Jam ${v}`}
                                                formatter={(value) => [`${value} km/h`, 'Avg Speed']}
                                            />
                                        }
                                    />
                                    <Line
                                        type="monotone"
                                        dataKey="avg_speed"
                                        stroke="var(--color-avg_speed)"
                                        strokeWidth={2}
                                        dot={{ r: 3, fill: 'var(--color-avg_speed)' }}
                                        activeDot={{ r: 5 }}
                                    />
                                </LineChart>
                            </ChartContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Middle row */}
                <div className="grid gap-4 lg:grid-cols-3">

                    {/* Fleet composition */}
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                <Radio className="text-muted-foreground h-4 w-4" />
                                Fleet Composition
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            {totalUnits === 0 ? (
                                <p className="text-muted-foreground py-4 text-center text-sm">No devices registered</p>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(unitTypeCounts).map(([type, count]) => (
                                        <UnitTypeBar
                                            key={type}
                                            label={type}
                                            count={count}
                                            total={totalUnits}
                                            color={UNIT_COLORS[type] ?? '#94a3b8'}
                                        />
                                    ))}
                                </div>
                            )}
                            {totalUnits > 0 && (
                                <div className="border-border flex flex-wrap gap-2 border-t pt-4">
                                    {Object.entries(unitTypeCounts).map(([type, count]) => (
                                        <Badge
                                            key={type}
                                            variant="outline"
                                            className={UNIT_BADGE_CLASS[type] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/20'}
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: UNIT_COLORS[type] }} />
                                            {count}× {type}
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Speed by device */}
                    <Card className="lg:col-span-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                                <Zap className="text-muted-foreground h-4 w-4" />
                                Speed Overview — Last Hour
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {speedByDevice.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 text-center">
                                    <Activity className="text-muted-foreground/40 mb-2 h-8 w-8" />
                                    <p className="text-muted-foreground text-sm">No movement data in the last hour</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {speedByDevice.map((d) => (
                                        <div key={d.device_name} className="space-y-2">
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="text-foreground truncate font-medium">{d.device_name}</span>
                                                <div className="flex shrink-0 gap-4">
                                                    <span className="text-muted-foreground text-xs">
                                                        avg <span className="text-primary font-semibold">{d.avg_speed}</span>
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        max <span className="text-accent font-semibold">{d.max_speed}</span> km/h
                                                    </span>
                                                    <span className="text-muted-foreground/60 text-xs">{d.log_count} pts</span>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <SpeedGauge value={d.avg_speed} max={maxSpeed} color="var(--color-primary)" />
                                                <SpeedGauge value={d.max_speed} max={maxSpeed} color="var(--color-accent)" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Recent activity table */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                            <Activity className="text-muted-foreground h-4 w-4" />
                            Recent Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {recentActivity.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <Satellite className="text-muted-foreground/40 mb-2 h-8 w-8" />
                                <p className="text-muted-foreground text-sm">Waiting for GPS uplinks...</p>
                                <p className="text-muted-foreground/60 mt-1 text-xs">
                                    Run <code className="text-muted-foreground">php artisan mqtt:subscribe</code> to start ingesting data
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
                                            <TableCell className="font-medium">{item.device_name}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={UNIT_BADGE_CLASS[item.unit_type] ?? 'bg-slate-500/15 text-slate-400 border-slate-500/20'}
                                                >
                                                    {item.unit_type}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-primary font-mono font-semibold">{item.speed_kmh} km/h</TableCell>
                                            <TableCell className="text-muted-foreground font-mono text-xs">
                                                {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {item.rssi !== null ? `${item.rssi} dBm` : '—'}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">{item.recorded_at}</TableCell>
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
