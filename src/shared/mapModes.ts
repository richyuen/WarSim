/** Map modes (SPEC §9): palette swaps over the same id textures (SPEC §8). */
export const MAP_MODES = ['political', 'alliances', 'puppets', 'terrain'] as const;
export type MapMode = (typeof MAP_MODES)[number];

/** Nations outside any alliance (alliance mode) or puppet bloc (puppet mode), 0xRRGGBB. */
export const NON_ALIGNED_COLOR = 0xb4b4ac;

export interface NationColors {
  own: number;
  /** Colour of the nation's alliance leader (null = no alliance). */
  allianceLeader: number | null;
  /** Colour of its overlord (null = not a puppet). */
  overlord: number | null;
  /** Whether it has puppets of its own. */
  hasPuppets: boolean;
}

/** Mixes `c` toward white by `t` (0..1). */
export function lighten(c: number, t: number): number {
  const ch = (s: number): number => Math.round(((c >> s) & 255) + (255 - ((c >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/**
 * The colour a nation takes in `mode`. Alliances: the leader's colour, else grey. Puppets: an
 * overlord with puppets keeps its colour, a puppet shows its overlord's colour lightened by
 * PUPPET_LIGHTEN, everyone else grey.
 */
export const PUPPET_LIGHTEN = 0.45;
export function modeColor(mode: MapMode, n: NationColors): number {
  if (mode === 'alliances') return n.allianceLeader ?? NON_ALIGNED_COLOR;
  if (mode === 'puppets') {
    if (n.overlord !== null) return lighten(n.overlord, PUPPET_LIGHTEN);
    return n.hasPuppets ? n.own : NON_ALIGNED_COLOR;
  }
  return n.own;
}
