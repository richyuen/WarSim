/**
 * The order line of a fleet under way (PLAN 4.7d): its way left, from where it stands, by the
 * cells of its path, cut down to the points the line turns at. A path over the sea is a walk of
 * neighbouring cells; drawn as it is, its stairs show, and drawn straight to the target, it
 * crosses the land between (Gibraltar to Suez, over Africa).
 */

/** How far, in cells, the line may pass from a cell of the path it leaves out. */
export const WAY_TOLERANCE = 0.75;

/**
 * The points of the line, `x, y` in cells by twos: (`x`, `y`) first, then the middles of the
 * cells `path[from + 1]` to its last, as few as keep every cell within `tol` of the line.
 * On a map that loops each point is on the near side of the one before it (x may leave 0…w).
 */
export function wayLine(x: number, y: number, path: ArrayLike<number>, from: number, w: number, wrapX: boolean, tol = WAY_TOLERANCE): number[] {
  const pts: number[] = [x, y];
  for (let i = Math.max(0, from + 1); i < path.length; i++) {
    let px = (path[i]! % w) + 0.5;
    const py = Math.floor(path[i]! / w) + 0.5;
    if (wrapX) {
      const prev = pts[pts.length - 2]!;
      while (px - prev > w / 2) px -= w;
      while (prev - px > w / 2) px += w;
    }
    pts.push(px, py);
  }
  return simplify(pts, tol);
}

/** Ramer–Douglas–Peucker over `x, y` pairs: the first and last points kept. */
function simplify(pts: number[], tol: number): number[] {
  const n = pts.length / 2;
  if (n <= 2) return pts;
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length > 0) {
    const [a, b] = stack.pop()!;
    const [ax, ay, bx, by] = [pts[2 * a]!, pts[2 * a + 1]!, pts[2 * b]!, pts[2 * b + 1]!];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    let far = -1;
    let most = tol;
    for (let i = a + 1; i < b; i++) {
      const px = pts[2 * i]! - ax;
      const py = pts[2 * i + 1]! - ay;
      const d = len > 0 ? Math.abs(px * dy - py * dx) / len : Math.hypot(px, py);
      if (d > most) {
        most = d;
        far = i;
      }
    }
    if (far >= 0) {
      keep[far] = 1;
      stack.push([a, far], [far, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[2 * i]!, pts[2 * i + 1]!);
  return out;
}
