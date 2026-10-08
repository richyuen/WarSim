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
 *
 * The window ends with an hour in which that square has such a loss (PLAN 3.10f1): a hull
 * stands for `HULL_LIFE_MS` of the render clock, and a spec that looks at one after the window
 * needs a loss at its end, however long its machine takes over an hour. So a window starts at
 * any hour, not on a grid of `hours`.
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
  // The last `hours` hours: the state's hash before each, its strengths, and its losses of the kind asked for by square.
  const past: { before: number; hour: Strengths; lost: Map<string, { x: number; y: number; n: number }[]> }[] = [];
  for (let end = 24 * firstDay + 1; end <= 24 * lastDay; end++) {
    const before = sim.hash();
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
    const lost = new Map<string, { x: number; y: number; n: number }[]>();
    for (const [id, n] of was) {
      const left = now.get(id) ?? 0;
      hour.set(id, [n, left, hit.has(id)]);
      const p = stood.get(id)!;
      if (left === 0 || left >= n || hit.has(id) !== underFire) continue;
      const k = `${Math.floor(p[0] / SQUARE)},${Math.floor(p[1] / SQUARE)}`;
      lost.set(k, [...(lost.get(k) ?? []), { x: p[0], y: p[1], n: n - left }]);
    }
    was = now;
    stood = places;
    past.push({ before, hour, lost });
    if (past.length > hours) past.shift();
    if (past.length < hours) continue;
    // The squares with a loss in this hour, each with its losses of the whole window.
    const top = [...lost.keys()].map((k) => past.flatMap((h) => h.lost.get(k) ?? [])).sort((a, b) => sum(b) - sum(a))[0];
    if (top && sum(top) >= least) return { start: end - hours, before: past[0]!.before, after: sim.hash(), hours: past.map((h) => h.hour), x: top.reduce((s, d) => s + d.x, 0) / top.length, y: top.reduce((s, d) => s + d.y, 0) / top.length, lost: sum(top) };
  }
  throw new Error(`no ${hours} hours from day ${firstDay} to ${lastDay} that end with a loss and in which ${least} tanks are lost ${underFire ? 'under fire' : 'without fire'} on one ground`);
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
    places.set(id, elementPlace(w, f, c.slot[id]!, slotCount(w, f, idx.get(f)!.length), id));
  });
}
