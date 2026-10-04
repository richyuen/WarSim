import { describe, expect, it } from 'vitest';
import { MarkerStacks, NUDGE_MAX_PX, NUDGE_MS, nudgeApart, shareUnder, STACK_HOLD, STACK_UNDER, stackMarkers, type StackItem } from '../../src/render/units/markerStacks';
import { FADE_MS } from '../../src/render/timing';

// PLAN 2.7s1: markers of one nation that stand on each other are one marker. On Spain's front
// after two weeks, at 1200 m/px, 13 pairs of markers of one nation were more than a quarter
// under each other, and the number of the one underneath could not be read.

const W = 26;
const H = 29;
const m = (id: number, nation: number, x: number, y: number, strength: number): StackItem => ({ id, nation, x, y, strength });
const shown = (r: ReturnType<typeof stackMarkers>): number[] => [...r].filter(([, s]) => s.into === null).map(([id]) => id).sort((a, b) => a - b);

describe('marker stacks (PLAN 2.7s1)', () => {
  it('how much of a box is under another', () => {
    expect(shareUnder({ x: 0, y: 0 }, { x: 0, y: 0 }, W, H)).toBe(1);
    expect(shareUnder({ x: 0, y: 0 }, { x: 13, y: 0 }, W, H)).toBeCloseTo(0.5, 12);
    expect(shareUnder({ x: 0, y: 0 }, { x: 13, y: 14.5 }, W, H)).toBeCloseTo(0.25, 12);
    expect(shareUnder({ x: 0, y: 0 }, { x: 26, y: 0 }, W, H)).toBe(0);
    expect(shareUnder({ x: 0, y: 0 }, { x: 0, y: 40 }, W, H)).toBe(0);
  });

  it('a marker on a stronger one of its nation goes into it: the men of both, and whom it stands for', () => {
    const r = stackMarkers([m(1, 7, 0, 0, 500), m(2, 7, 5, 3, 300), m(3, 7, 100, 0, 400)], W, H);
    expect(shown(r)).toEqual([1, 3]);
    expect(r.get(1)).toEqual({ into: null, total: 800, members: [1, 2] });
    expect(r.get(2)).toEqual({ into: 1, total: 0, members: [] });
    expect(r.get(3)).toEqual({ into: null, total: 400, members: [3] });
    // Nothing is dropped: the shown markers stand for every formation, once.
    expect([...r.values()].flatMap((s) => s.members).sort()).toEqual([1, 2, 3]);
    expect([...r.values()].reduce((a, s) => a + s.total, 0)).toBe(1200);
  });

  it('the weaker goes into the stronger, wherever it is in the list; equal men: the lower id leads', () => {
    expect(shown(stackMarkers([m(1, 7, 0, 0, 300), m(2, 7, 5, 0, 500)], W, H))).toEqual([2]);
    expect(shown(stackMarkers([m(9, 7, 0, 0, 400), m(4, 7, 5, 0, 400)], W, H))).toEqual([4]);
  });

  it('markers of two nations are never one marker', () => {
    const r = stackMarkers([m(1, 7, 0, 0, 500), m(2, 8, 0, 0, 300)], W, H);
    expect(shown(r)).toEqual([1, 2]);
  });

  it('more than a quarter under: exactly a quarter is not', () => {
    // Side by side: under by (26 − dx) / 26.
    const at = (dx: number): number[] => shown(stackMarkers([m(1, 7, 0, 0, 500), m(2, 7, dx, 0, 300)], W, H));
    expect(STACK_UNDER).toBe(0.25);
    expect(at(19.5)).toEqual([1, 2]); // a quarter
    expect(at(19.4)).toEqual([1]);
    expect(at(26)).toEqual([1, 2]);
  });

  it('with two to go into, the one it is most under', () => {
    // Two leads 30 px apart, and a weaker marker between them, nearer the second.
    const r = stackMarkers([m(1, 7, 0, 0, 500), m(2, 7, 30, 0, 400), m(3, 7, 18, 0, 100)], W, H);
    expect(shown(r)).toEqual([1, 2]);
    expect(r.get(3)!.into).toBe(2);
    expect(r.get(2)).toMatchObject({ total: 500, members: [2, 3] });
  });

  it('a stack does not reach further than its lead: what is on a marker in it, and not on the lead, stands alone', () => {
    const r = stackMarkers([m(1, 7, 0, 0, 500), m(2, 7, 15, 0, 400), m(3, 7, 30, 0, 300)], W, H);
    expect(shown(r)).toEqual([1, 3]);
    expect(r.get(2)!.into).toBe(1);
  });

  it('a marker in a stack stays in until it is well clear of its lead', () => {
    const at = (dx: number, held: boolean): number[] => shown(stackMarkers([m(1, 7, 0, 0, 500), m(2, 7, dx, 0, 300)], W, H, (id) => held && id === 2));
    // Under by 0.154: out for a marker that comes, in for one that was in.
    expect(shareUnder({ x: 0, y: 0 }, { x: 22, y: 0 }, W, H)).toBeGreaterThan(STACK_HOLD);
    expect(at(22, false)).toEqual([1, 2]);
    expect(at(22, true)).toEqual([1]);
    // Under by 0.096: out.
    expect(shareUnder({ x: 0, y: 0 }, { x: 23.5, y: 0 }, W, H)).toBeLessThan(STACK_HOLD);
    expect(at(23.5, true)).toEqual([1, 2]);
  });

  describe('over time', () => {
    const far = [m(1, 7, 0, 0, 500), m(2, 7, 100, 0, 300)];
    const close = [m(1, 7, 0, 0, 500), m(2, 7, 5, 0, 300)];

    it('going into a stack is a fade in place; the lead shows the men of both at once', () => {
      const S = new MarkerStacks();
      expect([...S.frame(far, W, H, 0)]).toEqual([
        [1, { alpha: 1, strength: 500, members: [1], dx: 0, dy: 0 }],
        [2, { alpha: 1, strength: 300, members: [2], dx: 0, dy: 0 }],
      ]);
      expect(S.animating(0)).toBe(false);
      let last = 1;
      for (let t = 1000; t < 1000 + FADE_MS; t += 16) {
        const f = S.frame(close, W, H, t);
        expect(f.get(1)).toEqual({ alpha: 1, strength: 800, members: [1, 2], dx: 0, dy: 0 });
        const b = f.get(2)!;
        expect(b.strength).toBe(300); // its own number, where it stands, while it goes
        expect(b.members).toEqual([]);
        expect(b.alpha).toBeLessThanOrEqual(last);
        expect(last - b.alpha).toBeLessThan(0.15);
        last = b.alpha;
        expect(S.animating(t)).toBe(true);
      }
      expect(S.frame(close, W, H, 1000 + FADE_MS).get(2)!.alpha).toBe(0);
      expect(S.animating(1000 + FADE_MS + 100)).toBe(false);
      // And out again, by a fade: the lead shows its own men at once.
      const out = S.frame(far, W, H, 5000);
      expect(out.get(1)).toEqual({ alpha: 1, strength: 500, members: [1], dx: 0, dy: 0 });
      expect(out.get(2)).toMatchObject({ alpha: 0, strength: 300, members: [2] });
      expect(S.frame(far, W, H, 5000 + FADE_MS).get(2)!.alpha).toBe(1);
    });

    it('a marker new to the view takes its place at once: in a stack, or shown', () => {
      const S = new MarkerStacks();
      S.frame(far, W, H, 0);
      const f = S.frame([...far, m(3, 7, 2, 0, 100), m(4, 7, 300, 0, 100)], W, H, 16);
      expect(f.get(3)!.alpha).toBe(0);
      expect(f.get(4)!.alpha).toBe(1);
      expect(f.get(1)).toMatchObject({ strength: 600, members: [1, 3] });
      expect(S.animating(16)).toBe(false);
    });

    it('after clear() the markers take their places at once again', () => {
      const S = new MarkerStacks();
      S.frame(far, W, H, 0);
      S.clear();
      expect(S.frame(close, W, H, 16).get(2)!.alpha).toBe(0);
      expect(S.animating(16)).toBe(false);
    });
  });
});

// PLAN 2.7s2: markers of two nations are never one marker. Where they face each other across a
// front at the far end of T1 (a cell is 10 px, a marker 26) their boxes stood on each other: on
// Spain's front after two weeks 9 pairs at 1800 m/px after the stacks of 2.7s1. They move apart
// by a few px.
describe('markers of two nations move apart (PLAN 2.7s2)', () => {
  const under = (r: Map<number, [number, number]>, a: StackItem, b: StackItem): number =>
    shareUnder({ x: a.x + r.get(a.id)![0], y: a.y + r.get(a.id)![1] }, { x: b.x + r.get(b.id)![0], y: b.y + r.get(b.id)![1] }, W, H);
  const far = (r: Map<number, [number, number]>): number => Math.max(...[...r.values()].map(([dx, dy]) => Math.hypot(dx, dy)));

  it('two boxes too much on each other move apart by half each, along the shorter way, to a quarter', () => {
    // Side by side, 16 px apart: under each other by 10 / 26 = 0.38.
    const [a, b] = [m(1, 7, 0, 0, 500), m(2, 8, 16, 0, 300)];
    const r = nudgeApart([a, b], W, H);
    expect(under(r, a, b)).toBeLessThanOrEqual(STACK_UNDER);
    expect(under(r, a, b)).toBeGreaterThan(0.2); // and no further than that takes
    expect(r.get(1)![0]).toBeCloseTo(-r.get(2)![0], 9);
    expect(r.get(1)![0]).toBeLessThan(0); // away from the other
    expect([r.get(1)![1], r.get(2)![1]]).toEqual([0, 0]);
    expect(far(r)).toBeLessThan(3);
    // One above the other: along y.
    const [c, d] = [m(3, 7, 0, 0, 500), m(4, 8, 2, 18, 300)];
    const v = nudgeApart([c, d], W, H);
    expect(under(v, c, d)).toBeLessThanOrEqual(STACK_UNDER);
    expect(v.get(3)![1]).toBeLessThan(0);
    expect(v.get(3)![0]).toBe(0);
  });

  it('boxes that are a quarter under each other or less stand on their formations', () => {
    const r = nudgeApart([m(1, 7, 0, 0, 500), m(2, 8, 20, 0, 300), m(3, 8, 200, 0, 300)], W, H);
    expect([...r.values()]).toEqual([[0, 0], [0, 0], [0, 0]]);
  });

  it('no box is moved further than the limit from its formation, whatever is left', () => {
    // Two on one spot: a quarter would take 9.75 px each along x.
    const [a, b] = [m(1, 7, 0, 0, 500), m(2, 8, 0, 0, 300)];
    const r = nudgeApart([a, b], W, H);
    expect(far(r)).toBeLessThanOrEqual(NUDGE_MAX_PX + 1e-9);
    expect(under(r, a, b)).toBeGreaterThan(STACK_UNDER);
  });

  it('three in a row come to rest', () => {
    const row = [m(1, 7, 0, 0, 500), m(2, 8, 17, 0, 300), m(3, 7, 34, 0, 200)];
    const r = nudgeApart(row, W, H);
    expect(under(r, row[0]!, row[1]!)).toBeLessThanOrEqual(STACK_UNDER);
    expect(under(r, row[1]!, row[2]!)).toBeLessThanOrEqual(STACK_UNDER);
    expect(far(r)).toBeLessThanOrEqual(NUDGE_MAX_PX);
  });

  it('a box keeps its move while it serves, and goes back when it touches no other', () => {
    const [a, b] = [m(1, 7, 0, 0, 500), m(2, 8, 16, 0, 300)];
    const first = nudgeApart([a, b], W, H);
    // The other has moved off a little: under by less than a quarter even without the move. The move stays.
    const b2 = m(2, 8, 21, 0, 300);
    const kept = nudgeApart([a, b2], W, H, first);
    expect(kept.get(1)).toEqual(first.get(1));
    // It has gone: back onto the formation.
    expect(nudgeApart([a, m(2, 8, 60, 0, 300)], W, H, first).get(1)).toEqual([0, 0]);
  });

  it('over time: a box eases to its move; a marker new among the shown stands there at once', () => {
    const S = new MarkerStacks();
    const apart = [m(1, 7, 0, 0, 500), m(2, 8, 100, 0, 300)];
    const close = [m(1, 7, 0, 0, 500), m(2, 8, 16, 0, 300)];
    expect(S.frame(apart, W, H, 0).get(1)).toMatchObject({ dx: 0, dy: 0 });
    const want = nudgeApart(close, W, H).get(1)![0];
    let last = 0;
    for (let t = 1000; t <= 1000 + NUDGE_MS; t += 16) {
      const dx = S.frame(close, W, H, t).get(1)!.dx;
      expect(dx).toBeLessThanOrEqual(last + 1e-9); // on its way, never back
      expect(last - dx).toBeLessThan(0.6); // px a frame
      last = dx;
      if (t < 1000 + NUDGE_MS) expect(S.animating(t)).toBe(true);
    }
    expect(S.frame(close, W, H, 1000 + NUDGE_MS).get(1)!.dx).toBeCloseTo(want, 9);
    expect(S.animating(1000 + NUDGE_MS + 100)).toBe(false);
    // `still` (the morph into T2): the boxes keep what they have, though it is no longer needed.
    expect(S.frame(apart, W, H, 3000, true).get(1)!.dx).toBeCloseTo(want, 9);
    // At another zoom the moves are found afresh: a move that is kept at one zoom though no
    // longer needed is given up at the next.
    const Z = new MarkerStacks();
    const touching = [m(1, 7, 0, 0, 500), m(2, 8, 21, 0, 300)]; // under each other by less than a quarter
    Z.frame(close, W, H, 0, false, 10);
    expect(Z.frame(touching, W, H, 1000, false, 10).get(1)!.dx).toBeCloseTo(want, 9);
    expect(Z.frame(touching, W, H, 2000, false, 12).get(1)!.dx).toBeCloseTo(want, 9); // the frame of the change: on its way
    expect(Z.frame(touching, W, H, 2000 + NUDGE_MS, false, 12).get(1)!.dx).toBe(0);
    // New to the view, on another's spot: moved at once.
    const N = new MarkerStacks();
    expect(N.frame(close, W, H, 0).get(1)!.dx).toBeCloseTo(want, 9);
    expect(N.animating(0)).toBe(false);
  });
});
