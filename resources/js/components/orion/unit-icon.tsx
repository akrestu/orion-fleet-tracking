import { UNIT_TYPES } from '@/lib/orion/unit-types';
import type { UnitType } from '@/lib/orion/unit-types';
import { cn } from '@/lib/utils';

interface UnitIconProps {
    type: UnitType;
    /** pixel size of the square icon box */
    size?: number;
    /**
     * 'plain'  — silhouette in category colour (lists, tables)
     * 'tile'   — white silhouette on a rounded category tile (cards, headers)
     */
    variant?: 'plain' | 'tile';
    /** dims the icon for offline units */
    muted?: boolean;
    className?: string;
    title?: string;
}

export function UnitIcon({
    type,
    size = 24,
    variant = 'plain',
    muted,
    className,
    title,
}: UnitIconProps) {
    const meta = UNIT_TYPES[type];
    const svg = (
        <svg
            width={variant === 'tile' ? Math.round(size * 0.72) : size}
            height={variant === 'tile' ? Math.round(size * 0.72) : size}
            viewBox="0 0 32 32"
            role={title ? 'img' : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
        >
            <path
                d={meta.path}
                fill={variant === 'tile' ? '#fff' : meta.colorVar}
            />
        </svg>
    );

    if (variant === 'plain') {
        return (
            <span
                className={cn(
                    'inline-flex shrink-0',
                    muted && 'opacity-50',
                    className,
                )}
            >
                {svg}
            </span>
        );
    }

    return (
        <span
            className={cn(
                'inline-grid shrink-0 place-items-center rounded-[28%]',
                muted && 'opacity-55',
                className,
            )}
            style={{ width: size, height: size, background: meta.colorVar }}
        >
            {svg}
        </span>
    );
}
