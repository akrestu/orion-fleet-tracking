import type { PropsWithChildren } from 'react';

/**
 * ORION auth shell (artboards "Login", "Login — Mobile").
 * Desktop: centred split card (photo | form) over the contour background.
 * Mobile: photo on top fading into the page, form below on the contours.
 */
export default function AuthCardLayout({
    children,
    title,
    description,
}: PropsWithChildren<{
    name?: string;
    title?: string;
    description?: string;
}>) {
    return (
        <div className="relative min-h-svh overflow-hidden bg-background md:flex md:items-center md:justify-center md:p-10">
            <div
                aria-hidden
                style={{ backgroundImage: 'url(/images/orion/contour-bg.png)' }}
                className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-60 mix-blend-multiply dark:opacity-[0.18] dark:mix-blend-screen"
            />

            <div className="relative w-full md:grid md:max-w-[1040px] md:grid-cols-2 md:overflow-hidden md:rounded-[28px] md:bg-card md:shadow-[0_24px_64px_-12px_oklch(0.3_0.03_250/0.25)] dark:md:shadow-[0_24px_64px_-12px_oklch(0_0_0/0.6)]">
                <div className="relative h-[360px] md:h-auto md:min-h-[640px]">
                    <img
                        src="/images/orion/hero-site.jpg"
                        alt=""
                        className="absolute inset-0 size-full object-cover"
                    />
                    <div
                        aria-hidden
                        className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-background md:hidden"
                    />
                    <span className="absolute top-5 left-5 inline-flex items-center gap-2.5 rounded-full bg-background/95 py-1.5 pr-4 pl-1.5 shadow-sm">
                        <img
                            src="/images/orion/wbk-logo.png"
                            alt="PT. WBK"
                            width={30}
                            height={30}
                        />
                        <span className="text-[13px] font-bold tracking-[0.16em]">
                            ORION
                        </span>
                    </span>
                    <span className="absolute right-5 bottom-5 text-xs font-medium text-muted-foreground md:text-white/90">
                        Site Lahat
                    </span>
                </div>

                <div className="relative flex flex-col justify-center px-6 pt-2 pb-10 md:px-16 md:py-14">
                    {(title || description) && (
                        <div className="mb-6 flex flex-col gap-2">
                            {title && (
                                <h1 className="text-[32px] leading-tight font-bold tracking-tight md:text-[36px]">
                                    {title}
                                </h1>
                            )}
                            {description && (
                                <p className="text-[15px] text-muted-foreground">
                                    {description}
                                </p>
                            )}
                        </div>
                    )}
                    {children}
                </div>
            </div>
        </div>
    );
}
