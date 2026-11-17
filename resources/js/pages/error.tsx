import { Head, Link } from '@inertiajs/react';
import { AlertTriangle, Lock, SearchX, Timer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { OrionLockup } from '@/components/orion/misc';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';

type Props = {
    status: 403 | 404 | 429 | 500 | 503;
    reference: string;
};

const COPY: Record<
    Props['status'],
    { title: string; body: string; icon: LucideIcon; tone: string }
> = {
    403: {
        title: 'You don’t have access to this page',
        body: 'Your role doesn’t include this area. Ask an admin if you need it.',
        icon: Lock,
        tone: 'bg-accent text-accent-foreground',
    },
    404: {
        title: 'Page not found',
        body: 'The link may be old, or the item was removed.',
        icon: SearchX,
        tone: 'bg-accent text-accent-foreground',
    },
    429: {
        title: 'Too many requests',
        body: 'Please wait a moment, then try again.',
        icon: Timer,
        tone: 'bg-warning-bg text-warning',
    },
    500: {
        title: 'Something went wrong',
        body: 'The server hit an error while loading this page.',
        icon: AlertTriangle,
        tone: 'bg-danger-bg text-danger',
    },
    503: {
        title: 'ORION is under maintenance',
        body: 'We’ll be back shortly. Live tracking resumes automatically.',
        icon: AlertTriangle,
        tone: 'bg-warning-bg text-warning',
    },
};

export default function ErrorPage({ status, reference }: Props) {
    const copy = COPY[status] ?? COPY[500];
    const Icon = copy.icon;
    const retryable = status >= 429;

    return (
        <>
            <Head title={copy.title} />

            <main className="grid min-h-svh place-items-center bg-background p-6">
                <div className="flex max-w-md flex-col items-center gap-4 text-center">
                    <OrionLockup size={28} />
                    <span
                        className={cn(
                            'mt-6 grid size-14 place-items-center rounded-2xl',
                            copy.tone,
                        )}
                    >
                        <Icon className="size-6" aria-hidden />
                    </span>
                    <h1 className="text-xl font-semibold">{copy.title}</h1>
                    <p className="leading-relaxed text-muted-foreground">
                        {copy.body}{' '}
                        <span className="font-mono text-xs whitespace-nowrap">
                            Error {status} · ref {reference}
                        </span>
                    </p>
                    <div className="mt-2 flex gap-2">
                        {retryable && (
                            <Button
                                className="h-11"
                                onClick={() => window.location.reload()}
                            >
                                Try again
                            </Button>
                        )}
                        <Button
                            variant={retryable ? 'outline' : 'default'}
                            asChild
                            className="h-11"
                        >
                            <Link href={dashboard()}>Back to dashboard</Link>
                        </Button>
                    </div>
                </div>
            </main>
        </>
    );
}
