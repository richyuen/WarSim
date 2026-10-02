/**
 * Deterministic scanline polygon rasterizer (even-odd rule) over a cell grid. A cell is inside
 * when its centre (x + 0.5, y + 0.5) is inside the polygon. Used offline by tools/data (land
 * mask) and at load time in the worker (admin-1 → province raster, PLAN 0.19).
 *
 * Only exact IEEE ops are used, so Node and every browser produce identical rasters.
 */

/** A polygon = one or more rings, each a flat [x0, y0, x1, y1, …] list in cell units. */
export type Rings = readonly Float64Array[];

/** Span callback: cells [x0, x1) of row y are inside. */
export type SpanFn = (y: number, x0: number, x1: number) => void;

interface Edge {
  /** First and last row (inclusive) whose centre lies within [ymin, ymax). */
  r0: number;
  r1: number;
  /** x at the centre of row r0, and dx per row. */
  x: number;
  dx: number;
}

/**
 * Calls `span` for every inside run of cells, clipped to [0, w) × [0, h). Rings may be open or
 * closed (a repeated first vertex is harmless).
 */
export function rasterizePolygon(rings: Rings, w: number, h: number, span: SpanFn): void {
  const edges: Edge[] = [];
  let rowMin = h;
  let rowMax = -1;
  for (const ring of rings) {
    const n = ring.length >> 1;
    for (let i = 0; i < n; i++) {
      const j = i + 1 === n ? 0 : i + 1;
      let xa = ring[2 * i]!;
      let ya = ring[2 * i + 1]!;
      let xb = ring[2 * j]!;
      let yb = ring[2 * j + 1]!;
      if (ya === yb) continue;
      if (ya > yb) {
        const tx = xa;
        xa = xb;
        xb = tx;
        const ty = ya;
        ya = yb;
        yb = ty;
      }
      // Rows whose centre c = r + 0.5 satisfies ya ≤ c < yb.
      let r0 = Math.ceil(ya - 0.5);
      let r1 = Math.ceil(yb - 0.5) - 1;
      if (r1 < 0 || r0 >= h || r1 < r0) continue;
      const slope = (xb - xa) / (yb - ya);
      if (r0 < 0) r0 = 0;
      if (r1 >= h) r1 = h - 1;
      edges.push({ r0, r1, x: xa + (r0 + 0.5 - ya) * slope, dx: slope });
      if (r0 < rowMin) rowMin = r0;
      if (r1 > rowMax) rowMax = r1;
    }
  }
  if (edges.length === 0) return;
  edges.sort((a, b) => a.r0 - b.r0 || a.x - b.x);

  const active: Edge[] = [];
  const xs: number[] = [];
  let next = 0;
  for (let r = rowMin; r <= rowMax; r++) {
    while (next < edges.length && edges[next]!.r0 === r) active.push(edges[next++]!);
    xs.length = 0;
    let k = 0;
    for (let i = 0; i < active.length; i++) {
      const e = active[i]!;
      if (e.r1 < r) continue;
      xs.push(e.x + (r - e.r0) * e.dx);
      active[k++] = e;
    }
    active.length = k;
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      let c0 = Math.ceil(xs[i]! - 0.5);
      let c1 = Math.ceil(xs[i + 1]! - 0.5); // exclusive
      if (c0 < 0) c0 = 0;
      if (c1 > w) c1 = w;
      if (c1 > c0) span(r, c0, c1);
    }
  }
}

/** Sets bits [x0, x1) of row y in an LSB-first row-major bitset of width w. */
export function setBits(bits: Uint8Array, w: number, y: number, x0: number, x1: number): void {
  let i = y * w + x0;
  const end = y * w + x1;
  while (i < end && (i & 7) !== 0) {
    bits[i >> 3]! |= 1 << (i & 7);
    i++;
  }
  while (i + 8 <= end) {
    bits[i >> 3] = 0xff;
    i += 8;
  }
  while (i < end) {
    bits[i >> 3]! |= 1 << (i & 7);
    i++;
  }
}

export function getBit(bits: Uint8Array, w: number, x: number, y: number): boolean {
  const i = y * w + x;
  return ((bits[i >> 3]! >> (i & 7)) & 1) === 1;
}
