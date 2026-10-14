import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, elementPlace, slotCount } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 5.8w13: an element's end is an event at the place it was last drawn (PLAN 2.4b). One that
// dies before the hour's contacts are found, to an air strike (`airSystem` runs before
// `combatSystem`), was placed by the deployments of two hours before: on day 14 of seed 1938 the
// 18 elements of an infantry division struck from the air ended 0.32 to 0.36 cells from their
// sprites (`wrecks1938`), the block having moved on since.

/** Slots of a block are this far apart (cells): an end lies where the element stood, not a slot away. */
const SLOT = 0.03;

/** Where every element stands now, as the snapshot draws it. */
function places(w: World): Map<number, [number, number]> {
  const out = new Map<number, [number, number]>();
  const idx = elementIndex(w);
  w.elements.forEach((e) => {
    const f = w.elements.cols.formation[e]!;
    out.set(e, elementPlace(w, f, w.elements.cols.slot[e]!, slotCount(w, f, idx.get(f)!.length), e));
  });
  return out;
}

describe('an element ends where it was last drawn (PLAN 5.8w13)', () => {
  it('struck from the air or in battle: day 14 of seed 1938, 16 hours', () => {
    const sim = new Sim({ scenario: '1938', seed: 1938, assets: assets1938(SIZE_1938.w) });
    sim.step(24 * 14 - 1);
    let drawn = new Map<number, [number, number]>();
    sim.step(1, (w) => {
      drawn = places(w);
      w.out.events.length = 0;
      w.out.fires.length = 0;
    });
    const off: string[] = [];
    let ends = 0;
    let struck = 0;
    for (let h = 1; h <= 16; h++) {
      sim.step(1, (w) => {
        const ev = w.out.events;
        const hit = new Set<number>();
        for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.AirStrike && ev[i + 3]! > 0) hit.add(i);
        for (let i = 0; i < ev.length; i += 6) {
          if (ev[i + 1] !== EventKind.ElementDestroyed) continue;
          const id = ev[i + 2]!;
          const p = drawn.get(id)!;
          ends++;
          if (hit.size > 0) struck++;
          const d = Math.hypot(ev[i + 4]! - p[0], ev[i + 5]! - p[1]);
          if (!(d < SLOT / 2)) off.push(`hour ${h}: element ${id}, ${d.toFixed(3)} cells from where it was drawn`);
        }
        drawn = places(w);
        w.out.events.length = 0;
        w.out.fires.length = 0;
      });
    }
    // The case: elements end in the hours, some of them in an hour of air strikes that took something.
    expect(ends).toBeGreaterThan(10);
    expect(struck).toBeGreaterThan(0);
    expect(off.slice(0, 5)).toEqual([]);
  });
});
