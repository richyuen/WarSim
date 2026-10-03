import { describe, expect, it } from 'vitest';
import { buildClusters, clusterKey, clusterLevel, CounterLayer, HYSTERESIS, SPLIT_MS, type CounterSource } from '../../src/render/units/counters';

// PLAN 2.2: T0 counters with stable multi-level clustering and split/merge animation.

let seed = 22;
const rnd = (): number => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const SRC: CounterSource[] = Array.from({ length: 400 }, () => ({ x: rnd() * 2000, y: rnd() * 1000, nation: 1 + Math.floor(rnd() * 6), strength: 1 + Math.floor(rnd() * 12000) }));

describe('T0 counters (PLAN 2.2)', () => {
  it('levels follow the zoom with ±0.15 hysteresis', () => {
    const at = (lv: number): number => 64 / 2 ** lv; // scale where the continuous level is lv
    expect(clusterLevel(at(5), null)).toBe(5);
    expect(clusterLevel(at(5.6), 5)).toBe(5); // inside the band
    expect(clusterLevel(at(5.5 + HYSTERESIS + 0.01), 5)).toBe(6);
    expect(clusterLevel(at(4.4), 5)).toBe(5);
    expect(clusterLevel(at(4.5 - HYSTERESIS - 0.01), 5)).toBe(4);
    expect(clusterLevel(at(-3), null)).toBe(0);
  });

  it('grids nest: every cluster is exactly the union of its children; Σ strength is conserved', () => {
    const total = SRC.reduce((a, f) => a + f.strength, 0);
    for (let l = 0; l < 10; l++) {
      const fine = buildClusters(SRC, l);
      const coarse = buildClusters(SRC, l + 1);
      expect([...fine.values()].reduce((a, c) => a + c.strength, 0)).toBe(total);
      const sums = new Map<string, number>();
      for (const c of fine.values()) {
        const k = clusterKey(c.nation, l + 1, Math.floor(c.gx / 2), Math.floor(c.gy / 2));
        sums.set(k, (sums.get(k) ?? 0) + c.strength);
      }
      expect(sums.size).toBe(coarse.size);
      for (const [k, c] of coarse) expect(sums.get(k)).toBe(c.strength);
    }
  });

  it('splits animate from the parent centroid to the children, merges the reverse', () => {
    const L = new CounterLayer();
    const scale = (lv: number): number => 64 / 2 ** lv;
    L.layout(SRC, scale(7), 0, true);
    expect(L.level).toBe(7);
    // Zoom in one level: split. At t=0 the children sit on their parent; at the end on themselves.
    const start = L.layout(SRC, scale(6), 1000, true);
    const parents = buildClusters(SRC, 7);
    const kids = buildClusters(SRC, 6);
    expect(start.length).toBe(kids.size);
    for (const it of start) {
      const p = parents.get(clusterKey(it.c.nation, 7, Math.floor(it.c.gx / 2), Math.floor(it.c.gy / 2)))!;
      expect(it.x).toBeCloseTo(p.x, 9);
      expect(it.y).toBeCloseTo(p.y, 9);
    }
    const mid = L.layout(SRC, scale(6), 1000 + SPLIT_MS / 2, true);
    expect(mid.length).toBe(kids.size);
    const end = L.layout(SRC, scale(6), 1000 + SPLIT_MS, true);
    expect(L.level).toBe(6);
    for (const it of end) {
      expect(it.x).toBe(kids.get(it.key)!.x);
    }
    // Zoom out again: merge. The children travel to the parent; then the parent replaces them.
    L.layout(SRC, scale(7), 2000, true);
    const late = L.layout(SRC, scale(7), 2000 + SPLIT_MS - 1, true);
    for (const it of late) {
      const p = parents.get(clusterKey(it.c.nation, 7, Math.floor(it.c.gx / 2), Math.floor(it.c.gy / 2)))!;
      expect(Math.hypot(it.x - p.x, it.y - p.y)).toBeLessThan(0.01 * 2 ** 7);
    }
    const done = L.layout(SRC, scale(7), 2000 + SPLIT_MS, true);
    expect(done.length).toBe(parents.size);
    expect(L.animating(2000 + SPLIT_MS + 100)).toBe(false);
  });

  it('invisible layers follow the zoom without animating', () => {
    const L = new CounterLayer();
    L.layout(SRC, 64 / 2 ** 8, 0, false);
    L.layout(SRC, 64 / 2 ** 3, 10, false);
    expect(L.level).toBe(3);
    expect(L.animating(10)).toBe(false);
  });
});
