import { describe, expect, it } from 'vitest';
import type { FromWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { seaControlOf } from '../../src/sim/systems/seaControl';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 4.8p (the tenth read): the worker sent the sea's holders only while the world had them
// (`world.seaControl`); after a load of a save in which no zone is held, the sea-control map
// mode kept the last game's holders until the next 00:00 reckoning.

describe('the sea-control layer after a load (PLAN 4.8p)', () => {
  it('a save with no zone held clears the holders the page was shown', () => {
    const got: FromWorker[] = [];
    const server = new SimServer((m) => got.push(m));
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) } }, 0);
    const sim = server.sim!;
    expect(sim.world.seaControl).toBeNull();
    const bytes = sim.save();
    // A game in which Britain holds a zone: the page is shown it.
    seaControlOf(sim.world).holder[1] = 7;
    server.handle({ type: 'pause', paused: true }, 1);
    const shown = got.filter((m) => m.type === 'seaControl');
    expect(shown.length).toBeGreaterThan(0);
    expect((shown.at(-1) as { holder: Uint16Array }).holder[1]).toBe(7);
    // The save loaded: the page is told no zone is held.
    got.length = 0;
    server.handle({ type: 'load', reqId: 2, bytes }, 2);
    expect(sim.world.seaControl).toBeNull();
    const after = got.filter((m) => m.type === 'seaControl') as { holder: Uint16Array }[];
    expect(after.length, 'no sea-control message after the load').toBeGreaterThan(0);
    expect(after.at(-1)!.holder.every((h) => h === 0)).toBe(true);
  });
});
