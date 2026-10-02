import { describe, expect, it } from 'vitest';
import type { FromWorker, Snapshot } from '../../src/shared/protocol';
import { Sim } from '../../src/sim/sim';
import { TILE, World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';

// SPEC §8 budget "snapshot build ≤ 2 ms" (PLAN 0.13 follow-up from the Phase 0 audit).
// Worst realistic steady state at M size: 2048×1024 cells, 4000 formations, 32 dirty tiles
// per snapshot, 200 queued events. The one-off full sync (all 512 tiles) is reported too.

function bigWorld(): World {
  const w = new World(1, 2048, 1024);
  for (let n = 1; n <= 150; n++) w.nations.cols.color[w.nations.create()] = n * 997;
  for (let i = 0; i < w.cells.owner.length; i++) {
    w.cells.owner[i] = 1 + (i % 150);
    w.cells.controller[i] = 1 + (i % 150);
  }
  for (let k = 0; k < 4000; k++) {
    const id = w.formations.create();
    w.formations.cols.nation[id] = 1 + (k % 150);
    w.formations.cols.x[id] = (k * 7.3) % 2048;
    w.formations.cols.y[id] = (k * 3.1) % 1024;
    w.formations.cols.strength[id] = 1000;
  }
  return w;
}

describe('snapshot build time (M size)', () => {
  it('stays within 2 ms for a steady-state snapshot', () => {
    let last: Snapshot | null = null;
    const server = new SimServer((m: FromWorker) => {
      if (m.type === 'snapshot') last = m.snap;
    });
    const sim = new Sim({ scenario: 'toy', seed: 1 });
    (sim as unknown as { world: World }).world = bigWorld();
    server.sim = sim;
    const world = sim.world;
    const ack = (): void => server.handle({ type: 'ack', seq: last!.seq, buffers: last!.buffers }, 0);
    const sub = { bbox: [0, 0, Infinity, Infinity] as [number, number, number, number], z: 0, tier: 0 as const, wantsElements: false };

    world.out.markAllDirty();
    let t0 = performance.now();
    server.handle({ type: 'subscribe', sub }, 0); // forces a send: full sync
    const fullMs = performance.now() - t0;
    expect(last!.tiles.count).toBe(512);
    ack();

    const times: number[] = [];
    for (let r = 0; r < 60; r++) {
      for (let k = 0; k < 32; k++) world.out.dirtyTiles[(r * 37 + k * 13) % world.out.dirtyTiles.length] = 1;
      for (let e = 0; e < 200; e++) world.out.emit(r, 1, e, 1, (e * 9) % 2048, (e * 5) % 1024);
      server['drainEvents'](world);
      t0 = performance.now();
      server.handle({ type: 'subscribe', sub }, 0);
      times.push(performance.now() - t0);
      expect(last!.formations.count).toBe(4000);
      expect(last!.tiles.count).toBe(32);
      ack();
    }
    times.sort((a, b) => a - b);
    const median = times[30]!;
    console.log(`snapshot build at M: full sync ${fullMs.toFixed(2)} ms (512 tiles), steady median ${median.toFixed(3)} ms, p95 ${times[57]!.toFixed(3)} ms`);
    expect(TILE).toBe(64);
    expect(median).toBeLessThan(2);
  });
});
