/**
 * What the ground of each terrain class looks like at T2 and T3 (PLAN 2.8b, ADR-78): how the map
 * pass's noise is laid on a fill. The fill keeps its colour (it says whose the land is); the
 * class says how rough the ground is.
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
