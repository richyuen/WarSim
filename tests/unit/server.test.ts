import { describe, expect, it } from 'vitest';
import { EVENT_STRIDE, EventKind, readEvent } from '../../src/shared/events';
import type { FromWorker, Snapshot, Subscription, ToWorker } from '../../src/shared/protocol';
import { Pcg32 } from '../../src/sim/core/rng';
import { Sim } from '../../src/sim/sim';
import { TOY_H, TOY_W } from '../../src/sim/toy';
import { SimServer } from '../../src/worker/server';

/** Fake main thread: records messages, acks snapshots on demand, mirrors tiles and events. */
class FakeMain {
  readonly server: SimServer;
  outstanding: Snapshot | null = null;
  snapshots = 0;
  violations = 0;
  replies: FromWorker[] = [];
  owner = new Uint16Array(TOY_W * TOY_H);
  controller = new Uint16Array(TOY_W * TOY_H);
  events: number[] = [];
  lastTick = -1;
  now = 0;

  constructor() {
    this.server = new SimServer((msg) => this.receive(msg));
  }

  receive(msg: FromWorker): void {
    if (msg.type !== 'snapshot') {
      this.replies.push(msg);
      return;
    }
    if (this.outstanding) this.violations++; // a snapshot without an ack for the previous one
    const s = msg.snap;
    this.outstanding = s;
    this.snapshots++;
    this.lastTick = s.tick;
    const T = s.tiles.size;
    for (let k = 0; k < s.tiles.count; k++) {
      const t = s.tiles.ids[k]!;
      const tx = t % s.tiles.tilesX;
      const ty = (t - tx) / s.tiles.tilesX;
      for (let r = 0; r < T; r++) {
        const y = ty * T + r;
        if (y >= TOY_H) break;
        for (let c = 0; c < T; c++) {
          const x = tx * T + c;
          if (x >= TOY_W) break;
          this.owner[y * TOY_W + x] = s.tiles.owner[(k * T + r) * T + c]!;
          this.controller[y * TOY_W + x] = s.tiles.controller[(k * T + r) * T + c]!;
        }
      }
    }
    for (let i = 0; i < s.events.count * EVENT_STRIDE; i++) this.events.push(s.events.data[i]!);
  }

  send(msg: ToWorker): void {
    this.server.handle(msg, this.now);
  }

  ack(): void {
    const s = this.outstanding;
    if (!s) return;
    this.outstanding = null;
    this.send({ type: 'ack', seq: s.seq, buffers: s.buffers });
  }

  pump(ms: number): void {
    this.now += ms;
    let fake = this.now;
    this.server.pump(this.now, () => (fake += 1)); // 'max' runs ~12 ticks per pump
  }
}

const FULL: Subscription = { bbox: [0, 0, Infinity, Infinity], z: 0, tier: 0, wantsElements: false };

function randomSub(r: Pcg32): Subscription {
  const x0 = r.nextFloat() * TOY_W * 2 - TOY_W;
  const y0 = r.nextFloat() * TOY_H;
  const tiers = [0, 1, 1.5, 2, 3] as const;
  return {
    bbox: [x0, y0, x0 + r.nextFloat() * TOY_W * 1.5, y0 + r.nextFloat() * TOY_H],
    z: r.nextFloat() * 20,
    tier: tiers[r.nextInt(tiers.length)]!,
    wantsElements: r.chance(0.5),
  };
}

describe('SimServer', () => {
  it('I4: random subscription churn, acks and pumps leave the hash equal to a plain run', () => {
    const r = new Pcg32(0, 77, 0, 1);
    const main = new FakeMain();
    main.send({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 3 } });
    main.send({ type: 'speed', speed: 240 });
    main.send({ type: 'pause', paused: false });
    const commands: { tick: number; nation: number }[] = [];
    for (let i = 0; i < 4000; i++) {
      const op = r.nextInt(10);
      if (op < 3) main.send({ type: 'subscribe', sub: randomSub(r) });
      else if (op < 6) main.ack();
      else if (op === 6 && r.chance(0.05)) {
        const nation = 1 + (i % 2);
        commands.push({ tick: main.server.sim!.tick, nation });
        main.send({ type: 'cmd', cmd: { kind: 'spawnFormation', nation, x: 50, y: 50, strength: 900 } });
      } else main.pump(1 + r.nextInt(30));
    }
    const sim = main.server.sim!;
    expect(sim.tick).toBeGreaterThan(2000);

    const plain = new Sim({ scenario: 'toy', seed: 3 });
    let ci = 0;
    for (let t = 0; t < sim.tick; t++) {
      for (; ci < commands.length && commands[ci]!.tick === t; ci++) {
        plain.command({ kind: 'spawnFormation', nation: commands[ci]!.nation, x: 50, y: 50, strength: 900 });
      }
      plain.step();
    }
    expect(commands.length).toBeGreaterThan(3);
    expect(plain.world.commandLog).toEqual(sim.world.commandLog);
    expect(plain.hash()).toBe(sim.hash());
    expect(main.violations).toBe(0);
  });

  it('sends no snapshot without an ack; the buffer pool is stable over 10k frames', () => {
    const r = new Pcg32(0, 5, 0, 9);
    const main = new FakeMain();
    main.send({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 1 } });
    main.send({ type: 'speed', speed: 90 }); // ~1.4 ticks per 16 ms frame keeps 10k frames fast
    main.send({ type: 'pause', paused: false });
    let allocatedAt1k = -1;
    let frames = 0;
    while (frames < 10_000) {
      main.pump(16);
      if (r.chance(0.7)) {
        if (main.outstanding) frames++;
        main.ack();
      }
      if (frames === 1000 && allocatedAt1k < 0) allocatedAt1k = main.server.pool.allocated;
    }
    expect(main.violations).toBe(0);
    expect(main.snapshots).toBeGreaterThanOrEqual(10_000);
    // Every buffer is accounted for (in the pool or in the one in-flight snapshot), and after
    // warm-up allocation is flat: a leak would allocate ~9 buffers per frame for 9k frames.
    // A few allocations may remain when a payload outgrows its power-of-two size class.
    const pool = main.server.pool;
    expect(pool.pooled + pool.outstanding).toBe(pool.allocated);
    expect(pool.allocated - allocatedAt1k).toBeLessThanOrEqual(4);
    expect(pool.allocated).toBeLessThan(64);
    // The buffers of the one snapshot in flight: 17 since PLAN 3.11a (16 and the formations' block places).
    expect(main.server.pool.outstanding).toBeLessThanOrEqual(17);
  });

  // PLAN 1.36: a paused God/editor command applied while a snapshot is in flight owes the UI a
  // snapshot; with no ticks running, the ack itself must send it (handleInner's final maybeSend).
  it('a paused now-command during an unacked snapshot is drawn right after the ack', () => {
    const main = new FakeMain();
    main.send({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 1 } });
    main.send({ type: 'subscribe', sub: FULL });
    expect(main.outstanding).not.toBeNull(); // the first snapshot is in flight, unacked
    const cell = 20 * TOY_W + 30;
    const before = main.snapshots;
    main.send({ type: 'cmd', cmd: { kind: 'paintControl', nation: 2, x: 30.5, y: 20.5, r: 2 }, now: true });
    expect(main.snapshots).toBe(before); // flow control: no second snapshot before the ack
    main.ack();
    expect(main.snapshots).toBe(before + 1);
    expect(main.controller[cell]).toBe(2);
    expect(main.violations).toBe(0);
  });

  it('coalesces: while unacked, ticks continue; the next snapshot has every dirty tile and event', () => {
    const main = new FakeMain();
    main.send({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 9 } });
    expect(main.snapshots).toBe(1); // initial full snapshot
    const first = main.outstanding!;
    expect(first.tiles.count).toBe(Math.ceil(TOY_W / 64) * Math.ceil(TOY_H / 64));
    main.ack();
    expect(main.snapshots).toBe(1); // nothing changed, nothing due
    // Step while main does not ack: only one snapshot goes out.
    main.send({ type: 'step', reqId: 2, n: 1 });
    expect(main.snapshots).toBe(2);
    for (let i = 0; i < 1000; i++) {
      if (i % 100 === 0) main.send({ type: 'cmd', cmd: { kind: 'removeFormation', id: 1 + i / 100 } });
      main.send({ type: 'step', reqId: 3 + i, n: 1 });
    }
    expect(main.snapshots).toBe(2);
    main.ack();
    expect(main.snapshots).toBe(3);
    expect(main.lastTick).toBe(1001);
    main.ack();
    // The mirror built only from snapshots equals the sim's layers exactly.
    expect(main.controller).toEqual(main.server.sim!.world.cells.controller);
    expect(main.owner).toEqual(main.server.sim!.world.cells.owner);
    // Events arrive in order with contiguous sequence numbers (none lost under the full bbox).
    const seqs: number[] = [];
    for (let i = 0; i < main.events.length; i += EVENT_STRIDE) seqs.push(main.events[i]!);
    expect(seqs.length).toBeGreaterThan(0);
    seqs.forEach((s, i) => expect(s).toBe(i + 1));
  });

  it('filters spatial events by the subscribed bbox (wrap-aware) but always delivers global ones', () => {
    const main = new FakeMain();
    main.send({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 4 } });
    main.ack();
    main.send({ type: 'subscribe', sub: { ...FULL, bbox: [200, 0, 300, TOY_H] } }); // wraps past x = 256
    main.ack();
    main.send({ type: 'cmd', cmd: { kind: 'removeFormation', id: 1 } });
    main.send({ type: 'step', reqId: 2, n: 24 * 20 });
    main.ack();
    const ev = Float64Array.from(main.events);
    let spatial = 0;
    let global = 0;
    for (let i = 0; i < ev.length / EVENT_STRIDE; i++) {
      const e = readEvent(ev, i);
      if (e.kind === EventKind.CommandApplied) {
        global++;
        expect(e.x).toBeNaN();
      } else {
        spatial++;
        expect(e.x >= 200 || e.x <= 300 - TOY_W).toBe(true);
      }
    }
    expect(global).toBe(1);
    expect(spatial).toBeGreaterThan(0);
  });

  it('formations carry prev positions one tick behind', () => {
    const main = new FakeMain();
    main.send({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 2 } });
    main.ack();
    main.send({ type: 'step', reqId: 2, n: 10 });
    const a = main.outstanding!;
    const ax = new Map<number, number>();
    for (let i = 0; i < a.formations.count; i++) ax.set(a.formations.id[i]!, a.formations.x[i]!);
    main.ack();
    main.send({ type: 'step', reqId: 3, n: 1 });
    const b = main.outstanding!;
    let checked = 0;
    for (let i = 0; i < b.formations.count; i++) {
      const prev = ax.get(b.formations.id[i]!);
      if (prev === undefined) continue;
      expect(b.formations.prevX[i]).toBe(prev);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('replies with errors for bad requests and stale acks', () => {
    const main = new FakeMain();
    main.send({ type: 'step', reqId: 5, n: 1 });
    expect(main.replies.at(-1)).toMatchObject({ type: 'error', reqId: 5, message: 'sim not initialised' });
    main.send({ type: 'init', reqId: 6, init: { scenario: 'toy', seed: 1 } });
    main.send({ type: 'ack', seq: 999, buffers: [] });
    expect(main.replies.at(-1)).toMatchObject({ type: 'error', reqId: -1 });
  });
});

describe('SimServer at max speed', () => {
  it('runs bounded slices and keeps flow control', () => {
    const main = new FakeMain();
    main.send({ type: 'init', reqId: 1, init: { scenario: 'toy', seed: 1 } });
    main.send({ type: 'speed', speed: 'max' });
    main.send({ type: 'pause', paused: false });
    for (let i = 0; i < 50; i++) {
      main.pump(16);
      main.ack();
    }
    // Fake clock advances 1 ms per read: each 12 ms slice runs a bounded number of ticks.
    expect(main.server.sim!.tick).toBeGreaterThan(50 * 5);
    expect(main.server.sim!.tick).toBeLessThan(50 * 20);
    expect(main.violations).toBe(0);
  });
});
