/** Map modes (SPEC §9): palette swaps over the same id textures (SPEC §8). */
export const MAP_MODES = ['political', 'alliances', 'puppets', 'terrain', 'wars', 'diplomacy', 'income', 'revolts'] as const;
export type MapMode = (typeof MAP_MODES)[number];

/** Nations outside any alliance (alliance mode) or puppet bloc (puppet mode), 0xRRGGBB. */
export const NON_ALIGNED_COLOR = 0xb4b4ac;
export const WAR_COLOR = 0xc0392b;
export const PEACE_COLOR = 0xb4b4ac;
export const SELF_COLOR = 0xf1c40f;
export const ALLY_COLOR = 0x2e9e5b;
export const ENEMY_COLOR = 0xc0392b;
export const SUBJECT_COLOR = 0x8fd19e;
export const NEUTRAL_COLOR = 0xb4b4ac;
export const INCOME_LOW = 0xf4f1d6;
export const INCOME_HIGH = 0x16703a;

export type Relation = 'none' | 'self' | 'ally' | 'enemy' | 'subject' | 'neutral';

export interface NationColors {
  own: number;
  /** Colour of the nation's alliance leader (null = no alliance). */
  allianceLeader: number | null;
  /** Colour of its overlord (null = not a puppet). */
  overlord: number | null;
  /** Whether it has puppets of its own. */
  hasPuppets: boolean;
  /** At war with anyone (wars mode). */
  atWar?: boolean;
  /** Relation to the selected nation ('none' = nothing selected; diplomacy mode). */
  relation?: Relation;
  /** Income share of the richest nation, 0..1, log-scaled by the caller (income mode). */
  incomeT?: number;
}

/** Mixes `c` toward white by `t` (0..1). */
export function lighten(c: number, t: number): number {
  return mix(c, 0xffffff, t);
}

/** Linear mix of two 0xRRGGBB colours. */
export function mix(a: number, b: number, t: number): number {
  const ch = (s: number): number => Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

const RELATION_COLOR: Record<Exclude<Relation, 'none'>, number> = { self: SELF_COLOR, ally: ALLY_COLOR, enemy: ENEMY_COLOR, subject: SUBJECT_COLOR, neutral: NEUTRAL_COLOR };

/**
 * The colour a nation takes in `mode`. Alliances: the leader's colour, else grey. Puppets: an
 * overlord with puppets keeps its colour, a puppet shows its overlord's colour lightened by
 * PUPPET_LIGHTEN, everyone else grey. Wars: red at war, grey at peace. Diplomacy: relative to
 * the selected nation (self yellow, allies green, enemies red, overlord/puppets light green,
 * others grey; own colours when nothing is selected). Income: a ramp from pale to deep green.
 * Terrain and revolts modes do not use the palette (the shader colours terrain / province unrest).
 */
export const PUPPET_LIGHTEN = 0.45;
export function modeColor(mode: MapMode, n: NationColors): number {
  switch (mode) {
    case 'alliances':
      return n.allianceLeader ?? NON_ALIGNED_COLOR;
    case 'puppets':
      if (n.overlord !== null) return lighten(n.overlord, PUPPET_LIGHTEN);
      return n.hasPuppets ? n.own : NON_ALIGNED_COLOR;
    case 'wars':
      return n.atWar ? WAR_COLOR : PEACE_COLOR;
    case 'diplomacy':
      return !n.relation || n.relation === 'none' ? n.own : RELATION_COLOR[n.relation];
    case 'income':
      return mix(INCOME_LOW, INCOME_HIGH, Math.max(0, Math.min(1, n.incomeT ?? 0)));
    default:
      return n.own;
  }
}

/** Legend entries per mode: [swatch colour or null for a note, i18n key]. */
export function legendFor(mode: MapMode): [number | null, string][] {
  switch (mode) {
    case 'political':
      return [[null, 'legend.political'], [null, 'legend.occupied']];
    case 'alliances':
      return [[null, 'legend.alliance'], [NON_ALIGNED_COLOR, 'legend.nonAligned']];
    case 'puppets':
      return [[null, 'legend.overlord'], [lighten(0x777777, PUPPET_LIGHTEN), 'legend.puppet'], [NON_ALIGNED_COLOR, 'legend.independent']];
    case 'terrain':
      return [[null, 'legend.terrain']];
    case 'wars':
      return [[WAR_COLOR, 'legend.atWar'], [PEACE_COLOR, 'legend.atPeace']];
    case 'diplomacy':
      return [[SELF_COLOR, 'legend.selected'], [ALLY_COLOR, 'legend.ally'], [ENEMY_COLOR, 'legend.enemy'], [SUBJECT_COLOR, 'legend.subject'], [NEUTRAL_COLOR, 'legend.neutral'], [null, 'legend.selectHint']];
    case 'income':
      return [[INCOME_LOW, 'legend.incomeLow'], [INCOME_HIGH, 'legend.incomeHigh']];
    case 'revolts':
      return [[0xe8e3cf, 'legend.calm'], [0xf0a050, 'legend.mayRevolt'], [0x8e1c10, 'legend.revoltLikely']];
  }
}
