import type { NationStat } from './protocol';

/**
 * Statistics ranking metrics (PLAN 1.31b), each read from a NationStat. Land is km² (ADR-52).
 * Nine lists as AoC's (PLAN 7.4f11, the critic's N14): its wars now, its puppets, its aircraft
 * and its warheads besides.
 */
export const RANK_METRICS = ['land', 'army', 'income', 'gold', 'manpower', 'wars', 'puppets', 'aircraft', 'warheads'] as const;
export type RankMetric = (typeof RANK_METRICS)[number];
const VALUE: Record<RankMetric, (n: NationStat) => number> = {
  land: (n) => n.area,
  army: (n) => n.men,
  income: (n) => n.income,
  gold: (n) => n.gold,
  manpower: (n) => n.manpower,
  wars: (n) => n.enemies.length,
  puppets: (n) => n.puppets.length,
  aircraft: (n) => n.aircraft,
  warheads: (n) => n.warheads,
};

export function rankValue(n: NationStat, metric: RankMetric): number {
  return VALUE[metric](n);
}

/** Nations by `metric`, highest first (ties by id). */
export function rankNations(nations: NationStat[], metric: RankMetric): NationStat[] {
  const v = VALUE[metric];
  return [...nations].sort((a, b) => v(b) - v(a) || a.id - b.id);
}
