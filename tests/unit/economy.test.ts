import { describe, expect, it } from 'vitest';
import { dayOfIso, tickOfDate } from '../../src/shared/calendar';
import { EventKind } from '../../src/shared/events';
import { ECONOMY_TABLES_1938, NATIONS_1938, SIZE_1938, START_GOLD_MONTHS } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import {
  adminCost,
  BANKRUPT_MONTHS,
  cellWeight,
  DESERTION,
  economySystem,
  industrialCapacity,
  INCOME_PER_BN,
  monthlyAccounts,
  OCCUPIED_SHARE,
  runEconomyMonth,
  UPKEEP_SCALE,
  type EconomyTables,
} from '../../src/sim/systems/economy';
import { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 1.9: one test per economic rule on a tiny world, plus the 1938 income ranking.

const TABLES: EconomyTables = { templateUpkeep: [10], templateStrength: [1000] };
const START = dayOfIso('1938-01-01');

/** 4×1 world, two nations; every cell worth 1 bn (1000 $M). */
function tiny(): World {
  const w = new World(1, 4, 1);
  w.startDay = START;
  for (let n = 1; n <= 2; n++) {
    const id = w.nations.create();
    w.nations.cols.living[id] = 1;
    w.nations.cols.incomeMult[id] = 1;
  }
  w.cells.owner.set([1, 1, 2, 2]);
  w.cells.controller.set([1, 1, 2, 2]);
  w.cells.econ.fill(1000);
  return w;
}

describe('economy rules (PLAN 1.9)', () => {
  it('controlled land pays its controller; occupied land pays the occupier a share, the owner nothing', () => {
    const w = tiny();
    expect(monthlyAccounts(w, TABLES).gross.slice(1, 3)).toEqual(Float64Array.from([2 * INCOME_PER_BN, 2 * INCOME_PER_BN]));
    w.cells.controller[2] = 1; // nation 1 occupies one of nation 2's cells
    const g = monthlyAccounts(w, TABLES).gross;
    expect(g[1]).toBeCloseTo((2 + OCCUPIED_SHARE) * INCOME_PER_BN);
    expect(g[2]).toBeCloseTo(INCOME_PER_BN);
  });

  it('income bonus (−100..100) and trait multipliers scale gross income', () => {
    const w = tiny();
    w.nations.cols.incomeBonus[1] = 50;
    w.nations.cols.incomeBonus[2] = -100;
    w.nations.cols.incomeMult[1] = 1.15;
    const g = monthlyAccounts(w, TABLES).gross;
    expect(g[1]).toBeCloseTo(2 * INCOME_PER_BN * 1.15 * 1.5);
    expect(g[2]).toBe(0);
  });

  it('formation upkeep scales with current strength', () => {
    const w = tiny();
    for (const s of [1000, 500]) {
      const id = w.formations.create();
      w.formations.cols.nation[id] = 1;
      w.formations.cols.template[id] = 0;
      w.formations.cols.strength[id] = s;
    }
    expect(monthlyAccounts(w, TABLES).upkeep[1]).toBeCloseTo(UPKEEP_SCALE * 10 * 1.5);
  });

  it('admin cost is superlinear in land held', () => {
    expect(adminCost(0)).toBe(0);
    expect(adminCost(2000)).toBeGreaterThan(2 * adminCost(1000));
    expect(adminCost(100_000) / adminCost(10_000)).toBeGreaterThan(20);
  });

  it('the economy runs once a month, at 00:00 of day 1', () => {
    const w = tiny();
    const eco = economySystem(TABLES);
    let payments = 0;
    for (let t = 0; t < tickOfDate(START, 1939, 1, 1); t++) {
      const before = w.nations.cols.gold[1];
      w.tick = t;
      eco(w);
      if (w.nations.cols.gold[1] !== before) payments++;
    }
    expect(payments).toBe(12);
    expect(w.nations.cols.gold[1]).toBeCloseTo(12 * (2 * INCOME_PER_BN - adminCost(2)));
  });

  it('bankruptcy below −3 months of income makes armies desert, and ends at gold ≥ 0', () => {
    const w = tiny();
    const id = w.formations.create();
    w.formations.cols.nation[id] = 1;
    w.formations.cols.strength[id] = 1000;
    const nc = w.nations.cols;
    nc.gold[1] = -BANKRUPT_MONTHS * 2 * INCOME_PER_BN - 100;
    runEconomyMonth(w, TABLES);
    expect(nc.bankrupt[1]).toBe(1);
    expect(w.formations.cols.strength[id]).toBe(Math.floor(1000 * (1 - DESERTION)));
    expect(w.out.events.slice(1, 4)).toEqual([EventKind.Bankruptcy, 1, 1]);
    nc.gold[1] = 0;
    runEconomyMonth(w, TABLES);
    expect(nc.bankrupt[1]).toBe(0);
    expect(w.out.events.slice(7, 10)).toEqual([EventKind.Bankruptcy, 1, 0]);
  });

  it('cell weights favour cities; industrial capacity favours rich economies', () => {
    expect(cellWeight(2, 1, 5)).toBeGreaterThan(cellWeight(2, 1, 1) * 20);
    expect(cellWeight(0, 1, 0)).toBe(0); // water
    expect(industrialCapacity(100, 6134, 6134)).toBe(100);
    expect(industrialCapacity(100, 613.4, 6134)).toBeLessThan(35);
  });
});

describe('1938 economy (PLAN 1.9 AT)', () => {
  const sim = new Sim({
    scenario: '1938',
    seed: 1938,
    assets: assets1938(SIZE_1938.w),
  });
  const { gross } = monthlyAccounts(sim.world, ECONOMY_TABLES_1938);
  const tags = NATIONS_1938.map((n) => n.tag);
  const ranked = tags.map((t, i) => [t, gross[i + 1]!] as const).sort((a, b) => b[1] - a[1]);

  it('the top 5 incomes are the USA, the UK, Germany, the USSR and France', () => {
    expect(ranked.slice(0, 5).map(([t]) => t).sort()).toEqual(['ENG', 'FRA', 'GER', 'SOV', 'USA']);
    expect(ranked[0]![0]).toBe('USA');
  });

  it('every living nation earns something and starts with six months of income', () => {
    NATIONS_1938.forEach((n, i) => {
      if (n.alive === false) return;
      expect(gross[i + 1], n.tag).toBeGreaterThan(0);
      expect(sim.world.nations.cols.gold[i + 1]).toBeCloseTo(START_GOLD_MONTHS * gross[i + 1]!);
    });
  });

  it('one year of play pays 12 months and keeps the major economies solvent', () => {
    sim.step(tickOfDate(sim.world.startDay, 1939, 1, 1) + 1);
    const nc = sim.world.nations.cols;
    for (const t of ['USA', 'ENG', 'GER', 'FRA', 'SOV', 'JAP', 'ITA']) {
      const id = tags.indexOf(t) + 1;
      expect(nc.bankrupt[id], t).toBe(0);
      expect(nc.income[id], t).toBeGreaterThan(0);
    }
  });
});
