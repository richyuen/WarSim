import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderMission } from '../../src/sim/systems/air';
import { STRIKE_FIRE, strikes } from '../../src/sim/systems/airCombat';
import { effectiveness } from '../../src/sim/systems/combat';
import { destroyFormation } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 5.4b: a strike sortie at its target fires once on the enemy's land elements there by its
// aircraft's soft and hard attack; the losses as on the land.

const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const [cx, cy] = cellOf(19.0, 52.0, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];
const TARGET: [number, number] = [cx + 0.5, cy + 0.5];
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
const stukas = (w: World): number =>
  [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === 'close_support_group')![0];
/** Germany and Poland at war, and no formation within 3 cells of the target. */
function world(s = sim()): World {
  const w = s.world;
  const c = w.formations.cols;
  for (const id of [...w.formations.ids()]) if (!w.offLand(id) && Math.abs(c.x[id]! - TARGET[0]) <= 3 && Math.abs(c.y[id]! - TARGET[1]) <= 3) destroyFormation(w, id);
  w.wars.start([GER], [POL], 0);
  return w;
}
/** Wing `id` reaching `target` on its strike this hour: `kind` its mission there. */
function arriving(w: World, id: number, target: [number, number], kind: 'strike' | 'patrol' = 'strike'): void {
  w.wingMission.set(id, { kind, x: target[0], y: target[1] });
  w.sorties.set(id, { bx: target[0] - 2, by: target[1], tx: target[0], ty: target[1], launch: w.tick - 0.5, kmh: 400, km: 200, over: 0 });
}
/** What formation `g` has, units with what is carried counted off. */
const units = (w: World, g: number): number => {
  const ec = w.elements.cols;
  let n = 0;
  w.elements.forEach((e) => {
    if (ec.formation[e] === g) n += ec.strength[e]! - ec.wound[e]!;
  });
  return n;
};
const strikesOf = (w: World): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === EventKind.AirStrike) out.push(w.out.events.slice(i, i + 6));
  return out;
};

describe('CAS and tactical bombing (PLAN 5.4b)', () => {
  it('a close support group on a Polish infantry division: its fire by the rule, once, on arriving', () => {
    const w = world();
    const div = addDivision(w, POL, cx, cy, template('infantry_div'));
    const wing = stukas(w);
    const ec = w.elements.cols;
    const rules = w.rules!;
    // The rule's figure: each squadron × its effectiveness × STRIKE_FIRE over the division's
    // elements by their health, ÷ their hp: in sum Σ over squadrons and targets.
    const sq = [...w.elements.ids()].filter((e) => ec.formation[e] === wing);
    const els = [...w.elements.ids()].filter((e) => ec.formation[e] === div);
    const health = els.map((t) => ec.strength[t]! * rules.units[ec.unit[t]!]!.hpPerUnit);
    const total = health.reduce((a, b) => a + b, 0);
    let want = 0;
    for (const e of sq) els.forEach((t, k) => (want += (ec.strength[e]! * effectiveness(rules.units[ec.unit[e]!]!, rules.units[ec.unit[t]!]!) * STRIKE_FIRE * health[k]!) / total / rules.units[ec.unit[t]!]!.hpPerUnit));
    const before = units(w, div);
    arriving(w, wing, TARGET);
    w.out.events.length = 0;
    strikes(w);
    expect(before - units(w, div)).toBeCloseTo(want, 9);
    // 30 aircraft, soft 20: about 120 men of the division.
    expect(want).toBeGreaterThan(60);
    expect(want).toBeLessThan(200);
    const ev = strikesOf(w);
    expect(ev).toHaveLength(1);
    // It logs the whole units it took: what is carried to the next is not yet one.
    expect(ev[0]![2]).toBe(wing);
    expect(ev[0]![3]).toBeLessThanOrEqual(want);
    expect(ev[0]![3]).toBeGreaterThan(want - els.length);
    // The next hour it is on its way back: no strike.
    w.tick++;
    const after = units(w, div);
    strikes(w);
    expect(units(w, div)).toBe(after);
  });

  it('on armour, by its hard attack: a panzer division loses tanks', () => {
    const w = world();
    const div = addDivision(w, POL, cx, cy, template('panzer_div'));
    const ec = w.elements.cols;
    const tanks = (): number => {
      let n = 0;
      w.elements.forEach((e) => {
        if (ec.formation[e] === div && w.rules!.units[ec.unit[e]!]!.armor > 0) n += ec.strength[e]! - ec.wound[e]!;
      });
      return n;
    };
    const t0 = tanks();
    arriving(w, stukas(w), TARGET);
    strikes(w);
    expect(tanks()).toBeLessThan(t0);
  });

  it('nothing: a patrol, a sortie turned home short of it, an enemy out of reach, its own, a nation at peace', () => {
    const w = world();
    const wing = stukas(w);
    const own = addDivision(w, GER, cx, cy, template('infantry_div'));
    const far = addDivision(w, POL, cx + 2, cy, template('infantry_div'));
    const peace = world();
    peace.wars.end(peace.wars.list.find((x) => x.sides[0].includes(GER) && x.sides[1].includes(POL))!);
    const pdiv = addDivision(peace, POL, cx, cy, template('infantry_div'));
    const [a, b, c] = [units(w, own), units(w, far), units(peace, pdiv)];
    arriving(peace, stukas(peace), TARGET);
    strikes(peace);
    arriving(w, wing, TARGET);
    strikes(w);
    expect([units(w, own), units(w, far), units(peace, pdiv)]).toEqual([a, b, c]);
    const div = addDivision(w, POL, cx, cy, template('infantry_div'));
    const d = units(w, div);
    arriving(w, wing, TARGET, 'patrol');
    strikes(w);
    arriving(w, wing, TARGET);
    w.wingMission.set(wing, { kind: 'strike', x: TARGET[0] + 5, y: TARGET[1] });
    strikes(w);
    expect(units(w, div)).toBe(d);
  });

  it('in the game: a strike ordered on a Polish division flies, strikes, and strikes again after its turn round', () => {
    const s = sim();
    const w = s.world;
    w.wars.start([GER], [POL], 0);
    const wing = stukas(w);
    // 20 cells east of its base, within its 500 km.
    const target: [number, number] = [Math.floor(w.formations.cols.x[wing]!) + 20.5, Math.floor(w.formations.cols.y[wing]!) + 0.5];
    const div = addDivision(w, POL, Math.floor(target[0]), Math.floor(target[1]), template('infantry_div'));
    expect(orderMission(w, wing, 'strike', ...target)).toBe(0);
    const d0 = units(w, div);
    let hits = 0;
    s.step(24, (ww) => {
      hits += strikesOf(ww).filter((e) => e[2] === wing).length;
      ww.out.events.length = 0;
    });
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(units(w, div)).toBeLessThan(d0);
  });
});
