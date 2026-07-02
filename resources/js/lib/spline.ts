type LatLng = [number, number];

/**
 * Interpolates a smooth curve between `p1` and `p2` using uniform Catmull-Rom splines,
 * with `p0`/`p3` as tangent-control neighbors. Returns `numPoints` points including both
 * endpoints, so consecutive segments share their boundary point exactly.
 */
export function catmullRomSegment(
    p0: LatLng,
    p1: LatLng,
    p2: LatLng,
    p3: LatLng,
    numPoints = 8,
): LatLng[] {
    const points: LatLng[] = [];

    for (let i = 0; i < numPoints; i++) {
        const t = i / (numPoints - 1);
        const t2 = t * t;
        const t3 = t2 * t;

        const lat =
            0.5 *
            (2 * p1[0] +
                (-p0[0] + p2[0]) * t +
                (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
                (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);

        const lng =
            0.5 *
            (2 * p1[1] +
                (-p0[1] + p2[1]) * t +
                (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
                (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);

        points.push([lat, lng]);
    }

    return points;
}
