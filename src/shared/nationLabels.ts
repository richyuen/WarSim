/**
 * Nation label curves (SPEC §8 Labels, PLAN 1.29), derived in the worker from control and sent
 * to the app (`labels` message). Per nation: a quadratic Bézier (p0, c, p2 in cells, x possibly
 * beyond the map width for components across the date line) following the mid-line of its
 * largest connected territory, the curve's length and the territory's half-thickness (cells),
 * and its area for priority. Stride LABEL_STRIDE in a Float64Array.
 */
export const LabelField = { id: 0, x0: 1, y0: 2, cx: 3, cy: 4, x2: 5, y2: 6, length: 7, thickness: 8, area: 9 } as const;
export const LABEL_STRIDE = 10;

/** Point at t on the quadratic Bézier (p0, c, p2). */
export function bezierAt(x0: number, y0: number, cx: number, cy: number, x2: number, y2: number, t: number): [number, number] {
  const u = 1 - t;
  return [u * u * x0 + 2 * u * t * cx + t * t * x2, u * u * y0 + 2 * u * t * cy + t * t * y2];
}
