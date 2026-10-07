import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';
import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, elementPlace, slotCount } from '../../src/sim/systems/elements';
import type { Fire } from './armourFire';
import type { Strengths } from './armourLosses';
import { assets1938 } from './earth';

// A battle of armour in the 1938 world for the tank battle demo (PLAN 3.6e4): four hours on one
// ground, in which tanks fire, fire again, lose tanks under fire and without, and lose one more
// under fire in the middle of the view. Found in Node: the worker runs the same sim (I4), and the
// demo compares hashes.

/** The view of the demo, CSS px, and the m/px of the stops at which its four hours are stepped. */
export const VIEW = { width: 1400, height: 800 };
export const STEPPED = [60, 12, 4, 1.5] as const;

export interface TankHour {
  /** The shots of armour, with where each shooter stands. */
  shots: Fire[];
  /** Every element of tanks in the world: its tanks before and after, and whether it was fired at. */
  tanks: Strengths;
}

export interface TankBattle {
  /** The tick before the first of the four hours, and the state hashes there and after each hour. */
  start: number;
  hashes: number[];
  /** The element that loses a tank under fire in the fourth hour, its formation and nation, and where it stands (cells). */
  element: number;
  formation: number;
  nation: number;
  anchor: [number, number];
  hours: TankHour[];
  /** Elements of tanks within the view of the third stop that lose a tank in the third hour: fired at, and not. */
  burning: number[];
  left: number[];
}

interface Hour {
  shots: Fire[];
  hit: Set<number>;
  /** After the hour: each element of tanks, its strength, its formation and where it stands. */
  tanks: Map<number, { n: number; f: number; x: number; y: number }>;
  hash: number;
}

/** Whether a point is in the demo's view at `m` m/px with the camera on `p`. */
export const inView = (x: number, y: number, p: readonly [number, number], m: number): boolean => {
  const cell = SCENARIO_GEOMETRY['1938'].kmPerCell * 1000;
  return Math.abs(x - p[0]) * cell < (VIEW.width / 2) * m && Math.abs(y - p[1]) * cell < (VIEW.height / 2) * m;
};

/**
 * The first four hours from day `firstDay` on (seed 1938) that make a demo. An element of tanks
 * that has stood through them loses a tank under fire in the fourth: the camera is on it. In the
 * first hour at least `shooters` elements of tanks fire in the view of the first stop, in the
 * second at least three in the view of the second; in the third, in the view of the third stop,
 * an element of tanks loses a tank under fire and another loses one that nothing fired at (a
 * breakdown, attrition: PLAN 3.2d).
 */
export function tankBattle(firstDay: number, lastDay: number, shooters: number): TankBattle {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  sim.step(24 * firstDay - 1);
  const past: Hour[] = [];
  for (let tick = 24 * firstDay; tick <= 24 * lastDay; tick++) {
    const hour: Hour = { shots: [], hit: new Set(), tanks: new Map(), hash: 0 };
    sim.step(1, (w) => {
      const units = w.rules!.units;
      const c = w.elements.cols;
      const raw = w.out.fires;
      for (let i = 0; i < raw.length; i += FIRE_STRIDE) {
        hour.hit.add(raw[i + FireField.target]!);
        if (!units[raw[i + FireField.weapon]!]!.cls.startsWith('armor')) continue;
        hour.shots.push({ shooter: raw[i + FireField.shooter]!, x0: raw[i + FireField.x0]!, y0: raw[i + FireField.y0]!, x1: raw[i + FireField.x1]!, y1: raw[i + FireField.y1]! });
      }
      const idx = elementIndex(w);
      w.elements.forEach((id) => {
        if (!units[c.unit[id]!]!.cls.startsWith('armor')) return;
        const f = c.formation[id]!;
        const [x, y] = elementPlace(w, f, c.slot[id]!, slotCount(w, f, idx.get(f)!.length));
        hour.tanks.set(id, { n: c.strength[id]!, f, x, y });
      });
      w.out.fires.length = 0;
      w.out.events.length = 0;
    });
    hour.hash = sim.hash();
    past.push(hour);
    if (past.length < 5) continue;
    if (past.length > 5) past.shift();
    const [h0, h1, h2, h3, h4] = past as [Hour, Hour, Hour, Hour, Hour];
    /** Elements of tanks that live through an hour and lose a tank in it, each where it stood. */
    const lossesOf = (before: Hour, after: Hour): { id: number; n: number; f: number; x: number; y: number; hit: boolean }[] =>
      [...after.tanks].flatMap(([id, t]) => {
        const was = before.tanks.get(id);
        return was && t.n < was.n ? [{ id, ...was, hit: after.hit.has(id) }] : [];
      });
    for (const l of lossesOf(h3, h4).filter((l) => l.hit).sort((a, b) => a.id - b.id)) {
      const p: [number, number] = [l.x, l.y];
      if ([h0, h1, h2].some((h) => h.tanks.get(l.id)?.x !== l.x || h.tanks.get(l.id)?.y !== l.y)) continue;
      const firing = (h: Hour, m: number): number => new Set(h.shots.filter((s) => inView(s.x0, s.y0, p, m)).map((s) => s.shooter)).size;
      if (firing(h1, STEPPED[0]) < shooters || firing(h2, STEPPED[1]) < 3) continue;
      const near = lossesOf(h2, h3).filter((o) => inView(o.x, o.y, p, STEPPED[2]));
      const left = near.filter((o) => !o.hit).map((o) => o.id);
      if (left.length === 0 || left.length === near.length) continue;
      const strengths = (before: Hour, after: Hour): Strengths => new Map([...before.tanks].map(([id, t]) => [id, [t.n, after.tanks.get(id)?.n ?? 0, after.hit.has(id)] as const]));
      return {
        start: tick - 4,
        hashes: past.map((h) => h.hash),
        element: l.id,
        formation: l.f,
        nation: sim.world.formations.cols.nation[l.f]!,
        anchor: p,
        hours: [h1, h2, h3, h4].map((h, k) => ({ shots: h.shots, tanks: strengths(past[k]!, h) })),
        burning: near.filter((o) => o.hit).map((o) => o.id),
        left,
      };
    }
  }
  throw new Error(`no four hours from day ${firstDay} to ${lastDay} in which tanks fire and lose tanks under fire and without on one ground: the demo has no battle`);
}
