import { useEffect, useRef } from 'react';

type UnitState = {
    x: number;
    y: number;
    pathIndex: number;
    waypointIndex: number;
    direction: 1 | -1;
    progress: number;
    speed: number;
    color: string;
    trail: Array<{ x: number; y: number }>;
    pingRadius: number;
    pingAlpha: number;
    pingTimer: number;
    label: string;
    labelAlpha: number;
    labelTimer: number;
};

// Road network — waypoints as [x ratio, y ratio] of screen size
const RAW_PATHS = [
    [[0, 0.18], [0.25, 0.15], [0.55, 0.2], [0.8, 0.16], [1, 0.18]],
    [[0, 0.42], [0.2, 0.38], [0.45, 0.44], [0.7, 0.4], [1, 0.42]],
    [[0, 0.7], [0.3, 0.67], [0.6, 0.73], [0.85, 0.68], [1, 0.7]],
    [[0.12, 0], [0.15, 0.25], [0.1, 0.55], [0.14, 0.8], [0.12, 1]],
    [[0.5, 0], [0.48, 0.3], [0.52, 0.55], [0.49, 0.8], [0.5, 1]],
    [[0.88, 0], [0.85, 0.28], [0.9, 0.52], [0.86, 0.78], [0.88, 1]],
    [[0, 0.05], [0.3, 0.25], [0.55, 0.48], [0.78, 0.72], [1, 0.92]],
    [[1, 0.08], [0.72, 0.28], [0.48, 0.5], [0.25, 0.72], [0, 0.9]],
];

const TRAIL_LENGTH = 180;
const UNIT_COUNT = 10;
const UNIT_TYPES = ['OHT', 'DT', 'DZR', 'EXC', 'GDR', 'CMP'];

function randomLabel(): string {
    const type = UNIT_TYPES[Math.floor(Math.random() * UNIT_TYPES.length)];
    const id = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
    const spd = (Math.random() * 55 + 8).toFixed(1);
    const lat = (-(Math.random() * 2 + 0.5)).toFixed(4);
    const lng = (Math.random() * 2 + 117).toFixed(4);
    return Math.random() > 0.5 ? `${type}-${id}  ${spd} km/h` : `${lat}°S  ${lng}°E`;
}

export default function FleetBackground() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };
        resize();
        window.addEventListener('resize', resize);

        const style = getComputedStyle(document.documentElement);
        const cssVar = (name: string) => style.getPropertyValue(name).trim();

        const UNIT_COLORS = [
            cssVar('--primary'),
            cssVar('--accent'),
            cssVar('--chart-1'),
            cssVar('--chart-2'),
            cssVar('--chart-3'),
            cssVar('--chart-4'),
            cssVar('--chart-5'),
        ];

        // Resolve paths to pixel coordinates based on current canvas size
        const getPaths = () =>
            RAW_PATHS.map((path) =>
                path.map(([rx, ry]) => ({
                    x: rx * canvas.width,
                    y: ry * canvas.height,
                })),
            );

        const makeUnit = (): UnitState => {
            const pathIndex = Math.floor(Math.random() * RAW_PATHS.length);
            const paths = getPaths();
            const path = paths[pathIndex];
            const waypointIndex = Math.floor(Math.random() * (path.length - 1));
            const direction: 1 | -1 = Math.random() > 0.5 ? 1 : -1;
            const start = path[waypointIndex];
            return {
                x: start.x,
                y: start.y,
                pathIndex,
                waypointIndex,
                direction,
                progress: Math.random(),
                speed: 0.004 + Math.random() * 0.005,
                color: UNIT_COLORS[Math.floor(Math.random() * UNIT_COLORS.length)],
                trail: [],
                pingRadius: 0,
                pingAlpha: 0,
                pingTimer: Math.random() * 300,
                label: randomLabel(),
                labelAlpha: 0,
                labelTimer: Math.floor(Math.random() * 200),
            };
        };

        const units: UnitState[] = Array.from({ length: UNIT_COUNT }, makeUnit);

        let animId: number;

        const draw = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const paths = getPaths();

            units.forEach((u) => {
                const path = paths[u.pathIndex];
                const nextIndex = u.waypointIndex + u.direction;

                if (nextIndex < 0 || nextIndex >= path.length) {
                    // Reverse direction at path ends
                    u.direction = (u.direction * -1) as 1 | -1;
                    return;
                }

                const from = path[u.waypointIndex];
                const to = path[nextIndex];

                // Move along segment
                u.progress += u.speed;
                u.x = from.x + (to.x - from.x) * u.progress;
                u.y = from.y + (to.y - from.y) * u.progress;

                if (u.progress >= 1) {
                    u.progress = 0;
                    u.waypointIndex = nextIndex;

                    // Reverse at ends
                    const nextNext = u.waypointIndex + u.direction;
                    if (nextNext < 0 || nextNext >= path.length) {
                        u.direction = (u.direction * -1) as 1 | -1;
                    }
                }

                u.trail.push({ x: u.x, y: u.y });
                if (u.trail.length > TRAIL_LENGTH) u.trail.shift();

                // Ping animation
                u.pingTimer--;
                if (u.pingTimer <= 0) {
                    u.pingRadius = 0;
                    u.pingAlpha = 0.7;
                    u.pingTimer = 200 + Math.random() * 400;
                }
                if (u.pingAlpha > 0) {
                    u.pingRadius += 0.5;
                    u.pingAlpha -= 0.01;
                    ctx.globalAlpha = Math.max(0, u.pingAlpha);
                    ctx.strokeStyle = u.color;
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 0;
                    ctx.beginPath();
                    ctx.arc(u.x, u.y, u.pingRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.globalAlpha = 1;
                }

                // Draw trail
                if (u.trail.length > 1) {
                    ctx.strokeStyle = u.color;
                    ctx.lineCap = 'round';
                    for (let i = 1; i < u.trail.length; i++) {
                        const t = i / u.trail.length;
                        ctx.globalAlpha = t * 0.6;
                        ctx.lineWidth = t * 2.5;
                        ctx.beginPath();
                        ctx.moveTo(u.trail[i - 1].x, u.trail[i - 1].y);
                        ctx.lineTo(u.trail[i].x, u.trail[i].y);
                        ctx.stroke();
                    }
                    ctx.globalAlpha = 1;
                }

                // Unit dot with glow
                ctx.shadowColor = u.color;
                ctx.shadowBlur = 14;
                ctx.fillStyle = u.color;
                ctx.beginPath();
                ctx.arc(u.x, u.y, 3.5, 0, Math.PI * 2);
                ctx.fill();

                // Outer ring
                ctx.shadowBlur = 0;
                ctx.globalAlpha = 0.33;
                ctx.strokeStyle = u.color;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(u.x, u.y, 7, 0, Math.PI * 2);
                ctx.stroke();
                ctx.globalAlpha = 1;

                // Telemetry label
                u.labelTimer--;
                if (u.labelTimer <= 0) {
                    u.label = randomLabel();
                    u.labelAlpha = 0.85;
                    u.labelTimer = 150 + Math.floor(Math.random() * 250);
                }
                if (u.labelAlpha > 0) {
                    u.labelAlpha -= 0.003;
                    ctx.globalAlpha = Math.max(0, u.labelAlpha);
                    ctx.font = '9px monospace';
                    ctx.fillStyle = u.color;
                    ctx.shadowColor = u.color;
                    ctx.shadowBlur = 4;
                    ctx.fillText(u.label, u.x + 12, u.y - 10);
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 1;
                }
            });

            ctx.shadowBlur = 0;
            animId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-70" />;
}
