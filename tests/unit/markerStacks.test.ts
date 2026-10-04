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

  // (Until PLAN 2.7v a box kept its move from frame to frame while it served. That memory is
  // what never came to rest: see the last tests of this file.)
  it('where the formations stand says where the boxes stand: a box is on its formation when it need not move', () => {
    const [a, b] = [m(1, 7, 0, 0, 500), m(2, 8, 16, 0, 300)];
    expect(nudgeApart([a, b], W, H).get(1)![0]).toBeLessThan(0);
    // The other has moved off a little: under by less than a quarter. No move is needed, and none is made.
    expect(nudgeApart([a, m(2, 8, 21, 0, 300)], W, H).get(1)).toEqual([0, 0]);
    expect(nudgeApart([a, m(2, 8, 60, 0, 300)], W, H).get(1)).toEqual([0, 0]);
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
    // A move that is no longer needed is given up, by the same ease.
    const Z = new MarkerStacks();
    const touching = [m(1, 7, 0, 0, 500), m(2, 8, 21, 0, 300)]; // under each other by less than a quarter
    Z.frame(close, W, H, 0);
    expect(Z.frame(touching, W, H, 2000).get(1)!.dx).toBeCloseTo(want, 9); // the frame of the change: on its way
    expect(Z.frame(touching, W, H, 2000 + NUDGE_MS).get(1)!.dx).toBe(0);
    // New to the view, on another's spot: moved at once.
    const N = new MarkerStacks();
    expect(N.frame(close, W, H, 0).get(1)!.dx).toBeCloseTo(want, 9);
    expect(N.animating(0)).toBe(false);
  });
});

// PLAN 2.7v (ADR-74, third read, finding 1): the moves come to rest. `nudgeApart` started from
// the moves of the frame before, so that a box kept its move while it served. Where three
// markers are crowded beyond what NUDGE_MAX_PX can part, its result, fed back to it, went round a
// cycle; the targets changed in every frame, and the layer said for ever that it animated: a
// paused view at T1 drew every frame. Found in 29 of 324 samples of a 1938 game, none of them at
// a tick a spec looked at.
describe('the moves come to rest (PLAN 2.7v)', () => {
  /** Frames 16 ms apart with the same markers, as the view draws them: how many until two in a row leave nothing animating (0: never, in `max`). */
  const framesToRest = (items: readonly StackItem[], max = 400): number => {
    const S = new MarkerStacks();
    let t = 0;
    S.frame(items, W, H, t);
    for (let frames = 1, quiet = 0; frames <= max; frames++) {
      t += 16;
      S.frame(items, W, H, t);
      quiet = S.animating(t) ? 0 : quiet + 1;
      if (quiet === 2) return frames;
    }
    return 0;
  };

  it('three markers that 6 px cannot part: the layer rests', () => {
    // The reader's case: after the 40th call there had been 31 different results.
    const three = [m(1, 2, 18.57, 16.65, 300), m(2, 1, 10.4, 1.19, 500), m(3, 4, 11.66, 14.84, 400)];
    const frames = framesToRest(three);
    expect(frames).toBeGreaterThan(0);
    expect(frames).toBeLessThanOrEqual(20);
    // Where the formations stand says where the boxes stand: the same answer every time.
    expect(nudgeApart(three, W, H)).toEqual(nudgeApart(three, W, H));
  });

  it('3,000 random clusters of 2 to 8 markers of three nations: every one rests within 20 frames', () => {
    let s = 2718;
    const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
    const never: string[] = [];
    let slowest = 0;
    let crowded = 0;
    for (let k = 0; k < 3000; k++) {
      const n = 2 + Math.floor(rnd() * 7);
      const items = Array.from({ length: n }, (_, i) => m(i + 1, 1 + Math.floor(rnd() * 3), rnd() * 40, rnd() * 40, 100 + Math.floor(rnd() * 900)));
      const frames = framesToRest(items);
      if (frames === 0 || frames > 20) never.push(`cluster ${k}: ${items.map((i) => `(${i.x.toFixed(2)}, ${i.y.toFixed(2)}) n${i.nation}`).join(' ')}`);
      slowest = Math.max(slowest, frames);
      // Among them the case of the finding: boxes left more than a quarter on each other at the limit.
      const r = nudgeApart(items, W, H);
      if ([...r.values()].some(([dx, dy]) => Math.hypot(dx, dy) > NUDGE_MAX_PX - 1e-6)) crowded++;
    }
    expect(crowded).toBeGreaterThan(300);
    expect(never.slice(0, 3)).toEqual([]);
    expect(slowest).toBeLessThanOrEqual(20);
  });
});

// PLAN 2.7w (ADR-74, third read, finding 3): a marker that goes into a stack fades where it
// stands. A box that had been moved apart from another nation's marker lost its move in the frame
// it went into a stack: it jumped back onto its formation, up to NUDGE_MAX_PX, at full opacity,
// and faded there.
describe('a marker that goes into a stack fades where it stands (PLAN 2.7w)', () => {
  // a and b of one nation, just short of a quarter on each other; c of another nation, more than
  // half on b: b and c are moved apart. Then b's army moves 0.2 px towards a, and b is a's.
  const a = m(1, 7, 0, 0, 500);
  const c = m(3, 8, 19.6, 12, 400);
  const withB = (x: number): StackItem[] => [a, m(2, 7, x, 0, 300), c];
  /** The layer after 82 frames of the three as they first stand: b is drawn off its formation. */
  const moved = (): { S: MarkerStacks; t: number; off: [number, number] } => {
    const S = new MarkerStacks();
    let t = 0;
    let b = S.frame(withB(19.6), W, H, t).get(2)!;
    for (let k = 1; k < 82; k++) b = S.frame(withB(19.6), W, H, (t = k * 16)).get(2)!;
    expect(b.alpha).toBe(1);
    expect(Math.hypot(b.dx, b.dy)).toBeGreaterThan(4);
    expect(S.animating(t)).toBe(false);
    return { S, t, off: [b.dx, b.dy] };
  };

  it('in the frame it goes in, and in every frame of its fade, its box is where it was', () => {
    const { S, t, off } = moved();
    let alpha = 1;
    let frames = 0;
    for (let now = t + 16; now <= t + 16 + FADE_MS + 32; now += 16) {
      const f = S.frame(withB(19.4), W, H, now);
      const b = f.get(2)!;
      expect(f.get(1)!.members).toEqual([1, 2]);
      expect(b.alpha).toBeLessThanOrEqual(alpha);
      alpha = b.alpha;
      if (alpha === 0) break;
      frames++;
      expect([b.dx, b.dy], `at ${now - t} ms, opacity ${alpha.toFixed(3)}`).toEqual(off);
    }
    expect(frames).toBeGreaterThan(10);
    expect(alpha).toBe(0);
  });

  it('one that comes out again before its fade has ended moves from where it stood, by the ease', () => {
    const { S, t, off } = moved();
    let now = t;
    for (let k = 0; k < 6; k++) S.frame(withB(19.4), W, H, (now += 16));
    // b's army moves off: under a by less than STACK_HOLD. It is shown again, and c still presses on it.
    const want = nudgeApart([a, m(2, 7, 24, 0, 300), c], W, H).get(2)!;
    expect(Math.hypot(want[0], want[1])).toBeGreaterThan(3);
    let last = S.frame(withB(24), W, H, (now += 16)).get(2)!;
    expect(last.alpha).toBeGreaterThan(0.5);
    expect(last.alpha).toBeLessThan(1);
    expect([last.dx, last.dy]).toEqual(off); // the frame of the change: where it stood
    for (let k = 0; k < 30; k++) {
      const b = S.frame(withB(24), W, H, (now += 16)).get(2)!;
      expect(Math.hypot(b.dx - last.dx, b.dy - last.dy), 'a step of the ease').toBeLessThan(1.5);
      expect(b.alpha).toBeGreaterThanOrEqual(last.alpha);
      last = b;
    }
    expect(last.alpha).toBe(1);
    expect(last.dx).toBeCloseTo(want[0], 9);
    expect(last.dy).toBeCloseTo(want[1], 9);
  });

  it('armies that move at random, 40 games of 150 ticks: no box that shows moves off its formation by more than a step of the ease', () => {
    // The largest step of an ease over NUDGE_MS between two places NUDGE_MAX_PX from a formation, in a frame of 16 ms.
    const STEP = 1.5 * (16 / NUDGE_MS) * 2 * NUDGE_MAX_PX;
    let s = 31415;
    const rnd = (): number => ((s = (s * 1664525 + 1013904223) >>> 0), s / 2 ** 32);
    let wentInMoved = 0;
    let worst = 0;
    const jumps: string[] = [];
    for (let game = 0; game < 40; game++) {
      const S = new MarkerStacks();
      const at = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, nation: 7 + (i % 2), x: rnd() * 70, y: rnd() * 70, strength: 100 + Math.floor(rnd() * 900), vx: 0, vy: 0 }));
      const before = new Map<number, { alpha: number; dx: number; dy: number; lead: boolean }>();
      let now = 0;
      for (let tick = 0; tick < 150; tick++) {
        for (const a of at) {
          a.vx = (rnd() - 0.5) * 3;
          a.vy = (rnd() - 0.5) * 3;
          a.x = Math.min(70, Math.max(0, a.x + a.vx));
          a.y = Math.min(70, Math.max(0, a.y + a.vy));
        }
        for (let f = 0; f < 6; f++, now += 16) {
          const got = S.frame(at, W, H, now);
          for (const a of at) {
            const g = got.get(a.id)!;
            const b = before.get(a.id);
            const lead = g.members.length > 0;
            if (b && b.alpha > 0 && g.alpha > 0) {
              const step = Math.hypot(g.dx - b.dx, g.dy - b.dy);
              worst = Math.max(worst, step);
              if (step > STEP + 1e-9) jumps.push(`game ${game}, tick ${tick}, marker ${a.id}: ${step.toFixed(2)} px at opacity ${g.alpha.toFixed(2)}`);
              if (b.lead && !lead && Math.hypot(b.dx, b.dy) > 1) wentInMoved++;
            }
            before.set(a.id, { alpha: g.alpha, dx: g.dx, dy: g.dy, lead });
          }
        }
      }
    }
    // The case is among them, many times: a box that stood off its formation goes into a stack.
    expect(wentInMoved).toBeGreaterThan(50);
    expect(jumps.slice(0, 3)).toEqual([]);
    expect(worst).toBeLessThanOrEqual(STEP + 1e-9);
  });

  it('one whose fade has ended keeps nothing: when it comes out later it stands where it should at once', () => {
    const { S, t } = moved();
    let now = t;
    for (let k = 0; k < 40; k++) S.frame(withB(19.4), W, H, (now += 16));
    expect(S.frame(withB(19.4), W, H, (now += 16)).get(2)!.alpha).toBe(0);
    // c has gone off meanwhile: nothing presses on b where it comes out.
    const b = S.frame([a, m(2, 7, 24, 0, 300), m(4, 8, 24, 80, 400)], W, H, now + 16).get(2)!;
    expect(b.alpha).toBeLessThan(0.1);
    expect([b.dx, b.dy]).toEqual([0, 0]);
  });
});

// PLAN 2.7z (ADR-74, fourth read, finding 1): on the way back from T2 the markers stand where
// they will rest. At T2 no markers are drawn and the layer forgets its moves (`clear`). On the way
// back the boxes do not move while they grow (`still`), and `still` took each box's place from
// the moves in hand: there were none, so every box stood on its formation for the whole morph,
// markers of two nations on each other, and they eased apart when it ended.
describe('back from T2: a cleared layer drawn still (PLAN 2.7z)', () => {
  // 1 and 2, of two nations, 16 px apart: at rest they are parted. 3 stands alone.
  const items = [m(1, 7, 0, 0, 500), m(2, 8, 16, 0, 300), m(3, 9, 5, 60, 400)];

  it('each lead stands, from the first frame, where it will rest; nothing moves when the morph ends', () => {
    const want = nudgeApart(items, W, H);
    expect(Math.abs(want.get(1)![0])).toBeGreaterThan(1);
    expect(want.get(3)).toEqual([0, 0]);
    const S = new MarkerStacks();
    S.frame(items, W, H, 0); // T1, at rest
    S.clear(); // T2: no markers are drawn
    let t = 1000;
    // The way back: 470 ms of the morph, the boxes growing about their places.
    for (; t < 1470; t += 16) {
      const f = S.frame(items, W, H, t, true);
      for (const it of items) expect([f.get(it.id)!.dx, f.get(it.id)!.dy], `marker ${it.id} at ${t - 1000} ms of the morph`).toEqual(want.get(it.id));
      expect(S.animating(t)).toBe(false);
    }
    // The morph over: they are where they were, and nothing is on its way.
    for (; t < 1470 + 200; t += 16) {
      const f = S.frame(items, W, H, t);
      for (const it of items) expect([f.get(it.id)!.dx, f.get(it.id)!.dy], `marker ${it.id}, ${t - 1470} ms after the morph`).toEqual(want.get(it.id));
      expect(S.animating(t)).toBe(false);
    }
  });

  it('on the way into T2 the boxes keep the moves they have, as before; one that is new among them takes its place', () => {
    const S = new MarkerStacks();
    const had = S.frame(items, W, H, 0);
    const [dx1, dx2] = [had.get(1)!.dx, had.get(2)!.dx];
    // The armies part while the boxes shrink: no move is needed any more, and none is given up.
    const apart = [m(1, 7, 0, 0, 500), m(2, 8, 40, 0, 300), m(3, 9, 5, 60, 400)];
    let f = S.frame(apart, W, H, 100, true);
    expect([f.get(1)!.dx, f.get(2)!.dx]).toEqual([dx1, dx2]);
    // A marker that was not there (a formation made meanwhile), on marker 3: it has no move to keep.
    const more = [...apart, m(4, 7, 21, 60, 200)];
    f = S.frame(more, W, H, 116, true);
    expect([f.get(4)!.dx, f.get(4)!.dy]).toEqual(nudgeApart(more, W, H).get(4));
    expect([f.get(1)!.dx, f.get(2)!.dx]).toEqual([dx1, dx2]);
  });
});
