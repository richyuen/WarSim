import { describe, expect, it } from 'vitest';
import { FIRE_STRIDE, FireField } from '../../src/shared/events';
import type { FromWorker, Snapshot } from '../../src/shared/protocol';
import { SLOT_SPACING, slotGrid } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { DEPLOY_SCATTER, DEPLOY_TURN, deployOf, elementIndex, elementPlace, slotCount, slotPlace } from '../../src/sim/systems/elements';
import type { World } from '../../src/sim/world';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { addDivision, INF_DIV, nationId } from '../helpers/sim1938';

// PLAN 3.11c4 (critic R3-B3): the elements of a block in contact stood on the points of a
// lattice, 600 m apart, and all faced the way their block did (`critic/shots/
// c3j_11_tank_paused_0040m.png`, `c3j_12_tank_live_002m_2.png`). An element of a deployed block
// now stands off its slot and is turned off its block's facing, by its id: the same place in the
// snapshot, the fire events and the wrecks. A block at rest stands as it did.

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');

/** A German cell with a Polish one east of it, land a cell and a half around: [x, y] of the German cell's middle. */
function border(w: World): [number, number] {
  const { owner, w: cw, h: ch } = w.cells;
  const around: [number, number][] = [];
  for (let dy = -0.5; dy <= 0.5; dy += 0.25) for (let dx = -0.5; dx <= 1.5; dx += 0.25) around.push([dx, dy]);
  for (let y = 2; y < ch - 2; y++) for (let x = 2; x < cw - 4; x++) if (owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && around.every(([dx, dy]) => w.onLand(x + 0.5 + dx, y + 0.5 + dy))) return [x + 0.5, y + 0.5];
  throw new Error('no German cell with a Polish one east of it, land around');
}

/** How far `p` is from the line through `a` and `b`, cells. */
function offLine(a: [number, number], b: [number, number], p: [number, number]): number {
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]];
  return Math.abs(dx * (p[1] - a[1]) - dy * (p[0] - a[0])) / Math.hypot(dx, dy);
}

describe('the elements of a deployed block stand off their slots and do not all face one way (PLAN 3.11c4)', () => {
  it('no three of the front row on one line, each within its slot, and the shots leave from where the elements stand', () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    const w = s.world;
    w.settings.aiEnabled = false;
    const site = border(w);
    const ger = addDivision(w, GER, site[0], site[1]);
    const pol = addDivision(w, POL, site[0] + 1, site[1]);
    s.command({ kind: 'declareWar', attacker: GER, defender: POL });
    const fc = w.formations.cols;
    const ec = w.elements.cols;
    // Before the contact (the war is declared in the first hour's commands): each element on its slot.
    for (const f of [ger, pol]) {
      const list = elementIndex(w).get(f)!;
      const slots = slotCount(w, f, list.length);
      expect(fc.engaged[f]).toBe(0);
      for (const e of list) expect(elementPlace(w, f, ec.slot[e]!, slots, e)).toEqual(slotPlace(w, fc.x[f]!, fc.y[f]!, fc.facing[f]!, ec.slot[e]!, slots));
    }
    // The hours of the fight: every shot of either division leaves from its shooter's place and ends at its target's.
    let shots = 0;
    s.step(12, (world) => {
      const fr = world.out.fires;
      for (let i = 0; i < fr.length; i += FIRE_STRIDE) {
        for (const [who, x, y] of [[FireField.shooter, FireField.x0, FireField.y0], [FireField.target, FireField.x1, FireField.y1]] as const) {
          const e = fr[i + who]!;
          const f = ec.formation[e]!;
          expect([fr[i + x], fr[i + y]]).toEqual(elementPlace(world, f, ec.slot[e]!, slotCount(world, f, elementIndex(world).get(f)!.length), e));
        }
        shots++;
      }
      world.out.events.length = 0;
      fr.length = 0;
    });
    expect(shots).toBeGreaterThan(20);
    for (const f of [ger, pol]) {
      expect(fc.engaged[f]).toBe(1);
      const list = elementIndex(w).get(f)!;
      const slots = slotCount(w, f, list.length);
      const d = deployOf(w, f, slots)!;
      const { cols } = slotGrid(slots);
      const at = new Map<number, [number, number]>();
      for (const e of list) {
        const p = elementPlace(w, f, ec.slot[e]!, slots, e);
        at.set(ec.slot[e]!, p);
        // Off its slot, and within it each way: no two of a block change places, and the block keeps its rectangle.
        const home = slotPlace(w, d.x, d.y, d.facing, ec.slot[e]!, slots);
        const [ox, oy] = [p[0] - home[0], p[1] - home[1]];
        const along = ox * Math.cos(d.facing) + oy * Math.sin(d.facing);
        const across = oy * Math.cos(d.facing) - ox * Math.sin(d.facing);
        expect(Math.abs(along), `element ${e}: off its slot along the block's facing`).toBeLessThanOrEqual(DEPLOY_SCATTER * SLOT_SPACING + 1e-12);
        expect(Math.abs(across), `element ${e}: off its slot across`).toBeLessThanOrEqual(DEPLOY_SCATTER * SLOT_SPACING + 1e-12);
        expect(DEPLOY_SCATTER).toBeLessThan(0.5);
      }
      // The front row: no three on one line. On their slots every three were (0 off it, to the
      // last bits). By chance three may come near one (the places are a draw by id: 0.9 m for
      // slots 3 to 5 of the German division here), so the measure of what is seen is the next:
      // how far the middle one of three neighbours stands off the line of the other two, on average.
      const front = Array.from({ length: cols }, (_, k) => at.get(k)).filter((p): p is [number, number] => p !== undefined);
      expect(front.length).toBe(cols);
      for (let i = 0; i < front.length; i++) for (let j = i + 1; j < front.length; j++) for (let k = j + 1; k < front.length; k++) {
        expect(offLine(front[i]!, front[k]!, front[j]!), `formation ${f}: slots ${i}, ${j} and ${k} of the front row`).toBeGreaterThan(1e-6);
      }
      let off = 0;
      for (let i = 1; i + 1 < front.length; i++) off += offLine(front[i - 1]!, front[i + 1]!, front[i]!);
      expect(off / (front.length - 2), `formation ${f}: the middle of three neighbours of the front row, off the line of the other two`).toBeGreaterThan(0.05 * SLOT_SPACING);
      const alongs = front.map((p) => (p[0] - d.x) * Math.cos(d.facing) + (p[1] - d.y) * Math.sin(d.facing));
      expect(Math.max(...alongs) - Math.min(...alongs), `formation ${f}: how far its front row is spread along its facing`).toBeGreaterThan(0.2 * SLOT_SPACING);
    }
  }, 120_000);

  it('the worker sends each element of a deployed block where it stands and turned off the block\'s facing; a block at rest faces one way', async () => {
    let snap: Snapshot | null = null;
    const server: SimServer = new SimServer((msg: FromWorker) => {
      if (msg.type !== 'snapshot') return;
      snap = msg.snap;
      queueMicrotask(() => server.handle({ type: 'ack', seq: msg.snap.seq, buffers: [] }, 0));
    });
    server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 99, assets: assets1938(W) } }, 0);
    const w = server.sim!.world;
    const [sx, sy] = border(w);
    server.handle({ type: 'subscribe', sub: { bbox: [sx - 3, sy - 3, sx + 4, sy + 3], z: 7, tier: 2, wantsElements: true } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'setSetting', key: 'aiEnabled', value: false } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: GER, x: sx, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: POL, x: sx + 1, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 2 }, 0);
    await Promise.resolve();
    const [ger, pol] = w.formations.ids().slice(-2) as [number, number];
    const fc = w.formations.cols;
    const ec = w.elements.cols;
    /** The elements of formation `f` in the last snapshot: [x, y, facing] by element id. */
    const sent = (f: number): Map<number, [number, number, number]> => {
      const e = snap!.elements;
      const out = new Map<number, [number, number, number]>();
      for (let i = 0; i < e.count; i++) if (e.formation[i] === f) out.set(e.id[i]!, [e.x[i]!, e.y[i]!, e.facing[i]!]);
      return out;
    };
    // At peace: at rest, every element at its block's facing.
    for (const f of [ger, pol]) {
      expect(fc.engaged[f]).toBe(0);
      const got = sent(f);
      expect(got.size).toBe(elementIndex(w).get(f)!.length);
      for (const [, [, , facing]] of got) expect(facing).toBe(Math.fround(fc.facing[f]!));
    }
    server.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: GER, defender: POL } }, 0);
    server.handle({ type: 'step', reqId: 3, n: 3 }, 0);
    await Promise.resolve();
    for (const f of [ger, pol]) {
      expect(fc.engaged[f]).toBe(1);
      const list = elementIndex(w).get(f)!;
      const slots = slotCount(w, f, list.length);
      const d = deployOf(w, f, slots)!;
      const got = sent(f);
      expect(got.size).toBe(list.length);
      const turns: number[] = [];
      for (const e of list) {
        const [x, y, facing] = got.get(e)!;
        expect([x, y]).toEqual(elementPlace(w, f, ec.slot[e]!, slots, e));
        // Off the block's facing, still towards the enemy.
        const turn = Math.atan2(Math.sin(facing - d.facing), Math.cos(facing - d.facing));
        expect(Math.abs(turn), `element ${e}: turned off its block's facing`).toBeLessThanOrEqual(DEPLOY_TURN + 1e-6);
        turns.push(turn);
      }
      expect(Math.max(...turns) - Math.min(...turns), `formation ${f}: between the two of its elements turned furthest apart`).toBeGreaterThan(DEPLOY_TURN);
      expect(new Set(turns.map((t) => t.toFixed(3))).size, `formation ${f}: facings of its ${list.length} elements`).toBeGreaterThan(list.length / 2);
    }
    // The next hour, the same line: nothing moves (an element's place is by its id, not by the hour).
    const before = new Map([...sent(ger), ...sent(pol)]);
    server.handle({ type: 'step', reqId: 4, n: 1 }, 0);
    await Promise.resolve();
    const e = snap!.elements;
    let same = 0;
    for (let i = 0; i < e.count; i++) {
      const was = before.get(e.id[i]!);
      if (!was) continue;
      expect([e.x[i], e.y[i], e.facing[i]]).toEqual(was);
      expect([e.prevX[i], e.prevY[i]]).toEqual([was[0], was[1]]);
      same++;
    }
    expect(same).toBeGreaterThan(30);
  }, 120_000);
});
