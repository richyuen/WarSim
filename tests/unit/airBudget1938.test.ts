import { describe, expect, it } from 'vitest';
import { AIR_SHARE } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { UPKEEP_SCALE } from '../../src/sim/systems/economy';
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

  it('with fighters half its wings or more, a tactical bomber group; with no airfield, none', () => {
    const s = peaceful(['GER']);
    const w = s.world;
    const GER = id('GER');
    const c = w.formations.cols;
    // Germany keeps its fighters and two of its other wings.
    const others = [...w.wingBase.keys()].filter((f) => c.nation[f] === GER && c.template[f] !== wingsMix.fighter).sort((a, b) => a - b);
    for (const f of others.slice(2)) destroyFormation(w, f);
    runEvents(s, 1);
    expect(ordered(w, GER)).toEqual([wingsMix.tactical]);
    const v = peaceful(['GER']);
    v.world.airbases.forEach((b) => {
      if (v.world.cells.controller[b.cell] === GER) v.world.cells.controller[b.cell] = id('POL');
    });
    runEvents(v, 1);
    expect(ordered(v.world, GER)).toEqual([]);
  });
});
