/**
 * The fine land mask (SPEC §3.1): one bit a pixel, 1 = land, row-major, the lowest bit of a
 * byte first; 16384 × 8192 for the Earth, 8 px to a cell of the M map. The sim (where a
 * formation and its elements stand: PLAN 2.9a), the renderer (the coast of T2 and T3) and the
 * tests read it through this module, so that "land at (x, y)" has one meaning.
 *
 * **The convention:** a point is on land when the bit of the mask pixel that holds it is set
 * (`maskLand`). The coast runs along pixel edges.
 *
 * **The drawn coast** (PLAN 2.9b) is that coast made a shore: `maskField` blends the four
 * pixels round a place, 1 where they are all land and 0 where none is, and the map's shader
 * (`mapShader.ts`, the same blend) draws land where it is over a half, after moving the line by
 * a noise of at most `SHORE_NOISE` × 4f(1 − f). So the picture can say other than the bit,
 * inside the squares where the four pixels differ, and nowhere else.
 *
 * **Surely land** (`maskSure`): the field is `SURE_LAND` or more. Such a place is in a land
 * pixel (with its own pixel water the field is 0.75 at most) and is drawn as land whatever the
 * noise (0.85 − 0.35 × 4 × 0.85 × 0.15 = 0.67, over a half). It is where a formation and its
 * elements stand, and where a tree does.
 */
export interface LandMask {
  w: number;
  h: number;
  bits: Uint8Array;
}

/** The mask's bit at pixel (`px`, `py`); outside its rows there is no land. `px` is taken as it is: wrap it first. */
export function maskBit(mask: LandMask, px: number, py: number): boolean {
  if (py < 0 || py >= mask.h || px < 0 || px >= mask.w) return false;
  const i = py * mask.w + px;
  return ((mask.bits[i >> 3]! >> (i & 7)) & 1) === 1;
}

/**
 * Whether (`x`, `y`), in cells of a map `mapW` × `mapH` cells wide and high, is on land. On a
 * map that loops (`wrapX`) x is taken modulo its width; on one that does not, there is no land
 * beyond its edges.
 */
export function maskLand(mask: LandMask, mapW: number, mapH: number, x: number, y: number, wrapX: boolean): boolean {
  let px = Math.floor((x * mask.w) / mapW);
  if (wrapX) px = ((px % mask.w) + mask.w) % mask.w;
  return maskBit(mask, px, Math.floor((y * mask.h) / mapH));
}

/**
 * How far the drawn shore's noise can move the field, at a half (the shader takes it from
 * here). `SURE_LAND` is safe for this much and no more: a larger noise needs a larger margin,
 * and the unit test of the two holds them together.
 */
export const SHORE_NOISE = 0.35;
/** The least of `maskField` at which a place is land in the mask and in every picture of it. */
export const SURE_LAND = 0.85;

/**
 * How much land the four mask pixels round (`x`, `y`) hold, 0–1: their bits blended by how near
 * each pixel's middle is. At a pixel's middle it is that pixel's bit; on the edge between a
 * land pixel and a water pixel it is a half. Sums and products of doubles only: every engine
 * gives the same number.
 */
export function maskField(mask: LandMask, mapW: number, mapH: number, x: number, y: number, wrapX: boolean): number {
  const mx = (x * mask.w) / mapW - 0.5;
  const my = (y * mask.h) / mapH - 0.5;
  const x0 = Math.floor(mx);
  const y0 = Math.floor(my);
  const tx = mx - x0;
  const ty = my - y0;
  const at = (px: number, py: number): number => (maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py) ? 1 : 0);
  return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
}

/**
 * Whether cell (`cx`, `cy`) is inland: its mask pixels and the ring of pixels round them are
 * all land. Every place in such a cell is surely land (the four pixels round any of them are
 * among those), so who asks often can ask this once for a cell and remember it.
 */
export function cellInland(mask: LandMask, mapW: number, cx: number, cy: number, wrapX: boolean): boolean {
  const k = Math.round(mask.w / mapW);
  for (let py = cy * k - 1; py <= cy * k + k; py++) {
    for (let px = cx * k - 1; px <= cx * k + k; px++) {
      if (!maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py)) return false;
    }
  }
  return true;
}

/** Whether (`x`, `y`) is surely land: in a land pixel of the mask, and land in the picture drawn from it. */
export function maskSure(mask: LandMask, mapW: number, mapH: number, x: number, y: number, wrapX: boolean): boolean {
  return maskField(mask, mapW, mapH, x, y, wrapX) >= SURE_LAND;
}

/**
 * The land point of cell (`cx`, `cy`) of a map `mapW` cells wide: the middle of the mask pixel of that cell that is
 * furthest from water, in cells; null when the cell has no land pixel. A formation that would
 * stand on water takes it (PLAN 2.9a): it is where a block of elements has most room.
 *
 * - Distance is to the nearest water pixel within a cell's width of the cell (beyond that the
 *   answer would not change which pixel wins by enough to matter, and the cost stays small).
 * - Ties go to the pixel nearest the cell's middle, then to the first in row order: whole
 *   numbers throughout, so every engine gives the same point.
 */
export function landPoint(mask: LandMask, mapW: number, cx: number, cy: number, wrapX: boolean): [number, number] | null {
  const k = Math.round(mask.w / mapW); // mask pixels to a cell
  const x0 = cx * k;
  const y0 = cy * k;
  const at = (px: number, py: number): boolean => maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py);
  let best = -1;
  let bestMid = 0;
  let bx = 0;
  let by = 0;
  for (let py = y0; py < y0 + k; py++) {
    for (let px = x0; px < x0 + k; px++) {
      if (!at(px, py)) continue;
      // The square of the distance to the nearest water pixel in the window, in pixels.
      let near = 2 * k * k + 1;
      for (let qy = y0 - k; qy < y0 + 2 * k && near > 1; qy++) {
        for (let qx = x0 - k; qx < x0 + 2 * k; qx++) {
          if (at(qx, qy)) continue;
          const d = (qx - px) * (qx - px) + (qy - py) * (qy - py);
          if (d < near) near = d;
        }
      }
      // Twice the distance from the cell's middle, squared, in half pixels: whole numbers.
      const mid = (2 * (px - x0) + 1 - k) ** 2 + (2 * (py - y0) + 1 - k) ** 2;
      if (near > best || (near === best && mid < bestMid)) {
        best = near;
        bestMid = mid;
        bx = px;
        by = py;
      }
    }
  }
  if (best < 0) return null;
  return [(bx + 0.5) / k, (by + 0.5) / k];
}

/**
 * Gives cell (`cx`, `cy`) of a map `mapW` cells wide an islet where the mask has no land pixel
 * in it: the cell's pixels but for its corners, cut a quarter of the cell deep (rows of 4, 6
 * and 8 pixels on the M map, 52 of the 64). True when the mask changed; a cell with any land
 * pixel is left alone, so a second call changes nothing.
 *
 * It is for land the game has and the mask's source is too coarse to show (an atoll that the
 * scenario owns: PLAN 2.15e2b, ADR-105). Every reader of the mask takes it for land: the
 * cell's middle is surely land (the four pixels round it), a formation's elements have the
 * width of a cell to stand on, and each quarter of the cell is more than half land (13 of 16),
 * which is what the coverage drawn at T0 and T1 asks (`buildLandCoverage` at two texels to a
 * cell). Smaller, it was a square speck at T1 (6 × 6: 9 of 16) or nothing (4 × 4).
 */
export function addIslet(mask: LandMask, mapW: number, cx: number, cy: number): boolean {
  const k = Math.round(mask.w / mapW);
  const x0 = cx * k;
  const y0 = cy * k;
  for (let py = y0; py < y0 + k; py++) {
    for (let px = x0; px < x0 + k; px++) if (maskBit(mask, px, py)) return false;
  }
  const cut = Math.floor(k / 4);
  for (let r = 0; r < k; r++) {
    const inset = Math.max(0, cut - Math.min(r, k - 1 - r));
    for (let px = x0 + inset; px < x0 + k - inset; px++) {
      const i = (y0 + r) * mask.w + px;
      mask.bits[i >> 3] = mask.bits[i >> 3]! | (1 << (i & 7));
    }
  }
  return true;
}

/**
 * Whether the straight line from (`x0`, `y0`) to (`x1`, `y1`), in mask pixels (x left as it
 * is: beyond the seam of a map that loops it is folded here), is clear of water: each square
 * between four pixels' middles that it passes through has its four pixels land. Every place of
 * such a line is surely land, and its field is 1. It says no to some lines that are surely
 * land all the same (one along a spit a pixel wide): who asks takes another way then. With
 * `open`, a pixel counts as land only where that says so too (`px` as it is, not folded).
 */
export function lineClear(mask: LandMask, x0: number, y0: number, x1: number, y1: number, wrapX: boolean, open?: (px: number, py: number) => boolean): boolean {
  const at = (px: number, py: number): boolean => maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py) && (open === undefined || open(px, py));
  const ux = x0 - 0.5;
  const uy = y0 - 0.5;
  const dx = x1 - x0;
  const dy = y1 - y0;
  // Where the line passes from one square to the next; between two of these it is in one.
  const ts = [0, 1];
  if (dx !== 0) for (let g = Math.ceil(Math.min(ux, ux + dx)); g <= Math.floor(Math.max(ux, ux + dx)); g++) ts.push((g - ux) / dx);
  if (dy !== 0) for (let g = Math.ceil(Math.min(uy, uy + dy)); g <= Math.floor(Math.max(uy, uy + dy)); g++) ts.push((g - uy) / dy);
  ts.sort((a, b) => a - b);
  for (let i = 0; i + 1 < ts.length; i++) {
    const t0 = ts[i]!;
    const t1 = ts[i + 1]!;
    if (t0 < 0 || t1 > 1 || t0 === t1) continue;
    const t = (t0 + t1) / 2;
    const sx = Math.floor(ux + dx * t);
    const sy = Math.floor(uy + dy * t);
    if (!at(sx, sy) || !at(sx + 1, sy) || !at(sx, sy + 1) || !at(sx + 1, sy + 1)) return false;
  }
  return true;
}

/** How far beyond the box of a step's two cells its way over land is looked for, in cells, where `landWay` is told which cells are open. */
export const WAY_MARGIN_CELLS = 1;

/**
 * The way over land from the place `a` to the place `b` (in cells of a map `mapW` wide; `b`
 * unfolded, at most a few cells from `a`), where the straight line between them is not clear
 * of water (`lineClear`): the corners of a line over land pixels, x and y by turns, from `a`
 * to `b`, x unfolded as `b` is. Null where the straight line is clear, and where the mask has
 * no land way between the two in the cells it may use: the straight line is the way then
 * (`found` says which of the two it was).
 *
 * A march takes it for a step between two cells' points (PLAN 4.1d2): the straight line went
 * over a bay.
 *
 * - **The cells of a way.** The box of the two cells: the two of a step east-west or
 *   north-south, the four of a diagonal one (the straight line between two points off their
 *   cells' middles passes those too). With `open`, also a cell within `WAY_MARGIN_CELLS` of
 *   that box that `open` says yes to (cell x folded onto the map, y as it is). A formation is
 *   in the cell its place is in: with every cell of the margin taken, a way led through a
 *   cell that is water on the cell grid and has land pixels, which no route enters (three of
 *   the gate's ten-year games had a formation in one).
 * - Each place is a mask pixel's middle (a cell's land point) or a corner of four land pixels
 *   (a cell's middle); one that is neither has no way.
 * - The search goes pixel by pixel, 8-way, with no corner of water cut: the field is 1 all
 *   along such a line, so every place of it is surely land. Costs are whole numbers (10 a
 *   step, 14 a diagonal one, 7 from a corner to a pixel's middle), the pixels of a cost are
 *   taken in the order they were reached and a pixel's neighbours in row order: every engine
 *   finds the same way.
 * - Then the corners that a clear straight line makes needless are left out, from `a` on, each
 *   time to the furthest corner that can be seen; such a line keeps to the way's cells too.
 */
export function landWay(mask: LandMask, mapW: number, a: readonly [number, number], b: readonly [number, number], wrapX: boolean, found?: { clear: boolean }, open?: (cx: number, cy: number) => boolean): Float64Array | null {
  const k = Math.round(mask.w / mapW);
  const [ax, ay, bx, by] = [a[0] * k, a[1] * k, b[0] * k, b[1] * k];
  const clear = lineClear(mask, ax, ay, bx, by, wrapX);
  if (found) found.clear = clear;
  if (clear) return null;
  // The two cells' box, in cells; and the pixels of a way: land, in the box or in an open cell beside it.
  const [cx0, cy0, cx1, cy1] = [Math.floor(Math.min(a[0], b[0])), Math.floor(Math.min(a[1], b[1])), Math.floor(Math.max(a[0], b[0])), Math.floor(Math.max(a[1], b[1]))];
  const cells = new Map<number, boolean>();
  const mayUse = (px: number, py: number): boolean => {
    const cx = Math.floor(px / k);
    const cy = Math.floor(py / k);
    if (cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) return true;
    if (!open) return false;
    const key = (cy - cy0 + 1) * 8 + (cx - cx0 + 1);
    let ok = cells.get(key);
    if (ok === undefined) cells.set(key, (ok = open(wrapX ? ((cx % mapW) + mapW) % mapW : cx, cy)));
    return ok;
  };
  const at = (px: number, py: number): boolean => maskBit(mask, wrapX ? ((px % mask.w) + mask.w) % mask.w : px, py) && mayUse(px, py);
  const m = open ? WAY_MARGIN_CELLS * k : 0;
  const X0 = cx0 * k - m;
  const Y0 = cy0 * k - m;
  const bw = (cx1 + 1) * k + m - X0;
  const bh = (cy1 + 1) * k + m - Y0;
  // The pixels a place is reached from, with the cost from it: its own, or the four round a corner.
  const ends = (x0: number, y0: number): [number, number][] => {
    // (To the half pixel: with a number of pixels to a cell that is no power of two, a pixel's middle is not exact.)
    const x = Math.round(x0 * 2) / 2;
    const y = Math.round(y0 * 2) / 2;
    const fx = Math.floor(x);
    const fy = Math.floor(y);
    const out: [number, number][] = [];
    if (Math.abs(x - x0) > 1e-9 || Math.abs(y - y0) > 1e-9) return out;
    if (x === fx && y === fy) {
      for (const [px, py] of [[fx - 1, fy - 1], [fx, fy - 1], [fx - 1, fy], [fx, fy]] as const) if (at(px, py)) out.push([(py - Y0) * bw + (px - X0), 7]);
    } else if (x - fx === 0.5 && y - fy === 0.5 && at(fx, fy)) out.push([(fy - Y0) * bw + (fx - X0), 0]);
    return out;
  };
  const INF = 0x7fffffff;
  const dist = new Int32Array(bw * bh).fill(INF);
  const prev = new Int32Array(bw * bh).fill(-1);
  const buckets: number[][] = [];
  const put = (v: number, d: number, from: number): void => {
    if (d >= dist[v]!) return;
    dist[v] = d;
    prev[v] = from;
    (buckets[d] ??= []).push(v);
  };
  for (const [v, d] of ends(ax, ay)) put(v, d, -1);
  const goal = new Map(ends(bx, by));
  let best = INF;
  let last = -1;
  for (let d = 0; d < buckets.length && d < best; d++) {
    const row = buckets[d];
    if (!row) continue;
    for (let i = 0; i < row.length; i++) {
      const u = row[i]!;
      if (dist[u] !== d) continue;
      const over = goal.get(u);
      if (over !== undefined && d + over < best) {
        best = d + over;
        last = u;
      }
      const ux = u % bw;
      const uy = (u - ux) / bw;
      for (let sy = -1; sy <= 1; sy++) {
        for (let sx = -1; sx <= 1; sx++) {
          const vx = ux + sx;
          const vy = uy + sy;
          if ((sx === 0 && sy === 0) || vx < 0 || vy < 0 || vx >= bw || vy >= bh || !at(vx + X0, vy + Y0)) continue;
          if (sx !== 0 && sy !== 0 && (!at(vx + X0, uy + Y0) || !at(ux + X0, vy + Y0))) continue;
          put(vy * bw + vx, d + (sx !== 0 && sy !== 0 ? 14 : 10), u);
        }
      }
    }
  }
  if (last < 0) return null;
  // From b back to a, in pixels; then forward, leaving out the corners a clear line passes.
  const line: number[] = [by, bx];
  for (let u = last; u >= 0; u = prev[u]!) line.push(Math.floor(u / bw) + Y0 + 0.5, (u % bw) + X0 + 0.5);
  line.push(ay, ax);
  line.reverse();
  const out: number[] = [];
  const n = line.length / 2;
  for (let i = 0; i < n; ) {
    // (A place that is a pixel's middle is also the first pixel of the way.)
    const x = line[2 * i]! / k;
    const y = line[2 * i + 1]! / k;
    if (out.length === 0 || out[out.length - 2] !== x || out[out.length - 1] !== y) out.push(x, y);
    if (i === n - 1) break;
    let j = n - 1;
    while (j > i + 1 && !lineClear(mask, line[2 * i]!, line[2 * i + 1]!, line[2 * j]!, line[2 * j + 1]!, wrapX, mayUse)) j--;
    i = j;
  }
  return Float64Array.from(out);
}
