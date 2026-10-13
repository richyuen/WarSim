import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { AA_CELLS, AA_FIRE, aircraftOf, antiAir } from '../../src/sim/systems/airCombat';
import { destroyFormation } from '../../src/sim/systems/elements';
import { Leg, sortieAt } from '../../src/sim/systems/sorties';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 5.3b: a sortie in the air is fired on by the AA of the formations of nations at war with
// its own below it (within AA_CELLS), land and fleets; per full element, as on the land. The AT
// of 5.3, its second half: the AA attrition rate.

const [GER, FRA] = ['GER', 'FRA'].map(nationId) as [number, number];
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const [cx, cy] = cellOf(7.75, 48.58, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];
const PLACE: [number, number] = [cx + 0.5, cy + 0.5];
const wingOf = (w: World, nation: number, t: string): number =>
  [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === nation && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === t)![0];
/** Aircraft left, with what is carried towards the next lost counted off. */
const left = (w: World, id: number): number => {
  const ec = w.elements.cols;
  let n = 0;
  w.elements.forEach((e) => {
    if (ec.formation[e] === id) n += ec.strength[e]! - ec.wound[e]!;
  });
  return n;
};
/** A world with no formation but wings within 3 cells of PLACE, France and Germany at war. */
function world(): World {
  const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
  const c = w.formations.cols;
  for (const id of [...w.formations.ids()]) if (!w.isWing(id) && Math.abs(c.x[id]! - PLACE[0]) <= 3 && Math.abs(c.y[id]! - PLACE[1]) <= 3) destroyFormation(w, id);
  w.wars.start([GER], [FRA], 0);
  return w;
}
function overhead(w: World, id: number, [x, y]: [number, number]): void {
  w.sorties.set(id, { bx: w.formations.cols.x[id]!, by: w.formations.cols.y[id]!, tx: x, ty: y, launch: w.tick - 1, kmh: 400, km: 400, over: 100 });
  expect(sortieAt(w.sorties.get(id)!, w.tick, w.cells.w).leg).toBe(Leg.Over);
}
/** The AA fire of formation `g` an hour, by the rule. */
function fireOf(w: World, g: number): number {
  const ec = w.elements.cols;
  let fire = 0;
  w.elements.forEach((e) => {
    if (ec.formation[e] !== g) return;
    const u = w.rules!.units[ec.unit[e]!]!;
    fire += (u.aa * ec.strength[e]! * AA_FIRE) / u.size;
  });
  return fire;
}

describe('AA (PLAN 5.3b)', () => {
  it('the AT: a French bomber group over a German infantry division loses its fire ÷ defence ÷ hp an hour; over 8 hours a few in a hundred', () => {
    const w = world();
    const div = addDivision(w, GER, cx, cy, template('infantry_div'));
    const b = wingOf(w, FRA, 'tactical_bomber_group');
    const b0 = aircraftOf(w, b);
    const fire = fireOf(w, div);
    expect(fire).toBeGreaterThan(0);
    overhead(w, b, PLACE);
    antiAir(w);
    // One target: all the fire on it; a tactical bomber has defence 10 and 8 hp.
    expect(b0 - left(w, b)).toBeCloseTo(fire / 10 / 8, 9);
    for (let h = 1; h < 8; h++) {
      w.tick++;
      overhead(w, b, PLACE);
      antiAir(w);
    }
    const rate = (b0 - left(w, b)) / b0 / 8;
    // An infantry division's battalions (0.5 each a full element): about 1% an hour.
    expect(rate).toBeGreaterThan(0.002);
    expect(rate).toBeLessThan(0.03);
    console.log(`AA: an infantry division's fire ${fire.toFixed(1)} an hour; a tactical bomber group loses ${(100 * rate).toFixed(2)}% an hour`);
  });

  it('its own, out of reach, a wing and an enemy at peace fire none; on the corner of its reach it fires; an AA battery 60 times a rifle battalion', () => {
    const w = world();
    const b = wingOf(w, FRA, 'tactical_bomber_group');
    const b0 = aircraftOf(w, b);
    // Nothing below: no loss.
    overhead(w, b, PLACE);
    antiAir(w);
    expect(left(w, b)).toBe(b0);
    // A division of its own below, and one of the enemy's out of reach.
    addDivision(w, FRA, cx, cy, template('infantry_div'));
    addDivision(w, GER, cx + AA_CELLS + 1, cy, template('infantry_div'));
    // A German wing on a base below: a wing has no AA.
    const gw = wingOf(w, GER, 'fighter_group');
    w.formations.cols.x[gw] = PLACE[0];
    w.formations.cols.y[gw] = PLACE[1];
    antiAir(w);
    expect(left(w, b)).toBe(b0);
    // At peace, a German division below fires none.
    const v = world();
    v.wars.end(v.wars.list.find((x) => x.sides[0].includes(GER) && x.sides[1].includes(FRA))!);
    const vb = wingOf(v, FRA, 'tactical_bomber_group');
    addDivision(v, GER, cx, cy, template('infantry_div'));
    overhead(v, vb, PLACE);
    antiAir(v);
    expect(left(v, vb)).toBe(aircraftOf(v, vb));
    // Within reach, on the corner cell: it fires.
    addDivision(w, GER, cx - AA_CELLS, cy + AA_CELLS, template('infantry_div'));
    antiAir(w);
    expect(left(w, b)).toBeLessThan(b0);
    // An AA battery's element: 30 a full element; a rifle battalion 0.5.
    const unit = (cls: string): number => w.rules!.units.findIndex((u) => u.cls === cls);
    expect(w.rules!.units[unit('aa')]!.aa).toBe(30);
    expect(w.rules!.units[unit('inf')]!.aa).toBe(0.5);
  });

  it('two sorties overhead share the fire by their aircraft; a wing shot down to none is lost', () => {
    const w = world();
    const div = addDivision(w, GER, cx, cy, template('infantry_div'));
    const [b1, b2] = [...w.wingBase].filter(([id, b]) => w.formations.cols.nation[id] === FRA && b > 0).map(([id]) => id);
    overhead(w, b1!, PLACE);
    overhead(w, b2!, PLACE);
    const [a1, a2] = [aircraftOf(w, b1!), aircraftOf(w, b2!)];
    const hp = (id: number): number => {
      const u = w.rules!.units[w.elements.cols.unit[[...w.elements.ids()].find((e) => w.elements.cols.formation[e] === id)!]!]!;
      return u.defense * u.hpPerUnit;
    };
    antiAir(w);
    const fire = fireOf(w, div);
    expect(a1 - left(w, b1!)).toBeCloseTo((fire * a1) / (a1 + a2) / hp(b1!), 9);
    expect(a2 - left(w, b2!)).toBeCloseTo((fire * a2) / (a1 + a2) / hp(b2!), 9);
    // Strip it to one aircraft and fire on: it goes.
    const ec = w.elements.cols;
    w.elements.forEach((e) => {
      if (ec.formation[e] === b1) ec.strength[e] = 0;
    });
    const first = [...w.elements.ids()].find((e) => ec.formation[e] === b1)!;
    ec.strength[first] = 1;
    ec.wound[first] = 0.99;
    antiAir(w);
    expect(w.formations.has(b1!)).toBe(false);
    expect(w.sorties.has(b1!)).toBe(false);
  });
});
