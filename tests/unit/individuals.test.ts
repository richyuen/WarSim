import { describe, expect, it } from 'vitest';
import { hash2, pair } from '../../src/render/hash';
import { Frame, shownFrame } from '../../src/shared/unitLooks';
import { figureCells, figureCount, figureOffsets, FOOTPRINT_CELLS, gridSide, LINE_DEPTH, MAX_FIGURES, subSlotOrder } from '../../src/render/units/individuals';

// PLAN 2.6 and 2.10b: an element as its individuals at T3 (ADR-69, ADR-80). How many, and where
// each stands. The drawing and the sim's strengths are checked in the browser
// (tests/e2e/individuals1938.spec.ts).

const points = (off: number[]): [number, number][] => Array.from({ length: off.length / 2 }, (_, k) => [off[k * 2]!, off[k * 2 + 1]!]);

describe('placement hash', () => {
  it('is a 32-bit mix of two integers, the same every time', () => {
    const seen = new Set<number>();
    for (let a = 0; a < 50; a++) {
      for (let b = 0; b < 50; b++) {
        const h = hash2(a, b);
        expect(Number.isInteger(h) && h >= 0 && h <= 0xffffffff).toBe(true);
        expect(hash2(a, b)).toBe(h);
        seen.add(h);
      }
    }
    expect(seen.size).toBeGreaterThan(2490); // 2,500 pairs, next to no collisions
    for (const h of seen) for (const v of pair(h)) expect(v >= -1 && v < 1).toBe(true);
  });
});

describe('how many figures', () => {
  it('a figure for each unit where an element has up to 64 units: guns, tanks, planes, ships', () => {
    expect(MAX_FIGURES).toBe(64);
    for (const size of [1, 6, 10, 12, 64]) for (let s = 0; s <= size; s++) expect(figureCount(s, size), `${s} of ${size}`).toBe(s);
    expect(figureCount(-3, 12)).toBe(0);
    expect(figureCount(9.9, 12)).toBe(9);
  });

  it('a battalion: 64 figures when whole, and its share of them while it loses men, rounded up', () => {
    const of500 = (s: number): number => figureCount(s, 500);
    // Until PLAN 2.10b (ADR-69's cap) every one of these above 64 men drew 64, and 63, 16, 8, 7 and 1 drew a figure a man.
    expect([500, 493, 492, 485, 484, 250, 152, 65, 64, 63, 16, 8, 7, 1, 0].map(of500)).toEqual([64, 64, 63, 63, 62, 32, 20, 9, 9, 9, 3, 2, 1, 1, 0]);
    expect(of500(-3)).toBe(0);
    for (let s = 1; s <= 500; s++) {
      // A man lost takes a figure away or none; an element with men has a figure; never more figures than men.
      expect(of500(s) - of500(s - 1), `${s}`).toBeGreaterThanOrEqual(0);
      expect(of500(s) - of500(s - 1), `${s}`).toBeLessThanOrEqual(1);
      expect(of500(s), `${s}`).toBeGreaterThanOrEqual(1);
      expect(of500(s), `${s}`).toBeLessThanOrEqual(s);
      // What the eye reads off the block is the battalion's strength, to within a figure.
      const over = of500(s) / MAX_FIGURES - s / 500;
      expect(over, `${s}`).toBeGreaterThanOrEqual(0);
      expect(over, `${s}`).toBeLessThan(1 / MAX_FIGURES);
    }
    // Any size above 64 is of this kind; more than whole (no state of the sim's) is whole.
    for (const size of [65, 120, 1000]) {
      expect(figureCount(size, size)).toBe(MAX_FIGURES);
      expect(figureCount(1, size)).toBe(1);
      expect(figureCount(Math.floor(size / 2), size)).toBe(Math.ceil((Math.floor(size / 2) * MAX_FIGURES) / size));
    }
    expect(figureCount(600, 500)).toBe(MAX_FIGURES);
  });

  it('the grid is the whole element\'s: men 8 × 8; vehicles and guns 4 × 4, larger; more than 16 of them 8 × 8', () => {
    for (const whole of [1, 12, 40, 64]) expect(gridSide(Frame.infantry, whole)).toBe(8);
    for (const f of [Frame.tank, Frame.gun, Frame.ship, Frame.aircraft]) {
      expect(gridSide(f, 10)).toBe(4);
      expect(gridSide(f, 16)).toBe(4);
      expect(gridSide(f, 17)).toBe(8);
      expect(gridSide(f, figureCount(500, 500))).toBe(8); // a mechanised battalion: more than a 4 × 4 holds
    }
    expect(figureCells(4)).toBeCloseTo(2 * figureCells(8), 12);
    expect(figureCells(8) * 8).toBeLessThan(FOOTPRINT_CELLS);
  });
});

describe('where they stand', () => {
  it('every sub-slot once, in an order of the element\'s own', () => {
    for (const side of [4, 8]) {
      const order = subSlotOrder(1234, side);
      expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: side * side }, (_, k) => k));
      expect(subSlotOrder(1234, side)).toEqual(order);
      expect(subSlotOrder(1235, side)).not.toEqual(order);
    }
    // Not the reading order: the first eight are not one row.
    expect(new Set(subSlotOrder(1234, 8).slice(0, 8).map((s) => Math.floor(s / 8))).size).toBeGreaterThan(3);
  });

  it('inside the footprint, apart from each other, the same every time', () => {
    // [frame, the figures of the whole element, the figures it has]: the last a mechanised battalion that has lost most of its men.
    for (const [frame, whole, n] of [[Frame.infantry, 64, 64], [Frame.infantry, 64, 23], [Frame.tank, 10, 10], [Frame.gun, 12, 12], [Frame.tank, 64, 64], [Frame.tank, 64, 10]] as const) {
      const side = gridSide(frame, whole);
      for (const element of [1, 77, 19_353]) {
        const off = figureOffsets(element, side, n, 0.7);
        const p = points(off);
        expect(p).toHaveLength(n);
        const pitch = FOOTPRINT_CELLS / side;
        for (const [dx, dy] of p) expect(Math.hypot(dx, dy)).toBeLessThan((FOOTPRINT_CELLS / 2) * Math.SQRT2);
        // Two figures are in different sub-slots: never closer than a sub-slot less the jitter of both.
        let nearest = Infinity;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) nearest = Math.min(nearest, Math.hypot(p[i]![0] - p[j]![0], p[i]![1] - p[j]![1]));
        expect(nearest).toBeGreaterThan(pitch * 0.6);
        expect(figureOffsets(element, side, n, 0.7)).toEqual(off);
      }
    }
    // Facing east the block is square to the axes: every figure within half the footprint on each.
    for (const [dx, dy] of points(figureOffsets(5, 8, 64, 0))) {
      expect(Math.abs(dx)).toBeLessThan(FOOTPRINT_CELLS / 2);
      expect(Math.abs(dy)).toBeLessThan(FOOTPRINT_CELLS / 2);
    }
  });

  // PLAN 2.14c2: a battalion in contact does not stand in its parade grid.
  it('in contact the men lie in a loose line at the front of the footprint: half as deep, inside it, a loss still the last figure', () => {
    const along = (off: number[]): number[] => points(off).map(([dx]) => dx); // facing east: along is x
    for (const element of [1, 77, 19_353]) {
      const rest = figureOffsets(element, 8, 64, 0);
      const line = figureOffsets(element, 8, 64, 0, true);
      expect(line).not.toEqual(rest);
      const depth = (a: number[]): number => Math.max(...a) - Math.min(...a);
      // The ranks closed up: at most 0.6 of the depth at rest, and forward of the middle on the whole.
      expect(depth(along(line)) / depth(along(rest))).toBeLessThan(0.6);
      expect(depth(along(line)) / depth(along(rest))).toBeGreaterThan(LINE_DEPTH * 0.8);
      const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
      expect(mean(along(line))).toBeGreaterThan(FOOTPRINT_CELLS * 0.15);
      expect(Math.abs(mean(along(rest)))).toBeLessThan(FOOTPRINT_CELLS * 0.03);
      // Inside the footprint, front edge included.
      for (const [dx, dy] of points(line)) {
        expect(Math.abs(dx)).toBeLessThan(FOOTPRINT_CELLS / 2);
        expect(Math.abs(dy)).toBeLessThan(FOOTPRINT_CELLS / 2);
      }
      // Less regular than the grid: across the front the men are further off their files.
      const across = (off: number[]): number[] => points(off).map(([, dy]) => dy);
      const offFile = (a: number[]): number => mean(a.map((v) => Math.abs(v / (FOOTPRINT_CELLS / 8) - Math.round(v / (FOOTPRINT_CELLS / 8) - 0.5) - 0.5)));
      expect(offFile(across(line))).toBeGreaterThan(offFile(across(rest)) * 1.4);
      // The same man in the same file: a loss takes the last figure of the order away.
      for (const n of [63, 40, 1]) expect(figureOffsets(element, 8, n, 0, true)).toEqual(line.slice(0, n * 2));
      // And it turns with the block as the grid does.
      const turned = points(figureOffsets(element, 8, 64, Math.PI / 2, true));
      points(line).forEach(([dx, dy], i) => {
        expect(turned[i]![0]).toBeCloseTo(-dy, 12);
        expect(turned[i]![1]).toBeCloseTo(dx, 12);
      });
    }
  });

  it('infantry in contact is drawn prone; guns, tanks and infantry at rest as they are', () => {
    expect(shownFrame(Frame.infantry, true)).toBe(Frame.prone);
    expect(shownFrame(Frame.infantry, false)).toBe(Frame.infantry);
    for (const f of [Frame.tank, Frame.gun, Frame.ship, Frame.aircraft]) expect(shownFrame(f, true)).toBe(f);
  });
  it('a loss takes the last figure of the order: the others stand where they stood', () => {
    const full = figureOffsets(42, gridSide(Frame.infantry, 64), 64, 1.1);
    for (const n of [63, 40, 1]) expect(figureOffsets(42, gridSide(Frame.infantry, 64), n, 1.1)).toEqual(full.slice(0, n * 2));
    const tanks = figureOffsets(42, gridSide(Frame.tank, 10), 10, 1.1);
    expect(figureOffsets(42, gridSide(Frame.tank, 10), 7, 1.1)).toEqual(tanks.slice(0, 14));
    // A battalion's losses, man by man: each figure that is left is where it was when the battalion was whole.
    for (let s = 500; s >= 1; s -= 7) {
      const n = figureCount(s, 500);
      expect(figureOffsets(42, 8, n, 1.1), `${s} men`).toEqual(full.slice(0, n * 2));
    }
    // A mechanised battalion keeps its grid of 8 × 8 down to its last vehicle's worth: with the
    // grid taken from what is left, its 16 figures would stand in a 4 × 4, twice the size, elsewhere.
    const side = gridSide(Frame.tank, figureCount(500, 500));
    const mech = figureOffsets(42, side, 64, 1.1);
    for (const s of [400, 125, 100, 8]) {
      const n = figureCount(s, 500);
      expect(figureOffsets(42, side, n, 1.1), `${s} men`).toEqual(mech.slice(0, n * 2));
    }
    expect(figureCount(125, 500)).toBe(16);
  });

  it('the block turns with the formation', () => {
    const east = points(figureOffsets(9, 4, 12, 0));
    const south = points(figureOffsets(9, 4, 12, Math.PI / 2));
    east.forEach(([x, y], k) => {
      expect(south[k]![0]).toBeCloseTo(-y, 12);
      expect(south[k]![1]).toBeCloseTo(x, 12);
    });
  });
});
