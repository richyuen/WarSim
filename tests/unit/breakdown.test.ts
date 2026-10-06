import { describe, expect, it } from 'vitest';
import { RULES_1938, SIZE_1938, UNIT_IDS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex } from '../../src/sim/systems/elements';
import { BASE_ATTRITION_PER_DAY, BREAKDOWN_PER_DAY } from '../../src/sim/systems/supply';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { setUp } from '../helpers/pocket';

// PLAN 3.2d: breakdowns. A formation that moves on engines, with no supply and no org left,
// loses its vehicles and its towed guns faster than the 2% a day that every formation without
// supply loses; its men go at the 2%.
// AT (PLAN 3.2's, the three stages in one test): unsupplied armour slows, then loses org, then
// strength.

const W = SIZE_1938.w;
const unit = (id: string): number => UNIT_IDS_1938.indexOf(id);

/** What formation `f` has of unit type `id`, in that type's units (tanks, guns, men), and when whole. */
function has(world: World, f: number, id: string): { now: number; whole: number } {
  const ec = world.elements.cols;
  const els = (elementIndex(world).get(f) ?? []).filter((e) => ec.unit[e] === unit(id));
  const rule = RULES_1938.templates[world.formations.cols.template[f]!]!;
  const count = rule.elements.find((e) => e.unit === unit(id))?.count ?? 0;
  return { now: els.reduce((s, e) => s + ec.strength[e]!, 0), whole: count * RULES_1938.units[unit(id)]!.size };
}

describe('breakdowns (PLAN 3.2d)', () => {
  it('a unit type breaks down when it burns fuel and is counted in vehicles or guns, not in men', () => {
    const breaks = UNIT_IDS_1938.filter((_, u) => RULES_1938.units[u]!.fuel > 0 && RULES_1938.units[u]!.menPerUnit > 1);
    expect(breaks).toEqual(['artillery_heavy', 'tank_light', 'tank_medium', 'tank_medium_2', 'tank_heavy', 'tank_mbt']);
    // The men of the motorised and the mechanised infantry burn fuel and are men.
    for (const id of ['infantry_motorised', 'infantry_mechanised']) {
      expect(RULES_1938.units[unit(id)]!.fuel, id).toBeGreaterThan(0);
      expect(RULES_1938.units[unit(id)]!.menPerUnit, id).toBe(1);
    }
    expect(BREAKDOWN_PER_DAY).toBeGreaterThan(BASE_ATTRITION_PER_DAY);
  });

  it('unsupplied armour slows, then loses its org, then its vehicles: in that order', () => {
    const fed = setUp(false);
    const { s, pz, inf, rifle, x0 } = setUp(true);
    const w = s.world;
    const f = w.formations.cols;
    const tanks = (): number => has(w, pz, 'tank_light').now + has(w, pz, 'tank_medium').now;
    const whole = has(w, pz, 'tank_light').whole + has(w, pz, 'tank_medium').whole;
    expect(whole).toBe(340);
    expect(tanks()).toBe(whole);

    // Hour 4: slower than on its network, with all its org and all its tanks.
    fed.s.step(4);
    s.step(4);
    expect(f.x[pz]! - x0).toBeGreaterThan(0);
    expect(f.x[pz]! - x0).toBeLessThan(0.8 * (fed.s.world.formations.cols.x[fed.pz]! - fed.x0));
    expect(f.supply[pz]!).toBeGreaterThan(0);
    expect(f.org[pz]).toBe(1);
    expect(tanks()).toBe(whole);

    // Hour 20: dry since hour 5, half its org gone, and still all its tanks (the 2% a day of
    // a formation without supply is a fifth of a tank a day in a company of ten).
    s.step(16);
    expect(f.supply[pz]).toBe(0);
    expect(f.org[pz]).toBe(0.5);
    expect(tanks()).toBe(whole);

    // Hour 35: the last hour with org.
    s.step(15);
    expect(f.org[pz]!).toBeGreaterThan(0);
    expect(tanks()).toBe(whole);
    s.step(1);
    expect(f.org[pz]).toBe(0);

    // Two days with no org: the tanks and the towed guns go, the men as before.
    const men = has(w, pz, 'infantry_motorised');
    expect(men.whole).toBe(4000);
    s.step(48);
    const days = 2 + 1 / 24; // the hour the org went is the first
    // Its men: 84 hours, 80 of them dry, at the 2% a day and what the ground takes besides
    // (the infantry division beside it loses the same share of its men an hour).
    const menLost = 1 - has(w, pz, 'infantry_motorised').now / men.whole;
    const perDay = menLost / (80 / 24);
    const foot = has(w, inf, 'infantry');
    const footPerDay = (1 - foot.now / foot.whole) / (77 / 24); // dry in hour 8
    expect(perDay).toBeGreaterThan(0.9 * BASE_ATTRITION_PER_DAY);
    expect(perDay / footPerDay).toBeGreaterThan(0.9);
    expect(perDay / footPerDay).toBeLessThan(1.1);
    // Its tanks: that and the breakdowns. A company of ten loses whole tanks, so up to one of
    // the ten is still carried.
    const lost = 1 - tanks() / whole;
    expect(lost).toBeGreaterThan(days * (BREAKDOWN_PER_DAY + perDay) - 0.1);
    expect(lost).toBeLessThan(days * (BREAKDOWN_PER_DAY + perDay));
    expect(lost).toBeGreaterThan(2 * menLost);
    const guns = has(w, pz, 'artillery_heavy');
    expect(guns.now).toBeLessThan(guns.whole);

    // What walks keeps its org, and with it its vehicles: the Soviet rifle division's tank
    // battalion is whole, and its men went as the infantry division's.
    expect(f.org[rifle]).toBe(1);
    expect(has(w, rifle, 'tank_light')).toEqual({ now: 30, whole: 30 });
    const rifles = has(w, rifle, 'infantry');
    expect((1 - rifles.now / rifles.whole) / (77 / 24) / footPerDay).toBeGreaterThan(0.9);
    expect((1 - rifles.now / rifles.whole) / (77 / 24) / footPerDay).toBeLessThan(1.1);
  });

  it('with supply left, or back on its network, nothing breaks down', () => {
    // No org and supply left (a formation whose order was lost another way).
    const cut = setUp(true);
    const g = cut.s.world.formations.cols;
    g.org[cut.idle] = 0;
    cut.s.step(7); // armour that stands is dry in hour 8
    expect(g.supply[cut.idle]!).toBeGreaterThan(0);
    expect(g.org[cut.idle]).toBe(0);
    const el = elementIndex(cut.s.world).get(cut.idle)!;
    for (const e of el) expect(cut.s.world.elements.cols.wound[e]).toBe(0);
    // On its network with no org: it gets its org back and loses nothing.
    const fed = setUp(false);
    fed.s.world.formations.cols.org[fed.idle] = 0;
    fed.s.step(24);
    expect(has(fed.s.world, fed.idle, 'tank_light')).toEqual({ now: 300, whole: 300 });
    for (const e of elementIndex(fed.s.world).get(fed.idle)!) expect(fed.s.world.elements.cols.wound[e]).toBe(0);
  });

  it('a save in the days of the breakdown goes on as the saved game', () => {
    const { s, pz } = setUp(true);
    s.step(60);
    const t = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    t.step(3);
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    s.step(24);
    t.step(24);
    expect(has(t.world, pz, 'tank_light').now).toBe(has(s.world, pz, 'tank_light').now);
    expect(has(s.world, pz, 'tank_light').now).toBeLessThan(300);
    expect(t.hash()).toBe(s.hash());
  });
});
