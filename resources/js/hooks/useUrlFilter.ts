import { useCallback, useState } from 'react';

/**
 * Syncs a single filter value with the page's URL query string (via history.replaceState,
 * no Inertia visit) so tab selection and report filters are shareable/bookmarkable and
 * survive a reload. The default value is omitted from the URL to keep links tidy.
 */
export function useUrlFilter(key: string, defaultValue: string) {
    const [value, setValue] = useState<string>(
        () =>
            new URLSearchParams(window.location.search).get(key) ??
            defaultValue,
    );

    const update = useCallback(
        (next: string) => {
            setValue(next);

            const params = new URLSearchParams(window.location.search);

            if (next && next !== defaultValue) {
                params.set(key, next);
            } else {
                params.delete(key);
            }

            const qs = params.toString();
            window.history.replaceState(
                null,
                '',
                qs
                    ? `${window.location.pathname}?${qs}`
                    : window.location.pathname,
            );
        },
        [key, defaultValue],
    );

    return [value, update] as const;
}
