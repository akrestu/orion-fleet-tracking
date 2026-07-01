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
