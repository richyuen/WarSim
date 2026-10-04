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

function setup(): { sim: Sim; snapshot: (sub: Subscription) => Snapshot; step: (cmds: Command[]) => void } {
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
  return { sim, snapshot, step };
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
