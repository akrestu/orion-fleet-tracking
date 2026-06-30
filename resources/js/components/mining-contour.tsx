// Topographic contour clusters at 4 sides of screen.
// Card sits at center ~x:496-944, y:100-800 on 1440×900 viewBox.
// Each cluster is positioned firmly at its edge with safe clearance.

const LEFT_PATH =
    'M 260,-200 C 340,-150 380,-60 350,40 C 320,130 360,210 290,265 C 210,325 110,330 30,305 C -40,282 -60,245 -120,268 C -200,298 -275,255 -305,175 C -345,75 -320,-45 -270,-120 C -220,-200 -155,-275 -65,-300 C 30,-328 130,-310 200,-275 C 240,-255 225,-225 260,-200 Z';

const RIGHT_PATH =
    'M 190,-90 C 260,-140 360,-110 400,-40 C 450,50 420,160 350,210 C 270,265 160,265 70,230 C 10,205 -30,170 -100,195 C -185,225 -265,185 -295,110 C -335,15 -310,-100 -240,-155 C -165,-215 -60,-215 30,-188 C 100,-165 130,-50 190,-90 Z';

// Outer → inner ring scales
const SCALES = [1, 0.86, 0.73, 0.61, 0.50, 0.40, 0.31, 0.23, 0.16, 0.10];

function Rings({ basePath, prefix, baseOpacity = 0.52 }: { basePath: string; prefix: string; baseOpacity?: number }) {
    return (
        <>
            {SCALES.map((s, i) => (
                <path
                    key={`${prefix}${i}`}
                    d={basePath}
                    fill="none"
                    stroke="var(--color-primary)"
                    strokeWidth={i === 0 ? 1.4 : i < 3 ? 1.1 : 0.85}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={i % 3 === 2 ? '4 7' : undefined}
                    opacity={Math.max(0, baseOpacity - i * 0.034)}
                    transform={`scale(${s})`}
                />
            ))}
        </>
    );
}

export default function MiningContour() {
    return (
        <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 1440 900"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/*
              Left side — center x=-130 so rightmost ring edge ≈ -130+380=250, well left of card (496)
              y=440 keeps it vertically centered
            */}
            <g transform="translate(-130, 440)">
                <Rings basePath={LEFT_PATH} prefix="l" />
            </g>

            {/*
              Right side — center x=1570 so leftmost ring edge ≈ 1570-295=1275, well right of card (944)
            */}
            <g transform="translate(1570, 460) scale(-1,1)">
                <Rings basePath={LEFT_PATH} prefix="r" />
            </g>

            {/*
              Top side — center y=-200 so bottommost ring edge ≈ -200+265=65, above card (top ~100)
              rotate(18) adds natural tilt
            */}
            <g transform="translate(1140, -200) rotate(18)">
                <Rings basePath={RIGHT_PATH} prefix="t" baseOpacity={0.48} />
            </g>

            {/*
              Bottom side — center y=1100 so topmost ring edge ≈ 1100-328=772, below card bottom (~800)
              rotate(-12) adds variety
            */}
            <g transform="translate(300, 1100) rotate(-12)">
                <Rings basePath={LEFT_PATH} prefix="b" baseOpacity={0.48} />
            </g>
        </svg>
    );
}
