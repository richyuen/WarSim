/**
 * Land measured by true area (ADR-52, PLAN 1.42d): the map is a Miller projection, so a count of
 * cells overstates land near the poles (by cells Denmark, with Greenland, is the fourth-largest
 * nation of 1938). Everything a land share or a land ranking reports goes through here. Derived
 * from the owner raster on demand: never state, never hashed, and no sim rule reads it.
 */
import { cellAreaByRow } from './nav/grid';
import type { World } from './world';

/** km² owned per nation id (index 0 = unowned), over a w×h owner raster. */
export function ownedAreas(owner: ArrayLike<number>, w: number, h: number, nations: number): Float64Array {
  const rowArea = cellAreaByRow(w, h);
  const out = new Float64Array(nations);
  for (let y = 0, c = 0; y < h; y++) {
    const a = rowArea[y]!;
    for (let x = 0; x < w; x++, c++) out[owner[c]!]! += a;
  }
  out[0] = 0;
  return out;
}

export interface LandStandings {
  /** km² owned per nation id. */
  area: Float64Array;
  /** km² owned by living nations. */
  owned: number;
  /** Living nations by owned area, largest first (ties by id). */
  ranked: number[];
}

/** Owned area per nation and the living nations ranked by it. */
export function landStandings(world: World): LandStandings {
  const { owner, w, h } = world.cells;
  const area = ownedAreas(owner, w, h, world.nations.highWater);
  const living = world.nations.cols.living;
  const ranked: number[] = [];
  let owned = 0;
  world.nations.forEach((n) => {
    if (living[n] !== 1) return;
    ranked.push(n);
    owned += area[n]!;
  });
  ranked.sort((a, b) => area[b]! - area[a]! || a - b);
  return { area, owned, ranked };
}
