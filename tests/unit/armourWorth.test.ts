import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, RULES_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { budgetOf, economicAi } from '../../src/sim/ai/economic';
import { Sim } from '../../src/sim/sim';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import { destroyFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 3.1d (from PLAN 2.13, ADR-86): a nation short of money sent home its weakest idle
// formation first, by men. A tank brigade has 1,800 men and a rifle division 12,600, so the
// armour went before the infantry: the dearest formations to raise again, and the fewest men
// back in the pool. AT: the rifle divisions go before the armour of the same upkeep; the Soviet
// armour count after the first cut.

const template = (t: string): number => TEMPLATES_LAND.findIndex((x) => x.id === t);
const INFANTRY = template('infantry_div');
const BRIGADE = template('tank_brigade');
const [SOV, SWE] = ['SOV', 'SWE'].map(nationId) as [number, number];
const upkeep = (t: number): number => UPKEEP_SCALE * ECONOMY_TABLES_1938.templateUpkeep[t]!;

/** The 1938 world at peace, with nobody's AI running but that of `n`. */
function world1938(n: number): World {
  const w = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) }).world;
  for (const war of [...w.wars.list]) w.wars.end(war);
  w.nations.forEach((m) => (w.nations.cols.aiOff[m] = m === n ? 0 : 1));
  return w;
}

/** How many formations of `n` there are, by template. */
function army(w: World, n: number): Map<number, number> {
  const out = new Map<number, number>();
  w.formations.forEach((id) => {
    // Its army: a fleet is not sent home (PLAN 4.2b).
    if (w.formations.cols.nation[id] === n && !w.afloat(id)) out.set(w.formations.cols.template[id]!, (out.get(w.formations.cols.template[id]!) ?? 0) + 1);
  });
  return out;
}

/** An armour formation, as the critic counted them (PLAN 2.13): it has tanks and nobody on foot. */
function isArmour(t: number): boolean {
  const cls = RULES_1938.templates[t]!.elements.map((e) => RULES_1938.units[e.unit]!.cls);
  return cls.some((c) => c.startsWith('armor')) && !cls.includes('inf');
}

describe('what armour is worth to the AI that cuts (PLAN 3.1d)', () => {
  it('the share of a template that is tanks: none of a division on foot or in lorries, most of a tank brigade', () => {
    const share = (t: string): number => ECONOMY_TABLES_1938.templateArmour[template(t)]!;
    // A share for every template of the rules: the fleets' stand after the land's (PLAN 4.2a).
    expect(ECONOMY_TABLES_1938.templateArmour).toHaveLength(RULES_1938.templates.length);
    expect(RULES_1938.templates.length).toBeGreaterThanOrEqual(TEMPLATES_LAND.length);
    for (const t of ['infantry_div', 'infantry_div_cadre', 'mountain_div', 'motorised_div', 'cavalry_div', 'garrison_brigade']) expect(share(t), t).toBe(0);
    // The Soviet rifle division has a tank battalion: a little, and far from an armour formation.
    expect(share('rifle_div_soviet')).toBeGreaterThan(0);
    expect(share('rifle_div_soviet')).toBeLessThan(0.25);
    expect(share('mech_div')).toBeLessThan(share('light_mech_div'));
    for (const t of ['panzer_div', 'tank_brigade', 'tank_corps', 'panzer_div_2', 'heavy_panzer_div', 'mbt_div']) {
      expect(share(t), t).toBeGreaterThan(0.5);
      expect(share(t), t).toBeLessThanOrEqual(1);
    }
  });

  it('short of money, a nation sends home its rifle divisions before its armour of the same upkeep', () => {
    const w = world1938(SWE);
    const f = w.formations.cols;
    const nc = w.nations.cols;
    for (const id of w.formations.ids()) if (f.nation[id] === SWE) destroyFormation(w, id);
    // Four tank brigades, each worn down to the men that cost what a rifle division costs a
    // month: fewer men than any division, and so the first to go by the rule before.
    const brigades = [0, 1, 2, 3].map((k) => addDivision(w, SWE, 500 + k, 300, BRIGADE));
    const men = (ECONOMY_TABLES_1938.templateStrength[BRIGADE]! * upkeep(INFANTRY)) / upkeep(BRIGADE);
    for (const id of brigades) f.strength[id] = men;
    expect(men).toBeLessThan(ECONOMY_TABLES_1938.templateStrength[INFANTRY]! / 10);
    // Rifle divisions until the budget is short of five of them, with the treasury empty.
    nc.gold[SWE] = 0;
    const short = (): number => {
      const b = budgetOf(w, SWE, monthlyAccounts(w, ECONOMY_TABLES_1938));
      return b.need - b.balance;
    };
    let divisions = 0;
    while (short() <= 4.5 * upkeep(INFANTRY)) {
      addDivision(w, SWE, 520 + divisions, 300, INFANTRY);
      divisions++;
    }
    expect(divisions).toBeGreaterThan(8);
    // Every formation here costs the same: so many go as cover what is short.
    const cuts = Math.ceil(short() / upkeep(INFANTRY) - 1e-9);
    expect(cuts).toBeGreaterThanOrEqual(5);
    expect(cuts).toBeLessThan(divisions);
    w.out.events.length = 0;
    economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
    const ev = w.out.events;
    const events: number[][] = [];
    for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.FormationsDisbanded) events.push([ev[i + 2]!, ev[i + 3]!]);
    expect(events).toEqual([[SWE, cuts]]);
    expect([army(w, SWE).get(BRIGADE), army(w, SWE).get(INFANTRY)]).toEqual([4, divisions - cuts]);
    expect(short()).toBeLessThanOrEqual(1e-9);
  });

  it('with no rifle division left to send home, the armour goes', () => {
    const w = world1938(SWE);
    const f = w.formations.cols;
    for (const id of w.formations.ids()) if (f.nation[id] === SWE) destroyFormation(w, id);
    w.nations.cols.gold[SWE] = 0;
    const income = budgetOf(w, SWE, monthlyAccounts(w, ECONOMY_TABLES_1938)).income;
    const brigades = Math.ceil(income / upkeep(BRIGADE)) + 4;
    for (let k = 0; k < brigades; k++) addDivision(w, SWE, 500 + k, 300, BRIGADE);
    addDivision(w, SWE, 499, 300, INFANTRY);
    economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
    expect(army(w, SWE).get(INFANTRY)).toBeUndefined();
    expect(army(w, SWE).get(BRIGADE)!).toBeLessThan(brigades - 3);
    expect(army(w, SWE).get(BRIGADE)!).toBeGreaterThan(0);
  });

  it('seed 99: the Soviet Union, its treasury empty, keeps its 34 armour formations through the first cut', () => {
    const w = world1938(SOV);
    const count = (): { armour: number; others: number } => {
      const out = { armour: 0, others: 0 };
      for (const [t, n] of army(w, SOV)) out[isArmour(t) ? 'armour' : 'others'] += n;
      return out;
    };
    const before = count();
    expect(before).toEqual({ armour: 34, others: 128 });
    w.nations.cols.gold[SOV] = 0;
    const b = budgetOf(w, SOV, monthlyAccounts(w, ECONOMY_TABLES_1938));
    expect(b.need - b.balance).toBeGreaterThan(100); // ADR-86: short 112 a month and its margin
    economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);
    const after = count();
    expect(after.armour).toBe(34);
    // By men the 34 were the weakest, and all 34 went (ADR-86). Now what has no tank in it at
    // all goes first, the 32 cavalry divisions, and then 35 of the 96 rifle divisions, which
    // have a tank battalion each.
    // With the fleets of the start (PLAN 4.2b) it is short their 73.5 a month besides, and no
    // fleet is sent home: 12 rifle divisions more go for them, 47 of the 96 (61 others were left
    // before, 49 now).
    expect(army(w, SOV).get(template('cavalry_div'))).toBeUndefined();
    expect(after.others).toBe(49);
  });
});
