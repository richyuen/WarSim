import { describe, expect, it } from 'vitest';
import type { NationStat } from '../../src/shared/protocol';
import { RANK_METRICS, rankNations, rankValue } from '../../src/shared/ranking';

const nation = (id: number, v: number): NationStat => ({
  id,
  name: `=N${id}`,
  color: 0,
  cells: v,
  gold: v * 2,
  income: v * 3,
  expenses: 0,
  incomeBonus: 0,
  bankrupt: false,
  manpower: v * 4,
  men: v * 5,
  formations: 1,
  efficiency: 1,
  alliance: null,
  overlord: 0,
  autonomy: 0,
  loyalty: 0,
  integration: 0,
  puppets: [],
  enemies: [],
  aiOff: false,
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
  });
});
