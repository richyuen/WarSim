import { describe, expect, it } from 'vitest';
import { BLOCK_STRIDE, type FormationDetail, type FromWorker, type Snapshot } from '../../src/shared/protocol';
import { blockReach, SLOT_SPACING } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { deployOf, elementIndex, elementPlace, slotCount, slotPlace } from '../../src/sim/systems/elements';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';
import { INF_DIV, nationId } from '../helpers/sim1938';

// PLAN 2.14c1: what the worker sends of a block that is deployed. In the hour a contact begins
// the elements come from the formation's place to the line (their place of an hour ago is the
// block at the formation, their place now the deployed one); after that they stand.

const W = SIZE_1938.w;
const GER = nationId('GER');
const POL = nationId('POL');

/** A worker with a 1938 game, and its last snapshot (each one acked, so the next can come). */
function worker(): { server: SimServer; last: () => Snapshot; replies: FromWorker[] } {
  let snap: Snapshot | null = null;
  const replies: FromWorker[] = [];
  const server: SimServer = new SimServer((msg: FromWorker) => {
    if (msg.type === 'reply') replies.push(msg);
    if (msg.type !== 'snapshot') return;
    snap = msg.snap;
    queueMicrotask(() => server.handle({ type: 'ack', seq: msg.snap.seq, buffers: [] }, 0));
  });
  server.handle({ type: 'init', reqId: 1, init: { scenario: '1938', seed: 99, assets: assets1938(W) } }, 0);
  return { server, last: () => snap!, replies };
}

describe('the worker sends a deployed block where it stands, and where it stood an hour ago (PLAN 2.14c1)', () => {
  it('in the hour the contact begins the elements go from the formation\'s place to the line; then they stand', async () => {
    const { server, last } = worker();
    const w = server.sim!.world;
    const { owner, w: cw, h: ch } = w.cells;
    // A German cell with two Polish cells east of it, land all the way: the Pole starts two cells off and marches up.
    let site: [number, number] | null = null;
    for (let y = 1; y < ch - 1 && !site; y++) for (let x = 1; x < cw - 3 && !site; x++) if (owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && owner[y * cw + x + 2] === POL && [0.5, 1, 1.5, 2, 2.5].every((d) => w.onLand(x + d, y + 0.5))) site = [x + 0.5, y + 0.5];
    expect(site).not.toBeNull();
    const [sx, sy] = site!;
    server.handle({ type: 'subscribe', sub: { bbox: [sx - 4, sy - 3, sx + 6, sy + 3], z: 7, tier: 2, wantsElements: true } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'setSetting', key: 'aiEnabled', value: false } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: GER, defender: POL } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: GER, x: sx, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: POL, x: sx + 2, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 1 }, 0);
    await Promise.resolve();
    const [ger, pol] = w.formations.ids().slice(-2) as [number, number];
    const fc = w.formations.cols;
    expect([fc.engaged[ger], fc.engaged[pol]]).toEqual([0, 0]); // two cells apart: no contact
    server.handle({ type: 'cmd', cmd: { kind: 'moveFormation', id: pol, x: sx + 1, y: sy } }, 0);

    /** The German division's elements in the last snapshot: [x, y, prevX, prevY] by element id. */
    const german = (): Map<number, [number, number, number, number]> => {
      const e = last().elements;
      const out = new Map<number, [number, number, number, number]>();
      for (let i = 0; i < e.count; i++) if (e.formation[i] === ger) out.set(e.id[i]!, [e.x[i]!, e.y[i]!, e.prevX[i]!, e.prevY[i]!]);
      return out;
    };
    let began = -1;
    for (let h = 0; h < 24 * 6 && began < 0; h++) {
      server.handle({ type: 'step', reqId: 10 + h, n: 1 }, 0);
      await Promise.resolve();
      if (fc.engaged[ger] === 1) began = w.tick;
    }
    expect(began).toBeGreaterThan(1);
    const list = elementIndex(w).get(ger)!;
    const slots = slotCount(w, ger, list.length);
    const first = german();
    expect(first.size).toBe(list.length);
    let moved = 0;
    for (const e of list) {
      const slot = w.elements.cols.slot[e]!;
      const [x, y, px, py] = first.get(e)!;
      // Now: deployed, forward of the formation. An hour ago: in the block at the formation's place.
      expect([x, y]).toEqual(elementPlace(w, ger, slot, slots, e));
      const home = slotPlace(w, fc.x[ger]!, fc.y[ger]!, fc.facing[ger]!, slot, slots);
      expect(Math.hypot(px - home[0], py - home[1]), `element ${e}: its place of an hour ago, from its slot at the formation`).toBeLessThan(0.02);
      if (Math.hypot(x - px, y - py) > 0.1) moved++;
    }
    expect(moved).toBe(list.length);
    // The next hour: the same enemy, the same line. Nothing moves.
    server.handle({ type: 'step', reqId: 900, n: 1 }, 0);
    await Promise.resolve();
    expect(fc.engaged[ger]).toBe(1);
    for (const [, [x, y, px, py]] of german()) expect([px, py]).toEqual([x, y]);
    // The formation itself never left its place.
    expect([fc.x[ger], fc.y[ger]]).toEqual([sx, sy]);
  }, 120_000);

  // PLAN 3.11a (critic R3-B3): the formation section said a formation in contact was at its
  // place in the rules, two thirds of a cell (12.8 km) from its elements, and a view that went
  // there at 6 m/px held an empty field under the formation's tag.
  it('says a formation in contact is where its block stands: the marker\'s place, its move of an hour, and the panel\'s', async () => {
    const { server, last, replies } = worker();
    const w = server.sim!.world;
    const { owner, w: cw, h: ch } = w.cells;
    let site: [number, number] | null = null;
    for (let y = 1; y < ch - 1 && !site; y++) for (let x = 1; x < cw - 3 && !site; x++) if (owner[y * cw + x] === GER && owner[y * cw + x + 1] === POL && owner[y * cw + x + 2] === POL && [0.5, 1, 1.5, 2, 2.5].every((d) => w.onLand(x + d, y + 0.5))) site = [x + 0.5, y + 0.5];
    const [sx, sy] = site!;
    server.handle({ type: 'subscribe', sub: { bbox: [sx - 4, sy - 3, sx + 6, sy + 3], z: 7, tier: 2, wantsElements: true } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'setSetting', key: 'aiEnabled', value: false } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'declareWar', attacker: GER, defender: POL } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: GER, x: sx, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'cmd', cmd: { kind: 'spawnFormation', nation: POL, x: sx + 2, y: sy, strength: 0, template: INF_DIV } }, 0);
    server.handle({ type: 'step', reqId: 2, n: 1 }, 0);
    await Promise.resolve();
    const [ger, pol] = w.formations.ids().slice(-2) as [number, number];
    const fc = w.formations.cols;
    server.handle({ type: 'cmd', cmd: { kind: 'moveFormation', id: pol, x: sx + 1, y: sy } }, 0);

    /** A formation in the last snapshot: where its block is said to be and where it was, its T1 marker's place, and the middle of its elements. */
    const said = (id: number): { at: [number, number]; prev: [number, number]; marker: [number, number]; facing: number; middle: [number, number]; elements: number } => {
      const f = last().formations;
      const e = last().elements;
      let i = 0;
      while (i < f.count && f.id[i] !== id) i++;
      expect(i).toBeLessThan(f.count);
      let n = 0;
      let mx = 0;
      let my = 0;
      for (let k = 0; k < e.count; k++) {
        if (e.formation[k] !== id) continue;
        n++;
        mx += e.x[k]!;
        my += e.y[k]!;
      }
      const b = i * BLOCK_STRIDE;
      return { at: [f.block[b]!, f.block[b + 1]!], prev: [f.block[b + 2]!, f.block[b + 3]!], marker: [f.x[i]!, f.y[i]!], facing: f.facing[i]!, middle: [mx / n, my / n], elements: n };
    };
    const detail = (id: number): FormationDetail => {
      const reqId = 5000 + replies.length;
      server.handle({ type: 'formation', reqId, id }, 0);
      const r = replies.find((m) => m.type === 'reply' && m.reqId === reqId);
      if (!r || r.type !== 'reply' || !r.bytes) throw new Error('no reply with bytes');
      return JSON.parse(new TextDecoder().decode(r.bytes)) as FormationDetail;
    };

    // Before the contact: at its place in the rules.
    expect(said(ger).at).toEqual([sx, sy]);
    let began = -1;
    for (let h = 0; h < 24 * 6 && began < 0; h++) {
      server.handle({ type: 'step', reqId: 10 + h, n: 1 }, 0);
      await Promise.resolve();
      if (fc.engaged[ger] === 1) began = w.tick;
    }
    expect(began).toBeGreaterThan(1);
    for (const id of [ger, pol]) {
      const slots = slotCount(w, id, elementIndex(w).get(id)!.length);
      const block = deployOf(w, id, slots)!;
      const s = said(id);
      expect(s.elements).toBe(elementIndex(w).get(id)!.length);
      // Where the block stands, which is not where the rules have the formation: the critic's 12.8 km.
      expect(s.at).toEqual([block.x, block.y]);
      expect(Math.hypot(s.at[0] - fc.x[id]!, s.at[1] - fc.y[id]!), `formation ${id}: forward of its place`).toBeGreaterThan(0.2);
      // The middle of its elements is by it, and a block's reach about it holds them all.
      expect(Math.hypot(s.middle[0] - s.at[0], s.middle[1] - s.at[1]), `formation ${id}: from its elements' middle`).toBeLessThan(SLOT_SPACING);
      const e = last().elements;
      for (let k = 0; k < e.count; k++) if (e.formation[k] === id) expect(Math.hypot(e.x[k]! - s.at[0], e.y[k]! - s.at[1])).toBeLessThanOrEqual(blockReach(slots, SLOT_SPACING));
      // It faces the enemy, as its elements do.
      expect(s.facing).toBeCloseTo(block.facing, 5);
      // Its T1 marker stays at its place in the rules (ADR-198: on the line the markers of the two sides cover each other).
      expect(s.marker).toEqual([fc.x[id], fc.y[id]]);
      // The panel says the same place.
      const d = detail(id);
      expect([d.x, d.y]).toEqual(s.at);
    }
    // In the hour the contact began the German block went from its formation's place to the line, as its elements did.
    const first = said(ger);
    expect(first.prev).toEqual([sx, sy]);
    // The next hour: it stands.
    server.handle({ type: 'step', reqId: 900, n: 1 }, 0);
    await Promise.resolve();
    expect(fc.engaged[ger]).toBe(1);
    const held = said(ger);
    expect(held.prev).toEqual(held.at);
    expect(held.at).toEqual(first.at);
    // The contact ends, when one of the two gives way: in that hour the block comes back from
    // the line to its place, and then it stands there. (Not by a command: one clears the hour
    // before, and nothing moves then.)
    let last1 = held;
    for (let h = 0; h < 24 * 60 && fc.engaged[ger] === 1; h++) {
      last1 = said(ger);
      server.handle({ type: 'step', reqId: 1000 + h, n: 1 }, 0);
      await Promise.resolve();
    }
    expect(fc.engaged[ger]).toBe(0);
    expect(w.formations.has(ger)).toBe(true);
    const back = said(ger);
    expect(back.at).toEqual([fc.x[ger], fc.y[ger]]);
    expect(back.prev).toEqual(last1.at);
    expect(Math.hypot(back.prev[0] - back.at[0], back.prev[1] - back.at[1])).toBeGreaterThan(0.2);
    server.handle({ type: 'step', reqId: 902, n: 1 }, 0);
    await Promise.resolve();
    const home = said(ger);
    expect(home.prev).toEqual(home.at);
    // The rules never moved it.
    expect([fc.x[ger], fc.y[ger]]).toEqual([sx, sy]);
  }, 120_000);
});
