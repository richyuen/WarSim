import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938, TEMPLATES_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { orderMission } from '../../src/sim/systems/air';
import { AIR_FIRE, aircraftOf, airCombat, BREAK_OFF } from '../../src/sim/systems/airCombat';
import { Leg, sortieAt } from '../../src/sim/systems/sorties';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 5.3a: the sorties of nations at war in one air zone fire on each other by their aircraft's
// air attack against the target's defence; losses in aircraft; a wing with none left is lost; a
// sortie that lost a quarter of its aircraft in the hour turns home. Fighters beat bombers.

const [GER, FRA] = ['GER', 'FRA'].map(nationId) as [number, number];
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, SIZE_1938.w, SIZE_1938.h);
const STRASBOURG = at(7.75, 48.58);
const sim = (): Sim => new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
const wingOf = (w: World, nation: number, t: string, skip = 0): number =>
  [...w.wingBase].filter(([id, b]) => w.formations.cols.nation[id] === nation && b > 0 && TEMPLATES_1938[w.formations.cols.template[id]!]!.id === t)[skip]![0];
/** Wing `id` over (x, y) on patrol now: a sortie from its base that has just come over its target. */
function over(w: World, id: number, [x, y]: [number, number]): void {
  const [bx, by] = [w.formations.cols.x[id]!, w.formations.cols.y[id]!];
  w.sorties.set(id, { bx, by, tx: x, ty: y, launch: w.tick - 1, kmh: 400, km: 400, over: 100 });
  expect(sortieAt(w.sorties.get(id)!, w.tick, w.cells.w).leg).toBe(Leg.Over);
}
/** Aircraft left, what is carried towards the next lost counted off. */
const left = (w: World, id: number): number => {
  const ec = w.elements.cols;
  let n = 0;
  w.elements.forEach((e) => {
    if (ec.formation[e] === id) n += ec.strength[e]! - ec.wound[e]!;
  });
  return n;
};
const events = (w: World, kind: number): number[][] => {
  const out: number[][] = [];
  for (let i = 0; i < w.out.events.length; i += 6) if (w.out.events[i + 1] === kind) out.push(w.out.events.slice(i, i + 6));
  return out;
};

describe('air combat (PLAN 5.3a)', () => {
  it('fighters beat bombers: an hour, a fighter group takes an eighth of a tactical bomber group and loses a fiftieth of itself', () => {
    const w = sim().world;
    w.wars.start([GER], [FRA], 0);
    const f = wingOf(w, GER, 'fighter_group');
    const b = wingOf(w, FRA, 'tactical_bomber_group');
    over(w, f, STRASBOURG);
    over(w, b, STRASBOURG);
    const [f0, b0] = [aircraftOf(w, f), aircraftOf(w, b)];
    expect([f0, b0]).toEqual([36, 24]);
    w.out.events.length = 0;
    airCombat(w, new Map([[7, [f, b]]]));
    const [f1, b1] = [aircraftOf(w, f), aircraftOf(w, b)];
    // 36 fighters × 25 × AIR_FIRE ÷ 10 defence ÷ 8 hp a bomber: 2.8 bombers; 24 × 4 × AIR_FIRE ÷
    // 12 ÷ 4: 0.5 fighters. Each squadron carries its share as on the land (none whole yet).
    expect(b0 - left(w, b)).toBeCloseTo((36 * 25 * AIR_FIRE) / 10 / 8, 9);
    expect(f0 - left(w, f)).toBeCloseTo((24 * 4 * AIR_FIRE) / 12 / 4, 9);
    const battle = events(w, EventKind.AirBattle);
    expect(battle).toHaveLength(1);
    expect(battle[0]!.slice(2, 4)).toEqual([7, f0 - f1 + b0 - b1]);
    // Hour on hour the bombers go down, the fighters hardly: over 8 hours.
    for (let h = 0; h < 8 && w.formations.has(b); h++) {
      over(w, f, STRASBOURG);
      if (w.sorties.has(b)) over(w, b, STRASBOURG);
      airCombat(w, new Map([[7, [f, b]]]));
    }
    expect(w.formations.has(b) ? aircraftOf(w, b) / b0 : 0).toBeLessThan(0.25);
    expect(aircraftOf(w, f) / f0).toBeGreaterThan(0.85);
  });

  it('fighters against fighters lose alike; nations at peace do not fight; one side alone in a zone does not', () => {
    const w = sim().world;
    const [g, f] = [wingOf(w, GER, 'fighter_group'), wingOf(w, FRA, 'fighter_group')];
    over(w, g, STRASBOURG);
    over(w, f, STRASBOURG);
    airCombat(w, new Map([[7, [g, f]]]));
    expect([aircraftOf(w, g), aircraftOf(w, f)]).toEqual([36, 36]);
    w.wars.start([GER], [FRA], 0);
    const g2 = wingOf(w, GER, 'fighter_group', 1);
    over(w, g2, STRASBOURG);
    airCombat(w, new Map([[7, [g, g2]]]));
    expect([aircraftOf(w, g), aircraftOf(w, g2)]).toEqual([36, 36]);
    airCombat(w, new Map([[7, [g, f]]]));
    expect(aircraftOf(w, g)).toBe(aircraftOf(w, f));
    expect(aircraftOf(w, g)).toBeLessThan(36);
  });

  it('a sortie that lost a quarter of its aircraft in the hour turns home from where it is; a wing with none left is lost', () => {
    const w = sim().world;
    w.wars.start([GER], [FRA], 0);
    const fighters = [0, 1, 2, 3].map((k) => wingOf(w, GER, 'fighter_group', k));
    const b = wingOf(w, FRA, 'tactical_bomber_group');
    for (const id of fighters) over(w, id, STRASBOURG);
    over(w, b, STRASBOURG);
    const b0 = aircraftOf(w, b);
    airCombat(w, new Map([[7, [...fighters, b]]]));
    expect(b0 - aircraftOf(w, b)).toBeGreaterThanOrEqual(BREAK_OFF * b0);
    const s = w.sorties.get(b)!;
    // Home from Strasbourg: its turn is now, at the place it was.
    const now = sortieAt(s, w.tick, w.cells.w);
    expect([now.x, now.y].map((v) => Math.round(v * 1e6) / 1e6)).toEqual(STRASBOURG.map((v) => Math.round(v * 1e6) / 1e6));
    expect(s.over).toBe(0);
    expect(sortieAt(s, w.tick + 0.5, w.cells.w).leg).toBe(Leg.Back);
    // The fighters, little hurt, stay.
    for (const id of fighters) expect(w.sorties.get(id)!.over).toBe(100);
    // Hour on hour, every bomber down: the wing is lost.
    w.out.events.length = 0;
    for (let h = 0; h < 12 && w.formations.has(b); h++) {
      over(w, b, STRASBOURG);
      airCombat(w, new Map([[7, [...fighters, b]]]));
    }
    expect(w.formations.has(b)).toBe(false);
    expect(w.wingBase.has(b)).toBe(false);
    expect(w.sorties.has(b)).toBe(false);
    expect(events(w, EventKind.FormationDestroyed).some((e) => e[2] === b)).toBe(true);
  });

  it('in the game: a German fighter patrol and a French bomber patrol over Strasbourg meet, and the bombers lose', () => {
    const s = sim();
    const w = s.world;
    w.wars.start([GER], [FRA], 0);
    const f = wingOf(w, GER, 'fighter_group');
    const b = wingOf(w, FRA, 'tactical_bomber_group');
    expect(orderMission(w, f, 'patrol', ...STRASBOURG)).toBe(0);
    expect(orderMission(w, b, 'patrol', ...STRASBOURG)).toBe(0);
    const [f0, b0] = [aircraftOf(w, f), aircraftOf(w, b)];
    let battles = 0;
    s.step(48, (ww) => {
      battles += events(ww, EventKind.AirBattle).length;
      ww.out.events.length = 0;
    });
    expect(battles).toBeGreaterThan(0);
    const bLost = 1 - (w.formations.has(b) ? aircraftOf(w, b) : 0) / b0;
    const fLost = 1 - aircraftOf(w, f) / f0;
    expect(bLost).toBeGreaterThan(0.2);
    expect(bLost).toBeGreaterThan(3 * fLost);
  });
});
