/**
 * Where the trees, the rocks and the buildings of T2 and T3 stand (PLAN 2.8c, ADR-78): a scatter
 * seeded by the place. Pure and DOM-free; `GroundInstances` draws what it gives.
 *
 * **A nested lattice.** Level l has 2^l lattice points to a cell, and each point of a level is
 * a point of every finer level. An instance belongs to the coarsest level its point is on, and
 * stands near that point, moved by a hash of the point: so it stands at one place whatever the
 * zoom. A view shows the levels whose points are at least `SPACING_PX` apart on screen, and the
 * next finer one comes in by its opacity through the upper half of the octave of zoom before
 * its points are that far apart. Zooming in adds instances between those that are there and
 * moves none; nothing appears at once.
 *
 * **What stands at a point** is a matter of the ground there: buildings by how near a city is
 * and how large; else trees and rocks by the terrain class of the cell. Nothing stands on
 * water: by the cell's class and, where the fine coast is known, by its land coverage.
 *
 * **Its size** is a symbol's at T2, a few px that stand for "wood here" or "town here", and the
 * thing's own once the zoom shows it larger than that (a crown of 9 m is 9 px at 1 m/px).
 */
import { Terrain } from '../../shared/terrain';
import { hash2, pair } from '../hash';

export const ScatterKind = { Tree: 0, Rock: 1, Building: 2 } as const;

/** The least distance on screen between the lattice points of a level that is shown in full, CSS px. */
export const SPACING_PX = 14;
/** How far from its lattice point an instance may stand, as a share of its level's spacing. */
const JITTER = 0.35;
/** Floats to an instance: x and y from the view's centre (CSS px), size (CSS px), kind, opacity, variant (0–1). */
export const SCATTER_STRIDE = 6;

/** By terrain class: the chance that a lattice point has a tree, and a rock. */
const COVER: Record<number, { tree: number; rock: number }> = {
  [Terrain.Water]: { tree: 0, rock: 0 },
  [Terrain.Crossing]: { tree: 0, rock: 0 },
  [Terrain.Plains]: { tree: 0.05, rock: 0 },
  [Terrain.Grassland]: { tree: 0.04, rock: 0 },
  [Terrain.Forest]: { tree: 0.75, rock: 0 },
  [Terrain.Hills]: { tree: 0.12, rock: 0.1 },
  [Terrain.Mountains]: { tree: 0.08, rock: 0.42 },
  [Terrain.Desert]: { tree: 0, rock: 0.05 },
  [Terrain.Tundra]: { tree: 0.02, rock: 0.04 },
  [Terrain.Marsh]: { tree: 0.07, rock: 0 },
  [Terrain.Urban]: { tree: 0.04, rock: 0 },
  [Terrain.Ice]: { tree: 0, rock: 0 },
};

/** By kind: the size of its symbol (CSS px) and of the thing (m). */
const SIZE: Record<number, { px: number; m: number }> = {
  [ScatterKind.Tree]: { px: 7, m: 9 },
  [ScatterKind.Rock]: { px: 6, m: 5 },
  [ScatterKind.Building]: { px: 7, m: 14 },
};

/** How far a city's buildings reach, km, by its size (1 town … 5 metropolis). */
const CITY_REACH_KM = [0, 3, 5, 8, 12, 18];
/** The chance of a building at a city's very middle. */
const CITY_DENSITY = 0.85;

/** The cities, by the cells their buildings reach. */
export interface CityIndex {
  w: number;
  x: Float64Array;
  y: Float64Array;
  /** Reach in cells. */
  reach: Float64Array;
  byCell: Map<number, number[]>;
}

export function cityIndex(cities: readonly { x: number; y: number; size: number }[], w: number, h: number, kmPerCell: number): CityIndex {
  const idx: CityIndex = { w, x: new Float64Array(cities.length), y: new Float64Array(cities.length), reach: new Float64Array(cities.length), byCell: new Map() };
  cities.forEach((c, k) => {
    const reach = CITY_REACH_KM[Math.max(0, Math.min(5, Math.round(c.size)))]! / kmPerCell;
    idx.x[k] = c.x;
    idx.y[k] = c.y;
    idx.reach[k] = reach;
    for (let cy = Math.max(0, Math.floor(c.y - reach)); cy <= Math.min(h - 1, Math.floor(c.y + reach)); cy++) {
      for (let cx = Math.max(0, Math.floor(c.x - reach)); cx <= Math.min(w - 1, Math.floor(c.x + reach)); cx++) {
        const key = cy * w + cx;
        const list = idx.byCell.get(key);
        if (list) list.push(k);
        else idx.byCell.set(key, [k]);
      }
    }
  });
  return idx;
}

/** The chance of a building at (`x`, `y`): most at a city's middle, none beyond its reach. */
export function cityDensity(idx: CityIndex, x: number, y: number): number {
  const list = idx.byCell.get(Math.floor(y) * idx.w + Math.floor(x));
  if (!list) return 0;
  let best = 0;
  for (const k of list) {
    const d = Math.hypot(x - idx.x[k]!, y - idx.y[k]!) / idx.reach[k]!;
    if (d < 1) best = Math.max(best, CITY_DENSITY * (1 - d) ** 1.3);
  }
  return best;
}

export interface ScatterWorld {
  w: number;
  h: number;
  wrapX: boolean;
  kmPerCell: number;
  /** Terrain class of each cell. */
  terrain: Uint8Array;
  /** The fine land coverage (0–255 a texel, `LandCoverage`), or null: the coast follows the cells. */
  land: { w: number; h: number; data: Uint8Array } | null;
  cities: CityIndex;
}

/** A view: its centre and half its size in cells, and CSS px to a cell. */
export interface ScatterView {
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  pxPerCell: number;
}

export interface Scatter {
  count: number;
  /** `count` × SCATTER_STRIDE floats, the instances of the coarser levels first. */
  data: Float32Array;
  /** The finest level shown in full. */
  level: number;
  /** There were more than the cap. */
  truncated: boolean;
}

/** Whether (`x`, `y`) is land by the fine coverage, with a margin: an instance does not stand on the coast line. */
function onLand(land: { w: number; h: number; data: Uint8Array }, world: ScatterWorld, x: number, y: number): boolean {
  const u = (x * land.w) / world.w - 0.5;
  const v = (y * land.h) / world.h - 0.5;
  const u0 = Math.floor(u);
  const v0 = Math.floor(v);
  const fu = u - u0;
  const fv = v - v0;
  const at = (ix: number, iy: number): number => {
    const cx = world.wrapX ? ((ix % land.w) + land.w) % land.w : Math.min(land.w - 1, Math.max(0, ix));
    return land.data[Math.min(land.h - 1, Math.max(0, iy)) * land.w + cx]!;
  };
  const cov = (at(u0, v0) * (1 - fu) + at(u0 + 1, v0) * fu) * (1 - fv) + (at(u0, v0 + 1) * (1 - fu) + at(u0 + 1, v0 + 1) * fu) * fv;
  return cov > 0.55 * 255;
}

/**
 * The instances of `view`, at most `cap`. `out` is reused when it is large enough.
 */
export function scatter(world: ScatterWorld, view: ScatterView, cap: number, out?: Float32Array): Scatter {
  const data = out && out.length >= cap * SCATTER_STRIDE ? out : new Float32Array(cap * SCATTER_STRIDE);
  const f = Math.log2(view.pxPerCell / SPACING_PX);
  const level = Math.max(0, Math.floor(f));
  // The next finer level, on its way in through the upper half of the octave.
  const t = Math.min(1, Math.max(0, (f - level - 0.5) / 0.5));
  const fade = f < 0 ? 0 : t * t * (3 - 2 * t);
  const mPerPx = (world.kmPerCell * 1000) / view.pxPerCell;
  // A margin of a symbol's width: what stands just outside the view reaches into it.
  const margin = 16 / view.pxPerCell;
  const [x0, x1, y0, y1] = [view.cx - view.halfW - margin, view.cx + view.halfW + margin, view.cy - view.halfH - margin, view.cy + view.halfH + margin];
  let count = 0;
  let truncated = false;

  for (let l = 0; l <= level + (fade > 0 ? 1 : 0) && !truncated; l++) {
    const n = 2 ** l; // lattice points to a cell
    const alpha = l <= level ? 1 : fade;
    const period = world.w * n;
    const [i0, i1] = [Math.floor(x0 * n - JITTER), Math.ceil(x1 * n + JITTER)];
    const [j0, j1] = [Math.max(0, Math.floor(y0 * n - JITTER)), Math.min(world.h * n, Math.ceil(y1 * n + JITTER))];
    for (let j = j0; j <= j1 && !truncated; j++) {
      for (let i = i0; i <= i1; i++) {
        // A point of a coarser level is that level's.
        if (l > 0 && (i & 1) === 0 && (j & 1) === 0) continue;
        // (The same point either side of the seam of a looping map.)
        const iw = world.wrapX ? ((i % period) + period) % period : i;
        const h = hash2(hash2(iw, j), l);
        const [jx, jy] = pair(h);
        const x = (i + jx * JITTER) / n;
        const y = (j + jy * JITTER) / n;
        if (x < x0 || x > x1 || y < y0 || y > y1 || y < 0 || y >= world.h) continue;
        if (!world.wrapX && (x < 0 || x >= world.w)) continue;
        const cellX = world.wrapX ? ((Math.floor(x) % world.w) + world.w) % world.w : Math.floor(x);
        const cls = world.terrain[Math.floor(y) * world.w + cellX]!;
        if (cls === Terrain.Water || cls === Terrain.Crossing) continue;
        // What stands here: three numbers in [0, 1) from the point's hash.
        const h2 = hash2(h, 0x51ed);
        const r = (h2 & 0xffff) / 65536;
        const variant = (h2 >>> 16) / 65536;
        const cover = COVER[cls] ?? COVER[Terrain.Plains]!;
        let kind: number;
        const built = world.cities.byCell.size > 0 ? cityDensity(world.cities, world.wrapX ? cellX + (x - Math.floor(x)) : x, y) : 0;
        if (built > 0 && ((hash2(h, 0xb17d) & 0xffff) / 65536) < built) kind = ScatterKind.Building;
        else if (r < cover.tree) kind = ScatterKind.Tree;
        else if (r < cover.tree + cover.rock) kind = ScatterKind.Rock;
        else continue;
        if (world.land && !onLand(world.land, world, x, y)) continue;
        if (count === cap) {
          truncated = true;
          break;
        }
        const size = SIZE[kind]!;
        const vary = 0.8 + 0.4 * variant;
        const o = count * SCATTER_STRIDE;
        data[o] = (x - view.cx) * view.pxPerCell;
        data[o + 1] = (y - view.cy) * view.pxPerCell;
        data[o + 2] = Math.max(size.px, size.m / mPerPx) * vary;
        data[o + 3] = kind;
        data[o + 4] = alpha;
        data[o + 5] = variant;
        count++;
      }
    }
  }
  return { count, data, level, truncated };
}
