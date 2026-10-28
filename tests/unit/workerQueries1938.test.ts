import { describe, expect, it } from 'vitest';
import type { FromWorker, Subscription, ToWorker } from '../../src/shared/protocol';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 7.152b (critic run 17, Stability 5: one browser run of 1307 hashed apart from headless
// from year 1, not reproduced): the page's queries between steps leave the sim's course alone.
// The 1938 world of seed 1307 inside the worker's host, with every query a page makes put
// between its days (a snapshot of a viewport at each tier, the labels and stats a pump flushes,
// inspect, formations' panels, every nation's economy, every war's battle, the charts, the
// history), hashes day by day as the same world stepped by `Sim` alone.
// `tools/diag/workerDeterminism.ts` runs the same over a year; `tools/diag/pageHash.ts` in the page.

const SEED = 1307;
const DAYS = 4;
const VIEWS: Subscription[] = [
  { bbox: [0, 0, 2048, 1024], z: 0, tier: 0, wantsElements: false },
  { bbox: [1000, 250, 1200, 350], z: 3, tier: 1, wantsElements: false },
  { bbox: [1080, 280, 1140, 320], z: 5, tier: 1.5, wantsElements: false },
  { bbox: [1090, 290, 1120, 310], z: 7, tier: 2, wantsElements: true },
  { bbox: [1100, 295, 1108, 300], z: 9, tier: 3, wantsElements: true },
];

describe("the page's queries and the sim's course (PLAN 7.152b)", () => {
  it('the world in the worker host, queried between days, hashes as the world stepped alone', () => {
    const assets = assets1938(SIZE_1938.w);
    const alone = new Sim({ scenario: '1938', seed: SEED, assets });
    const want: number[] = [];
    for (let d = 0; d < DAYS; d++) {
      alone.step(24, (w) => {
        w.out.events.length = 0;
        w.out.fires.length = 0;
      });
      want.push(alone.hash() >>> 0);
    }

    const replies = new Map<number, Extract<FromWorker, { type: 'reply' }>>();
    const acks: ToWorker[] = [];
    let clock = 0;
    let snapshots = 0;
    const server = new SimServer((msg, transfer) => {
      if (msg.type === 'reply') replies.set(msg.reqId, msg);
      if (msg.type === 'snapshot') snapshots++;
      if (msg.type === 'snapshot') acks.push({ type: 'ack', seq: msg.snap.seq, buffers: transfer as ArrayBuffer[] });
    });
    const send = (m: ToWorker): void => {
      clock += 37;
      server.handle(m, clock);
      while (acks.length > 0) server.handle(acks.shift()!, clock);
    };
    send({ type: 'init', reqId: 1, init: { scenario: '1938', seed: SEED, assets } });
    const world = (server as unknown as { sim: Sim }).sim.world;
    let req = 10;
    const got: number[] = [];
    for (let d = 0; d < DAYS; d++) {
      for (const sub of VIEWS) {
        send({ type: 'subscribe', sub });
        server.pump(1e12 + clock, () => 0);
      }
      send({ type: 'inspect', reqId: req++, full: true });
      const ids: number[] = [];
      world.formations.forEach((id) => void ids.push(id));
      const stride = Math.max(1, Math.floor(ids.length / 40));
      for (let i = d % stride; i < ids.length; i += stride) send({ type: 'formation', reqId: req++, id: ids[i]! });
      world.nations.forEach((n) => send({ type: 'economy', reqId: req++, nation: n }));
      for (const war of world.wars.list) send({ type: 'warBattle', reqId: req++, war: war.id });
      send({ type: 'stats', reqId: req++ });
      send({ type: 'history', reqId: req++ });
      const id = req++;
      send({ type: 'step', reqId: id, n: 24 });
      got.push(replies.get(id)!.status.hash >>> 0);
    }
    // A snapshot of each view each day was built (and acked), besides those after the steps.
    expect(snapshots).toBeGreaterThanOrEqual(DAYS * VIEWS.length);
    expect(world.tick).toBe(DAYS * 24);
    expect(got).toEqual(want);
  }, 300_000);
});
