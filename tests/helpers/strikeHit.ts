import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from './earth';

// Where a strike's bombs fall on a land formation in the 1938 world (PLAN 5.9), found in Node:
// the worker runs the same sim (I4), and the spec compares hashes.

export interface StrikeHitCase {
  /** The tick the hour of the strike starts at, and the state hashes before and after it. */
  start: number;
  before: number;
  after: number;
  /** The formation hit, the wing, where the formation stood (cells). */
  formation: number;
  wing: number;
  x: number;
  y: number;
}

/** The first hour from day `firstDay` to `lastDay` (seed `seed`) in which a strike hits a land formation. */
export function strikeHit(seed: number, firstDay: number, lastDay: number): StrikeHitCase {
  const sim = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
  sim.step(24 * firstDay);
  for (let t = 24 * firstDay; t < 24 * lastDay; t++) {
    const before = sim.hash();
    let hit: Omit<StrikeHitCase, 'start' | 'before' | 'after'> | null = null;
    sim.step(1, (w) => {
      const ev = w.out.events;
      for (let i = 0; i < ev.length && hit === null; i += 6) {
        if (ev[i + 1] !== EventKind.StrikeHit) continue;
        const g = ev[i + 2]!;
        // A land formation's, and one that lives on (its men are drawn after the hour).
        if (!w.formations.has(g) || w.rules!.templates[w.formations.cols.template[g]!]?.domain !== 0) continue;
        hit = { formation: g, wing: ev[i + 3]!, x: ev[i + 4]!, y: ev[i + 5]! };
      }
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    if (hit) return { start: t, before, after: sim.hash(), ...(hit as Omit<StrikeHitCase, 'start' | 'before' | 'after'>) };
  }
  throw new Error(`no strike on a land formation from day ${firstDay} to ${lastDay} of seed ${seed}`);
}
