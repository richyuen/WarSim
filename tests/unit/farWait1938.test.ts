import { describe, expect, it } from 'vitest';
import { FAR_RETRY_DAYS } from '../../src/sim/ai/operational';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { destroyFormation } from '../../src/sim/systems/elements';
import { at1938 } from '../helpers/checkpoint';
import { assets1938 } from '../helpers/earth';

// PLAN 7.117 (ADR-703): a formation whose march from afar is refused is sent so again only after
// FAR_RETRY_DAYS. Late in a war nearly every such order is refused, each a failed search of the
// whole way (5–6 ms), and was asked again every MARCH_DAYS: the operational AI's largest cost.

describe('a refused march from afar waits (PLAN 7.117, ADR-703)', () => {
  it('seed 1: the first formation refused waits FAR_RETRY_DAYS with no order refused, and the wait is saved', () => {
    // Seed 1 from day 180 since ADR-737 (PLAN 7.144, the k-th strike of a day dimmed): seed 4 has none in its
    // first 400 days on that history, seeds 1-3 and 5-7 one each (1: day 183; `tools/diag/firstWait.ts`).
    // Seed 4 from day 180 since ADR-723 (PLAN 7.133, the wings over the sea): seeds 7 and 99 have none in
    // their first 400 days on that history, seeds 1-6 each one (4: day 185; `tools/diag/firstWait.ts`).
    // Seed 7 from day 180 since ADR-711 (PLAN 7.5 before critic run 15); before, seed 99 from day 90.
    const s = at1938(1, 180 * 24);
    const w = s.world;
    const refused = new Map<number, number[]>();
    const step = (): void =>
      s.step(24, (ww) => {
        const e = ww.out.events;
        for (let i = 0; i < e.length; i += 6) {
          if (e[i + 1] !== EventKind.MoveRejected) continue;
          const id = e[i + 2]!;
          let days = refused.get(id);
          if (!days) refused.set(id, (days = []));
          days.push(Math.floor(e[i]! / 24));
        }
        e.length = 0;
        ww.out.fires.length = 0;
      });
    // Day by day to the first wait (seed 99 on 2026-10-25's rules: formation 571 on day 117; seed 7 on
    // ADR-711's: formation 35 on day 198; seed 4 on ADR-723's: formation 32 on day 185).
    let id = -1;
    let until = -1;
    for (let d = 0; d < 120 && id < 0; d++) {
      step();
      for (const [k, u] of w.farWait) {
        id = k;
        until = u;
        break;
      }
    }
    expect(id, 'a march from afar refused in days 180–300').toBeGreaterThan(0);
    const from = until - FAR_RETRY_DAYS;
    // It was refused on the day the wait began.
    expect(refused.get(id) ?? []).toContain(from);
    // Saved and loaded with the state.
    const u = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    u.load(s.save());
    expect(u.world.farWait.get(id)).toBe(until);
    expect(u.hash()).toBe(s.hash());
    // No order of it is refused while it waits, and the wait holds to its day.
    const seen = refused.get(id)?.length ?? 0;
    while (Math.floor(w.tick / 24) < until - 1 && w.formations.has(id)) {
      step();
      if (w.formations.has(id)) expect(w.farWait.get(id), `day ${Math.floor(w.tick / 24)}`).toBe(until);
    }
    expect(refused.get(id)?.length ?? 0, 'orders of it refused while it waits').toBe(seen);
    // It goes with its formation.
    if (w.formations.has(id)) {
      destroyFormation(w, id);
      expect(w.farWait.has(id)).toBe(false);
    }
  });
});
