import { describe, expect, it } from 'vitest';
import { staleFrontParts } from '../../src/sim/ai/operational';
import { at1938 } from '../helpers/checkpoint';

// PLAN 7.139: the operational AI keeps the holders' front parts from one tick's plans to the next
// (`frontPartsOf`), dropped for a holder that a flip touched (its own cell, or one next to its
// cells) and for all at a war's change. A kept part has the cells one made afresh has, and kept or
// made afresh each hour, the world runs the same.

describe("the operational AI's front parts kept between ticks (PLAN 7.139)", () => {
  it('seed 99 from day 180, 30 days: no kept part is stale, and the world hashes as with none kept', () => {
    const kept = at1938(99, 180 * 24);
    const fresh = at1938(99, 180 * 24);
    const clear = (w: typeof kept.world): void => {
      w.out.events.length = 0;
      w.out.fires.length = 0;
    };
    let checked = 0;
    let held = 0;
    for (let d = 0; d < 30; d++) {
      for (let h = 0; h < 24; h++) {
        kept.step(1, clear);
        const stale = staleFrontParts(kept.world);
        if (stale >= 0) {
          checked++;
          expect(stale, `hour ${kept.world.tick}`).toBe(0);
        }
        held = Math.max(held, (kept.world.frontParts as { parts: Map<number, unknown> } | null)?.parts.size ?? 0);
        fresh.world.frontParts = null;
        fresh.step(1, clear);
      }
      expect(fresh.hash(), `day ${180 + d + 1}`).toBe(kept.hash());
    }
    // Parts were kept and checked.
    expect(held).toBeGreaterThan(0);
    expect(checked).toBeGreaterThan(100);
  });
});
