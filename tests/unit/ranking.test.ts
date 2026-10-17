import { describe, expect, it } from 'vitest';
import type { NationStat } from '../../src/shared/protocol';
import { LIFE_METRICS, lifeValue, RANK_LISTS, RANK_METRICS, rankLives, rankNations, rankValue } from '../../src/shared/ranking';

const nation = (id: number, v: number): NationStat => ({
  id,
  name: `=N${id}`,
  color: 0,
  cells: v * 7,
  area: v,
  landShare: 0,
  gold: v * 2,
  income: v * 3,
  expenses: 0,
  incomeBonus: 0,
  bankrupt: false,
  manpower: v * 4,
  men: v * 5,
  formations: 1,
  aircraft: v * 6,
  wings: 0,
  airLost: 0,
  bombed: 0,
  nukeDead: 0,
  fallout: 0,
  efficiency: 1,
  ceLocked: false,
  alliance: null,
  overlord: 0,
  autonomy: 0,
  loyalty: 0,
  integration: 0,
  puppets: Array.from({ length: v }, (_, i) => 100 + i),
  enemies: Array.from({ length: v }, (_, i) => 200 + i),
  aiOff: false,
  nukesAllowed: true,
  warheads: v * 8,
  canDeliver: false,
  queue: [],
  aggression: 50,
  incomeMult: 1,
  techs: [0, 0],
  shipyard: false,
  airRoom: 0,
  research: 0,
  lines: [],
});

describe('statistics ranking (PLAN 1.31b)', () => {
  it('sorts every metric highest first, ties by id', () => {
    const list = [nation(3, 10), nation(1, 30), nation(2, 10), nation(4, 20)];
    for (const m of RANK_METRICS) {
      const ranked = rankNations(list, m);
      expect(ranked.map((n) => n.id)).toEqual([1, 4, 2, 3]);
      for (let i = 1; i < ranked.length; i++) expect(rankValue(ranked[i - 1]!, m)).toBeGreaterThanOrEqual(rankValue(ranked[i]!, m));
    }
    expect(list.map((n) => n.id)).toEqual([3, 1, 2, 4]); // input untouched
  });

  it('reads the matching field for each metric', () => {
    const n = nation(1, 7);
    expect([rankValue(n, 'land'), rankValue(n, 'gold'), rankValue(n, 'income'), rankValue(n, 'manpower'), rankValue(n, 'army')]).toEqual([7, 14, 21, 28, 35]);
    // PLAN 7.4f11: the wars it is in (its enemies), its puppets, its aircraft, its warheads.
    expect([rankValue(n, 'wars'), rankValue(n, 'puppets'), rankValue(n, 'aircraft'), rankValue(n, 'warheads')]).toEqual([7, 7, 42, 56]);
    expect(RANK_METRICS).toHaveLength(9);
  });

  // PLAN 7.4f28: the lists of a life, which have the dead in them.
  it('lists of a life: the dead ranked with the living, highest first, ties by id', () => {
    const lives = [
      { id: 3, living: false, age: 2, wars: 5, revolts: 1 },
      { id: 1, living: true, age: 9, wars: 1, revolts: 1 },
      { id: 2, living: true, age: 2, wars: 3, revolts: 4 },
    ];
    expect(rankLives(lives, 'age').map((l) => l.id)).toEqual([1, 2, 3]);
    expect(rankLives(lives, 'warsTotal').map((l) => l.id)).toEqual([3, 2, 1]);
    expect(rankLives(lives, 'revolts').map((l) => l.id)).toEqual([2, 1, 3]);
    expect(LIFE_METRICS.map((m) => lifeValue(lives[0]!, m))).toEqual([2, 5, 1]);
    expect(RANK_LISTS).toEqual([...RANK_METRICS, 'age', 'warsTotal', 'revolts']);
    expect(lives.map((l) => l.id)).toEqual([3, 1, 2]); // input untouched
  });
});
