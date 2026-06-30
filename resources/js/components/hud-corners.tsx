export default function HudCorners() {
    const size = 28;
    const stroke = 1.5;
    const color = 'var(--color-primary)';
    const opacity = 0.45;

    const Corner = ({ rotate }: { rotate: string }) => (
        <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            fill="none"
            style={{ transform: rotate, opacity }}
        >
            <path
                d={`M ${size} 4 L 4 4 L 4 ${size}`}
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="square"
            />
        </svg>
    );

    return (
        <>
            {/* Top-left */}
            <div className="pointer-events-none absolute top-5 left-5">
                <Corner rotate="rotate(0deg)" />
            </div>
            {/* Top-right */}
            <div className="pointer-events-none absolute top-5 right-5">
                <Corner rotate="rotate(90deg)" />
            </div>
            {/* Bottom-left */}
            <div className="pointer-events-none absolute bottom-5 left-5">
                <Corner rotate="rotate(-90deg)" />
            </div>
            {/* Bottom-right */}
            <div className="pointer-events-none absolute bottom-5 right-5">
                <Corner rotate="rotate(180deg)" />
            </div>
        </>
    );
}
