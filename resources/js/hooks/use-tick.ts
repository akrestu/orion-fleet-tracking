import { useEffect, useState } from 'react';

/** Forces a re-render every `intervalMs` — used to keep relative-time labels ("2 mnt lalu") fresh. */
export function useTick(intervalMs = 30_000): number {
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), intervalMs);

        return () => clearInterval(id);
    }, [intervalMs]);

    return tick;
}

/** Current epoch ms, refreshed every `intervalMs`; keeps render pure for relative-time labels. */
export function useNow(intervalMs = 15_000): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);

        return () => clearInterval(id);
    }, [intervalMs]);

    return now;
}
