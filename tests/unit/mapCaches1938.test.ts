import { describe, expect, it } from 'vitest';
import { buildLaneGraph } from '../../src/sim/nav/lanes';
import { keepWorldTemplates, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf, seaOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 7.125: a load builds the map's static caches, not the ticks after it. The lane graph was
// built at the first sail order: 0.43 s inside one tick, a load's day 2 in a new process (seed
// 8167's year 18: 460 ms). A new game's are built by the worker after its reply (PLAN 4.8e).

describe("the map's caches are built by a load (PLAN 7.125)", () => {
  it('a world made without a template has none; a load builds them, the same as a build at first use', () => {
    keepWorldTemplates(false);
    let s: Sim;
    try {
      s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
    } finally {
      if (process.env['NOTEMPLATES'] === undefined) keepWorldTemplates(true);
    }
    const w = s.world;
    expect(w.lanes).toBeNull();
    s.step(24);
    s.load(s.save());
    expect(w.lanes).not.toBeNull();
    // Built of the static layers alone: the same graph a tick's first sail order would build.
    const late = buildLaneGraph(navOf(w).grid, seaOf(w), w.seaPassages, w.ports, w.portReach);
    expect(w.lanes).toEqual(late);
  }, 60_000);

  it('a world made from a template has them (every load of a test file builds none)', () => {
    if (process.env['NOTEMPLATES'] !== undefined) return;
    new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
    const s = new Sim({ scenario: '1938', seed: 2, assets: assets1938(SIZE_1938.w) });
    expect(s.world.lanes).not.toBeNull();
  });
});
