/**
 * Formats an ISO timestamp as a short relative Indonesian string, e.g. "2 mnt lalu".
 * Returns null when the timestamp is missing so callers can render a fallback.
 */
export function formatRelativeTime(isoTimestamp: string | null): string | null {
    if (!isoTimestamp) {
        return null;
    }

    const seconds = Math.max(
        0,
        (Date.now() - new Date(isoTimestamp).getTime()) / 1000,
    );

    if (seconds < 10) {
        return 'baru saja';
    }

    if (seconds < 60) {
        return `${Math.floor(seconds)} dtk lalu`;
    }

    if (seconds < 3600) {
        return `${Math.floor(seconds / 60)} mnt lalu`;
    }

    if (seconds < 86400) {
        return `${Math.floor(seconds / 3600)} jam lalu`;
    }

    return `${Math.floor(seconds / 86400)} hari lalu`;
}

/** A device is "stale" when its last known position is older than the given threshold (default 5 min). */
export function isStale(
    isoTimestamp: string | null,
    thresholdMs = 5 * 60 * 1000,
): boolean {
    if (!isoTimestamp) {
        return true;
    }

    return Date.now() - new Date(isoTimestamp).getTime() > thresholdMs;
}
