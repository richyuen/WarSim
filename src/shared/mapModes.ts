/** Map modes (SPEC §9): palette swaps over the same id textures (SPEC §8). */
export const MAP_MODES = ['political', 'alliances'] as const;
export type MapMode = (typeof MAP_MODES)[number];

/** Alliance mode: nations outside any alliance (0xRRGGBB). */
export const NON_ALIGNED_COLOR = 0xb4b4ac;

/** The colour a nation takes in `mode`, given its own colour and its alliance leader's (0 = none). */
export function modeColor(mode: MapMode, own: number, allianceLeaderColor: number | null): number {
  if (mode === 'alliances') return allianceLeaderColor ?? NON_ALIGNED_COLOR;
  return own;
}
