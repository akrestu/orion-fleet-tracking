import { Head, Link, usePage } from '@inertiajs/react';
import { Activity, MapPinned, ShieldCheck } from 'lucide-react';
import { BrandLockup } from '@/components/brand-lockup';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { dashboard, login, register } from '@/routes';

const FEATURES = [
    {
        icon: MapPinned,
        title: 'Live Fleet Tracking',
        description:
            'Pantau posisi, kecepatan, dan status setiap unit secara real-time di atas peta satelit maupun tile kustom.',
    },
    {
        icon: Activity,
        title: 'Analytics & Reports',
        description:
            'Ringkasan produktivitas, utilisasi, dan tren kecepatan armada, siap diekspor untuk laporan operasional.',
    },
    {
        icon: ShieldCheck,
        title: 'Safety & Geofencing',
        description:
            'Deteksi overspeed, pelanggaran geofence, dan unit offline secara otomatis lewat sistem alert terpusat.',
    },
] as const;

export default function Welcome() {
    const { auth } = usePage<{ auth: { user: unknown } }>().props;

    return (
        <>
            <Head title="Selamat Datang" />
            <div className="flex min-h-screen flex-col bg-background text-foreground">
                <header className="flex items-center justify-between px-6 py-6 lg:px-12">
                    <BrandLockup />
                    <nav className="flex items-center gap-2">
                        {auth.user ? (
                            <Button asChild>
                                <Link href={dashboard()}>Dashboard</Link>
                            </Button>
                        ) : (
                            <>
                                <Button variant="ghost" asChild>
                                    <Link href={login()}>Log in</Link>
                                </Button>
                                <Button asChild>
                                    <Link href={register()}>Register</Link>
                                </Button>
                            </>
                        )}
                    </nav>
                </header>

                <main className="flex flex-1 flex-col items-center justify-center gap-16 px-6 py-12 lg:px-12">
                    <div className="max-w-2xl text-center">
                        <h1 className="text-4xl font-bold tracking-tight lg:text-5xl">
                            Fleet intelligence untuk operasi tambang Anda
                        </h1>
                        <p className="mt-4 text-lg text-muted-foreground">
                            ORION menyatukan tracking GPS, analitik
                            produktivitas, dan keselamatan armada alat berat
                            dalam satu dashboard real-time.
                        </p>
                        <div className="mt-8 flex items-center justify-center gap-3">
                            {auth.user ? (
                                <Button size="lg" asChild>
                                    <Link href={dashboard()}>
                                        Buka Dashboard
                                    </Link>
                                </Button>
                            ) : (
                                <Button size="lg" asChild>
                                    <Link href={login()}>Masuk</Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
                        {FEATURES.map((feature) => (
                            <Card key={feature.title}>
                                <CardHeader>
                                    <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                                        <feature.icon className="h-5 w-5 text-primary" />
                                    </div>
                                    <CardTitle className="text-base">
                                        {feature.title}
                                    </CardTitle>
                                    <CardDescription>
                                        {feature.description}
                                    </CardDescription>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                </main>

                <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
                    PT. WBK — ORION Fleet Intelligence
                </footer>
            </div>
        </>
    );
}
