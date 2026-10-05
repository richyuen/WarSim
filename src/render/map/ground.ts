/**
 * What the ground of each terrain class looks like at T2 and T3 (PLAN 2.8b, ADR-78): how the map
 * pass's noise is laid on the land: how rough each class is. Its colour is the terrain's too
 * since PLAN 2.14d (the casts below): until then the fill kept its colour, and the ground of
 * Berlin was Germany's grey.
 */
import { Terrain } from '../../shared/terrain';

export interface Ground {
  /** How high its small relief stands in the shading: 1 for mountains. */
  bump: number;
  /** How much its brightness varies from place to place, as a share of the fill. */
  grain: number;
  /** Its brightness against the fill's: woods are darker, sand and ice lighter. */
  shade: number;
}

export const GROUND: Record<number, Ground> = {
  // Water inside a land cell's blend (a coast, a lake shore): level, as the sea is for the hillshade.
  [Terrain.Water]: { bump: 0.1, grain: 0.03, shade: 1 },
  [Terrain.Crossing]: { bump: 0.1, grain: 0.03, shade: 1 },
  [Terrain.Plains]: { bump: 0.14, grain: 0.05, shade: 1 },
  [Terrain.Grassland]: { bump: 0.16, grain: 0.06, shade: 1 },
  [Terrain.Forest]: { bump: 0.34, grain: 0.12, shade: 0.93 },
  [Terrain.Hills]: { bump: 0.55, grain: 0.07, shade: 1 },
  [Terrain.Mountains]: { bump: 1, grain: 0.08, shade: 1 },
  [Terrain.Desert]: { bump: 0.28, grain: 0.04, shade: 1.03 },
  [Terrain.Tundra]: { bump: 0.22, grain: 0.07, shade: 1 },
  [Terrain.Marsh]: { bump: 0.1, grain: 0.1, shade: 0.96 },
  [Terrain.Urban]: { bump: 0.12, grain: 0.05, shade: 0.97 },
  [Terrain.Ice]: { bump: 0.18, grain: 0.02, shade: 1.04 },
};

/** How many classes the shader's table holds. */
export const GROUND_CLASSES = 12;

/** The table as the shader takes it: (bump, grain, shade) for each class in the order of its number. */
export function groundUniform(): Float32Array {
  const out = new Float32Array(GROUND_CLASSES * 3);
  for (let t = 0; t < GROUND_CLASSES; t++) {
    const g = GROUND[t];
    if (!g) throw new Error(`no ground for terrain class ${t}`);
    out.set([g.bump, g.grain, g.shade], t * 3);
  }
  return out;
}

/**
 * How much of the ground of T2 and T3, and of what stands on it, a zoom still shows: all of it
 * up to `outM` m/px, the zoom at which T2 is left; none an octave beyond; smoothly between.
 *
 * Leaving T2 the layers go by the clock (the handover: 220 ms in full, then a fade), and the
 * camera can be far out long before that. The ground's pass and the scatter are made for the
 * zooms of T2: at 5000 m/px a pixel of the fine mask is half a screen pixel, and a tree symbol
 * stands on every fourth pixel (PLAN 2.11l). So beyond T2 they go with the zoom as well.
 */
export function groundReach(mPerPx: number, outM: number): number {
  const t = Math.min(1, Math.max(0, Math.log2(mPerPx / outM)));
  return 1 - t * t * (3 - 2 * t);
}

/**
 * How much of the hatching of occupied land stays where the ground of T2 and T3 is in full
 * (PLAN 2.11f). The hatching is the picture of T0 and T1. With the ground it would lie over
 * the hillshade and the texture across the whole view: it gives way, to a weave no stronger
 * than the ground's own variation on a plain, and occupied land is told by its tint.
 */
export const HATCH_AT_GROUND = 0.12;

/**
 * The ground of T2 and T3 has the terrain's colour, and the fill (the nation's colour, or the
 * map mode's) is a cast on it (PLAN 2.14d, ADR-90): the share of the fill in the ground's
 * colour away from every border, at a border, and on occupied land; and how far from a border
 * the stronger cast reaches, as the difference of the two strongest ids' weights (0 on the
 * border, about 0.5 half a cell from it, 1 two cells inland).
 */
export const GROUND_CAST = 0.14;
export const BORDER_CAST = 0.62;
export const OCCUPIED_CAST = 0.42;
export const BORDER_BAND = 0.6;
