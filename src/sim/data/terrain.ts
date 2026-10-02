/**
 * Terrain helpers shared by the data pipeline and the sim (PLAN 1.2, SPEC §3.2).
 *
 * The shipped `terrain-<w>x<h>.u8.wsz` raster holds the derived base classes (no crossings).
 * Crossings are data (`data/maps/<map>/straits.json`): AoC-style walkable lanes painted over
 * water. They are applied at load time, so editing the straits list needs no asset rebuild.
 */
import { Terrain } from '../../shared/terrain';
import { project } from './projection';

export interface StraitDef {
  id: string;
  nameKey: string;
  /** [lon, lat] of a point on each shore. */
  a: readonly [number, number];
  b: readonly [number, number];
}

/** Cell coordinates (fractional) of a lon/lat point on a w×h map. */
export function cellOf(lon: number, lat: number, w: number, h: number): [number, number] {
  const [u, v] = project(lon, lat);
  return [u * w, v * h];
}

/**
 * Cells crossed by the segment (x0,y0)→(x1,y1) in cell units, in order, as a 4-connected path
 * (Amanatides–Woo grid traversal). x wraps; the caller picks the short way across the date line.
 */
export function segmentCells(x0: number, y0: number, x1: number, y1: number, w: number, h: number): number[] {
  const clampY = (y: number): number => Math.min(h - 1e-9, Math.max(0, y));
  y0 = clampY(y0);
  y1 = clampY(y1);
  let cx = Math.floor(x0);
  let cy = Math.floor(y0);
  const ex = Math.floor(x1);
  const ey = Math.floor(y1);
  const dx = x1 - x0;
  const dy = y1 - y0;
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  const tdx = dx === 0 ? Infinity : Math.abs(1 / dx);
  const tdy = dy === 0 ? Infinity : Math.abs(1 / dy);
  let tx = dx === 0 ? Infinity : (dx > 0 ? cx + 1 - x0 : x0 - cx) * tdx;
  let ty = dy === 0 ? Infinity : (dy > 0 ? cy + 1 - y0 : y0 - cy) * tdy;
  const wrap = (x: number): number => ((x % w) + w) % w;
  const out = [cy * w + wrap(cx)];
  for (let guard = 0; (cx !== ex || cy !== ey) && guard < 4 * (w + h); guard++) {
    if (tx < ty) {
      cx += sx;
      tx += tdx;
    } else {
      cy += sy;
      ty += tdy;
    }
    out.push(cy * w + wrap(cx));
  }
  return out;
}

/** How far (cells) a strait segment is extended past each shore point to find land. */
export const STRAIT_EXTEND_CELLS = 4;

/**
 * The cells of a strait at w×h: the segment a→b extended by STRAIT_EXTEND_CELLS at both ends,
 * so shore points that fall in mostly-water cells at coarse sizes still reach land.
 */
export function straitPath(s: StraitDef, w: number, h: number): number[] {
  const [ax, ay] = cellOf(s.a[0], s.a[1], w, h);
  const [bx0, by] = cellOf(s.b[0], s.b[1], w, h);
  let bx = bx0;
  if (bx - ax > w / 2) bx -= w;
  else if (ax - bx > w / 2) bx += w;
  const len = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay));
  const ex = len === 0 ? 0 : ((bx - ax) / len) * STRAIT_EXTEND_CELLS;
  const ey = len === 0 ? 0 : ((by - ay) / len) * STRAIT_EXTEND_CELLS;
  return segmentCells(ax - ex, ay - ey, bx + ex, by + ey, w, h);
}

export interface CrossingResult {
  id: string;
  /** Water cells turned into crossings. */
  cells: number;
  /** True when the strait links land on both halves of its path (always true once applied). */
  linked: boolean;
}

/**
 * Paints each strait's water cells between its first and last land cell as Terrain.Crossing
 * (in place). A strait links land only if land exists on both halves of its (symmetric) path.
 */
export function applyCrossings(terrain: Uint8Array, w: number, h: number, straits: readonly StraitDef[]): CrossingResult[] {
  return straits.map((s) => {
    const path = straitPath(s, w, h);
    const land = (i: number): boolean => terrain[path[i]!]! >= Terrain.Plains;
    let i0 = 0;
    while (i0 < path.length && !land(i0)) i0++;
    let i1 = path.length - 1;
    while (i1 >= 0 && !land(i1)) i1--;
    const mid = path.length >> 1;
    if (!(i0 < mid && i1 >= mid)) return { id: s.id, cells: 0, linked: false };
    let cells = 0;
    for (let i = i0; i <= i1; i++) {
      const c = path[i]!;
      if (terrain[c] === Terrain.Water) {
        terrain[c] = Terrain.Crossing;
        cells++;
      }
    }
    return { id: s.id, cells, linked: true };
  });
}

/** Decodes a shipped terrain raster and applies the map's crossings. */
export function loadTerrain(raw: Uint8Array, w: number, h: number, straits: readonly StraitDef[]): { terrain: Uint8Array; crossings: CrossingResult[] } {
  if (raw.length !== w * h) throw new Error(`terrain raster is ${raw.length} bytes, expected ${w}×${h}`);
  const terrain = new Uint8Array(raw);
  return { terrain, crossings: applyCrossings(terrain, w, h, straits) };
}
