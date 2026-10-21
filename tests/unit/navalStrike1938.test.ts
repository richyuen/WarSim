import { describe, expect, it } from 'vitest';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { NAVAL_STRIKE_FIRE, SALT_STRIKE_SHIP, shipEffectiveness, strikes } from '../../src/sim/systems/airCombat';
import { hash32, hashToUnit } from '../../src/sim/core/hash';
import { ARMOR_PEN } from '../../src/sim/systems/combat';
import type { UnitRule, World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.4c: a strike sortie at its target fires on the enemy's ships there by its aircraft's
// hard attack against their armour: hit points in full (NAVAL_STRIKE_FIRE), over their hp.

const [ITA, ENG] = ['ITA', 'ENG'].map(nationId) as [number, number];
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
const wingOf = (w: World, nation: number, t: string): number =>
  [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === nation && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === t)![0];
const fleetOf = (w: World, nation: number, t: string): number =>
  [...w.formations.ids()].find((id) => w.isFleet(id) && w.formations.cols.nation[id] === nation && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === t)!;
/** What formation `g` has, ships with the damage carried counted off. */
const ships = (w: World, g: number): number => {
  const ec = w.elements.cols;
  let n = 0;
  w.elements.forEach((e) => {
    if (ec.formation[e] === g) n += ec.strength[e]! - ec.wound[e]!;
  });
  return n;
};
/** Wing `id` reaching (x, y) on a strike there this hour. */
function arriving(w: World, id: number, x: number, y: number): void {
  w.wingMission.set(id, { kind: 'strike', x, y });
  w.sorties.set(id, { bx: x - 2, by: y, tx: x, ty: y, launch: w.tick - 0.5, kmh: 400, km: 200, over: 0 });
}
/** Every formation but `keep` moved far off. */
function alone(w: World, keep: number[]): void {
  const c = w.formations.cols;
  for (const id of w.formations.ids()) if (!keep.includes(id) && !w.isWing(id)) [c.x[id], c.y[id]] = [5.5, 5.5];
}

describe('naval strike (PLAN 5.4c)', () => {
  it('the hard attack, halved on a battleship\'s armour: a naval bomber on a destroyer 20, on a battleship 10', () => {
    const w = sim().world;
    const unit = (cls: string): UnitRule => w.rules!.units.find((u) => u.cls === cls)!;
    const nb = w.rules!.units.find((u) => u.cls === 'naval_bomber')!;
    expect(shipEffectiveness(nb, unit('dd'))).toBe(20);
    expect(shipEffectiveness(nb, unit('bb'))).toBe(20 * ARMOR_PEN);
    expect(shipEffectiveness(nb, unit('tp'))).toBe(20);
    expect(NAVAL_STRIKE_FIRE).toBe(1);
  });

  it('an Italian naval bomber group on a British fleet: each squadron\'s hit points on one ship, picked by health, by the rule', () => {
    const w = sim().world;
    w.wars.start([ITA], [ENG], 0);
    const wing = wingOf(w, ITA, 'naval_bomber_group');
    const fleet = [...w.formations.ids()].find((id) => w.isFleet(id) && w.formations.cols.nation[id] === ENG)!;
    alone(w, [fleet]);
    const ec = w.elements.cols;
    const rules = w.rules!;
    const els = [...w.elements.ids()].filter((e) => ec.formation[e] === fleet && ec.strength[e]! > 0).sort((a, b) => a - b);
    const total = els.reduce((s, t) => s + ec.strength[t]! * rules.units[ec.unit[t]!]!.hpPerUnit, 0);
    // Each squadron puts its fire on one ship, picked by hit points (PLAN 7.61, ADR-606; it was
    // spread over every ship by them): a ship takes at most what it has left.
    const fire = new Map<number, number>();
    for (const e of [...w.elements.ids()].filter((x) => ec.formation[x] === wing)) {
      const u = hashToUnit(hash32(w.seed, w.tick, e, SALT_STRIKE_SHIP)) * total;
      let acc = 0;
      const t = els.find((x) => (acc += ec.strength[x]! * rules.units[ec.unit[x]!]!.hpPerUnit) > u)!;
      const ut = rules.units[ec.unit[t]!]!;
      fire.set(t, (fire.get(t) ?? 0) + (ec.strength[e]! * shipEffectiveness(rules.units[ec.unit[e]!]!, ut) * NAVAL_STRIKE_FIRE) / ut.hpPerUnit);
    }
    let want = 0;
    for (const [t, d] of fire) want += Math.min(d, ec.strength[t]! - ec.wound[t]!);
    expect(fire.size, 'ships struck: at most one a squadron').toBeLessThan(els.length);
    const before = ships(w, fleet);
    arriving(w, wing, w.formations.cols.x[fleet]!, w.formations.cols.y[fleet]!);
    strikes(w);
    expect(before - ships(w, fleet)).toBeCloseTo(want, 9);
    expect(want).toBeGreaterThan(0.05);
  });

  it('a transport group hit by the hard attack; what is aboard it is not struck', () => {
    const s = sim();
    const w = s.world;
    w.wars.start([ITA], [ENG], 0);
    const wing = wingOf(w, ITA, 'naval_bomber_group');
    const tp = fleetOf(w, ENG, 'transport_group');
    const army = [...w.formations.ids()].find((id) => !w.offLand(id) && w.formations.cols.nation[id] === ENG)!;
    alone(w, [tp, army]);
    const c = w.formations.cols;
    // Aboard, as `embarked` has it, and at the fleet's place.
    w.embarked.set(army, { fleet: tp, land: 0, water: 0, target: 0 });
    [c.x[army], c.y[army]] = [c.x[tp]!, c.y[tp]!];
    const [t0, a0] = [ships(w, tp), ships(w, army)];
    arriving(w, wing, c.x[tp]!, c.y[tp]!);
    strikes(w);
    expect(ships(w, tp)).toBeLessThan(t0);
    expect(ships(w, army)).toBe(a0);
  });
});
