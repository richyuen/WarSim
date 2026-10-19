import { describe, expect, it } from 'vitest';
import { drawPips, formationPips, pipGrid, PIP_PANEL_H, type PipPart } from '../../src/render/units/pips';
import { MARKER_H } from '../../src/render/units/markers';
import { Frame } from '../../src/shared/unitLooks';

// PLAN 7.21c2 (ADR-498): what a T1 marker shows of its formation's elements. A pip for each, by
// the template's parts; a lost element an empty socket; the panel the same height for every
// formation, from a brigade of 6 to a tank corps of 53.

const INF_DIV: PipPart[] = [
  { frame: Frame.infantry, count: 24 },
  { frame: Frame.gun, count: 3 },
  { frame: Frame.gun, count: 1 },
];
const W = 26;

describe('a formation\'s pips (PLAN 7.21c2)', () => {
  it('a whole division: its template\'s parts in order, every pip full', () => {
    const frames = [...Array(24).fill(Frame.infantry), ...Array(4).fill(Frame.gun)];
    const p = formationPips(INF_DIV, frames, frames.map(() => 1));
    expect(p.count).toBe(28);
    expect(Array.from(p.frame)).toEqual(frames);
    expect(Array.from(p.share).every((s) => s === 1)).toBe(true);
  });

  it('a lost element is an empty socket at the end of its part; one that lost men is fainter, the strongest first', () => {
    // 22 battalions left, one of them at half its men; the guns whole but one battery lost.
    const frames = [...Array(22).fill(Frame.infantry), Frame.gun, Frame.gun, Frame.gun];
    const shares = frames.map((_, i) => (i === 3 ? 0.5 : 1));
    const p = formationPips(INF_DIV, frames, shares);
    expect(p.count).toBe(28);
    const inf = Array.from(p.share.subarray(0, 24));
    expect(inf.slice(0, 21)).toEqual(Array(21).fill(1));
    expect(inf[21]).toBe(0.5);
    expect(inf.slice(22)).toEqual([0, 0]);
    // The guns: the parts of one frame share its living elements, in order.
    expect(Array.from(p.share.subarray(24))).toEqual([1, 1, 1, 0]);
    expect(Array.from(p.frame.subarray(24))).toEqual([Frame.gun, Frame.gun, Frame.gun, Frame.gun]);
  });

  it('elements the template has no room for follow its parts; a living element is never an empty socket', () => {
    const p = formationPips([{ frame: Frame.infantry, count: 2 }], [Frame.infantry, Frame.infantry, Frame.infantry, Frame.tank], [1, 0, 1, 0.3]);
    expect(Array.from(p.frame)).toEqual([Frame.infantry, Frame.infantry, Frame.infantry, Frame.tank]);
    expect(p.share[2]).toBeGreaterThan(0); // the one at no strength left in the sim is still there
    expect(p.share[3]).toBeCloseTo(0.3);
  });

  it('without living elements every socket is empty (the view makes pips only for a formation whose elements it has)', () => {
    expect(formationPips(INF_DIV, [], []).count).toBe(28);
    expect(Array.from(formationPips(INF_DIV, [], []).share).every((s) => s === 0)).toBe(true);
  });
});

describe('the pip panel (PLAN 7.21c2)', () => {
  /** Every pip's rectangle for `n` pips. */
  const rects = (n: number): [number, number, number, number][] => {
    const g = pipGrid(n, W);
    return Array.from({ length: n }, (_, i) => [g.x0 + (i % g.cols) * g.px, g.y0 + Math.floor(i / g.cols) * g.py, g.pw, g.ph]);
  };

  it.each([6, 16, 28, 45, 53, 78])('%i pips: inside the panel, none on another, on whole pixels up to 78', (n) => {
    const r = rects(n);
    for (const [x, y, w, h] of r) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(W);
      expect(y).toBeGreaterThanOrEqual(1);
      expect(y + h).toBeLessThanOrEqual(PIP_PANEL_H);
      expect(w).toBeGreaterThanOrEqual(1);
      expect(h).toBeGreaterThanOrEqual(1);
      for (const v of [x, y, w, h]) expect(Number.isInteger(v), `${n}: ${v}`).toBe(true);
    }
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++) {
        const [a, b] = [r[i]!, r[j]!];
        const apart = a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
        expect(apart, `${n}: pips ${i} and ${j}`).toBe(true);
      }
  });

  it('a division of 28: 2-px pips in 4 rows of 8, centred; 53: 1-px pips in 5 rows of 13', () => {
    expect(pipGrid(28, W)).toMatchObject({ cols: 8, px: 3, py: 3, pw: 2, ph: 2, x0: 1, y0: 1 });
    expect(pipGrid(53, W)).toMatchObject({ cols: 13, px: 2, py: 2, pw: 1, ph: 1 });
    // A brigade of 6 is one row, in the middle of the panel.
    expect(pipGrid(6, W).y0).toBe(6);
  });

  it('more than 78 are squeezed into the panel, not out of it', () => {
    const g = pipGrid(120, W);
    const rows = Math.ceil(120 / g.cols);
    expect(g.y0 + (rows - 1) * g.py + g.ph).toBeLessThanOrEqual(PIP_PANEL_H);
  });

  it('the marker\'s footprint holds the box, the panel and the number', () => {
    expect(MARKER_H).toBe(17 + PIP_PANEL_H + 11);
  });

  it('drawing returns the elements drawn: the living pips, not the empty sockets (PLAN 7.34b)', () => {
    const rects: number[] = [];
    const ctx = { fillStyle: '', globalAlpha: 1, fillRect: () => rects.push(1) } as unknown as CanvasRenderingContext2D;
    const parts: PipPart[] = [{ frame: Frame.infantry, count: 4 }, { frame: Frame.gun, count: 2 }];
    const pips = formationPips(parts, [Frame.infantry, Frame.infantry, Frame.infantry, Frame.gun], [1, 0.5, 1, 1]);
    expect(drawPips(ctx, pips, 0, 0, W, 1)).toBe(4);
    expect(rects.length).toBe(6);
    expect(drawPips(ctx, pips, 0, 0, W, 0)).toBe(0);
  });
});
