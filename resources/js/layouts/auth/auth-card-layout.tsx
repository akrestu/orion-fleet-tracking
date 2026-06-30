import { Link } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import MiningContour from '@/components/mining-contour';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { home } from '@/routes';

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
        <div className="bg-background relative flex min-h-svh flex-col items-center justify-center p-6 md:p-10 overflow-hidden">
            <MiningContour />

<div className="relative z-10 flex w-full max-w-md flex-col">
                <Card className="bg-card/70 border-border/50 backdrop-blur-md shadow-2xl">
                    <CardHeader className="px-10 pt-10 pb-0 text-center">
                        <div className="flex items-center justify-center gap-4 mb-6">
                            {/* Client logo — PT. WBK */}
                            <img
                                src="/wbk.png"
                                alt="PT. WBK"
                                className="h-11 w-11 rounded-xl object-cover"
                            />

                            {/* Separator */}
                            <div className="flex flex-col items-center gap-1 select-none">
                                <div className="bg-border w-px h-5" />
                                <span className="text-muted-foreground/40 text-[9px] font-medium tracking-widest uppercase">by</span>
                                <div className="bg-border w-px h-5" />
                            </div>

                            {/* ORION logo */}
                            <Link href={home()} className="flex items-center gap-2.5">
                                <div className="border-primary/30 bg-primary/10 flex h-11 w-11 items-center justify-center rounded-xl border">
                                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <circle cx="12" cy="12" r="2.5" className="fill-primary" />
                                        <circle cx="12" cy="12" r="6" className="stroke-primary" strokeWidth="1.5" strokeDasharray="3 2" />
                                        <circle cx="12" cy="12" r="10" className="stroke-primary" strokeWidth="1" opacity="0.4" />
                                        <line x1="12" y1="2" x2="12" y2="6" className="stroke-primary" strokeWidth="1.5" />
                                        <line x1="12" y1="18" x2="12" y2="22" className="stroke-primary" strokeWidth="1.5" />
                                        <line x1="2" y1="12" x2="6" y2="12" className="stroke-primary" strokeWidth="1.5" />
                                        <line x1="18" y1="12" x2="22" y2="12" className="stroke-primary" strokeWidth="1.5" />
                                    </svg>
                                </div>
                                <div className="text-left">
                                    <p className="text-primary text-base font-bold tracking-widest">ORION</p>
                                    <p className="text-muted-foreground text-xs tracking-wide">Fleet Intelligence</p>
                                </div>
                            </Link>
                        </div>
                        <CardTitle className="text-xl">{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </CardHeader>
                    <CardContent className="px-10 py-8">
                        {children}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
