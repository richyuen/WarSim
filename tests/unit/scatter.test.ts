import { describe, expect, it } from 'vitest';
import { cityIndex, scatter, ScatterKind, SCATTER_STRIDE, type ScatterView, type ScatterWorld } from '../../src/render/map/scatter';
import { Terrain } from '../../src/shared/terrain';

// PLAN 2.8c1 (ADR-78): where the trees, the rocks and the buildings of T2 and T3 stand. A
// scatter seeded by the place: the same view gives the same instances, and a nearer view adds
// to those of a farther one without moving any.

const W = 64;
const H = 32;
const KM = 20;

/** A world of one terrain class, with `paint` laid over it. */
function world(base: number, paint: (x: number, y: number) => number | undefined = () => undefined, cities: { x: number; y: number; size: number }[] = [], wrapX = false): ScatterWorld {
  const terrain = new Uint8Array(W * H).fill(base);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) terrain[y * W + x] = paint(x, y) ?? base;
  return { w: W, h: H, wrapX, kmPerCell: KM, terrain, mask: null, cities: cityIndex(cities, W, H, KM) };
}

/** A view of 1400 × 800 px on (`cx`, `cy`) at `px` px to a cell. */
const view = (cx: number, cy: number, px: number): ScatterView => ({ cx, cy, halfW: 700 / px, halfH: 400 / px, pxPerCell: px });

interface Inst { x: number; y: number; size: number; kind: number; alpha: number; variant: number }
/** The instances of a view, with their places in cells. */
function instances(w: ScatterWorld, v: ScatterView, cap = 100_000): Inst[] {
  const s = scatter(w, v, cap);
  const out: Inst[] = [];
  for (let k = 0; k < s.count; k++) {
    const o = k * SCATTER_STRIDE;
    out.push({ x: v.cx + s.data[o]! / v.pxPerCell, y: v.cy + s.data[o + 1]! / v.pxPerCell, size: s.data[o + 2]!, kind: s.data[o + 3]!, alpha: s.data[o + 4]!, variant: s.data[o + 5]! });
  }
  return out;
}
/** An instance's place, for a message. */
const at = (i: Inst): string => `${i.x.toFixed(5)},${i.y.toFixed(5)}`;
/**
 * Finds in `list` the instance that stands where another does, `shift` cells further east. A
 * place comes back from the view as px in a float32 from the view's centre: two views give it
 * to within a few millionths of a cell, far less than the distance between two instances.
 */
function finder(list: readonly Inst[], shift = 0): (i: Inst) => Inst | undefined {
  const grid = new Map<string, Inst[]>();
  const cell = (v: number): number => Math.floor(v * 1000);
  for (const i of list) {
    const k = `${cell(i.x + shift)},${cell(i.y)}`;
    const there = grid.get(k);
    if (there) there.push(i);
    else grid.set(k, [i]);
  }
  return (i) => {
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) for (const c of grid.get(`${cell(i.x) + dx},${cell(i.y) + dy}`) ?? []) if (Math.abs(c.x + shift - i.x) < 2e-5 && Math.abs(c.y - i.y) < 2e-5) return c;
    return undefined;
  };
}

describe('the scatter of trees, rocks and buildings (PLAN 2.8c1)', () => {
  it('is a function of the view: the same twice, and of the place: a pan shows the same instances where the views overlap', () => {
    const w = world(Terrain.Forest);
    const a = scatter(w, view(20.3, 11.7, 400), 100_000);
    const b = scatter(w, view(20.3, 11.7, 400), 100_000);
    expect(a.count).toBeGreaterThan(500);
    expect(b.count).toBe(a.count);
    expect(Array.from(b.data.subarray(0, b.count * SCATTER_STRIDE))).toEqual(Array.from(a.data.subarray(0, a.count * SCATTER_STRIDE)));
    // Panned by half a view: what stands in both views stands at the same places.
    const here = instances(w, view(20.3, 11.7, 400));
    const there = finder(instances(w, view(20.3 + 700 / 400, 11.7, 400)));
    const shared = here.filter((i) => i.x > 20.3 + 0.1 && Math.abs(i.y - 11.7) < 0.9);
    expect(shared.length).toBeGreaterThan(200);
    for (const i of shared) {
      const j = there(i);
      expect(j, `the instance at ${at(i)}`).toBeDefined();
      expect([j!.kind, j!.size, j!.variant]).toEqual([i.kind, i.size, i.variant]);
    }
  });

  it('nothing stands on water: by the cells, and by the fine coast where there is one', () => {
    // The west half is sea by its cells.
    const cells = world(Terrain.Forest, (x) => (x < 20 ? Terrain.Water : undefined));
    const a = instances(cells, view(20, 12, 300));
    expect(a.length).toBeGreaterThan(100);
    expect(a.filter((i) => i.x < 20).length).toBe(0);
    // A crossing is sea too.
    expect(instances(world(Terrain.Crossing), view(20, 12, 300)).length).toBe(0);
    // The fine coast: land by the cells, but the fine mask (8 pixels a cell) says the sea begins at x = 20.5.
    // Nothing stands in the last third of a mask pixel before it either: there the drawn shore
    // wanders, and a place is land for the scatter where it is surely land (PLAN 2.9b, `maskSure`).
    const fine = world(Terrain.Forest);
    const mask = { w: W * 8, h: H * 8, bits: new Uint8Array((W * 8 * H * 8) / 8) };
    for (let y = 0; y < mask.h; y++)
      for (let x = 0; x < 164; x++) {
        const i = y * mask.w + x;
        mask.bits[i >> 3]! |= 1 << (i & 7);
      }
    fine.mask = mask;
    const b = instances(fine, view(20.5, 12, 300));
    expect(b.filter((i) => i.x < 20.4).length).toBeGreaterThan(100);
    expect(b.filter((i) => i.x > 20.5 - 0.3 / 8).length).toBe(0);
  });

  it('a forest is dense, a plain has a tree here and there, mountains have rocks, ice has nothing', () => {
    const count = (t: number): { trees: number; rocks: number; buildings: number } => {
      const all = instances(world(t), view(20, 12, 300));
      return { trees: all.filter((i) => i.kind === ScatterKind.Tree).length, rocks: all.filter((i) => i.kind === ScatterKind.Rock).length, buildings: all.filter((i) => i.kind === ScatterKind.Building).length };
    };
    const forest = count(Terrain.Forest);
    const plains = count(Terrain.Plains);
    const mountains = count(Terrain.Mountains);
    expect(forest.trees).toBeGreaterThan(plains.trees * 6);
    expect(plains.trees).toBeGreaterThan(0);
    expect(forest.rocks).toBe(0);
    expect(mountains.rocks).toBeGreaterThan(mountains.trees * 2);
    expect(mountains.rocks).toBeGreaterThan(forest.trees / 4);
    expect(count(Terrain.Ice)).toEqual({ trees: 0, rocks: 0, buildings: 0 });
    // No buildings without a city.
    expect(forest.buildings + plains.buildings + mountains.buildings).toBe(0);
  });

  it('buildings stand around a city: most at its middle, none beyond its reach, and a larger city reaches further', () => {
    const rings = (size: number): number[] => {
      const w = world(Terrain.Plains, undefined, [{ x: 20.5, y: 12.5, size }]);
      // 2 km to a px... a view that holds the city's whole reach, near enough for many buildings.
      const all = instances(w, view(20.5, 12.5, 600)).filter((i) => i.kind === ScatterKind.Building);
      const out = [0, 0, 0, 0, 0, 0];
      for (const i of all) {
        const km = Math.hypot(i.x - 20.5, i.y - 12.5) * KM;
        out[Math.min(5, Math.floor(km / 4))]!++; // rings of 4 km
      }
      return out;
    };
    const town = rings(1);
    const metropolis = rings(5);
    // By the ring's area the middle is the densest: 4 km is the first ring, with a third of the second's area.
    expect(metropolis[0]! / 1).toBeGreaterThan(metropolis[2]! / 5);
    expect(metropolis[0]).toBeGreaterThan(20);
    // A town is small: nothing past 4 km. A metropolis has buildings out to 16 km and none past 20.
    expect(town[0]).toBeGreaterThan(3);
    expect(town.slice(1).reduce((a, b) => a + b, 0)).toBe(0);
    expect(metropolis[3]).toBeGreaterThan(0);
    expect(metropolis[5]).toBe(0);
    expect(metropolis.reduce((a, b) => a + b, 0)).toBeGreaterThan(town.reduce((a, b) => a + b, 0) * 5);
  });

  it('a nearer view adds instances and moves none: every instance of a view is in the view at twice and four times the zoom', () => {
    const w = world(Terrain.Hills, (x, y) => ((x + y) % 3 === 0 ? Terrain.Forest : undefined), [{ x: 20.5, y: 12.5, size: 4 }]);
    for (const px of [70, 300, 2000]) {
      const far = instances(w, view(20.4, 12.3, px)).filter((i) => i.alpha === 1);
      expect(far.length, `${px} px a cell`).toBeGreaterThan(50);
      for (const zoom of [2, 4]) {
        const near = finder(instances(w, view(20.4, 12.3, px * zoom)));
        const inBoth = far.filter((i) => Math.abs(i.x - 20.4) < 690 / (px * zoom) && Math.abs(i.y - 12.3) < 390 / (px * zoom));
        expect(inBoth.length, `${px} px a cell, ×${zoom}`).toBeGreaterThan(5);
        for (const i of inBoth) {
          const j = near(i);
          expect(j, `${px} px a cell ×${zoom}: the instance at ${at(i)}`).toBeDefined();
          expect([j!.kind, j!.alpha]).toEqual([i.kind, 1]);
        }
      }
    }
  });

  it('through a zoom the new instances come in by their opacity: a step of 1% changes no opacity by more than a tenth', () => {
    const w = world(Terrain.Forest);
    let last = instances(w, view(20.4, 12.3, 200));
    let faded = 0;
    for (let px = 200 * 1.01; px < 900; px *= 1.01) {
      const now = instances(w, view(20.4, 12.3, px));
      const was = finder(last);
      for (const i of now) {
        // One that was not there comes in faint; one that was there changes little.
        expect(Math.abs(i.alpha - (was(i)?.alpha ?? 0)), `at ${px.toFixed(0)} px a cell, the instance at ${at(i)}`).toBeLessThanOrEqual(0.1);
        if (i.alpha > 0 && i.alpha < 1) faded++;
      }
      // (What leaves the view at its edge as it narrows is not a pop: the test is of what stays.)
      expect(now.length).toBeGreaterThan(last.length * 0.5);
      last = now;
    }
    expect(faded).toBeGreaterThan(1000);
  });

  it('on screen the instances keep their distance at every zoom: between 6 and 60 to a 100 px square of forest', () => {
    const w = world(Terrain.Forest);
    for (const px of [66, 100, 150, 400, 1000, 5000, 19_500]) {
      const n = instances(w, view(20.4, 12.3, px)).length;
      const per = n / ((1400 * 800) / (100 * 100));
      expect(per, `${px} px a cell: ${n} instances`).toBeGreaterThan(6);
      expect(per, `${px} px a cell: ${n} instances`).toBeLessThan(60);
    }
  });

  it('sizes: a symbol of a few px at T2, the thing itself at 1 m/px', () => {
    const w = world(Terrain.Forest);
    const far = instances(w, view(20.4, 12.3, 100)).map((i) => i.size); // 200 m/px
    expect(Math.min(...far)).toBeGreaterThanOrEqual(4);
    expect(Math.max(...far)).toBeLessThanOrEqual(10);
    const near = instances(w, view(20.4, 12.3, KM * 1000)).map((i) => i.size); // 1 m/px: a crown of 6 to 12 m
    expect(Math.min(...near)).toBeGreaterThanOrEqual(6);
    expect(Math.max(...near)).toBeLessThanOrEqual(12);
  });

  it('the cap: no more than it, said so, and the instances of the farther views first', () => {
    const w = world(Terrain.Forest);
    const all = scatter(w, view(20.4, 12.3, 400), 100_000);
    const some = scatter(w, view(20.4, 12.3, 400), 300);
    expect(all.truncated).toBe(false);
    expect(some.count).toBe(300);
    expect(some.truncated).toBe(true);
    // The first 300 of the uncapped scatter: the capped one is a prefix of it.
    expect(Array.from(some.data.subarray(0, 300 * SCATTER_STRIDE))).toEqual(Array.from(all.data.subarray(0, 300 * SCATTER_STRIDE)));
  });

  it('a looping map has the same instances either side of its seam', () => {
    const w = world(Terrain.Forest, undefined, [], true);
    // A view that straddles the seam from the east side, and one from the west side.
    const east = instances(w, view(W - 0.2, 12, 400));
    const west = finder(instances(w, view(-0.2, 12, 400)), W);
    expect(east.length).toBeGreaterThan(300);
    for (const i of east) expect(west(i), `the instance at ${at(i)}`).toBeDefined();
    // And west of the seam there is something: the lattice goes on.
    expect(east.filter((i) => i.x > W).length).toBeGreaterThan(50);
    // A map that does not loop has nothing beyond its edge.
    expect(instances(world(Terrain.Forest), view(W - 0.2, 12, 400)).filter((i) => i.x >= W).length).toBe(0);
  });
});
