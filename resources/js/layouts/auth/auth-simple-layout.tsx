import { Link } from '@inertiajs/react';
import { home } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="dark flex min-h-svh">
            {/* Left — branding panel */}
            <div className="relative hidden flex-col justify-between border-r border-sidebar-border bg-sidebar p-12 lg:flex lg:w-[45%]">
                {/* Logo */}
                <Link href={home()} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                        <svg
                            viewBox="0 0 24 24"
                            className="h-5 w-5"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <circle
                                cx="12"
                                cy="12"
                                r="2.5"
                                className="fill-primary"
                            />
                            <circle
                                cx="12"
                                cy="12"
                                r="6"
                                className="stroke-primary"
                                strokeWidth="1.5"
                                strokeDasharray="3 2"
                            />
                            <circle
                                cx="12"
                                cy="12"
                                r="10"
                                className="stroke-primary"
                                strokeWidth="1"
                                opacity="0.4"
                            />
                            <line
                                x1="12"
                                y1="2"
                                x2="12"
                                y2="6"
                                className="stroke-primary"
                                strokeWidth="1.5"
                            />
                            <line
                                x1="12"
                                y1="18"
                                x2="12"
                                y2="22"
                                className="stroke-primary"
                                strokeWidth="1.5"
                            />
                            <line
                                x1="2"
                                y1="12"
                                x2="6"
                                y2="12"
                                className="stroke-primary"
                                strokeWidth="1.5"
                            />
                            <line
                                x1="18"
                                y1="12"
                                x2="22"
                                y2="12"
                                className="stroke-primary"
                                strokeWidth="1.5"
                            />
                        </svg>
                    </div>
                    <div>
                        <p className="text-base font-bold tracking-widest text-primary">
                            ORION
                        </p>
                        <p className="text-xs tracking-wide text-muted-foreground">
                            Fleet Intelligence
                        </p>
                    </div>
                </Link>

                {/* Tagline */}
                <div className="space-y-8">
                    <div>
                        <p className="text-3xl leading-snug font-light text-foreground">
                            Real-time fleet tracking
                            <br />
                            <span className="font-medium text-primary">
                                powered by LoRaWAN.
                            </span>
                        </p>
                        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                            Monitor your heavy equipment fleet with GPS
                            precision, live telemetry, and intelligent alerting
                            — all in one platform.
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 border-t border-border pt-6">
                        <div>
                            <p className="text-xl font-bold text-primary">
                                Live
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                GPS Tracking
                            </p>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-emerald-400">
                                LoRa
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Long Range
                            </p>
                        </div>
                        <div>
                            <p className="text-xl font-bold text-violet-400">
                                24/7
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                                Monitoring
                            </p>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-muted-foreground/50">
                    &copy; {new Date().getFullYear()} ORION Fleet Intelligence.
                    All rights reserved.
                </p>
            </div>

            {/* Right — form panel */}
            <div className="flex flex-1 flex-col items-center justify-center bg-background p-8">
                <div className="w-full max-w-sm space-y-8">
                    {/* Mobile logo */}
                    <Link
                        href={home()}
                        className="flex items-center gap-3 lg:hidden"
                    >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10">
                            <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="2.5"
                                    className="fill-primary"
                                />
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="6"
                                    className="stroke-primary"
                                    strokeWidth="1.5"
                                    strokeDasharray="3 2"
                                />
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    className="stroke-primary"
                                    strokeWidth="1"
                                    opacity="0.4"
                                />
                            </svg>
                        </div>
                        <p className="text-base font-bold tracking-widest text-primary">
                            ORION
                        </p>
                    </Link>

                    {/* Heading */}
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                            {title}
                        </h1>
                        {description && (
                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                {description}
                            </p>
                        )}
                    </div>

                    {/* Form slot — components render with dark tokens automatically */}
                    {children}
                </div>
            </div>
        </div>
    );
}
