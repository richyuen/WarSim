import { describe, expect, it } from 'vitest';
import { budgetOf, economicAi, REFILL_MONTH, RESERVE_MONTHS } from '../../src/sim/ai/economic';
import { BUILD_MIX_1938, ECONOMY_TABLES_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { bleedFormation, elementIndex, settleFormation } from '../../src/sim/systems/elements';
import { monthlyAccounts } from '../../src/sim/systems/economy';
import { queueFormation, refillable, refillFormation } from '../../src/sim/systems/production';
import { declareWar } from '../../src/sim/systems/war';
import { Domain, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 7.3e1 (ADR-435): a land formation at rest on its nation's land is refilled from the pool
// of manpower, at the price of a man of its template, by the economic AI's step 3a before its new
// orders and under the bounds they have. Before, no rule gave a formation men back: on seed 7321
// the Soviet formations bled to shells and died while its pool grew unused.

const GER = nationId('GER');
const FRA = nationId('FRA');
const POL = nationId('POL');

function world1938(): World {
  const w = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
  w.nations.forEach((n) => (w.nations.cols.aggression[n] = 100));
  return w;
}

/** A German land formation of a template with elements, at full strength, standing on a cell Germany controls. */
function germanDivision(w: World): number {
  const fc = w.formations.cols;
  const { w: width, controller } = w.cells;
  for (const id of w.formations.ids()) {
    const rule = w.rules!.templates[fc.template[id]!];
    if (fc.nation[id] !== GER || !rule || rule.domain !== Domain.land || w.offLand(id)) continue;
    if (fc.strength[id] !== rule.manpower || (elementIndex(w).get(id)?.length ?? 0) < 4) continue;
    if (controller[Math.floor(fc.y[id]!) * width + Math.floor(fc.x[id]!)] !== GER) continue;
    return id;
  }
  throw new Error('no German division at home');
}

/** The economic AI's month, as the 1938 game runs it. */
const month = (w: World): void => economicAi(ECONOMY_TABLES_1938, BUILD_MIX_1938)(w);

const fullOf = (w: World, id: number): number => w.rules!.templates[w.formations.cols.template[id]!]!.manpower;
const perMan = (w: World, id: number): number => {
  const r = w.rules!.templates[w.formations.cols.template[id]!]!;
  return r.gold / r.manpower;
};

/** The world with a German division bled to half, Germany rich in gold and men. */
function bled(): { w: World; id: number } {
  const w = world1938();
  const id = germanDivision(w);
  bleedFormation(w, id, 0.5);
  w.nations.cols.gold[GER] = 1e6;
  w.nations.cols.manpower[GER] = 1e6;
  return { w, id };
}

describe("a formation is refilled from its nation's pool (PLAN 7.3e1)", () => {
  it('a bled division at rest at home gets REFILL_MONTH of its men back in a month, paid in men and gold', () => {
    const { w, id } = bled();
    // Without AI the month is the refills and the research alone (no orders spend the gold).
    w.nations.cols.aiOff[GER] = 1;
    const nc = w.nations.cols;
    const before = w.formations.cols.strength[id]!;
    const full = fullOf(w, id);
    expect(before).toBeLessThan(0.6 * full);
    const others = w.formations.ids().filter((x) => x !== id && w.formations.cols.nation[x] === GER).map((x) => w.formations.cols.strength[x]!);
    month(w);
    const gained = w.formations.cols.strength[id]! - before;
    expect(gained).toBeGreaterThan(0.95 * REFILL_MONTH * full);
    expect(gained).toBeLessThanOrEqual(REFILL_MONTH * full + 1);
    // The pool and the treasury pay for every man Germany's formations got back.
    const all = w.formations.ids().filter((x) => x !== id && w.formations.cols.nation[x] === GER).map((x) => w.formations.cols.strength[x]!);
    const men = gained + all.reduce((a, b) => a + b, 0) - others.reduce((a, b) => a + b, 0);
    expect(1e6 - nc.manpower[GER]!).toBeCloseTo(men, 0);
    expect(1e6 - nc.gold[GER]!).toBeGreaterThanOrEqual(gained * perMan(w, id) - 1e-6);
  });

  it('the AI refills with what its orders leave, and a shell is whole in four months, no more than whole', () => {
    const w = world1938();
    const id = germanDivision(w);
    bleedFormation(w, id, 0.9);
    const full = fullOf(w, id);
    for (let m = 0; m < 4; m++) {
      w.nations.cols.gold[GER] = 1e7;
      w.nations.cols.manpower[GER] = 1e7;
      month(w);
    }
    expect(Math.abs(w.formations.cols.strength[id]! - full)).toBeLessThanOrEqual(1);
    month(w);
    expect(Math.abs(w.formations.cols.strength[id]! - full)).toBeLessThanOrEqual(1);
  });

  it("a slot whose element died gets a new one of the template's unit there", () => {
    const w = world1938();
    const id = germanDivision(w);
    const ec = w.elements.cols;
    const dead = elementIndex(w).get(id)![0]!;
    const slot = ec.slot[dead]!;
    const unit = ec.unit[dead]!;
    ec.strength[dead] = 0;
    settleFormation(w, id);
    expect(elementIndex(w).get(id)!.some((e) => ec.slot[e] === slot)).toBe(false);
    expect(refillable(w, id)).toBe(true);
    expect(refillFormation(w, id, 1e6)).toBeGreaterThan(0);
    const back = elementIndex(w).get(id)!.find((e) => w.elements.cols.slot[e] === slot);
    expect(back).toBeDefined();
    expect(w.elements.cols.unit[back!]).toBe(unit);
    expect(w.elements.cols.formation[back!]).toBe(id);
    expect(w.formations.cols.strength[id]).toBe(fullOf(w, id));
    // The index stays ascending, as a rebuilt one is.
    const now = elementIndex(w).get(id)!;
    expect(now).toEqual([...now].sort((a, b) => a - b));
    w.elementIndex = null;
    expect(elementIndex(w).get(id)).toEqual(now);
  });

  it("none is refilled in contact, retreating, on a march home, short of supply, or off its nation's land", () => {
    const cases: ((w: World, id: number) => void)[] = [
      (w, id) => (w.formations.cols.engaged[id] = 1),
      (w, id) => (w.formations.cols.retreat[id] = 5),
      (w, id) => (w.formations.cols.home[id] = 1),
      (w, id) => (w.formations.cols.supply[id] = 0.3),
      (w, id) => {
        const fc = w.formations.cols;
        w.cells.controller[Math.floor(fc.y[id]!) * w.cells.w + Math.floor(fc.x[id]!)] = FRA;
      },
    ];
    for (const set of cases) {
      const { w, id } = bled();
      expect(refillable(w, id)).toBe(true);
      set(w, id);
      expect(refillable(w, id)).toBe(false);
      const before = w.formations.cols.strength[id]!;
      month(w);
      expect(w.formations.cols.strength[id]).toBe(before);
    }
  });

  it('none without men in the pool, or without gold above the reserve of a new order', () => {
    for (const short of ['men', 'gold'] as const) {
      const { w, id } = bled();
      w.nations.cols.aiOff[GER] = 1;
      if (short === 'men') w.nations.cols.manpower[GER] = 0;
      else w.nations.cols.gold[GER] = 0;
      const before = w.formations.cols.strength[id]!;
      month(w);
      expect(w.formations.cols.strength[id]).toBe(before);
    }
  });
  it('with no army order in training, the refills keep the price of the next one (PLAN 7.3e3)', () => {
    // Before, they spent each month's surplus to the reserve, and an order wants the reserve and
    // its price: the Soviet Union of seed 1 raised nothing in ten years.
    for (const training of [false, true]) {
      const { w, id } = bled();
      const nc = w.nations.cols;
      for (const o of w.production.ids()) if (w.production.cols.nation[o] === GER) w.production.remove(o);
      if (training) expect(queueFormation(w, GER, BUILD_MIX_1938.infantry)).not.toBe(0);
      const { income } = budgetOf(w, GER, monthlyAccounts(w, ECONOMY_TABLES_1938));
      const price = w.rules!.templates[BUILD_MIX_1938.infantry]!.gold;
      nc.gold[GER] = RESERVE_MONTHS * income + 0.9 * price;
      const before = w.formations.cols.strength[id]!;
      month(w);
      const orders = w.production.ids().filter((o) => w.production.cols.nation[o] === GER).length;
      // No new order: the treasury is short of one with its reserve.
      expect(orders).toBe(training ? 1 : 0);
      if (training) expect(w.formations.cols.strength[id]!).toBeGreaterThan(before + 0.95 * REFILL_MONTH * fullOf(w, id) - 1);
      else expect(w.formations.cols.strength[id]).toBe(before);
    }
  });
  it('at war the refills do not keep the next order its price (PLAN 7.26c2b)', () => {
    // Before, seed 2843's Brazil saved for a division through a war of six months, and its 612
    // and 38 men at Bolivia's border were refilled by no man while the pool held 1.21 M.
    const { w, id } = bled();
    const nc = w.nations.cols;
    for (const o of w.production.ids()) if (w.production.cols.nation[o] === GER) w.production.remove(o);
    expect(declareWar(w, GER, POL)).not.toBeNull();
    const { income } = budgetOf(w, GER, monthlyAccounts(w, ECONOMY_TABLES_1938));
    const price = w.rules!.templates[BUILD_MIX_1938.infantry]!.gold;
    nc.gold[GER] = RESERVE_MONTHS * income + 0.9 * price;
    const before = w.formations.cols.strength[id]!;
    month(w);
    expect(w.production.ids().filter((o) => w.production.cols.nation[o] === GER).length).toBe(0);
    expect(w.formations.cols.strength[id]!).toBeGreaterThan(before + 0.95 * REFILL_MONTH * fullOf(w, id) - 1);
  });
});
