// Line-silhouette icons for the fleet's heavy-equipment classes, drawn to
// match the Lucide stroke style already used across shadcn/ui components
// (24px grid, 1.6 stroke, round caps/joins, currentColor).

import * as React from 'react';
import type { UnitCategory } from '@/config/unit-types';

const PATHS: Record<UnitCategory, React.ReactNode> = {
    oht: (
        <>
            <path d="M2.5 13V6h9l3 4.5H21V13z" />
            <circle cx="7" cy="17" r="2.4" />
            <circle cx="16.5" cy="17" r="2.2" />
        </>
    ),
    dt: (
        <>
            <path d="M2.5 16v-5h4l1.5 5" />
            <path d="M8 13.5 19 6l2 3-9.5 6.5z" />
            <circle cx="5.5" cy="17.5" r="1.7" />
            <circle cx="16" cy="17.5" r="1.7" />
        </>
    ),
    excavator: (
        <>
            <rect x="3" y="16" width="11" height="4" rx="2" />
            <rect x="5" y="11" width="6" height="5" rx="1" />
            <path d="M10.5 12 16 8l4 4" />
            <path d="M20 12l1.6 3-3 .6" />
        </>
    ),
    dozer: (
        <>
            <rect x="3.5" y="15" width="11" height="4" rx="2" />
            <path d="M6 15v-4h5l2 4" />
            <path d="M19 9v10" />
            <path d="M14 13h5" />
        </>
    ),
    grader: (
        <>
            <path d="M3 10h11l4 3.5" />
            <path d="M13 10V7h4v3" />
            <path d="M8.5 13 12 16.5" />
            <circle cx="5.5" cy="17.5" r="1.8" />
            <circle cx="17" cy="17.5" r="1.8" />
        </>
    ),
    compactor: (
        <>
            <circle cx="7" cy="15" r="4" />
            <circle cx="7" cy="15" r="1" />
            <path d="M11 13.5h6V17" />
            <path d="M12.5 13.5V9.5h4v4" />
            <circle cx="16.5" cy="17" r="1.8" />
        </>
    ),
    driller: (
        <>
            <path d="M12 3v12" />
            <path d="M12 5.5h3M12 8.5h3M12 11.5h3" />
            <rect x="5" y="15" width="12" height="4" rx="2" />
            <path d="M7.5 15v-3.5H11" />
        </>
    ),
    other: (
        <>
            <rect x="4" y="8" width="16" height="10" rx="2" />
            <path d="M9 8V5h6v3" />
        </>
    ),
};

export interface UnitTypeIconProps extends React.SVGProps<SVGSVGElement> {
    type: UnitCategory;
}

export function UnitTypeIcon({ type, ...props }: UnitTypeIconProps) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...props}
        >
            {PATHS[type]}
        </svg>
    );
}
