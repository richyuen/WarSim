/**
 * Nation label curves (SPEC §8, PLAN 1.29), derived from the controller layer (not sim state).
 *
 * Per nation, the 4-connected component holding its capital (when ≥ MIN_CELLS, else its largest;
 * x unwrapped across the date line during the flood) gives a principal axis (PCA, read left to right). Along it, the robust extent [5%, 95%]
 * of the projected cells has length L; the mean perpendicular offsets of the cells near 10%, 50%
 * and 90% of it give three mid-line points, and the quadratic Bézier through them (control
 * c = 2·p1 − (p0 + p2)/2) is the label's baseline. Half-thickness = 1.2 × the perpendicular
 * standard deviation. Components under MIN_CELLS get no label. Cost: one flood over all
 * controlled cells (~40 ms at M), so the worker recomputes at most every few seconds.
 */

export const MIN_CELLS = 24;

export function deriveNationLabels(controller: Uint16Array, w: number, h: number, wrapX: boolean, capitals: ReadonlyMap<number, number> = new Map()): Float64Array {
  const n = w * h;
  const comp = new Int32Array(n).fill(-1);
  const ux = new Float64Array(n); // unwrapped x of each cell in its component
  // Per nation, the largest component: [nation] → {start, size}.
  const best = new Map<number, { start: number; size: number }>();
  const stack: number[] = [];
  let next = 0;
  for (let s = 0; s < n; s++) {
    const id = controller[s]!;
    if (id === 0 || comp[s] !== -1) continue;
    let size = 0;
    comp[s] = next;
    ux[s] = s % w;
    stack.push(s);
    while (stack.length) {
      const c = stack.pop()!;
      size++;
      const x = c % w;
      const y = (c - x) / w;
      const nb: [number, number][] = [];
      if (y > 0) nb.push([c - w, ux[c]!]);
      if (y < h - 1) nb.push([c + w, ux[c]!]);
      if (x > 0) nb.push([c - 1, ux[c]! - 1]);
      else if (wrapX) nb.push([c + w - 1, ux[c]! - 1]);
      if (x < w - 1) nb.push([c + 1, ux[c]! + 1]);
      else if (wrapX) nb.push([c - w + 1, ux[c]! + 1]);
      for (const [m, mx] of nb) {
        if (comp[m] !== -1 || controller[m] !== id) continue;
        comp[m] = next;
        ux[m] = mx;
        stack.push(m);
      }
    }
    const b = best.get(id);
    if (!b || size > b.size) best.set(id, { start: s, size });
    next++;
  }
  // The labelled component: the one holding the capital when it is big enough (France's name
  // belongs on France, not on Algeria), else the largest.
  const sizeOf = new Map<number, number>();
  for (let c = 0; c < n; c++) if (comp[c]! >= 0) sizeOf.set(comp[c]!, (sizeOf.get(comp[c]!) ?? 0) + 1);
  const bestComp = new Map<number, number>();
  for (const [id, { start, size }] of best) {
    const cap = capitals.get(id);
    const capComp = cap !== undefined && controller[cap] === id ? comp[cap]! : -1;
    if (capComp >= 0 && (sizeOf.get(capComp) ?? 0) >= MIN_CELLS) bestComp.set(id, capComp);
    else if (size >= MIN_CELLS) bestComp.set(id, comp[start]!);
  }
  // One pass: gather each nation's cells in its labelled component.
  const xs = new Map<number, number[]>();
  const ys = new Map<number, number[]>();
  for (let c = 0; c < n; c++) {
    const id = controller[c]!;
    if (id === 0 || bestComp.get(id) !== comp[c]) continue;
    let ax = xs.get(id);
    let ay = ys.get(id);
    if (!ax || !ay) {
      xs.set(id, (ax = []));
      ys.set(id, (ay = []));
    }
    ax.push(ux[c]! + 0.5);
    ay.push(Math.floor(c / w) + 0.5);
  }
  const out: number[] = [];
  for (const id of [...bestComp.keys()].sort((a, b) => a - b)) {
    const label = labelOf(xs.get(id)!, ys.get(id)!);
    if (label) out.push(id, ...label, xs.get(id)!.length);
  }
  return Float64Array.from(out);
}

/** [x0, y0, cx, cy, x2, y2, length, thickness] for a cell set, or null when degenerate. */
function labelOf(xs: number[], ys: number[]): number[] | null {
  const m = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < m; i++) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= m;
  my /= m;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < m; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  let ux = Math.cos(theta);
  let uy = Math.sin(theta);
  if (ux < 0) {
    ux = -ux;
    uy = -uy;
  }
  const vx = -uy;
  const vy = ux;
  const t = new Float64Array(m);
  const s = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    t[i] = dx * ux + dy * uy;
    s[i] = dx * vx + dy * vy;
  }
  const sorted = Float64Array.from(t).sort();
  const lo = sorted[Math.floor(0.05 * (m - 1))]!;
  const hi = sorted[Math.floor(0.95 * (m - 1))]!;
  const L = hi - lo;
  if (L < 3) return null;
  let s2 = 0;
  for (let i = 0; i < m; i++) s2 += s[i]! * s[i]!;
  const thickness = 1.2 * Math.sqrt(s2 / m);
  const at = (frac: number): [number, number] => {
    const ti = lo + frac * L;
    let sum = 0;
    let cnt = 0;
    for (let i = 0; i < m; i++) {
      if (Math.abs(t[i]! - ti) < L / 10) {
        sum += s[i]!;
        cnt++;
      }
    }
    const si = cnt > 0 ? sum / cnt : 0;
    return [mx + ti * ux + si * vx, my + ti * uy + si * vy];
  };
  const p0 = at(0.1);
  const p1 = at(0.5);
  const p2 = at(0.9);
  const cx = 2 * p1[0] - 0.5 * (p0[0] + p2[0]);
  const cy = 2 * p1[1] - 0.5 * (p0[1] + p2[1]);
  return [p0[0], p0[1], cx, cy, p2[0], p2[1], 0.8 * L, thickness];
}

