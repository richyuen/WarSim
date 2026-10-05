import { describe, expect, it } from 'vitest';
import { tierOf, type FromWorker, type Snapshot, type Subscription } from '../../src/shared/protocol';
import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';
import { Terrain } from '../../src/shared/terrain';
import { maskLand } from '../../src/shared/landMask';
import { SLOT_SPACING, slotPose } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { elementIndex, slotCount, slotPlace } from '../../src/sim/systems/elements';
import { SimServer } from '../../src/worker/server';
import { assets1938 } from '../helpers/earth';

// PLAN 2.9a (ADR-79): formations stand on land by the fine mask, and so do their elements.
//
// The sim knew only the cells' terrain, and a cell is land when half of it is: a formation at a
// coastal cell's middle could stand in the sea of the fine mask, the mask the coast is drawn
// from. Measured before the task (1938, seed 99, by the mask's bit): 200 of 23,210 elements on
// water at the start, in 18 formations, 11 of them wholly; 162 and 353 after 30 and 90 days.

const { w: W, h: H } = SIZE_1938;

describe('formations and elements against the fine land mask (PLAN 2.9a)', () => {
  it('1938 at the start and after 30 and 90 days: no formation at rest and none of its elements is on water', () => {
    const assets = assets1938(W);
    const mask = assets.landMask!;
    const sim = new Sim({ scenario: '1938', seed: 99, assets });
    const w = sim.world;
    // The test's own reading of the mask, not the world's: the bit of the pixel that holds the point.
    const land = (x: number, y: number): boolean => maskLand(mask, W, H, x, y, true);
    const f = w.formations.cols;
    for (const day of [0, 30, 90]) {
      while (sim.tick < day * 24) sim.step(24);
      const idx = elementIndex(w);
      const wet: string[] = [];
      const seen = { formations: 0, atRest: 0, elements: 0, drawnIn: 0, onItsFormation: 0, marching: 0, marchingWet: 0, crossing: 0 };
      w.formations.forEach((id) => {
        seen.formations++;
        const [fx, fy] = [f.x[id]!, f.y[id]!];
        const list = idx.get(id) ?? [];
        const slots = slotCount(w, id, list.length);
        // On the march a formation goes straight from one cell's point to the next, and can cross a bay: not this task's (ADR-79).
        if (f.moving[id] === 1) {
          seen.marching++;
          if (!land(fx, fy)) seen.marchingWet++;
          return;
        }
        // A crossing is a strait a formation walks: sea in the mask, and its cell has no land to stand on.
        if (w.cells.terrain[Math.floor(fy) * W + Math.floor(fx)] === Terrain.Crossing) {
          seen.crossing++;
          return;
        }
        seen.atRest++;
        if (!land(fx, fy)) wet.push(`day ${day}: formation ${id} at ${fx.toFixed(3)}, ${fy.toFixed(3)}`);
        for (const e of list) {
          const slot = w.elements.cols.slot[e]!;
          const [x, y] = slotPlace(w, fx, fy, f.facing[id]!, slot, slots);
          seen.elements++;
          if (!land(x, y)) wet.push(`day ${day}: element ${e} of formation ${id} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
          const [sx, sy] = slotPose(fx, fy, f.facing[id]!, slot, slots, SLOT_SPACING);
          if (sx !== x || sy !== y) {
            seen.drawnIn++;
            if (x === fx && y === fy) seen.onItsFormation++;
            // Drawn in towards its formation: no further from it than its slot is.
            expect(Math.hypot(x - fx, y - fy)).toBeLessThanOrEqual(Math.hypot(sx - fx, sy - fy) + 1e-12);
          }
        }
      });
      console.log(`day ${day}: ${seen.formations} formations, ${seen.atRest} at rest with ${seen.elements} elements, ${seen.drawnIn} of them drawn in from a slot on water (${seen.onItsFormation} as far as the formation's own place); ${seen.marching} on the march, ${seen.marchingWet} of them over water; ${seen.crossing} on a crossing`);
      // (Enough of both to be a test: after 90 days of war most formations are on the march.)
      expect(seen.atRest, `day ${day}`).toBeGreaterThan(200);
      expect(seen.elements, `day ${day}`).toBeGreaterThan(4000);
      expect(wet.slice(0, 5), `day ${day}: on the mask's water`).toEqual([]);
    }
  }, 120_000);

  it('a snapshot has each element where the rule puts it, also one drawn in from a slot on water', () => {
    const assets = assets1938(W);
    const sim = new Sim({ scenario: '1938', seed: 99, assets });
    const w = sim.world;
    const f = w.formations.cols;
    const idx = elementIndex(w);
    // A formation with a slot on water: its place is on land, and some of its block is not.
    let pick = 0;
    w.formations.forEach((id) => {
      if (pick !== 0) return;
      const list = idx.get(id) ?? [];
      const slots = slotCount(w, id, list.length);
      if (list.some((e) => !w.onLand(...slotPose(f.x[id]!, f.y[id]!, f.facing[id]!, w.elements.cols.slot[e]!, slots, SLOT_SPACING)))) pick = id;
    });
    expect(pick, 'a formation on a shore').toBeGreaterThan(0);

    let last: Snapshot | null = null;
    const server = new SimServer((m: FromWorker) => {
      if (m.type === 'snapshot') last = m.snap;
    });
    server.sim = sim;
    const scale = (SCENARIO_GEOMETRY['1938'].kmPerCell * 1000) / 100; // 100 m/px
    const [hw, hh] = [(1280 / 2 / scale) * 1.25, (720 / 2 / scale) * 1.25];
    const tier = tierOf(100);
    const sub: Subscription = { bbox: [f.x[pick]! - hw, f.y[pick]! - hh, f.x[pick]! + hw, f.y[pick]! + hh], z: Math.log2(scale), tier, wantsElements: tier >= 1.5 };
    server.handle({ type: 'subscribe', sub }, 0);
    const s = last! as Snapshot;
    const list = idx.get(pick)!;
    const slots = slotCount(w, pick, list.length);
    let own = 0;
    let drawnIn = 0;
    for (let j = 0; j < s.elements.count; j++) {
      if (s.elements.formation[j] !== pick) continue;
      own++;
      const e = s.elements.id[j]!;
      const want = slotPlace(w, f.x[pick]!, f.y[pick]!, f.facing[pick]!, w.elements.cols.slot[e]!, slots);
      expect([s.elements.x[j], s.elements.y[j]], `element ${e}`).toEqual(want);
      expect(w.onLand(want[0], want[1]), `element ${e}`).toBe(true);
      const pose = slotPose(f.x[pick]!, f.y[pick]!, f.facing[pick]!, w.elements.cols.slot[e]!, slots, SLOT_SPACING);
      if (pose[0] !== want[0] || pose[1] !== want[1]) drawnIn++;
    }
    expect(own).toBe(list.length);
    expect(drawnIn).toBeGreaterThan(0);
  }, 120_000);

  it('a world built without the mask stands on the cells’ middles, as before; the toy world has none', () => {
    const { landMask: _mask, ...without } = assets1938(W);
    const bare = new Sim({ scenario: '1938', seed: 99, assets: without }).world;
    expect(bare.landMask).toBeNull();
    expect(bare.onLand(0.5, 0.5)).toBe(true); // nothing to ask: every place will do
    expect(bare.cellPoint(5 * W + 7)).toEqual([7.5, 5.5]);
    expect(bare.standPoint(7.3, 5.9)).toEqual([7.3, 5.9]);
    const toy = new Sim({ scenario: 'toy', seed: 7 }).world;
    expect(toy.landMask).toBeNull();
  }, 120_000);
});
