import { Head } from '@inertiajs/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAppearance } from '@/hooks/use-appearance';
import type { Appearance as AppearanceMode } from '@/hooks/use-appearance';
import { cn } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';

const OPTIONS: { value: AppearanceMode; label: string; icon: LucideIcon }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
];

/** Miniature app shell drawn with theme tokens, scoped by a `light`/`dark` class. */
function ShellPreview({ theme }: { theme: 'light' | 'dark' }) {
    return (
        <span className={cn(theme, 'flex h-full w-full bg-background')}>
            <span className="flex w-1/4 flex-col gap-1.5 border-r bg-sidebar p-2">
                <span className="h-1.5 w-3/4 rounded-full bg-muted-foreground/40" />
                <span className="h-1.5 w-full rounded-full bg-primary" />
                <span className="h-1.5 w-2/3 rounded-full bg-muted-foreground/30" />
            </span>
            <span className="flex flex-1 flex-col gap-2 p-2.5">
                <span className="h-2 w-1/2 rounded-full bg-foreground/70" />
                <span className="grid flex-1 grid-cols-2 gap-1.5">
                    <span className="rounded-md border bg-card" />
                    <span className="rounded-md border bg-card" />
                </span>
            </span>
        </span>
    );
}

export default function Appearance() {
    const { appearance, updateAppearance } = useAppearance();

    return (
        <>
            <Head title="Appearance" />

            <section className="rounded-xl border bg-card">
                <header className="border-b px-6 py-5">
                    <h1 className="text-lg font-semibold">Appearance</h1>
                    <p className="text-sm text-muted-foreground">
                        Theme for this browser. System follows your device
                        setting.
                    </p>
                </header>

                <div
                    role="radiogroup"
                    aria-label="Theme"
                    className="grid gap-4 px-6 py-5 sm:grid-cols-3"
                >
                    {OPTIONS.map((opt) => {
                        const selected = appearance === opt.value;

                        return (
                            <button
                                key={opt.value}
                                type="button"
                                role="radio"
                                aria-checked={selected}
                                onClick={() => updateAppearance(opt.value)}
                                className={cn(
                                    'flex flex-col overflow-hidden rounded-xl border-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                                    selected
                                        ? 'border-primary'
                                        : 'border-border hover:border-muted-foreground/40',
                                )}
                            >
                                <span className="flex aspect-[16/10] w-full overflow-hidden">
                                    {opt.value === 'system' ? (
                                        <>
                                            <span className="flex w-1/2 overflow-hidden">
                                                <ShellPreview theme="light" />
                                            </span>
                                            <span className="flex w-1/2 overflow-hidden">
                                                <ShellPreview theme="dark" />
                                            </span>
                                        </>
                                    ) : (
                                        <ShellPreview theme={opt.value} />
                                    )}
                                </span>
                                <span className="flex items-center gap-2 border-t px-3 py-2.5 text-sm font-medium">
                                    <opt.icon className="size-4" />
                                    {opt.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [{ title: 'Appearance', href: editAppearance() }],
};
