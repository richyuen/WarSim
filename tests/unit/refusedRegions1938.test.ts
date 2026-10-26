import { describe, expect, it } from 'vitest';
import { askMove } from '../../src/sim/ai/operational';
import { cellOf } from '../../src/sim/data/terrain';
import { keepRegions, REGION_REFUSALS } from '../../src/sim/nav/provinceGraph';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { passageOf } from '../../src/sim/systems/movement';
import { EventKind } from '../../src/shared/events';
import { navOf, type World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';
import { addDivision, nationId } from '../helpers/sim1938';

// PLAN 7.124: the orders the operational AI gives again after a refused search. (1) A refusal in a
// corridor (PLAN 7.30b) was read again whenever any province's open or shut changed, anywhere: now the
// route over the provinces is planned again, and the refusal holds while it is the same. (2) Within a
// plan (no cell changes hands), the region a refused search reached is kept: from any cell of it to a
// goal outside it, with the same ends' provinces, the answer is the same refusal, with no search.
// Either way the answers are those of the search (seed 1021's year 6: the same hash, 9.3 → 4.8 ms).

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const [GER, SWI] = ['GER', 'SWI'].map(nationId) as [number, number];

function refusals(w: World, id: number): number {
  const ev = w.out.events;
  let n = 0;
  for (let i = 0; i < ev.length; i += 6) if (ev[i + 1] === EventKind.MoveRejected && ev[i + 2] === id) n++;
  ev.length = 0;
  return n;
}

/** A cell of `nation` with the cells within `reach` of it its own, nearest (lon, lat). */
function inner(w: World, nation: number, lon: number, lat: number, reach = 1): number {
  const [x0, y0] = cellOf(lon, lat, W, H).map(Math.floor) as [number, number];
  const own = (x: number, y: number): boolean => w.cells.controller[y * W + x] === nation;
  for (let r = 0; r < 20; r++) {
    for (let y = y0 - r; y <= y0 + r; y++) {
      for (let x = x0 - r; x <= x0 + r; x++) {
        let all = true;
        for (let dy = -reach; dy <= reach && all; dy++) for (let dx = -reach; dx <= reach && all; dx++) all = own(x + dx, y + dy);
        if (all) return y * W + x;
      }
    }
  }
  throw new Error(`no inner cell of ${nation}`);
}

/** The 1938 world with a German pocket by Leipzig walled in by Swiss cells two cells out: its centre and wall. */
function walled(seed: number): { w: World; goal: number; ring: number[] } {
  const s = new Sim({ scenario: '1938', seed, assets: assets1938(W) });
  const w = s.world;
  const goal = inner(w, GER, 12.5, 50.0, 3);
  const ring: number[] = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) ring.push(goal + dy * W + dx);
  for (const c of ring) w.setController(c, SWI);
  return { w, goal, ring };
}

describe('refused searches not made again (PLAN 7.124)', () => {
  it("a corridor's refusal holds when a province's shut changes away from it and its route is the same", () => {
    const { w, goal, ring } = walled(1942);
    const home = inner(w, GER, 11.5, 48.5);
    const id = addDivision(w, GER, (home % W) + 0.5, Math.floor(home / W) + 0.5);
    refusals(w, id);
    expect(askMove(w, id, goal, passageOf(w, GER))).toBe('refused');
    expect(refusals(w, id)).toBe(1);
    expect(w.refusedOrders.get(id)?.corridor).toBeDefined();
    // A German cell by Königsberg to Switzerland: that province now has closed ground, far from the way.
    const shut = passageOf(w, GER).shut!.slice();
    w.setController(inner(w, GER, 20.5, 54.7), SWI);
    expect(passageOf(w, GER).shut).not.toEqual(shut);
    expect(askMove(w, id, goal, passageOf(w, GER))).toBe('refused');
    expect(refusals(w, id)).toBe(0);
    // A cell of the wall opened: asked again, and the way through it is found.
    w.setController(ring[0]!, GER);
    expect(askMove(w, id, goal, passageOf(w, GER))).toBe('ok');
    expect(w.refusedOrders.has(id)).toBe(false);
  }, 120_000);

  it('within a plan, from the region a refused search reached to a goal outside it: refused with no search', () => {
    const { w, goal } = walled(1943);
    const nodeOf = navOf(w).graph.nodeOf;
    const home = inner(w, GER, 11.5, 48.5);
    const a = addDivision(w, GER, (home % W) + 0.5, Math.floor(home / W) + 0.5);
    const next = home + 1;
    expect(nodeOf[next]).toBe(nodeOf[home]);
    const b = addDivision(w, GER, (next % W) + 0.5, Math.floor(next / W) + 0.5);
    const other = goal + W;
    expect(nodeOf[other]).toBe(nodeOf[goal]);
    // Without the regions (the same world made again: a passage keeps its answers), both are searched and refused.
    {
      const { w: w0 } = walled(1943);
      const p0 = passageOf(w0, GER);
      const a0 = addDivision(w0, GER, (home % W) + 0.5, Math.floor(home / W) + 0.5);
      const b0 = addDivision(w0, GER, (next % W) + 0.5, Math.floor(next / W) + 0.5);
      expect(askMove(w0, a0, goal, p0)).toBe('refused');
      expect(askMove(w0, b0, other, p0)).toBe('refused');
    }
    const pass = passageOf(w, GER);
    keepRegions(true);
    try {
      const n = REGION_REFUSALS.n;
      expect(askMove(w, a, goal, pass)).toBe('refused');
      expect(REGION_REFUSALS.n).toBe(n);
      const gen = navOf(w).grid.scratch!.gen;
      // Another formation of the region, another goal in the pocket: the same refusal, no search.
      expect(askMove(w, b, other, pass)).toBe('refused');
      expect(REGION_REFUSALS.n).toBe(n + 1);
      expect(navOf(w).grid.scratch!.gen).toBe(gen);
      // A goal of the pocket's province outside the wall (in the region): searched, and found.
      let near = -1;
      for (let r = 3; r < 30 && near < 0; r++)
        for (let dy = -r; dy <= r && near < 0; dy++)
          for (let dx = -r; dx <= r && near < 0; dx++) {
            const c = goal + dy * W + dx;
            if (Math.max(Math.abs(dx), Math.abs(dy)) === r && nodeOf[c] === nodeOf[goal] && w.cells.controller[c] === GER) near = c;
          }
      expect(near).toBeGreaterThanOrEqual(0);
      expect(askMove(w, b, near, pass)).toBe('ok');
      expect(REGION_REFUSALS.n).toBe(n + 1);
    } finally {
      keepRegions(false);
    }
  }, 120_000);
});
