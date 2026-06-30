import type { SVGAttributes } from 'react';

export default function AppLogoIcon({ className, ...props }: SVGAttributes<SVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
            <circle cx="12" cy="12" r="2.5" className="fill-primary" />
            <circle cx="12" cy="12" r="6" className="stroke-primary" strokeWidth="1.5" strokeDasharray="3 2" />
            <circle cx="12" cy="12" r="10" className="stroke-primary" strokeWidth="1" opacity="0.4" />
            <line x1="12" y1="2" x2="12" y2="6" className="stroke-primary" strokeWidth="1.5" />
            <line x1="12" y1="18" x2="12" y2="22" className="stroke-primary" strokeWidth="1.5" />
            <line x1="2" y1="12" x2="6" y2="12" className="stroke-primary" strokeWidth="1.5" />
            <line x1="18" y1="12" x2="22" y2="12" className="stroke-primary" strokeWidth="1.5" />
        </svg>
    );
}
