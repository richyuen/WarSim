import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from './earth';

// Where armour fires in the 1938 world (PLAN 3.6): the specs of the tanks' pictures put the
// camera there. Found in Node: the worker runs the same sim (I4), and the specs compare hashes.

export interface Fire {
  shooter: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The FireEvents of armour in the hour after `start` (seed 1938), and the state hashes around it. */
export function armourFires(start: number): { fires: Fire[]; before: number; after: number } {
  const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
  sim.step(start);
  const before = sim.hash();
  const fires: Fire[] = [];
  sim.step(1, (w) => {
    const raw = w.out.fires;
    const units = w.rules!.units;
    for (let i = 0; i < raw.length; i += FIRE_STRIDE) {
      if (!units[raw[i + FireField.weapon]!]!.cls.startsWith('armor')) continue;
      fires.push({ shooter: raw[i + FireField.shooter]!, x0: raw[i + FireField.x0]!, y0: raw[i + FireField.y0]!, x1: raw[i + FireField.x1]!, y1: raw[i + FireField.y1]! });
    }
    w.out.fires.length = 0;
    w.out.events.length = 0;
  });
  return { fires, before, after: sim.hash() };
}

/** Centre of the 2-cell square with the most shooters. */
export function busiest(fires: readonly Fire[]): [number, number] {
  const squares = new Map<string, Fire[]>();
  for (const f of fires) {
    const k = `${Math.floor(f.x0 / 2)},${Math.floor(f.y0 / 2)}`;
    squares.set(k, [...(squares.get(k) ?? []), f]);
  }
  const top = [...squares.values()].sort((a, b) => b.length - a.length)[0]!;
  return [top.reduce((s, f) => s + f.x0, 0) / top.length, top.reduce((s, f) => s + f.y0, 0) / top.length];
}
