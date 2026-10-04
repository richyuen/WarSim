import { describe, expect, it } from 'vitest';
import { FIRE_STRIDE, FireField, Weapon } from '../../src/shared/events';
import type { FromWorker, Snapshot, Subscription } from '../../src/shared/protocol';
import { Sim } from '../../src/sim/sim';
import { TOY_W } from '../../src/sim/toy';
import type { World } from '../../src/sim/world';
import { FIRE_QUEUE_CAP, SimServer } from '../../src/worker/server';

// PLAN 2.4a: which FireEvents a snapshot carries. The worker is driven as in
// snapshot-perf.test.ts: fire records are put into the tick outputs by hand (a toy world with
// three unit classes), drained as after a tick, and a snapshot is forced by a subscription.

const CLASSES = ['inf', 'art', 'armor_l'];

function setup(): { world: World; fire: (sub: Subscription, recs: readonly number[][]) => Snapshot; resub: (sub: Subscription) => Snapshot; server: SimServer } {
  let last: Snapshot | null = null;
  let unacked: Snapshot | null = null;
  const server = new SimServer((m: FromWorker) => {
    if (m.type === 'snapshot') last = unacked = m.snap;
  });
  const sim = new Sim({ scenario: 'toy', seed: 1 });
  sim.world.rules = { units: CLASSES.map((cls) => ({ cls })) } as unknown as NonNullable<World['rules']>;
  server.sim = sim;
  const ack = (): void => {
    const s = unacked;
    unacked = null;
    if (s) server.handle({ type: 'ack', seq: s.seq, buffers: s.buffers }, 0);
  };
  // The subscription first, then the ack of the snapshot before: the next one is built for it.
  const resub = (sub: Subscription): Snapshot => {
    server.handle({ type: 'subscribe', sub }, 0);
    ack();
    return last!;
  };
  const fire = (sub: Subscription, recs: readonly number[][]): Snapshot => {
    resub(sub);
    for (const r of recs) sim.world.out.fires.push(...r);
    server['drainEvents'](sim.world);
    return resub(sub);
  };
  return { world: sim.world, fire, resub, server };
}

/** [tick, subtick, shooter, target, unit, dmg, x0, y0, x1, y1]. */
const rec = (shooter: number, unit: number, x0: number, y0: number, x1: number, y1: number): number[] => [41, shooter % 60, shooter, 500 + shooter, unit, 0.25, x0, y0, x1, y1];
const sub = (tier: Subscription['tier'], bbox: Subscription['bbox'], wantsElements = true): Subscription => ({ bbox, z: 0, tier, wantsElements });
const shooters = (s: Snapshot): number[] => Array.from({ length: s.fires.count }, (_, i) => s.fires.data[i * FIRE_STRIDE + FireField.shooter]!);

describe('fire events in snapshots', () => {
  it('a view that draws elements gets the fires with an end in its box, the weapon in place of the unit', () => {
    const { fire } = setup();
    const s = fire(sub(2, [10, 10, 20, 20]), [
      rec(1, 0, 12, 12, 13, 13), // both ends inside
      rec(2, 1, 5, 5, 11, 11), // the target inside
      rec(3, 2, 19, 19, 30, 30), // the shooter inside
      rec(4, 0, 5, 5, 30, 30), // neither
    ]);
    expect(shooters(s)).toEqual([1, 2, 3]);
    expect(Array.from(s.fires.data.subarray(0, FIRE_STRIDE))).toEqual([41, 1, 1, 501, Weapon.smallArms, 0.25, 12, 12, 13, 13]);
    expect(s.fires.data[FIRE_STRIDE + FireField.weapon]).toBe(Weapon.shell);
    expect(s.fires.data[2 * FIRE_STRIDE + FireField.weapon]).toBe(Weapon.cannon);
    expect(s.fires.dropped).toBe(0);
  });

  it('the box wraps east-west like the elements', () => {
    const { fire } = setup();
    const s = fire(sub(2, [TOY_W - 5, 0, TOY_W + 5, 50]), [rec(1, 0, 2, 10, 3, 10), rec(2, 0, TOY_W - 2, 10, TOY_W - 3, 10), rec(3, 0, 40, 10, 41, 10)]);
    expect(shooters(s)).toEqual([1, 2]);
  });

  it('a strategic view gets none and none are kept for it', () => {
    const { fire, resub, world } = setup();
    const all: Subscription['bbox'] = [0, 0, Infinity, Infinity];
    const recs = [rec(1, 0, 12, 12, 13, 13)];
    for (const s of [fire(sub(0, all, false), recs), fire(sub(1, all), recs), fire(sub(2, all, false), recs)]) {
      expect(s.fires.count).toBe(0);
      expect(s.fires.data.length).toBe(0);
    }
    expect(world.out.fires).toHaveLength(0); // drained all the same
    // Zooming in afterwards does not bring the old fire along.
    expect(resub(sub(2, all)).fires.count).toBe(0);
    // And fire queued at T2 is not sent to a view that has left for T1.
    const { fire: f2, resub: r2, world: w2, server } = setup();
    f2(sub(2, all), []);
    w2.out.fires.push(...rec(1, 0, 12, 12, 13, 13));
    server['drainEvents'](w2);
    expect(r2(sub(1, all)).fires.count).toBe(0);
    expect(r2(sub(2, all)).fires.count).toBe(0);
  });

  it('each fire is sent once', () => {
    const { fire, resub } = setup();
    const all: Subscription['bbox'] = [0, 0, Infinity, Infinity];
    expect(fire(sub(2, all), [rec(1, 0, 12, 12, 13, 13)]).fires.count).toBe(1);
    expect(resub(sub(2, all)).fires.count).toBe(0);
  });

  it('the queue is capped: the oldest are dropped and counted', () => {
    const { fire } = setup();
    const many = Array.from({ length: FIRE_QUEUE_CAP + 40 }, (_, i) => rec(i + 1, 0, 12, 12, 13, 13));
    const s = fire(sub(2, [0, 0, Infinity, Infinity]), many);
    expect(s.fires.count).toBe(FIRE_QUEUE_CAP);
    expect(s.fires.dropped).toBe(40);
    expect(s.fires.data[FireField.shooter]).toBe(41);
  });

  it('a snapshot without fire takes no pooled buffer for it', () => {
    const { resub, fire } = setup();
    const all: Subscription['bbox'] = [0, 0, Infinity, Infinity];
    const empty = resub(sub(2, all)).buffers.length;
    expect(fire(sub(2, all), [rec(1, 0, 12, 12, 13, 13)]).buffers.length).toBe(empty + 1);
  });
});
