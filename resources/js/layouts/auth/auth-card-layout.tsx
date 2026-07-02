import type { PropsWithChildren } from 'react';
import { BrandLockup } from '@/components/brand-lockup';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

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
        <div className="relative flex min-h-svh flex-col items-center justify-center bg-background p-6 md:p-10">
            <div className="relative z-10 flex w-full max-w-md flex-col">
                <Card className="border-border/50 bg-card/70 shadow-2xl backdrop-blur-md">
                    <CardHeader className="px-10 pt-10 pb-0 text-center">
                        <BrandLockup className="mb-6 justify-center" />
                        <CardTitle className="text-xl">{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </CardHeader>
                    <CardContent className="px-10 py-8">{children}</CardContent>
                </Card>
            </div>
        </div>
    );
}
