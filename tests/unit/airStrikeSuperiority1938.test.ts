import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { strikes } from '../../src/sim/systems/airCombat';
import { AIR_STRIKE } from '../../src/sim/systems/airSuperiority';
import { bombIndustry } from '../../src/sim/systems/bombing';
import { destroyFormation } from '../../src/sim/systems/elements';
import { airOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 5.8t3: air superiority on a strike's bombs: its fire and its tons × (1 + AIR_STRIKE ×
// (2s − 1)), s the striker's superiority in the air zone of its target.

const [GER, POL] = ['GER', 'POL'].map(nationId) as [number, number];
const template = (t: string): number => TEMPLATES_1938.findIndex((x) => x.id === t);
const [cx, cy] = cellOf(19.0, 52.0, SIZE_1938.w, SIZE_1938.h).map(Math.floor) as [number, number];
const TARGET: [number, number] = [cx + 0.5, cy + 0.5];
/** The 1938 world with the AI off: the missions here are the test's, not the air AI's (PLAN 5.6). */
const sim = (): Sim => {
  const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  s.world.settings.aiEnabled = false;
  return s;
};
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

/** The air over the target to `air` (0 for no one's). */
const over = (w: World, air: number): void => {
  if (air) w.airPower.set(airOf(w).zoneOf[cy * w.cells.w + cx]!, new Map([[air, 900]]));
};
/** What a German close support group's strike on a Polish infantry division takes, the air over it to `air`. */
function taken(air: number): number {
  const w = world();
  const div = addDivision(w, POL, cx, cy, template('infantry_div'));
  over(w, air);
  const before = units(w, div);
  arriving(w, stukas(w), TARGET);
  strikes(w);
  return before - units(w, div);
}
/** The tons a German tactical bomber group drops on the industry at the target, the air over it to `air`. */
function damage(air: number): number {
  const w = world();
  over(w, air);
  const wing = [...w.wingBase].find(([id, b]) => w.formations.cols.nation[id] === GER && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === 'tactical_bomber_group')![0];
  return bombIndustry(w, wing, ...TARGET);
}

describe('air superiority on a strike (PLAN 5.8t3)', () => {
  it('a strike takes × 1 + AIR_STRIKE under its side\'s air, × 1 − AIR_STRIKE under the enemy\'s, as much under none and a bystander\'s', () => {
    expect(AIR_STRIKE).toBe(0.25);
    const none = taken(0);
    expect(none).toBeGreaterThan(0);
    expect(taken(nationId('SWE'))).toBe(none);
    expect(taken(GER)).toBeCloseTo(1.25 * none, 9);
    expect(taken(POL)).toBeCloseTo(0.75 * none, 9);
  });

  it('its tons on industry the same (what they damage is by the tons, capped at MAX_DAMAGE a cell)', () => {
    const none = damage(0);
    expect(none).toBeGreaterThan(0);
    expect(damage(GER)).toBeCloseTo(1.25 * none, 9);
    expect(damage(POL)).toBeCloseTo(0.75 * none, 9);
  });
});
