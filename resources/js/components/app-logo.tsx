export default function AppLogo({ compact = false }: { compact?: boolean }) {
    return (
        <>
            <div
                className={`border-primary/30 bg-primary/10 flex aspect-square shrink-0 items-center justify-center rounded-lg border ${
                    compact ? 'size-6' : 'size-8'
                }`}
            >
                <svg viewBox="0 0 24 24" className={compact ? 'size-3.5' : 'size-5'} fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="2.5" className="fill-primary" />
                    <circle cx="12" cy="12" r="6" className="stroke-primary" strokeWidth="1.5" strokeDasharray="3 2" />
                    <circle cx="12" cy="12" r="10" className="stroke-primary" strokeWidth="1" opacity="0.4" />
                    <line x1="12" y1="2" x2="12" y2="6" className="stroke-primary" strokeWidth="1.5" />
                    <line x1="12" y1="18" x2="12" y2="22" className="stroke-primary" strokeWidth="1.5" />
                    <line x1="2" y1="12" x2="6" y2="12" className="stroke-primary" strokeWidth="1.5" />
                    <line x1="18" y1="12" x2="22" y2="12" className="stroke-primary" strokeWidth="1.5" />
                </svg>
            </div>
            <div className="ml-1 grid flex-1 text-left text-sm">
                <span className={`mb-0.5 truncate leading-tight font-semibold tracking-wider text-primary ${compact ? 'text-xs' : ''}`}>
                    ORION
                </span>
                {!compact && (
                    <span className="truncate text-xs text-muted-foreground">Fleet Intelligence</span>
                )}
            </div>
        </>
    );
}
