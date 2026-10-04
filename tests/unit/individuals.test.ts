import { describe, expect, it } from 'vitest';
import { hash2, pair } from '../../src/render/hash';
import { Frame } from '../../src/render/units/atlas';
import { figureCells, figureCount, figureOffsets, FOOTPRINT_CELLS, gridSide, MAX_FIGURES, subSlotOrder } from '../../src/render/units/individuals';

// PLAN 2.6: an element as its individuals at T3 (ADR-69). How many, and where each stands. The
// drawing and the sim's strengths are checked in the browser (tests/e2e/individuals1938.spec.ts).

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
  it('one for each unit of strength, at most 64', () => {
    expect([0, 1, 9, 10, 12, 63, 64, 65, 152, 500].map(figureCount)).toEqual([0, 1, 9, 10, 12, 63, 64, 64, 64, 64]);
    expect(MAX_FIGURES).toBe(64);
    expect(figureCount(-3)).toBe(0);
  });

  it('men stand in an 8 × 8 grid; vehicles and guns in a 4 × 4, larger', () => {
    for (const n of [1, 12, 40, 64]) expect(gridSide(Frame.infantry, n)).toBe(8);
    for (const f of [Frame.tank, Frame.gun, Frame.ship, Frame.aircraft]) {
      expect(gridSide(f, 10)).toBe(4);
      expect(gridSide(f, 16)).toBe(4);
      expect(gridSide(f, 17)).toBe(8); // a mechanised battalion: more than a 4 × 4 holds
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
    for (const [frame, n] of [[Frame.infantry, 64], [Frame.infantry, 23], [Frame.tank, 10], [Frame.gun, 12], [Frame.tank, 64]] as const) {
      for (const element of [1, 77, 19_353]) {
        const off = figureOffsets(element, frame, n, 0.7);
        const p = points(off);
        expect(p).toHaveLength(n);
        const pitch = FOOTPRINT_CELLS / gridSide(frame, n);
        for (const [dx, dy] of p) expect(Math.hypot(dx, dy)).toBeLessThan((FOOTPRINT_CELLS / 2) * Math.SQRT2);
        // Two figures are in different sub-slots: never closer than a sub-slot less the jitter of both.
        let nearest = Infinity;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) nearest = Math.min(nearest, Math.hypot(p[i]![0] - p[j]![0], p[i]![1] - p[j]![1]));
        expect(nearest).toBeGreaterThan(pitch * 0.6);
        expect(figureOffsets(element, frame, n, 0.7)).toEqual(off);
      }
    }
    // Facing east the block is square to the axes: every figure within half the footprint on each.
    for (const [dx, dy] of points(figureOffsets(5, Frame.infantry, 64, 0))) {
      expect(Math.abs(dx)).toBeLessThan(FOOTPRINT_CELLS / 2);
      expect(Math.abs(dy)).toBeLessThan(FOOTPRINT_CELLS / 2);
    }
  });

  it('a loss takes the last figure of the order: the others stand where they stood', () => {
    const full = figureOffsets(42, Frame.infantry, 64, 1.1);
    for (const n of [63, 40, 1]) expect(figureOffsets(42, Frame.infantry, n, 1.1)).toEqual(full.slice(0, n * 2));
    const tanks = figureOffsets(42, Frame.tank, 10, 1.1);
    expect(figureOffsets(42, Frame.tank, 7, 1.1)).toEqual(tanks.slice(0, 14));
  });

  it('the block turns with the formation', () => {
    const east = points(figureOffsets(9, Frame.gun, 12, 0));
    const south = points(figureOffsets(9, Frame.gun, 12, Math.PI / 2));
    east.forEach(([x, y], k) => {
      expect(south[k]![0]).toBeCloseTo(-y, 12);
      expect(south[k]![1]).toBeCloseTo(x, 12);
    });
  });
});
