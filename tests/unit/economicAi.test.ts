import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { ARMOUR_FULL_INCOME, ARMOUR_SHARE_MAX, ARMY_SHARE_WAR, armourWanted, economicAi, MAX_PARALLEL, PARALLEL_INCOME, peaceShare, POOR_INCOME, RESERVE_MONTHS, RICH_INCOME, SUPPRESS_FULL, SUPPRESS_LEVEL, SUPPRESS_ROOM, suppressionLevel, WAR_RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { SUPPRESSION_COST } from '../../src/sim/systems/revolts';
import { RULES_1938 } from '../../src/sim/scenario1938';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { destroyFormation } from '../../src/sim/systems/elements';
import { queueFormation } from '../../src/sim/systems/production';
import { Domain, navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, eventKinds, nationId, runEvents } from '../helpers/sim1938';

/** An order of the army: a fleet's (PLAN 4.6e1, the navy's share) is no part of the army's mix. */
const land = (w: { rules: { templates: readonly { domain: number }[] } | null; production: { cols: { template: ArrayLike<number> } } }, id: number): boolean => w.rules!.templates[w.production.cols.template[id]!]!.domain === Domain.land;

// PLAN 1.26 economic AI v1: budget balance (disband), suppression, build mix.
// (The 10-peaceful-years AT runs in tests/sweep/econSweep*.test.ts.)

const W = SIZE_1938.w;
/** The armoured division of 1938, the last of the AI's armour (PLAN 3.1c). */
const PANZER = BUILD_MIX_1938.armour[BUILD_MIX_1938.armour.length - 1]!;
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
    // Mongolia's 1938 army far exceeds its income. Since PLAN 2.13 the AI cuts it only when the
    // treasury cannot carry it (ADR-86; before, in the first hour of every game, with the money
    // of the start unspent). With the treasury empty it is cut before the first month is charged.
    const before = w.formations.ids().filter((id) => w.formations.cols.nation[id] === MON!);
    expect(before.length).toBeGreaterThan(0);
    w.nations.cols.gold[MON!] = 0;
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
    const ordered = (n: number): number[] => w.production.ids().filter((id) => land(w, id) && w.production.cols.nation[id] === n).map((id) => w.production.cols.template[id]!);
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
    for (let k = 0; k < 6; k++) addDivision(w, GER!, 500 + k, 300, PANZER);
    runEvents(s, 1);
    const polOrders = w.production.ids().filter((id) => land(w, id) && w.production.cols.nation[id] === POL!).map((id) => w.production.cols.template[id]!);
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
    w.nations.cols.gold[GER!] = 1e6;
    runEvents(s, 1);
    expect(w.nations.cols.suppression[GER!]).toBe(SUPPRESS_FULL);
    expect(w.nations.cols.suppression[SWE!]).toBe(0);
  });

  it('a treasury over its reserve pays for full suppression, a surplus for half (PLAN 7.3e2)', () => {
    const income = 100;
    // France of 7.3d3: gold, no surplus. A month of the full level over the reserve pays for it.
    const reserve = RESERVE_MONTHS * income;
    expect(suppressionLevel(true, reserve + SUPPRESSION_COST * SUPPRESS_FULL * income, income, 0)).toBe(SUPPRESS_FULL);
    expect(suppressionLevel(true, reserve, income, 0)).toBe(0);
    // Under the reserve, the surplus pays for the half level as before.
    expect(suppressionLevel(true, reserve, income, SUPPRESS_ROOM * income + 1)).toBe(SUPPRESS_LEVEL);
    expect(suppressionLevel(true, reserve, income, SUPPRESS_ROOM * income)).toBe(0);
    // Nothing restless, nothing paid, whatever the treasury.
    expect(suppressionLevel(false, 1e9, income, income)).toBe(0);
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
    const pending = (n: number): number => w.production.ids().filter((id) => land(w, id) && w.production.cols.nation[id] === n).length;
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
      w.wars.set(GER!, LUX!, true); // a rich nation with no armour: its first order is a panzer division (PLAN 3.5d)
      nc.aiOff[LUX!] = 1;
      for (const id of w.formations.ids()) if (w.formations.cols.nation[id] === GER!) destroyFormation(w, id);
      nc.manpower[GER!] = 1e7;
      nc.gold[GER!] = gold(Math.max(0, monthlyAccounts(w, ECONOMY_TABLES_1938).gross[GER!]!));
      runEvents(s, 1);
      return w.production.ids().filter((id) => land(w, id) && w.production.cols.nation[id] === GER!).map((id) => w.production.cols.template[id]!);
    };
    const panzer = RULES_1938.templates[PANZER]!.gold;
    const infantry = RULES_1938.templates[BUILD_MIX_1938.infantry]!.gold;
    expect(panzer).toBeGreaterThan(infantry);
    // At war with no army its reserve is WAR_RESERVE_MONTHS of income (PLAN 7.65, ADR-615).
    // Enough for the panzer division and the reserve: it is ordered first.
    expect(order((income) => panzer + WAR_RESERVE_MONTHS * income + 1)[0]).toBe(PANZER);
    // Enough for infantry only: infantry is ordered (before PLAN 1.42c nothing was).
    expect(order((income) => infantry + WAR_RESERVE_MONTHS * income + 1)).toEqual([BUILD_MIX_1938.infantry]);
    // Not enough for either: nothing.
    expect(order((income) => WAR_RESERVE_MONTHS * income + infantry - 1)).toEqual([]);
  });
});

// PLAN 3.5d: the share of armour a nation wants in its army's upkeep rises with its income, in
// peace too, and an armoured enemy does not shut its own armour out.
describe('the mix (PLAN 3.5d)', () => {
  const FRA = nationId('FRA');
  const orders = (w: Sim['world'], n: number): number[] => w.production.ids().filter((id) => land(w, id) && w.production.cols.nation[id] === n).map((id) => w.production.cols.template[id]!);
  const clear = (w: Sim['world'], n: number): void => w.formations.ids().filter((id) => w.formations.cols.nation[id] === n).forEach((id) => destroyFormation(w, id));
  const rich = (w: Sim['world'], n: number): void => {
    w.nations.cols.gold[n] = 1e7;
    w.nations.cols.manpower[n] = 1e7;
  };

  it('the share wanted is none up to RICH_INCOME, rises with the income and ends at ARMOUR_SHARE_MAX', () => {
    expect(armourWanted(POOR_INCOME)).toBe(0);
    expect(armourWanted(RICH_INCOME)).toBe(0);
    let last = 0;
    for (let income = RICH_INCOME + 50; income <= ARMOUR_FULL_INCOME; income += 50) {
      expect(armourWanted(income)).toBeGreaterThan(last);
      last = armourWanted(income);
    }
    expect(last).toBeCloseTo(ARMOUR_SHARE_MAX, 9);
    expect(armourWanted(10 * ARMOUR_FULL_INCOME)).toBe(ARMOUR_SHARE_MAX);
  });

  it('a rich nation at peace with no armour orders armour first, and infantry once it has its share', () => {
    const s = peaceful();
    const w = s.world;
    clear(w, GER!);
    rich(w, GER!);
    expect(w.wars.list).toHaveLength(0);
    runEvents(s, 1);
    const got = orders(w, GER!);
    expect(got.length).toBeGreaterThan(2);
    expect(got[0]).toBe(PANZER);
    // One armoured division is over the share of an army of a few divisions: the rest are infantry.
    expect(got.slice(1).every((t) => t === BUILD_MIX_1938.infantry)).toBe(true);
  });

  it('a nation with more armour than it wants orders none, at war too', () => {
    const s = peaceful();
    const w = s.world;
    w.wars.set(GER!, LUX!, true);
    w.nations.cols.aiOff[LUX!] = 1;
    clear(w, GER!);
    for (let k = 0; k < 6; k++) addDivision(w, GER!, 500 + k, 300, PANZER);
    rich(w, GER!);
    w.nations.cols.builds[GER!] = 2; // the third order of the rule before
    runEvents(s, 1);
    const got = orders(w, GER!);
    expect(got.length).toBeGreaterThan(0);
    expect(got.every((t) => t === BUILD_MIX_1938.infantry)).toBe(true);
  });

  /**
   * Germany at war with Luxembourg, its army cleared and one infantry division in training, its
   * gold `gold(income)`; with `army`, infantry divisions to its peacetime share of its income
   * (`peaceShare`), on foot: no armour. Its orders after the economic AI's month.
   */
  const saving = (gold: (income: number) => number, army: boolean): number[] => {
    const s = peaceful();
    const w = s.world;
    const nc = w.nations.cols;
    w.settings.aiEnabled = true;
    w.nations.forEach((n) => (nc.aiOff[n] = n === GER! ? 0 : 1));
    w.wars.set(GER!, LUX!, true);
    clear(w, GER!);
    rich(w, GER!);
    const income = Math.max(0, monthlyAccounts(w, ECONOMY_TABLES_1938).gross[GER!]!);
    if (army) {
      while (monthlyAccounts(w, ECONOMY_TABLES_1938).upkeep[GER!]! < peaceShare(nc.aggression[GER!]!) * income) addDivision(w, GER!, 1133, 271);
      expect(monthlyAccounts(w, ECONOMY_TABLES_1938).upkeep[GER!]!).toBeLessThan(ARMY_SHARE_WAR * income);
    }
    expect(queueFormation(w, GER!, BUILD_MIX_1938.infantry)).not.toBe(0);
    nc.gold[GER!] = gold(income);
    economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
    return orders(w, GER!);
  };
  const price = (t: number): number => RULES_1938.templates[t]!.gold;

  it('short of the price of its armour, a nation with an order in training and its peacetime army orders nothing more: it saves', () => {
    // The price of two infantry divisions and the reserve, and less than the armoured one's.
    expect(2 * price(BUILD_MIX_1938.infantry)).toBeLessThan(price(PANZER));
    expect(saving((income) => 2 * price(BUILD_MIX_1938.infantry) + RESERVE_MONTHS * income + 1, true)).toEqual([BUILD_MIX_1938.infantry]);
    // With the armoured division's price it is ordered, and the infantry after it.
    const got = saving((income) => price(PANZER) + price(BUILD_MIX_1938.infantry) + RESERVE_MONTHS * income + 1, false);
    expect(got.slice(0, 3)).toEqual([BUILD_MIX_1938.infantry, PANZER, BUILD_MIX_1938.infantry]);
  });

  it('a nation whose army is under its peacetime share does not save for armour: it raises what it can pay for (PLAN 7.3b)', () => {
    // Seed 7321: the Soviet Union, its army gone at war, two slots and gold for two infantry
    // divisions, ordered one at a time for ten years. Before PLAN 7.3b this was [infantry]: the
    // one in training and nothing more. Now two more, with the gold for two (and the reserve of
    // a nation at war with its army under its peacetime share, PLAN 7.65).
    expect(saving((income) => 2 * price(BUILD_MIX_1938.infantry) + WAR_RESERVE_MONTHS * income + 1, false)).toEqual([BUILD_MIX_1938.infantry, BUILD_MIX_1938.infantry, BUILD_MIX_1938.infantry]);
  });

  it('at war with its army under its peacetime share a nation keeps no reserve from its orders (PLAN 7.65, ADR-615)', () => {
    // The defenders of an income of 150-500 were stopped by gold in 549 of 751 months at war
    // (PLAN 7.49e): a division's price and three months of income more. Before, [infantry]: the
    // one in training and nothing more.
    expect(WAR_RESERVE_MONTHS).toBe(0);
    const inf = BUILD_MIX_1938.infantry;
    expect(saving(() => price(inf) + 1, false)).toEqual([inf, inf]);
    // Under the price: nothing.
    expect(saving(() => price(inf) - 1, false)).toEqual([inf]);
    // In peace the reserve is RESERVE_MONTHS: the same gold orders nothing more, and the price
    // with the reserve one division more.
    const atPeace = (gold: (income: number) => number): number[] => {
      const s = peaceful();
      const w = s.world;
      const nc = w.nations.cols;
      w.settings.aiEnabled = true;
      w.nations.forEach((n) => (nc.aiOff[n] = n === GER! ? 0 : 1));
      // Its land army cleared, its fleets kept: a nation with no navy saves for a warship (ADR-557).
      w.formations.ids().filter((id) => w.formations.cols.nation[id] === GER! && !w.isFleet(id) && !w.isWing(id)).forEach((id) => destroyFormation(w, id));
      rich(w, GER!);
      nc.aggression[GER!] = 100; // room in its peacetime share for the orders
      const income = Math.max(0, monthlyAccounts(w, ECONOMY_TABLES_1938).gross[GER!]!);
      expect(monthlyAccounts(w, ECONOMY_TABLES_1938).upkeep[GER!]!).toBeLessThan(peaceShare(nc.aggression[GER!]!) * income);
      expect(queueFormation(w, GER!, inf)).not.toBe(0);
      nc.gold[GER!] = gold(income);
      economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
      return orders(w, GER!);
    };
    expect(atPeace(() => price(inf) + 1)).toEqual([inf]);
    expect(atPeace((income) => price(inf) + RESERVE_MONTHS * income + 1)).toEqual([inf, inf]);
  });

  it('against an armour-heavy enemy a rich nation orders its armour and motorised divisions', () => {
    const s = peaceful();
    const w = s.world;
    w.wars.set(GER!, FRA, true);
    w.nations.cols.aiOff[GER!] = 1;
    clear(w, GER!);
    clear(w, FRA);
    for (let k = 0; k < 6; k++) addDivision(w, GER!, 500 + k, 300, PANZER);
    rich(w, FRA);
    runEvents(s, 1);
    const got = orders(w, FRA);
    expect(got[0]).toBe(PANZER);
    expect(got).toContain(BUILD_MIX_1938.motorised);
    expect(got).not.toContain(BUILD_MIX_1938.infantry);
  });
});
