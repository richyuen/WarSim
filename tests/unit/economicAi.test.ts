import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { MAX_PARALLEL, PARALLEL_INCOME, RESERVE_MONTHS, SUPPRESS_LEVEL } from '../../src/sim/ai/economic';
import { RULES_1938 } from '../../src/sim/scenario1938';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { destroyFormation } from '../../src/sim/systems/elements';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, eventKinds, nationId, runEvents } from '../helpers/sim1938';

// PLAN 1.26 economic AI v1: budget balance (disband), suppression, build mix.
// (The 10-peaceful-years AT runs in tests/sweep/econSweep*.test.ts.)

const W = SIZE_1938.w;
const [GER, POL, SWE, MON, LUX] = ['GER', 'POL', 'SWE', 'MON', 'LUX'].map(nationId) as number[];

function peaceful(): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
  s.world.nations.forEach((n) => (s.world.nations.cols.aggression[n] = 0));
  for (const war of [...s.world.wars.list]) s.world.wars.end(war);
  return s;
}

describe('economic AI (PLAN 1.26)', () => {
  it('a nation whose army costs more than it earns disbands its weakest idle divisions first', () => {
    const s = peaceful();
    const w = s.world;
    // Mongolia's 1938 army far exceeds its income: the AI cuts it before the first month is charged.
    const before = w.formations.ids().filter((id) => w.formations.cols.nation[id] === MON!);
    expect(before.length).toBeGreaterThan(0);
    runEvents(s, 1);
    const after = w.formations.ids().filter((id) => w.formations.cols.nation[id] === MON!);
    expect(after.length).toBeLessThan(before.length);
    const acc = monthlyAccounts(w, ECONOMY_TABLES_1938);
    expect(acc.gross[MON!]! - acc.expenses[MON!]!).toBeGreaterThanOrEqual(0);
    expect(w.nations.cols.bankrupt[MON!]).toBe(0);
  });

  it('a solvent nation with gold to spare orders infantry; a poor one orders cadre divisions', () => {
    const s = peaceful();
    const w = s.world;
    w.nations.cols.gold[SWE!] = 1e6;
    w.nations.cols.manpower[SWE!] = 1e7;
    w.nations.cols.gold[LUX!] = 1e6;
    w.nations.cols.manpower[LUX!] = 1e7;
    runEvents(s, 1);
    const ordered = (n: number): number[] => w.production.ids().filter((id) => w.production.cols.nation[id] === n).map((id) => w.production.cols.template[id]!);
    expect(ordered(SWE!)).toEqual([BUILD_MIX_1938.infantry]);
    expect(w.nations.cols.income[LUX!]!).toBeLessThan(20);
    expect(ordered(LUX!)).toEqual([BUILD_MIX_1938.cadre]);
  });

  it('against armour-heavy enemies the mix turns to motorised divisions', () => {
    const s = peaceful();
    const w = s.world;
    w.wars.set(GER!, POL!, true);
    w.nations.cols.gold[POL!] = 1e6;
    w.nations.cols.manpower[POL!] = 1e7;
    // Germany's army becomes panzers only, before the first monthly assessment (1 January).
    w.formations.ids().filter((id) => w.formations.cols.nation[id] === GER!).forEach((id) => destroyFormation(w, id));
    // Poland's own 1938 army already uses its war share of income: clear it so it has room to build.
    w.formations.ids().filter((id) => w.formations.cols.nation[id] === POL!).forEach((id) => destroyFormation(w, id));
    for (let k = 0; k < 6; k++) addDivision(w, GER!, 500 + k, 300, BUILD_MIX_1938.panzer);
    runEvents(s, 1);
    const polOrders = w.production.ids().filter((id) => w.production.cols.nation[id] === POL!).map((id) => w.production.cols.template[id]!);
    expect(polOrders).toContain(BUILD_MIX_1938.motorised);
  });

  it('suppression is switched on while non-core land is restless', () => {
    const s = peaceful();
    const w = s.world;
    const g = navOf(w).graph;
    let p = 0;
    for (let q = 1; q < w.provinces.count && p === 0; q++) if (w.cells.owner[g.centre[q]!] === GER) p = q;
    w.provinces.core[p] = POL!; // German-held, rightfully Polish
    w.provinces.unrest[p] = 60;
    runEvents(s, 1);
    expect(w.nations.cols.suppression[GER!]).toBe(SUPPRESS_LEVEL);
    expect(w.nations.cols.suppression[SWE!]).toBe(0);
  });

  it('with the AI off nothing is disbanded or ordered', () => {
    const s = peaceful();
    s.world.settings.aiEnabled = false;
    const n0 = s.world.formations.count;
    const ev = runEvents(s, 24 * 62);
    expect(eventKinds(ev, EventKind.ProductionQueued)).toEqual([]);
    expect(s.world.formations.count).toBe(n0);
  });

  it('a rich nation trains several formations at once: 1 + income/PARALLEL_INCOME, at most MAX_PARALLEL', () => {
    const s = peaceful();
    const w = s.world;
    const USA = nationId('USA');
    w.nations.cols.gold[USA] = 1e7;
    w.nations.cols.gold[SWE!] = 1e6;
    w.nations.cols.manpower[SWE!] = 1e7;
    const income = monthlyAccounts(w, ECONOMY_TABLES_1938).gross[USA]!;
    expect(income).toBeGreaterThan(MAX_PARALLEL * PARALLEL_INCOME);
    runEvents(s, 1);
    const pending = (n: number): number => w.production.ids().filter((id) => w.production.cols.nation[id] === n).length;
    expect(pending(USA)).toBe(MAX_PARALLEL);
    expect(pending(SWE!)).toBe(1); // income below PARALLEL_INCOME: one at a time
    // Nothing more is ordered while the slots are full.
    runEvents(s, 24 * 31);
    expect(pending(USA)).toBeLessThanOrEqual(MAX_PARALLEL);
  });

  it('an order the treasury cannot pay for is replaced by infantry instead of holding up the queue (PLAN 1.42c)', () => {
    const order = (gold: (income: number) => number): number[] => {
      const s = peaceful();
      const w = s.world;
      const nc = w.nations.cols;
      w.wars.set(GER!, LUX!, true); // a rich nation at war: every third order is a panzer division
      nc.aiOff[LUX!] = 1;
      for (const id of w.formations.ids()) if (w.formations.cols.nation[id] === GER!) destroyFormation(w, id);
      nc.builds[GER!] = 2; // the next order is the third
      nc.manpower[GER!] = 1e7;
      nc.gold[GER!] = gold(Math.max(0, monthlyAccounts(w, ECONOMY_TABLES_1938).gross[GER!]!));
      runEvents(s, 1);
      return w.production.ids().filter((id) => w.production.cols.nation[id] === GER!).map((id) => w.production.cols.template[id]!);
    };
    const panzer = RULES_1938.templates[BUILD_MIX_1938.panzer]!.gold;
    const infantry = RULES_1938.templates[BUILD_MIX_1938.infantry]!.gold;
    expect(panzer).toBeGreaterThan(infantry);
    // Enough for the panzer division and the reserve: it is ordered first.
    expect(order((income) => panzer + RESERVE_MONTHS * income + 1)[0]).toBe(BUILD_MIX_1938.panzer);
    // Enough for infantry only: infantry is ordered (before PLAN 1.42c nothing was).
    expect(order((income) => infantry + RESERVE_MONTHS * income + 1)).toEqual([BUILD_MIX_1938.infantry]);
    // Not enough for either: nothing.
    expect(order((income) => RESERVE_MONTHS * income)).toEqual([]);
  });
});
