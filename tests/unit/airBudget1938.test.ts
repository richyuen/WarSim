import { describe, expect, it } from 'vitest';
import { AIR_REBUILD_SHARE, AIR_SHARE, MAX_PARALLEL, PARALLEL_INCOME } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { destroyFormation } from '../../src/sim/systems/elements';
import { Domain, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { runEvents } from '../helpers/sim1938';

// PLAN 5.8s2: the economic AI keeps its air force under AIR_SHARE of its army's upkeep: under it,
// with the gold and an airfield, it orders a wing a time, a fighter group while fighters are under
// half its wings, else a tactical bomber group; over it, none.

const id = (t: string): number => TAGS_1938.indexOf(t) + 1;
const T = ECONOMY_TABLES_1938;
const wingsMix = BUILD_MIX_1938.wings;

function peaceful(rich: string[]): Sim {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const w = s.world;
  w.nations.forEach((n) => (w.nations.cols.aggression[n] = 0));
  for (const war of [...w.wars.list]) w.wars.end(war);
  for (const t of rich) [w.nations.cols.gold[id(t)], w.nations.cols.manpower[id(t)]] = [1e6, 1e7];
  return s;
}
const ordered = (w: World, n: number): number[] => w.production.ids().filter((p) => w.production.cols.nation[p] === n && w.rules!.templates[w.production.cols.template[p]!]!.domain === Domain.air).map((p) => w.production.cols.template[p]!);
const upkeep = (w: World, n: number, of: (f: number) => boolean): number => {
  let u = 0;
  const c = w.formations.cols;
  w.formations.forEach((f) => {
    if (c.nation[f] === n && of(f)) u += (UPKEEP_SCALE * T.templateUpkeep[c.template[f]!]! * c.strength[f]!) / T.templateStrength[c.template[f]!]!;
  });
  return u;
};
const army = (w: World, f: number): boolean => !w.offLand(f);
const income = (w: World, n: number): number => Math.max(0, monthlyAccounts(w, T).gross[n]!);
const slots = (w: World, n: number): number => Math.min(MAX_PARALLEL, 1 + Math.floor(income(w, n) / PARALLEL_INCOME));

describe('the air force\'s cost (PLAN 5.8s2)', () => {
  it('under its share France orders a fighter group, one at a time; Britain, over it, none; the Soviet Union, short of money, none', () => {
    const s = peaceful(['FRA', 'ENG']);
    const w = s.world;
    const [FRA, ENG, SOV] = [id('FRA'), id('ENG'), id('SOV')];
    for (const n of [FRA, SOV]) expect(upkeep(w, n, (f) => w.isWing(f))).toBeLessThan(AIR_SHARE * upkeep(w, n, (f) => army(w, f)));
    expect(upkeep(w, ENG, (f) => w.isWing(f))).toBeGreaterThan(AIR_SHARE * upkeep(w, ENG, (f) => army(w, f)));
    runEvents(s, 1);
    expect(ordered(w, FRA)).toEqual([wingsMix.fighter]);
    expect(ordered(w, ENG)).toEqual([]);
    // Its books short (its balance under what it needs), the Soviet Union orders none.
    expect(ordered(w, SOV)).toEqual([]);
    runEvents(s, 24 * 31);
    expect(ordered(w, FRA)).toHaveLength(1);
  });

  // Germany, its other wings destroyed, is under its start's wings and rebuilds (PLAN 7.113a): several
  // in training, the first a tactical bomber group by the pick.
  it('with fighters half its wings or more, a tactical bomber group first; with no airfield, none', () => {
    const s = peaceful(['GER']);
    const w = s.world;
    const GER = id('GER');
    const c = w.formations.cols;
    // Germany keeps its fighters and two of its other wings.
    const others = [...w.wingBase.keys()].filter((f) => c.nation[f] === GER && c.template[f] !== wingsMix.fighter).sort((a, b) => a - b);
    for (const f of others.slice(2)) destroyFormation(w, f);
    runEvents(s, 1);
    const got = ordered(w, GER);
    expect(got[0]).toBe(wingsMix.tactical);
    expect(got.length).toBeLessThanOrEqual(slots(w, GER));
    const v = peaceful(['GER']);
    v.world.airbases.forEach((b) => {
      if (v.world.cells.controller[b.cell] === GER) v.world.cells.controller[b.cell] = id('POL');
    });
    runEvents(v, 1);
    expect(ordered(v.world, GER)).toEqual([]);
  });
  // PLAN 7.113a (ADR-689, the user's decision, 2026-10-24): the wings shot down in year 1 were not
  // rebuilt (88 and 145 of 216 on seeds 941 and 942), one at a time under a tenth of armies that cost
  // 5-7 % of their income late. Under its start's wings a nation rebuilds: as many in training as its
  // army's order slots while its air force costs under AIR_REBUILD_SHARE of its income; at its
  // start's, one at a time under AIR_SHARE of its army's, as before.
  it("under its start's wings France rebuilds a wing a slot, no more than it lost; at its start's, one at a time", () => {
    const order = (lose: number): { got: number[]; start: number; left: number } => {
      const s = peaceful(['FRA']);
      const w = s.world;
      const FRA = id('FRA');
      const c = w.formations.cols;
      const own = [...w.wingBase.keys()].filter((f) => c.nation[f] === FRA).sort((a, b) => a - b);
      for (const f of own.slice(0, lose)) destroyFormation(w, f);
      runEvents(s, 1);
      return { got: ordered(w, FRA), start: w.airStart.get(FRA)!, left: own.length - lose };
    };
    const at = order(0);
    expect(at.start, "France's start: its 1938 wings").toBe(15);
    expect(at.got, 'at its start, one at a time').toEqual([wingsMix.fighter]);
    // Three slots (an income of about 1,070): it lost five, it orders three.
    const lost = order(5);
    expect(lost.got).toHaveLength(3);
    expect(lost.left + lost.got.length).toBeLessThanOrEqual(lost.start);
    // Lost two: it orders two, back to its start, and no more.
    const two = order(2);
    expect(two.got).toHaveLength(2);
    expect(two.left + two.got.length).toBe(two.start);
    expect(AIR_REBUILD_SHARE).toBe(0.035);
  });

  // PLAN 7.142 (ADR-736): late, the wings shot down were not rebuilt for the three months of income the
  // rebuild kept in the treasury past a wing's price (`goldPriceHeld`, the largest of its gates on 1171-1180
  // years 2-9). At war a nation under its start's wings keeps the war's reserve, as its army's orders do
  // (ADR-615); at peace the three months.
  it("under its start's wings, with the price and less than three months more, France rebuilds at war and not at peace", () => {
    const order = (war: boolean): number[] => {
      const s = peaceful([]);
      const w = s.world;
      const [FRA, GER] = [id('FRA'), id('GER')];
      const c = w.formations.cols;
      const own = [...w.wingBase.keys()].filter((f) => c.nation[f] === FRA).sort((a, b) => a - b);
      for (const f of own.slice(0, 5)) destroyFormation(w, f);
      if (war) w.wars.start([GER], [FRA], 0);
      // The price of a fighter group and one month of its income: under RESERVE_MONTHS' three.
      w.nations.cols.gold[FRA] = w.rules!.templates[wingsMix.fighter]!.gold + income(w, FRA);
      w.nations.cols.manpower[FRA] = 1e7;
      runEvents(s, 1);
      return ordered(w, FRA);
    };
    expect(order(false)).toEqual([]);
    expect(order(true).length).toBeGreaterThan(0);
  });

  it("a nation's start of wings is saved and loaded (PLAN 7.113a)", () => {
    const s = peaceful([]);
    const before = [...s.world.airStart].sort((a, b) => a[0] - b[0]);
    expect(before.length).toBeGreaterThan(10);
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(SIZE_1938.w) });
    t.world.airStart.clear();
    t.load(s.save());
    expect([...t.world.airStart].sort((a, b) => a[0] - b[0])).toEqual(before);
  });
});
