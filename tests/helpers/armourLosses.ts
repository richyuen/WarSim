import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, elementPlace, slotCount } from '../../src/sim/systems/elements';
import { assets1938 } from './earth';

// Where armour loses tanks in the 1938 world (PLAN 3.6d): the spec of the burning hulls puts the
// camera there. Found in Node: the worker runs the same sim (I4), and the spec compares hashes.

/** An element of tanks over one hour: its tanks before and after (0: it is gone), and whether it was fired at. */
export type Strengths = Map<number, readonly [before: number, after: number, hit: boolean]>;

export interface LossWindow {
  /** The tick the window starts at, and the state hashes at its start and its end. */
  start: number;
  before: number;
  after: number;
  /** Every element of tanks in the world, hour by hour. */
  hours: Strengths[];
  /** Cells: the middle of the ground where the most tanks are lost in the way asked for, and how many are lost there. */
  x: number;
  y: number;
  lost: number;
}

/** Side of the squares the losses are counted in, cells: what a view at T3 holds. */
const SQUARE = 0.2;

/**
 * The first window of `hours` hours from day `firstDay` on (seed 1938) in which elements of
 * tanks that live on lose at least `least` tanks in one square of SQUARE cells: under fire, or
 * (`underFire` false) in hours in which nothing fired at them, to breakdowns and to attrition
 * (PLAN 3.2d). An element loses a tank at a time, and no more than one in an hour.
 */
export function armourLosses(firstDay: number, lastDay: number, hours: number, least: number, underFire = true): LossWindow {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  sim.step(24 * firstDay - 1);
  let was = new Map<number, number>();
  // Where each element of tanks stands, at the hour's start.
  let stood = new Map<number, [number, number]>();
  sim.step(1, (w) => {
    tanks(w, was, stood);
    w.out.fires.length = 0;
    w.out.events.length = 0;
  });
  for (let start = 24 * firstDay; start < 24 * lastDay; start += hours) {
    const before = sim.hash();
    const window: Strengths[] = [];
    const squares = new Map<string, { x: number; y: number; n: number }[]>();
    for (let h = 0; h < hours; h++) {
      const now = new Map<number, number>();
      const places = new Map<number, [number, number]>();
      const hit = new Set<number>();
      sim.step(1, (w) => {
        tanks(w, now, places);
        const raw = w.out.fires;
        for (let i = 0; i < raw.length; i += FIRE_STRIDE) hit.add(raw[i + FireField.target]!);
        w.out.fires.length = 0;
        w.out.events.length = 0;
      });
      const hour: Strengths = new Map();
      for (const [id, n] of was) {
        const left = now.get(id) ?? 0;
        hour.set(id, [n, left, hit.has(id)]);
        const p = stood.get(id)!;
        if (left === 0 || left >= n || hit.has(id) !== underFire) continue;
        const k = `${Math.floor(p[0] / SQUARE)},${Math.floor(p[1] / SQUARE)}`;
        squares.set(k, [...(squares.get(k) ?? []), { x: p[0], y: p[1], n: n - left }]);
      }
      window.push(hour);
      was = now;
      stood = places;
    }
    const top = [...squares.values()].sort((a, b) => sum(b) - sum(a))[0];
    if (top && sum(top) >= least) return { start, before, after: sim.hash(), hours: window, x: top.reduce((s, d) => s + d.x, 0) / top.length, y: top.reduce((s, d) => s + d.y, 0) / top.length, lost: sum(top) };
  }
  throw new Error(`no ${hours} hours from day ${firstDay} to ${lastDay} in which ${least} tanks are lost ${underFire ? 'under fire' : 'without fire'} on one ground`);
}

const sum = (list: readonly { n: number }[]): number => list.reduce((s, d) => s + d.n, 0);

type World = Parameters<NonNullable<Parameters<Sim['step']>[1]>>[0];

function tanks(w: World, into: Map<number, number>, places: Map<number, [number, number]>): void {
  const units = w.rules!.units;
  const c = w.elements.cols;
  const idx = elementIndex(w);
  w.elements.forEach((id) => {
    if (!units[c.unit[id]!]!.cls.startsWith('armor')) return;
    into.set(id, c.strength[id]!);
    const f = c.formation[id]!;
    places.set(id, elementPlace(w, f, c.slot[id]!, slotCount(w, f, idx.get(f)!.length)));
  });
}
