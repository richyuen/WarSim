import { describe, expect, it } from 'vitest';
import { NATION_STRIDE, NationField, type FromWorker, type Snapshot, type Subscription } from '../../src/shared/protocol';
import { Sim } from '../../src/sim/sim';
import { eliminateNation } from '../../src/sim/systems/capitals';
import { SimServer } from '../../src/worker/server';

// PLAN 2.7g: what a snapshot says of a destroyed nation. Its row stays (charts and the list of
// the dead need its colour), and it says that the nation does not live: the view flew its flag
// over its last capital for the rest of the game.

const ALL: Subscription = { bbox: [0, 0, Infinity, Infinity], z: 0, tier: 0, wantsElements: false };

/** The toy world's server; `snapshot()` forces one, as a new subscription does. */
function setup(): { sim: Sim; snapshot: () => Snapshot } {
  let last: Snapshot | null = null;
  let unacked: Snapshot | null = null;
  const server = new SimServer((m: FromWorker) => {
    if (m.type === 'snapshot') last = unacked = m.snap;
  });
  const sim = new Sim({ scenario: 'toy', seed: 1 });
  server.sim = sim;
  const snapshot = (): Snapshot => {
    server.handle({ type: 'subscribe', sub: ALL }, 0);
    const s = unacked;
    unacked = null;
    if (s) server.handle({ type: 'ack', seq: s.seq, buffers: s.buffers }, 0);
    return last!;
  };
  return { sim, snapshot };
}

/** The nations' rows by id: [living, capitalX, capitalY, colour]. */
function rows(s: Snapshot): Map<number, { living: number; capital: [number, number]; color: number }> {
  const out = new Map<number, { living: number; capital: [number, number]; color: number }>();
  for (let i = 0; i < s.nations.count; i++) {
    const o = i * NATION_STRIDE;
    const d = s.nations.data;
    out.set(d[o + NationField.id]!, { living: d[o + NationField.living]!, capital: [d[o + NationField.capitalX]!, d[o + NationField.capitalY]!], color: d[o + NationField.color]! });
  }
  return out;
}

describe('nations in snapshots', () => {
  it('every nation has a row that says whether it lives', () => {
    const { sim, snapshot } = setup();
    snapshot();
    const before = rows(snapshot());
    expect(before.size).toBe(sim.world.nations.count);
    expect(before.size).toBeGreaterThanOrEqual(2);
    for (const [id, r] of before) expect(r.living, `nation ${id}`).toBe(sim.world.nations.cols.living[id]);
    expect([...before.values()].filter((r) => r.living === 1).length).toBeGreaterThanOrEqual(2);
  });

  it('a destroyed nation keeps its row and its colour, and does not live', () => {
    const { sim, snapshot } = setup();
    snapshot();
    const before = rows(snapshot());
    const victim = [...before].find(([, r]) => r.living === 1)![0];
    eliminateNation(sim.world, victim);
    const after = rows(snapshot());
    expect(after.size).toBe(before.size);
    expect(after.get(victim)).toEqual({ ...before.get(victim)!, living: 0 }); // the last capital, as it was
    for (const [id, r] of after) if (id !== victim) expect(r, `nation ${id}`).toEqual(before.get(id));
  });
});
