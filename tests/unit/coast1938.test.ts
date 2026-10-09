import { describe, expect, it } from 'vitest';
import { tierOf, type FromWorker, type Snapshot, type Subscription } from '../../src/shared/protocol';
import { SCENARIO_GEOMETRY } from '../../src/shared/scenarios';
import { Terrain } from '../../src/shared/terrain';
import { buildLandCoverage } from '../../src/shared/landCoverage';
import { addIslet, lineClear, maskBit, maskLand, maskSure } from '../../src/shared/landMask';
import { SLOT_SPACING, slotPose } from '../../src/sim/core/pose';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { elementIndex, slotCount, slotPlace } from '../../src/sim/systems/elements';
import { stepPlace } from '../../src/sim/systems/movement';
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
    // The test's own reading of the mask, not the world's: the bit of the pixel that holds the
    // point; and, since PLAN 2.9b, that the place is surely land (land in the picture drawn from
    // the mask too, whose shore wanders inside a pixel).
    const land = (x: number, y: number): boolean => maskLand(mask, W, H, x, y, true) && maskSure(mask, W, H, x, y, true);
    const f = w.formations.cols;
    // PLAN 4.1d2: a march's step goes round a bay. Every formation on the march, every hour:
    // one that is not on land is on a step the mask has no land way for (a river, a strait
    // narrower than a cell), and never on a step with a way or with a clear line.
    const K = mask.w / W;
    const march = { hours: 0, wet: 0, steps: new Set<number>(), crossing: 0 };
    const wrong: string[] = [];
    const marches = (): void => {
      w.formations.forEach((id) => {
        if (f.moving[id] !== 1) return;
        march.hours++;
        if (land(f.x[id]!, f.y[id]!)) return;
        const path = w.paths.get(id);
        const a = path?.[f.pathStep[id]!];
        const b = path?.[f.pathStep[id]! + 1];
        // (At the path's last cell it is at rest in the next hour: it stands on that cell's point.)
        if (a === undefined || b === undefined) return void wrong.push(`hour ${sim.tick}: formation ${id} on no step at ${f.x[id]!.toFixed(3)}, ${f.y[id]!.toFixed(3)}`);
        if (w.cells.terrain[a] === Terrain.Crossing || w.cells.terrain[b] === Terrain.Crossing) return void march.crossing++;
        const p = w.cellPoint(a);
        const q = w.cellPoint(b);
        if (q[0] - p[0] > W / 2) q[0] -= W;
        else if (p[0] - q[0] > W / 2) q[0] += W;
        if (w.stepWay(a, b) || lineClear(mask, p[0] * K, p[1] * K, q[0] * K, q[1] * K, true)) wrong.push(`hour ${sim.tick}: formation ${id} at ${f.x[id]!.toFixed(3)}, ${f.y[id]!.toFixed(3)} on the step ${a} > ${b}`);
        march.wet++;
        march.steps.add(Math.min(a, b) * W * H + Math.max(a, b));
      });
    };
    for (const day of [0, 30, 90]) {
      while (sim.tick < day * 24) {
        sim.step(1);
        marches();
      }
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
    console.log(`90 days: ${march.hours} formation-hours on the march, ${march.wet} of them over water, on ${march.steps.size} steps with no way over land; ${march.crossing} on a crossing's step`);
    expect(wrong.slice(0, 5), 'over water on a step with a way over land').toEqual([]);
    expect(march.hours).toBeGreaterThan(500_000);
    // Before PLAN 4.1d2: 1,266 of 774,232 hours over the mask's water by its bit alone, on 77 steps. What is left is steps with no way over land (a river of the mask).
    expect(march.wet / march.hours).toBeLessThan(0.0006);
  }, 120_000);

  it('a step with a way over land (PLAN 4.1d2): every place of it surely land, from the one cell’s point to the other’s, and the same walked back', () => {
    const assets = assets1938(W);
    const mask = assets.landMask!;
    const w = new Sim({ scenario: '1938', seed: 99, assets }).world;
    const terr = w.cells.terrain;
    const dry = (c: number): boolean => terr[c] !== Terrain.Water && terr[c] !== Terrain.Crossing;
    const seen = { steps: 0, ways: 0, longest: 0, third: 0 };
    const comp = navOf(w).grid.component;
    // A band of the map from the Baltic to the Sahara, all the way round.
    for (let cy = 180; cy < 380; cy++) {
      for (let cx = 0; cx < W; cx++) {
        const a = cy * W + cx;
        if (!dry(a)) continue;
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
          const nx = (cx + dx + W) % W;
          const b = (cy + dy) * W + nx;
          if (!dry(b) || (dx !== 0 && !dry(cy * W + nx)) || (dx !== 0 && dy !== 0 && !dry((cy + dy) * W + cx))) continue;
          seen.steps++;
          const way = w.stepWay(a, b);
          if (!way) continue;
          seen.ways++;
          const n = way.length / 3;
          const len = way[3 * n - 1]!;
          const [pa, pb] = [w.cellPoint(a), w.cellPoint(b)];
          seen.longest = Math.max(seen.longest, len / Math.hypot(Math.abs(pb[0] - pa[0]) > W / 2 ? W - Math.abs(pb[0] - pa[0]) : pb[0] - pa[0], pb[1] - pa[1]));
          let last = pa;
          for (let i = 0; i <= 40; i++) {
            const t = i / 40;
            const [x, y] = stepPlace(w, a, b, t);
            if (!maskSure(mask, W, H, x, y, true)) throw new Error(`the step ${cx}, ${cy} > ${nx}, ${cy + dy} at ${t}: ${x}, ${y} is not surely land`);
            // And in a cell a route enters, of the step's own land: the formation is in the cell its place is in (the gate's ten-year games had one in a water cell of the grid).
            const at = Math.floor(y) * W + Math.floor(x);
            if (comp[at] === 0 || comp[at] !== comp[a]) throw new Error(`the step ${cx}, ${cy} > ${nx}, ${cy + dy} at ${t}: ${x}, ${y} is in a cell of other land, or of none`);
            if (at !== a && at !== b) seen.third++;
            const back = stepPlace(w, b, a, 1 - t);
            expect(Math.abs(back[0] - x) + Math.abs(back[1] - y)).toBeLessThan(1e-9);
            // As far along its length as the share of the step done: no leap.
            const gap = Math.abs(x - last[0]) > W / 2 ? W - Math.abs(x - last[0]) : x - last[0];
            expect(Math.hypot(gap, y - last[1])).toBeLessThanOrEqual(len / 40 + 1e-9);
            last = [x, y];
          }
          expect(stepPlace(w, a, b, 0).slice(0, 2)).toEqual(pa);
          expect(stepPlace(w, a, b, 1).slice(0, 2)).toEqual(pb);
        }
      }
    }
    console.log(`${seen.steps} steps, ${seen.ways} with a way over land, the longest ${seen.longest.toFixed(2)} times its straight line; of ${seen.ways * 41} places on them ${seen.third} are in a cell that is neither of the step's two`);
    expect(seen.ways).toBeGreaterThan(2000);
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

  // PLAN 2.15e2b: eight atolls of the 1938 start (Pitcairn, the Ralik Chain, Johnston, the
  // Chagos, Tuvalu, the Coral Sea Islands, Clipperton, Ashmore and Cartier) are land cells of
  // the game and had not one land pixel in the fine mask: a formation there stood in the sea,
  // and the map drew no land at any zoom.
  it('every owned cell of the 1938 world has sure land to stand on, and an atoll shows in the coast drawn zoomed out', () => {
    const world = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) }).world;
    const mask = world.landMask!;
    const { owner } = world.cells;
    let owned = 0;
    const wet: string[] = [];
    for (let c = 0; c < W * H; c++) {
      if (owner[c] === 0) continue;
      owned++;
      const [x, y] = world.cellPoint(c);
      if (Math.floor(x) !== c % W || Math.floor(y) !== Math.floor(c / W) || !world.onLand(x, y)) wet.push(`${c % W},${Math.floor(c / W)}`);
    }
    expect(owned).toBeGreaterThan(600_000);
    expect(wet, 'owned cells without sure land at their place to stand').toEqual([]);
    // The coast of T0 and T1 is the coverage's, two texels to a cell, land where it is over a half.
    const factor = mask.w / (2 * W);
    const cov = buildLandCoverage(mask.bits, mask.w, mask.h, factor);
    const atolls = [[283, 742], [1985, 553], [59, 501], [1432, 627], [2047, 650], [1868, 698], [402, 538], [1727, 668]];
    const unseen = atolls.filter(([cx, cy]) => {
      expect(owner[cy! * W + cx!], `the owner of ${cx},${cy}`).not.toBe(0);
      const at = (dx: number, dy: number): number => cov.data[(2 * cy! + dy) * cov.w + 2 * cx! + dx]!;
      return Math.min(at(0, 0), at(1, 0), at(0, 1), at(1, 1)) <= 127;
    });
    expect(unseen, 'atolls with no land in the coverage').toEqual([]);
  }, 120_000);

  it('an islet is given to a cell without land in the mask, once, and to no other', () => {
    const mask = { w: 32, h: 16, bits: new Uint8Array((32 * 16) / 8) };
    expect(addIslet(mask, 4, 1, 1)).toBe(true);
    let n = 0;
    for (let py = 0; py < 16; py++) for (let px = 0; px < 32; px++) if (maskBit(mask, px, py)) n++;
    expect(n).toBe(52); // rows of 4, 6, 8, 8, 8, 8, 6 and 4: the cell without its corners
    expect(maskBit(mask, 8, 11)).toBe(true);
    expect(maskBit(mask, 8, 8)).toBe(false);
    expect(maskBit(mask, 9, 8)).toBe(false);
    expect(maskBit(mask, 10, 8)).toBe(true);
    expect(maskBit(mask, 7, 11)).toBe(false); // and nothing outside the cell
    expect(maskSure(mask, 4, 2, 1.5, 1.5, false)).toBe(true);
    expect(addIslet(mask, 4, 1, 1)).toBe(false);
    // A cell with one land pixel keeps its own land.
    mask.bits[0] = 1;
    expect(addIslet(mask, 4, 0, 0)).toBe(false);
    expect(maskBit(mask, 3, 3)).toBe(false);
    expect(maskBit(mask, 16, 8)).toBe(false);
  });

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
