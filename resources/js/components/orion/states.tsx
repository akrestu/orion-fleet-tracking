import { router, usePage } from '@inertiajs/react';
import { echo } from '@laravel/echo-react';
import { Loader2, Lock, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { EmptyState, LastSeen } from '@/components/orion/misc';
import { Button } from '@/components/ui/button';
import { useLiveConnection } from '@/hooks/use-live-connection';
import { cn } from '@/lib/utils';

/* ---------- No device groups assigned ---------- */

/** True for an operator/viewer whose account has no device group yet (admins see everything). */
export function useHasNoGroups(): boolean {
    const { auth } = usePage<{
        auth: { accessibleGroupIds?: number[] | null };
    }>().props;
    const ids = auth.accessibleGroupIds;

    return Array.isArray(ids) && ids.length === 0;
}

/** Replaces dashboard / map content when the user can't see any unit. */
export function NoGroupState({ className }: { className?: string }) {
    const { supportEmail } = usePage<{ supportEmail?: string | null }>().props;
    const mail = supportEmail
        ? `mailto:${supportEmail}?subject=${encodeURIComponent('ORION: please assign me a device group')}`
        : null;

    return (
        <div className={cn('grid place-items-center p-6', className)}>
            <EmptyState
                icon={<Lock className="size-6" />}
                title="You have no device groups assigned"
                actions={
                    <>
                        {mail && (
                            <Button asChild className="h-11 md:h-10">
                                <a href={mail}>Contact admin</a>
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            className="h-11 md:h-10"
                            onClick={() => router.reload()}
                        >
                            Refresh
                        </Button>
                    </>
                }
            >
                Your account is active, but no site is linked to it yet. Ask an
                admin to assign you to a device group such as a pit or haul
                road.
            </EmptyState>
        </div>
    );
}

/* ---------- Live connection lost ---------- */

type PusherLike = { connect: () => void };

/** Forces the Reverb (Pusher protocol) socket to reconnect right away. */
function reconnectNow(): void {
    const connector = echo().connector as unknown as { pusher?: PusherLike };
    connector.pusher?.connect();
}

type Tracking = {
    seen: ReturnType<typeof useLiveConnection>;
    attempts: number;
    lostAt: Date | null;
};

/**
 * Live feed state plus how many reconnect attempts happened since the drop and
 * when the feed was last healthy (derived during render, no effects).
 */
export function useLiveConnectionDetails() {
    const connection = useLiveConnection();
    const [tracking, setTracking] = useState<Tracking>({
        seen: connection,
        attempts: 0,
        lostAt: null,
    });

    if (tracking.seen !== connection) {
        const was = tracking.seen;
        setTracking({
            seen: connection,
            attempts:
                connection === 'connected'
                    ? 0
                    : tracking.attempts +
                      (connection === 'reconnecting' ? 1 : 0),
            lostAt:
                connection === 'connected'
                    ? null
                    : was === 'connected'
                      ? new Date()
                      : tracking.lostAt,
        });
    }

    return {
        connection,
        attempts: tracking.attempts,
        lostAt: tracking.lostAt,
        retry: reconnectNow,
    };
}

/** Amber banner shown while the live feed is down (Fleet Map). */
export function LiveConnectionBanner({ className }: { className?: string }) {
    const { connection, attempts, lostAt, retry } = useLiveConnectionDetails();

    if (connection === 'connected') {
        return null;
    }

    const reconnecting = connection === 'reconnecting';

    return (
        <div
            role="status"
            className={cn(
                'flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-bg px-4 py-2.5 text-warning shadow-sm',
                className,
            )}
        >
            {reconnecting ? (
                <Loader2
                    className="size-4 shrink-0 animate-spin motion-reduce:animate-none"
                    aria-hidden
                />
            ) : (
                <WifiOff className="size-4 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold">
                    {reconnecting
                        ? `Reconnecting to live feed…${attempts > 1 ? ` (attempt ${attempts})` : ''}`
                        : 'Live feed disconnected'}
                </p>
                {lostAt && (
                    <p className="truncate text-xs">
                        Positions shown are from{' '}
                        {lostAt.toLocaleTimeString('en-GB', {
                            timeZone: 'Asia/Jakarta',
                            hour: '2-digit',
                            minute: '2-digit',
                        })}{' '}
                        ·{' '}
                        <LastSeen
                            at={lostAt}
                            staleAfterSec={Number.MAX_SAFE_INTEGER}
                        />{' '}
                        and may be outdated.
                    </p>
                )}
            </div>
            <Button
                size="sm"
                variant="outline"
                className="h-9 shrink-0 bg-card"
                onClick={retry}
            >
                Retry now
            </Button>
        </div>
    );
}
