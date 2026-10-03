import type { NationStat } from './protocol';

/** Statistics ranking metrics (PLAN 1.31b), each read from a NationStat. */
export const RANK_METRICS = ['land', 'army', 'income', 'gold', 'manpower'] as const;
export type RankMetric = (typeof RANK_METRICS)[number];
const VALUE: Record<RankMetric, (n: NationStat) => number> = {
  land: (n) => n.cells,
  army: (n) => n.men,
  income: (n) => n.income,
  gold: (n) => n.gold,
  manpower: (n) => n.manpower,
};

export function rankValue(n: NationStat, metric: RankMetric): number {
  return VALUE[metric](n);
}

/** Nations by `metric`, highest first (ties by id). */
export function rankNations(nations: NationStat[], metric: RankMetric): NationStat[] {
  const v = VALUE[metric];
  return [...nations].sort((a, b) => v(b) - v(a) || a.id - b.id);
}
