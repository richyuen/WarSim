import { describe, expect, it } from 'vitest';
import {
  buildClusters,
  clusterKey,
  clusterLevel,
  CounterLayer,
  FOLD_GAP_PX,
  FOLD_HOLD_PX,
  FOLD_MS,
  foldOverlaps,
  HYSTERESIS,
  SPLIT_MS,
  type Cluster,
  type CounterSource,
  type FoldItem,
} from '../../src/render/units/counters';

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

  // PLAN 2.7f (ADR-74, finding 1): the level wanted was judged against the level a finished split
  // had just left. With the zoom in the overlap of two levels' bands, the end of each change
  // started the way back: counters splitting and merging every 250 ms at a resting camera.
  describe('the level comes to rest', () => {
    const FRAME = 16;
    const scaleAt = (lv: number): number => 64 / 2 ** lv;
    const FEW = SRC.slice(0, 16); // the level does not depend on what is clustered
    /**
     * Draws frames 16 ms apart with the zoom `lvAt(t)` (in levels) until `restAt`, then for
     * three more seconds at rest. Returns how often the level changed more than a second after
     * the camera came to rest, and whether the layer still animates at the end.
     */
    const rest = (L: CounterLayer, lvAt: (t: number) => number, restAt: number): { late: number; animating: boolean; level: number } => {
      let late = 0;
      let level = L.level;
      let t = 0;
      for (; t <= restAt + 3000; t += FRAME) {
        L.layout(FEW, scaleAt(lvAt(Math.min(t, restAt))), t, true);
        if (L.level !== level && t > restAt + 1000) late++;
        level = L.level;
      }
      return { late, animating: L.animating(t), level: L.level! };
    };

    it('after a zoom that turns back while a split runs', () => {
      const L = new CounterLayer();
      L.layout(FEW, scaleAt(3), -1000, true);
      expect(L.level).toBe(3);
      // Out to 3.7 levels (a merge to 4 begins), and 100 ms later back to 3.5: inside the band
      // of 3 and of 4.
      const got = rest(L, (t) => (t < 100 ? 3.7 : 3.5), 100);
      expect(got).toEqual({ late: 0, animating: false, level: 4 });
    });

    it('after a burst of wheel notches, eased as the camera eases, from any zoom', () => {
      // CameraController: a notch is × 1.25 on the target; each frame the scale closes
      // 1 − e^(−18 dt) of the distance to it, in log space.
      const NOTCH = Math.log2(1.25);
      const closes = 1 - Math.exp((-18 * FRAME) / 1000);
      const stuck: string[] = [];
      for (const notches of [4, 5, 6, -4]) {
        for (let i = 0; i <= 128; i++) {
          const from = 2 + i / 32;
          const to = from + notches * NOTCH;
          // The zoom of every frame until it is within 1e-4 of the target, as the controller has it.
          const path = [from];
          while (Math.abs(path.at(-1)! - to) * Math.LN2 > 1e-4) path.push(path.at(-1)! + (to - path.at(-1)!) * closes);
          const L = new CounterLayer();
          L.layout(FEW, scaleAt(from), -1000, true);
          const got = rest(L, (t) => path[Math.min(path.length - 1, Math.round(t / FRAME))]!, (path.length - 1) * FRAME);
          if (got.late > 0 || got.animating) stuck.push(`${notches} notches from ${from}: ${got.late} late changes`);
        }
      }
      expect(stuck, `${stuck.length} of 516 never rest`).toEqual([]);
    });
  });

  it('invisible layers follow the zoom without animating', () => {
    const L = new CounterLayer();
    L.layout(SRC, 64 / 2 ** 8, 0, false);
    L.layout(SRC, 64 / 2 ** 3, 10, false);
    expect(L.level).toBe(3);
    expect(L.animating(10)).toBe(false);
  });
});

// PLAN 1.45b: the declutter. No two shown counter boxes overlap; what would overlap is folded into
// its stronger neighbour, never dropped; a change is a fade in place.
describe('counter declutter (PLAN 1.45b)', () => {
  // A box 40 px wide per counter, 10 px more when it holds other nations, 14 px high.
  const boxOf = (_total: number, others: number): [number, number] => [others > 0 ? 50 : 40, 14];
  const fi = (key: string, nation: number, x: number, y: number, strength: number): FoldItem => ({ key, nation, x, y, strength });
  const shown = (r: Map<string, { into: string | null; total: number; others: number }>): string[] => [...r].filter(([, f]) => f.into === null).map(([k]) => k).sort();
  /** True when the boxes of a and b, as `boxOf` sizes them, keep at least `gap` px apart. */
  const apart = (a: FoldItem, wa: number, b: FoldItem, wb: number, gap: number): boolean => Math.abs(a.x - b.x) >= (wa + wb) / 2 + gap || Math.abs(a.y - b.y) >= 14 + gap;

  it('folds what would overlap into the stronger counter: the sum and the other nations are shown', () => {
    const items = [fi('ger', 1, 100, 100, 500), fi('pol', 2, 120, 104, 300), fi('cze', 3, 90, 96, 80), fi('fra', 4, 300, 100, 400), fi('ger2', 1, 110, 100, 50)];
    const r = foldOverlaps(items, boxOf);
    expect(shown(r)).toEqual(['fra', 'ger']);
    expect(r.get('ger')).toEqual({ into: null, total: 930, others: 2, lead: 'ger', own: 550 }); // 550 of them its own nation's
    expect(r.get('fra')).toMatchObject({ into: null, total: 400, others: 0 });
    for (const k of ['pol', 'cze', 'ger2']) expect(r.get(k)!.into).toBe('ger');
    expect(r.get('ger2')!.lead).toBe('ger'); // its own nation's counter stands for it
    expect(r.get('pol')).toMatchObject({ lead: 'pol', own: 300 });
    // Nothing is dropped: the shown counters hold every strength.
    expect([...r.values()].reduce((a, f) => a + f.total, 0)).toBe(items.reduce((a, i) => a + i.strength, 0));
  });

  it('leaves no two shown boxes closer than the gap, on a crowded map, and keeps the sum', () => {
    let s = 7;
    const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
    const items = Array.from({ length: 300 }, (_, i) => fi(`k${i}`, 1 + Math.floor(rnd() * 30), rnd() * 600, rnd() * 300, 1 + Math.floor(rnd() * 90_000)));
    const r = foldOverlaps(items, boxOf);
    const heads = items.filter((i) => r.get(i.key)!.into === null);
    expect(heads.length).toBeGreaterThan(20);
    expect(heads.length).toBeLessThan(items.length);
    const w = (i: FoldItem): number => boxOf(r.get(i.key)!.total, r.get(i.key)!.others)[0];
    for (let a = 0; a < heads.length; a++) for (let b = a + 1; b < heads.length; b++) expect(apart(heads[a]!, w(heads[a]!), heads[b]!, w(heads[b]!), FOLD_GAP_PX), `${heads[a]!.key} and ${heads[b]!.key}`).toBe(true);
    expect(heads.reduce((a, i) => a + r.get(i.key)!.total, 0)).toBe(items.reduce((a, i) => a + i.strength, 0));
    // Every folded counter points at a shown one.
    for (const [, f] of r) if (f.into !== null) expect(r.get(f.into)!.into).toBeNull();
    // The same picture wherever the camera is: moving every counter by the same way changes nothing.
    const moved = foldOverlaps(items.map((i) => ({ ...i, x: i.x + 1234.5, y: i.y - 77.25 })), boxOf);
    expect([...moved].map(([k, f]) => [k, f.into, f.total])).toEqual([...r].map(([k, f]) => [k, f.into, f.total]));
  });

  it("a nation's own counters fold first, so the children of a cluster on its centroid count as the cluster", () => {
    // Germany as one cluster of 900 beside Poland's 700: Germany is shown, Poland inside it.
    const parent = foldOverlaps([fi('ger', 1, 100, 100, 900), fi('pol', 2, 110, 100, 700)], boxOf);
    expect(shown(parent)).toEqual(['ger']);
    expect(parent.get('ger')).toMatchObject({ into: null, total: 1600, others: 1 });
    // Germany as three children on that spot, each weaker than Poland: the same picture.
    const kids = foldOverlaps([fi('g1', 1, 100, 100, 400), fi('g2', 1, 100, 100, 300), fi('g3', 1, 100, 100, 200), fi('pol', 2, 110, 100, 700)], boxOf);
    expect(shown(kids)).toEqual(['g1']);
    expect(kids.get('g1')).toMatchObject({ into: null, total: 1600, others: 1, own: 900 });
    expect(kids.get('pol')!.into).toBe('g1');
  });

  it('a folded counter comes out only once it clears its neighbour by the hold distance', () => {
    const at = (dx: number, held: boolean): boolean => foldOverlaps([fi('a', 1, 0, 0, 500), fi('b', 2, dx, 0, 300)], boxOf, (k) => held && k === 'b').get('b')!.into === null;
    const touch = 40 + FOLD_GAP_PX; // centres this far apart: the boxes keep exactly the gap
    expect(at(touch - 1, false)).toBe(false);
    expect(at(touch, false)).toBe(true);
    // Folded already: still inside at the distance where a free counter stands alone.
    expect(at(touch, true)).toBe(false);
    expect(at(touch + FOLD_HOLD_PX - 1, true)).toBe(false);
    expect(at(touch + FOLD_HOLD_PX, true)).toBe(true);
  });

  const cluster = (nation: number, strength: number): Cluster => ({ nation, gx: 0, gy: 0, x: 0, y: 0, strength, count: 1 });
  const item = (key: string, nation: number, x: number, y: number, strength: number): { key: string; c: Cluster; x: number; y: number } => ({ key, c: cluster(nation, strength), x, y });

  it('a fold is a fade in place over FOLD_MS; at rest a counter is shown in full or not at all', () => {
    const L = new CounterLayer();
    const far = [item('a', 1, 0, 0, 500), item('b', 2, 100, 0, 300)];
    const close = [item('a', 1, 0, 0, 500), item('b', 2, 30, 0, 300)];
    expect(L.fold(far, 1, 0, boxOf).map((d) => [d.key, d.alpha, d.strength, d.others])).toEqual([['a', 1, 500, 0], ['b', 1, 300, 0]]);
    expect(L.animating(0)).toBe(false);
    // They come close: b fades out where it stands, a shows the sum at once.
    let last = 1;
    for (let t = 1000; t <= 1000 + FOLD_MS; t += 16) {
      const d = L.fold(close, 1, t, boxOf);
      expect(d.find((x) => x.key === 'a')).toMatchObject({ alpha: 1, strength: 800, others: 1, x: 0 });
      const b = d.find((x) => x.key === 'b');
      const alpha = b?.alpha ?? 0;
      if (b) expect([b.x, b.y, b.strength]).toEqual([30, 0, 300]); // in place, with its own number
      expect(alpha).toBeLessThanOrEqual(last);
      expect(last - alpha).toBeLessThan(0.15);
      last = alpha;
      expect(L.animating(t)).toBe(true);
    }
    expect(L.fold(close, 1, 1000 + FOLD_MS, boxOf).map((d) => d.key)).toEqual(['a']);
    expect(L.animating(1000 + FOLD_MS + 50)).toBe(false);
    // Apart again, far enough to clear the hold: b fades back in; a turn in mid-fade goes on from there.
    const half = L.fold(far, 1, 5000 + FOLD_MS / 2, boxOf).find((x) => x.key === 'b');
    expect(half).toBeUndefined(); // the frame that sees the change starts the fade at 0
    const quarter = L.fold(far, 1, 5000 + FOLD_MS / 2 + 100, boxOf).find((x) => x.key === 'b')!;
    expect(quarter.alpha).toBeGreaterThan(0.2);
    expect(quarter.alpha).toBeLessThan(0.5);
    const turned = L.fold(close, 1, 5000 + FOLD_MS / 2 + 100, boxOf).find((x) => x.key === 'b')!;
    expect(turned.alpha).toBeCloseTo(quarter.alpha, 9);
    expect(L.fold(close, 1, 5000 + FOLD_MS / 2 + 150, boxOf).find((x) => x.key === 'b')!.alpha).toBeLessThan(quarter.alpha);
  });

  it('a fade goes on through the swap of a cluster and its children', () => {
    const L = new CounterLayer();
    const before = [item('ger:6', 1, 0, 0, 900), item('pol:6', 2, 100, 0, 700)];
    L.fold(before, 1, 0, boxOf);
    // Poland comes close and starts to fade into Germany.
    const close = [item('ger:6', 1, 0, 0, 900), item('pol:6', 2, 30, 0, 700)];
    L.fold(close, 1, 1000, boxOf);
    const mid = L.fold(close, 1, 1100, boxOf).find((d) => d.key === 'pol:6')!;
    expect(mid.alpha).toBeGreaterThan(0.5);
    // The level changes: every key is new. Poland's two children stand on its centroid.
    const split = [item('ger:5a', 1, 0, 0, 500), item('ger:5b', 1, 0, 0, 400), item('pol:5a', 2, 30, 0, 400), item('pol:5b', 2, 30, 0, 300)];
    const d = L.fold(split, 1, 1116, boxOf);
    // Germany: the stronger child shown in full with everything, the other inside it at once.
    expect(d.find((x) => x.key === 'ger:5a')).toMatchObject({ alpha: 1, strength: 1600, others: 1 });
    expect(d.find((x) => x.key === 'ger:5b')).toBeUndefined();
    // Poland: the stronger child carries the fade on (a little further) with Poland's number,
    // the other is inside it.
    const pol = d.find((x) => x.key === 'pol:5a')!;
    expect(pol.strength).toBe(700);
    expect(pol.alpha).toBeLessThan(mid.alpha);
    expect(mid.alpha - pol.alpha).toBeLessThan(0.15);
    expect(d.find((x) => x.key === 'pol:5b')).toBeUndefined();
    // And it ends folded.
    expect(L.fold(split, 1, 1000 + FOLD_MS, boxOf).map((x) => x.key)).toEqual(['ger:5a']);
  });
});