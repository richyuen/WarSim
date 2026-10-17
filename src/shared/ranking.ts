import type { NationLife, NationStat } from './protocol';

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

/**
 * The lists of a life (PLAN 7.4f28, the critic's N14): AoC's Statistics has the dead in its lists,
 * marked. A list of the present has them at 0; these name every nation that lived, by its years
 * alive, the wars it declared or had declared on it, and the nations that rose on its land
 * (`worker/lives.ts`).
 */
export const LIFE_METRICS = ['age', 'warsTotal', 'revolts'] as const;
export type LifeMetric = (typeof LIFE_METRICS)[number];
/** Every list of the ranking: the present's, then a life's. */
export type RankList = RankMetric | LifeMetric;
export const RANK_LISTS: readonly RankList[] = [...RANK_METRICS, ...LIFE_METRICS];

export function isLifeMetric(m: RankList): m is LifeMetric {
  return (LIFE_METRICS as readonly string[]).includes(m);
}

const LIFE_VALUE: Record<LifeMetric, (l: NationLife) => number> = {
  age: (l) => l.age,
  warsTotal: (l) => l.wars,
  revolts: (l) => l.revolts,
};

export function lifeValue(l: NationLife, metric: LifeMetric): number {
  return LIFE_VALUE[metric](l);
}

/** Lives by `metric`, highest first (ties by id), the dead among them. */
export function rankLives(lives: readonly NationLife[], metric: LifeMetric): NationLife[] {
  const v = LIFE_VALUE[metric];
  return [...lives].sort((a, b) => v(b) - v(a) || a.id - b.id);
}
