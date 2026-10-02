/**
 * Terrain classes (SPEC §3.2): the cell-layer `terrain` u8 is the index into TERRAIN_IDS.
 * `data/terrain.json` lists the same ids in the same order (checked by validateDataSet).
 */
export const TERRAIN_IDS = [
  'water', 'crossing', 'plains', 'grassland', 'forest', 'hills',
  'mountains', 'desert', 'tundra', 'marsh', 'urban', 'ice',
] as const;
export type TerrainId = (typeof TERRAIN_IDS)[number];

export const Terrain = {
  Water: 0,
  Crossing: 1,
  Plains: 2,
  Grassland: 3,
  Forest: 4,
  Hills: 5,
  Mountains: 6,
  Desert: 7,
  Tundra: 8,
  Marsh: 9,
  Urban: 10,
  Ice: 11,
} as const satisfies Record<string, number>;

/** Water and crossings are sea for naval movement; everything else is land. */
export function isLand(t: number): boolean {
  return t >= Terrain.Plains;
}
