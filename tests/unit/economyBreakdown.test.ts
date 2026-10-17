import { describe, expect, it } from 'vitest';
import { ECONOMY_TABLES_1938 } from '../../src/sim/scenario1938';
import { economyBreakdown, monthlyAccounts } from '../../src/sim/systems/economy';
import { at1938 } from '../helpers/checkpoint';

// PLAN 7.4f34 (the critic's N14: the economy tab was six numbers): a nation's month in parts. The
// parts are the steps of `monthlyAccounts`, so they add up to its gross and its expenses to the
// bit, for every nation, in a world where the war has blockades, raids and bombs in it.

describe('a nation\'s month in parts (PLAN 7.4f34)', () => {
  // Seed 1938 two years in: wars, a blockade, raids on convoys and bombs on cities.
  const sim = at1938(1938, 24 * 730);
  const w = sim.world;
  const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);

  it('the parts add up to the month\'s gross and expenses, for every nation', () => {
    let nations = 0;
    w.nations.forEach((n) => {
      const b = economyBreakdown(w, ECONOMY_TABLES_1938, n);
      expect(b.gross, `nation ${n} gross`).toBe(acc.gross[n]);
      expect(b.expenses, `nation ${n} expenses`).toBe(acc.expenses[n]);
      // Income: own land and occupied land, then what the bonuses add.
      expect(b.ownLand + b.occupiedLand + b.bonuses).toBeCloseTo(b.gross, 6);
      // Expenses: upkeep by domain, administration, warheads.
      expect(b.army + b.navy + b.air + b.admin + b.warheads).toBeCloseTo(b.expenses, 6);
      for (const k of ['ownLand', 'occupiedLand', 'blockade', 'convoys', 'bombs', 'fallout', 'army', 'navy', 'air', 'admin', 'warheads'] as const) expect(b[k], `nation ${n} ${k}`).toBeGreaterThanOrEqual(0);
      nations++;
    });
    expect(nations).toBeGreaterThan(50);
  });

  it('the war\'s losses are there to be seen in such a world', () => {
    const sum = { blockade: 0, convoys: 0, bombs: 0, occupied: 0, navy: 0, air: 0 };
    w.nations.forEach((n) => {
      const b = economyBreakdown(w, ECONOMY_TABLES_1938, n);
      sum.blockade += b.blockade;
      sum.convoys += b.convoys;
      sum.bombs += b.bombs;
      sum.occupied += b.occupiedLand;
      sum.navy += b.navy;
      sum.air += b.air;
    });
    process.stderr.write(`two years in: lost to blockades ${sum.blockade.toFixed(0)}, to convoy raids ${sum.convoys.toFixed(0)}, to bombs ${sum.bombs.toFixed(0)}; occupied land ${sum.occupied.toFixed(0)}; navies ${sum.navy.toFixed(0)}, air forces ${sum.air.toFixed(0)} a month\n`);
    expect(sum.occupied).toBeGreaterThan(0);
    expect(sum.navy).toBeGreaterThan(0);
    expect(sum.air).toBeGreaterThan(0);
    expect(sum.blockade + sum.convoys + sum.bombs).toBeGreaterThan(0);
  });
});
