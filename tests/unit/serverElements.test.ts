import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/shared/commands';
import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';
import { tierOf, type FromWorker, type Snapshot, type Subscription } from '../../src/shared/protocol';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, slotCount } from '../../src/sim/systems/elements';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 2.7n1 (ADR-74, second read, finding 1): which formations' elements a snapshot carries.
//
// The worker sent a formation's elements when the formation's centre was in the subscribed box.
// At the closest zooms the box is smaller than a division (28 elements stand ±2,055 m by ±880 m;
// a view of 1280 px at 1 m/px is 1,280 m wide): with the camera on a flank the snapshot had
// nothing of the division, and the view showed no figures where a battalion stands.

const GEO = SCENARIO_GEOMETRY['1938'];

/** The box a view of `vw` × `vh` px subscribes with, as `MapView.maybeSubscribe` makes it: the view padded by 25%. */
function boxOf(cx: number, cy: number, scale: number, vw: number, vh: number): Subscription {
  const hw = (vw / 2 / scale) * 1.25;
  const hh = (vh / 2 / scale) * 1.25;
  const tier = tierOf((GEO.kmPerCell * 1000) / scale);
  return { bbox: [cx - hw, cy - hh, cx + hw, cy + hh], z: Math.log2(scale), tier, wantsElements: tier >= 1.5 };
}

function setup(): { sim: Sim; snapshot: (sub: Subscription) => Snapshot; step: (cmds: Command[]) => void; server: SimServer } {
  let last: Snapshot | null = null;
  let unacked: Snapshot | null = null;
  const server = new SimServer((m: FromWorker) => {
    if (m.type === 'snapshot') last = unacked = m.snap;
  });
  const sim = new Sim({ scenario: '1938', seed: 99, assets: assets1938(SIZE_1938.w) });
  server.sim = sim;
  /** Acknowledges what was sent, and what that brings: an ack sends the snapshot the worker still owes (queued events). */
  const drain = (): void => {
    while (unacked) {
      const s: Snapshot = unacked;
      unacked = null;
      server.handle({ type: 'ack', seq: s.seq, buffers: s.buffers }, 0);
    }
  };
  /** The snapshot that answers a subscription with `sub`. */
  const snapshot = (sub: Subscription): Snapshot => {
    drain();
    server.handle({ type: 'subscribe', sub }, 0);
    const answer = last!;
    drain();
    return answer;
  };
  /** Sends `cmds` and steps one tick, as the page does. */
  const step = (cmds: Command[]): void => {
    for (const cmd of cmds) server.handle({ type: 'cmd', cmd }, 0);
    server.handle({ type: 'step', n: 1, reqId: 1 }, 0);
    drain();
  };
  return { sim, snapshot, step, server };
}

describe('elements in snapshots (PLAN 2.7n1)', () => {
  it('a view on any part of a formation gets every element of it that is in the view', () => {
    const { sim, snapshot } = setup();
    const w = sim.world;
    const idx = elementIndex(w);
    // A division of each block: the common one (28 slots, 8 × 4), the widest (53, 11 × 5) and a small one (6, 4 × 2).
    const picks = new Map<number, number>();
    w.formations.forEach((f) => {
      const n = idx.get(f)?.length ?? 0;
      const slots = slotCount(w, f, n);
      if (n === slots && [28, 53, 6].includes(slots) && !picks.has(slots)) picks.set(slots, f);
    });
    expect([...picks.keys()].sort((a, b) => a - b)).toEqual([6, 28, 53]);

    const missing: string[] = [];
    let views = 0;
    for (const [slots, f] of picks) {
      // Where its elements stand: from a view that holds all of it.
      const whole = snapshot(boxOf(w.formations.cols.x[f]!, w.formations.cols.y[f]!, 2000, 1920, 1080));
      const els: { id: number; x: number; y: number }[] = [];
      for (let i = 0; i < whole.elements.count; i++) if (whole.elements.formation[i] === f) els.push({ id: whole.elements.id[i]!, x: whole.elements.x[i]!, y: whole.elements.y[i]! });
      expect(els.length, `formation ${f}`).toBe(slots);
      for (const [vw, vh] of [[1280, 720], [1920, 1080]] as const) {
        for (const mPerPx of [1, 2, 3, 5]) {
          const scale = (GEO.kmPerCell * 1000) / mPerPx;
          let short = 0;
          for (const at of els) {
            const s = snapshot(boxOf(at.x, at.y, scale, vw, vh));
            const got = new Set<number>();
            for (let i = 0; i < s.elements.count; i++) got.add(s.elements.id[i]!);
            const inView = els.filter((e) => Math.abs(e.x - at.x) <= vw / 2 / scale && Math.abs(e.y - at.y) <= vh / 2 / scale);
            expect(inView.length).toBeGreaterThanOrEqual(1); // the one the camera is on
            if (inView.some((e) => !got.has(e.id))) short++;
            views++;
          }
          if (short > 0) missing.push(`${slots} slots, ${vw}×${vh} at ${mPerPx} m/px: ${short} of ${els.length} views lack an element that is in view`);
        }
      }
    }
    expect(views).toBe((28 + 53 + 6) * 8);
    expect(missing).toEqual([]);
  });

  it('a formation whose block does not reach the box is not sent', () => {
    const { sim, snapshot } = setup();
    const w = sim.world;
    const idx = elementIndex(w);
    let f = 0;
    w.formations.forEach((g) => {
      if (f === 0 && (idx.get(g)?.length ?? 0) === 28) f = g;
    });
    const [fx, fy] = [w.formations.cols.x[f]!, w.formations.cols.y[f]!];
    const scale = GEO.kmPerCell * 1000; // 1 m/px
    const own = (s: Snapshot): number => {
      let n = 0;
      for (let i = 0; i < s.elements.count; i++) if (s.elements.formation[i] === f) n++;
      return n;
    };
    // The block is 8 × 4 slots of 0.03 cells: its far corner is 0.114 cells from the centre. A
    // view of 1280 px at 1 m/px has a box of ±0.041 by ±0.023 cells.
    expect(own(snapshot(boxOf(fx + 0.1, fy, scale, 1280, 720)))).toBe(28); // on its flank
    expect(own(snapshot(boxOf(fx + 0.3, fy, scale, 1280, 720)))).toBe(0); // well clear of it
    expect(own(snapshot(boxOf(fx, fy + 0.3, scale, 1280, 720)))).toBe(0);
  });
});

// PLAN 3.6e5 (ADR-167): which of the elements it sends a snapshot says were fired at.
//
// A formation is sent whole, a shot only with an end in the box. The view took "fired at" from
// the shots it got: a tank lost by an element outside the box, to a shot from outside it, was
// drawn left behind and not burning (the demo of PLAN 3.6e4: 1 of 3 at 4 m/px, 4 of 5 at 1.5).
describe('the elements fired at in snapshots (PLAN 3.6e5)', () => {
  const scale = GEO.kmPerCell * 1000; // 1 m/px
  /** A division of 28 elements, a view on its flank, and the elements of it that the view's box does not hold. */
  const flank = (): ReturnType<typeof setup> & { sub: Subscription; outside: { id: number; x: number; y: number }[]; fire: (target: { id: number; x: number; y: number }) => void; hit: (s: Snapshot) => number[] } => {
    const made = setup();
    const w = made.sim.world;
    const idx = elementIndex(w);
    let f = 0;
    w.formations.forEach((g) => {
      if (f === 0 && (idx.get(g)?.length ?? 0) === 28) f = g;
    });
    const sub = boxOf(w.formations.cols.x[f]! + 0.1, w.formations.cols.y[f]!, scale, 1280, 720);
    const s = made.snapshot(sub);
    const [x0, y0, x1, y1] = sub.bbox;
    const outside: { id: number; x: number; y: number }[] = [];
    for (let i = 0; i < s.elements.count; i++) {
      const [x, y] = [s.elements.x[i]!, s.elements.y[i]!];
      if (s.elements.formation[i] === f && (x < x0 || x > x1 || y < y0 || y > y1)) outside.push({ id: s.elements.id[i]!, x, y });
    }
    // A shot from two cells off, as the sim puts it out: [tick, subtick, shooter, target, unit, dmg, x0, y0, x1, y1].
    const fire = (t: { id: number; x: number; y: number }): void => {
      w.out.fires.push(w.tick, 7, 1, t.id, 0, 0.25, t.x - 2, t.y, t.x, t.y);
      made.server['drainEvents'](w);
    };
    const hit = (snap: Snapshot): number[] => Array.from(snap.elements.id.subarray(0, snap.elements.count)).filter((_, i) => snap.elements.hit[i] === 1);
    return { ...made, sub, outside, fire, hit };
  };

  it('an element outside the box, fired at from outside it, is sent as fired at, its shot not', () => {
    const { snapshot, sub, outside, fire, hit } = flank();
    expect(outside.length).toBeGreaterThanOrEqual(2);
    fire(outside[0]!);
    const s = snapshot(sub);
    expect(s.elements.count).toBeGreaterThanOrEqual(28);
    expect(hit(s)).toEqual([outside[0]!.id]);
    expect(s.fires.count).toBe(0);
    // Since the snapshot before, and no longer: the next one has none.
    expect(hit(snapshot(sub))).toEqual([]);
  });

  it('a snapshot that spans two hours has the elements fired at in either', () => {
    const { snapshot, sub, outside, fire, hit } = flank();
    fire(outside[0]!);
    fire(outside[1]!);
    expect(hit(snapshot(sub)).sort((a, b) => a - b)).toEqual([outside[0]!.id, outside[1]!.id].sort((a, b) => a - b));
  });

  it('a view that draws no elements keeps none', () => {
    const { snapshot, sub, outside, fire, hit, sim } = flank();
    const far = boxOf(sim.world.formations.cols.x[1]!, sim.world.formations.cols.y[1]!, 2, 1280, 720);
    expect(far.wantsElements).toBe(false);
    snapshot(far);
    fire(outside[0]!);
    expect(hit(snapshot(sub))).toEqual([]);
  });
});

// PLAN 2.7o (ADR-74, second read, finding 3): the place a formation had one tick before, which
// the view moves its sprites from.
//
// The worker judged "new this tick: no previous place" by whether the id was alive before the
// step. Freed ids are reused, the last freed first: a formation created in the step in which
// another was destroyed takes that one's id, and was sent with that one's place as its own
// previous place. Its sprites then crossed the map in one tick.
describe('previous places in snapshots (PLAN 2.7o)', () => {
  const SITE = [1578.5, 338.8] as const; // western China, far from every other formation
  const JAP = NATIONS_1938.findIndex((n) => n.tag === 'JAP') + 1;
  const infantry = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');

  it('a formation that takes the id of one removed in the same step comes from nowhere but its own place', () => {
    const { sim, snapshot, step } = setup();
    const ft = sim.world.formations;
    // The victim: a formation far from the site.
    let victim = 0;
    ft.forEach((f) => {
      if (victim === 0 && Math.abs(ft.cols.x[f]! - SITE[0]) > 200) victim = f;
    });
    const was: [number, number] = [ft.cols.x[victim]!, ft.cols.y[victim]!];
    const before = new Map<number, [number, number]>();
    ft.forEach((f) => before.set(f, [ft.cols.x[f]!, ft.cols.y[f]!]));

    step([
      { kind: 'setAi', nation: JAP, enabled: false },
      { kind: 'removeFormation', id: victim },
      { kind: 'spawnFormation', nation: JAP, x: SITE[0], y: SITE[1], strength: 0, template: infantry },
    ]);
    // The new division has the victim's id: the case this test is about.
    expect(ft.has(victim)).toBe(true);
    expect([ft.cols.nation[victim], ft.cols.x[victim], ft.cols.y[victim]]).toEqual([JAP, SITE[0], SITE[1]]);

    const s = snapshot(boxOf(SITE[0], SITE[1], (GEO.kmPerCell * 1000) / 100, 1280, 720));
    const i = s.formations.id.subarray(0, s.formations.count).indexOf(victim);
    expect(i).toBeGreaterThanOrEqual(0);
    expect([s.formations.prevX[i], s.formations.prevY[i]], `the removed one stood at ${was.join(', ')}`).toEqual([SITE[0], SITE[1]]);
    // Its elements likewise: each comes from where it stands.
    let own = 0;
    for (let j = 0; j < s.elements.count; j++) {
      if (s.elements.formation[j] !== victim) continue;
      own++;
      expect([s.elements.prevX[j], s.elements.prevY[j]]).toEqual([s.elements.x[j], s.elements.y[j]]);
    }
    expect(own).toBe(28);

    // And every formation that was there before, and is itself still, comes from where it was.
    let moved = 0;
    for (let k = 0; k < s.formations.count; k++) {
      const id = s.formations.id[k]!;
      const b = before.get(id);
      if (id === victim || !b) continue;
      expect([s.formations.prevX[k], s.formations.prevY[k]], `formation ${id}`).toEqual(b);
      if (s.formations.x[k] !== b[0] || s.formations.y[k] !== b[1]) moved++;
    }
    expect(moved).toBeGreaterThan(0); // the step did move some: the previous place is not just the place
  });
});

// PLAN 2.7x (ADR-74, third read, finding 2): a save with more formation ids than a fresh world
// has room for (the toy world: 128), loaded into a fresh world. `Table.deserialize` left
// `generation` at its old length; for ids beyond it the worker compared the count of a tick ago
// (0) with undefined, took the formation for new in every tick, and sent it with its place as
// the place it came from: its sprites jumped from tick to tick.
describe('previous places after a load (PLAN 2.7x)', () => {
  const FULL: Subscription = { bbox: [0, 0, Infinity, Infinity], z: 0, tier: 0, wantsElements: false };
  type Places = { id: number[]; x: number[]; y: number[]; prevX: number[]; prevY: number[] };

  /** A worker on `sim`, subscribed to everything. A snapshot's arrays go back to the worker with the ack: what is read is copied first. */
  function worker(sim: Sim): { send: (m: Parameters<SimServer['handle']>[0]) => void; step: () => Places; now: () => Places } {
    let last: Snapshot | null = null;
    let unacked: Snapshot | null = null;
    const server = new SimServer((m: FromWorker) => {
      if (m.type === 'snapshot') last = unacked = m.snap;
    });
    server.sim = sim;
    const drain = (): void => {
      while (unacked) {
        const s: Snapshot = unacked;
        unacked = null;
        server.handle({ type: 'ack', seq: s.seq, buffers: s.buffers }, 0);
      }
    };
    const places = (): Places => {
      const f = last!.formations;
      const cut = (a: ArrayLike<number>): number[] => Array.from(a).slice(0, f.count);
      return { id: cut(f.id), x: cut(f.x), y: cut(f.y), prevX: cut(f.prevX), prevY: cut(f.prevY) };
    };
    const send = (m: Parameters<SimServer['handle']>[0]): void => {
      drain();
      server.handle(m, 0);
    };
    const now = (): Places => {
      send({ type: 'subscribe', sub: FULL });
      const p = places();
      drain();
      return p;
    };
    const step = (): Places => {
      send({ type: 'step', n: 1, reqId: 1 });
      const p = places();
      drain();
      return p;
    };
    now();
    return { send, step, now };
  }

  /** The saved game: the toy world with 20 formations more, after a day. */
  function saved(): { bytes: Uint8Array; highWater: number } {
    const a = new Sim({ scenario: 'toy', seed: 7 });
    const wa = worker(a);
    const fa = a.world.formations;
    const nation = fa.cols.nation[1]!;
    for (let i = 0; i < 20; i++) wa.send({ type: 'cmd', cmd: { kind: 'spawnFormation', nation, x: fa.cols.x[1]! + 0.5 * i, y: fa.cols.y[1]!, strength: 5000 } });
    for (let t = 0; t < 24; t++) wa.step();
    return { bytes: a.save(), highWater: fa.highWater };
  }

  it('every formation that moves is sent with the place it had before the tick, whatever its id', () => {
    const { bytes, highWater } = saved();
    const b = new Sim({ scenario: 'toy', seed: 7 });
    const fb = b.world.formations;
    expect(highWater).toBeGreaterThan(fb.capacity); // the case: more ids than the fresh world has room for
    const fresh = fb.capacity;
    const wb = worker(b);
    wb.send({ type: 'load', reqId: 2, bytes });
    expect(fb.highWater).toBe(highWater);

    const moves = { low: 0, high: 0 };
    const wrong: string[] = [];
    for (let t = 0; t < 48; t++) {
      const before = new Map<number, [number, number]>();
      fb.forEach((f) => before.set(f, [fb.cols.x[f]!, fb.cols.y[f]!]));
      const s = wb.step();
      for (let k = 0; k < s.id.length; k++) {
        const was = before.get(s.id[k]!);
        if (!was || (was[0] === s.x[k] && was[1] === s.y[k])) continue;
        moves[s.id[k]! < fresh ? 'low' : 'high']++;
        if (s.prevX[k] !== was[0] || s.prevY[k] !== was[1]) wrong.push(`tick ${t}, formation ${s.id[k]}: it stood at ${was.join(', ')} and was sent as coming from ${s.prevX[k]}, ${s.prevY[k]}`);
      }
    }
    expect(moves.low).toBeGreaterThan(1000);
    expect(moves.high).toBeGreaterThan(100);
    expect(wrong.length, wrong.slice(0, 3).join('; ')).toBe(0);
  });

  it('the snapshot that follows a load sends every formation from its own place, not from where the world before stood', () => {
    const { bytes } = saved();
    const b = new Sim({ scenario: 'toy', seed: 7 });
    const wb = worker(b);
    // The world before the load has moved on too, another way: its formations stand elsewhere.
    for (let t = 0; t < 12; t++) wb.step();
    const before = new Map<number, [number, number]>();
    const old = wb.now();
    old.id.forEach((id, k) => before.set(id, [old.x[k]!, old.y[k]!]));
    wb.send({ type: 'load', reqId: 2, bytes });
    const s = wb.now();
    let elsewhere = 0;
    for (let k = 0; k < s.id.length; k++) {
      expect([s.prevX[k], s.prevY[k]], `formation ${s.id[k]}`).toEqual([s.x[k], s.y[k]]);
      const was = before.get(s.id[k]!);
      if (was && (was[0] !== s.x[k] || was[1] !== s.y[k])) elsewhere++;
    }
    expect(s.id.length).toBeGreaterThan(130);
    expect(elsewhere).toBeGreaterThan(20); // ids whose formation of before the load stood somewhere else
  });
});

describe('an element\'s size in snapshots (PLAN 2.10b, ADR-80)', () => {
  it('every element is sent with the units it has when whole, by its unit type, whatever it has lost', () => {
    const { sim, snapshot } = setup();
    const w = sim.world;
    const ec = w.elements.cols;
    const units = w.rules!.units;
    // A month of war: divisions that have lost men.
    sim.step(24 * 30);
    const idx = elementIndex(w);
    const lost = (f: number): number => (idx.get(f) ?? []).reduce((n, e) => n + (units[ec.unit[e]!]!.size - ec.strength[e]!), 0);
    const worn = w.formations.ids().filter((f) => (idx.get(f)?.length ?? 0) > 0).sort((a, b) => lost(b) - lost(a) || a - b).slice(0, 5);
    expect(lost(worn[0]!)).toBeGreaterThan(1000);
    let sent = 0;
    const kinds = new Set<string>();
    for (const f of worn) {
      const s = snapshot(boxOf(w.formations.cols.x[f]!, w.formations.cols.y[f]!, 200, 1920, 1080));
      expect(s.elements.size).toHaveLength(s.elements.strength.length);
      for (let i = 0; i < s.elements.count; i++) {
        const e = s.elements.id[i]!;
        const size = units[ec.unit[e]!]!.size;
        expect(s.elements.size[i], `element ${e}`).toBe(size);
        expect(s.elements.strength[i], `element ${e}`).toBe(ec.strength[e]);
        expect(s.elements.strength[i]!, `element ${e}`).toBeLessThanOrEqual(size);
        if (s.elements.formation[i] !== f) continue;
        sent++;
        if (ec.strength[e]! < size) kinds.add(size > 64 ? 'a battalion with losses' : 'guns or vehicles with losses');
      }
    }
    expect(sent).toBeGreaterThan(50);
    expect([...kinds].sort()).toEqual(['a battalion with losses', 'guns or vehicles with losses']);
  });
});
