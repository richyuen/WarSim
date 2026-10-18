import { describe, expect, it } from 'vitest';
import { hash2, pair } from '../../src/render/hash';
import { Frame, shownFrame } from '../../src/shared/unitLooks';
import { figureCells, figureCount, figureOffsets, firingFigure, FOOTPRINT_CELLS, gridSide, isLine, LINE_ABREAST, LINE_CELLS, LINE_RANKS, MAX_FIGURES, shownSide, subSlotOrder, TANK_CELLS, TANK_ROWS } from '../../src/render/units/individuals';

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
    // Since PLAN 7.9c (ADR-469) an element of up to 12 tanks is ranks of four, each tank TANK_CELLS
    // (it was a 4 × 4 grid); more is a grid.
    expect(gridSide(Frame.tank, 10)).toBe(TANK_ROWS + 4);
    expect(gridSide(Frame.tankMedium, 10)).toBe(TANK_ROWS + 4);
    expect(gridSide(Frame.tankHeavy, 12)).toBe(TANK_ROWS + 4);
    expect(gridSide(Frame.tank, 17)).toBe(8);
    expect(figureCells(gridSide(Frame.tank, 10))).toBe(TANK_CELLS);
    for (const f of [Frame.gun, Frame.ship, Frame.aircraft]) {
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
    // (An element of up to 12 tanks is ranks since PLAN 7.9c, ADR-469, on the ground of its slot:
    // `tankRanks.test.ts`. Of more, a grid, as here.)
    for (const [frame, whole, n] of [[Frame.infantry, 64, 64], [Frame.infantry, 64, 23], [Frame.gun, 12, 12], [Frame.tank, 64, 64], [Frame.tank, 64, 10]] as const) {
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

  // PLAN 7.21a (critic run 8: "shapeless clumps"; PLAN 2.14c2 scattered them off a closed-up grid).
  it('in contact the men lie in ranks across the front, the front rank first, inside the footprint', () => {
    const line = shownSide(Frame.infantry, 64, true);
    expect(isLine(line)).toBe(true);
    expect(figureCells(line)).toBe(LINE_CELLS);
    // Not in contact, and anything but infantry, keeps its grid.
    expect(shownSide(Frame.infantry, 64, false)).toBe(gridSide(Frame.infantry, 64));
    for (const f of [Frame.gun, Frame.tank, Frame.halftrack]) expect(shownSide(f, 12, true)).toBe(gridSide(f, 12));
    // A prone man (19 of his 60 atlas px across) is narrower than his place in the rank.
    const across = FOOTPRINT_CELLS / LINE_ABREAST;
    expect((LINE_CELLS * 19) / 64).toBeLessThan(across);
    for (const element of [1, 77, 19_353]) {
      const p = points(figureOffsets(element, line, 64, 0)); // facing east: along is x, across is y
      const ranks = Array.from({ length: LINE_RANKS }, (_, r) => p.slice(r * LINE_ABREAST, (r + 1) * LINE_ABREAST));
      const mean = (a: number[]): number => a.reduce((s, v) => s + v, 0) / a.length;
      const depths = ranks.map((r) => mean(r.map(([x]) => x)));
      // The front rank at the front of the footprint, each rank behind the one before by a man's length.
      expect(depths[0]! + LINE_CELLS / 2).toBeGreaterThan(FOOTPRINT_CELLS / 2 - LINE_CELLS * 0.2);
      for (let r = 1; r < LINE_RANKS; r++) expect(depths[r - 1]! - depths[r]!).toBeCloseTo(LINE_CELLS * 1.05, 3);
      for (const [r, rank] of ranks.entries()) {
        // A rank is a line: its men within a fifth of a man's length of its depth...
        for (const [x] of rank) expect(Math.abs(x - depths[r]!)).toBeLessThan(LINE_CELLS * 0.1);
        // ... and along the front a place apart, less a little.
        const ys = rank.map(([, y]) => y).sort((a, b) => a - b);
        for (let k = 1; k < ys.length; k++) expect(ys[k]! - ys[k - 1]!).toBeGreaterThan(across * 0.75);
        expect(ys[ys.length - 1]! - ys[0]!).toBeGreaterThan(across * (LINE_ABREAST - 1.5));
      }
      // The ranks are a quarter of a place off each other, either way.
      const lateral = ranks.map((r) => mean(r.map(([, y]) => y)));
      expect(lateral[1]! - lateral[0]!).toBeGreaterThan(across * 0.3);
      expect(lateral[2]! - lateral[1]!).toBeLessThan(-across * 0.3);
      for (const [dx, dy] of p) {
        expect(Math.abs(dx)).toBeLessThan(FOOTPRINT_CELLS / 2);
        expect(Math.abs(dy)).toBeLessThan(FOOTPRINT_CELLS / 2);
      }
      // A loss takes the last figure, a man of the rear rank; the others lie where they lay.
      const off = figureOffsets(element, line, 64, 0);
      for (const n of [63, 40, 1]) expect(figureOffsets(element, line, n, 0)).toEqual(off.slice(0, n * 2));
      // Gaps here and there: the rear rank's first eight are not its eight leftmost places.
      const firstEight = ranks[3]!.slice(0, 8).map(([, y]) => y).sort((a, b) => a - b);
      const leftEight = ranks[3]!.map(([, y]) => y).sort((a, b) => a - b).slice(0, 8);
      expect(firstEight).not.toEqual(leftEight);
      // It turns with the block.
      const turned = points(figureOffsets(element, line, 64, Math.PI / 2));
      p.forEach(([dx, dy], i) => {
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

// PLAN 3.6c: the figure a volley leaves.
describe('the figure that fires', () => {
  it('is one of the figures the element has, where that figure stands', () => {
    // Ten tanks, seven left: the ranks of the whole element (PLAN 7.9c; a 4 x 4 grid before).
    const side = gridSide(Frame.tankMedium, 10);
    const places = points(figureOffsets(42, side, 7, 0.8));
    for (let tick = 0; tick < 200; tick++) {
      const f = firingFigure(42, tick, Frame.tankMedium, 7, 10, 0.8, true)!;
      expect(places.some(([x, y]) => x === f.dx && y === f.dy), `tick ${tick}`).toBe(true);
      expect(f).toMatchObject({ frame: Frame.tankMedium, side, facing: 0.8 });
    }
  });

  it('is the same for the same volley, and every figure has its turn', () => {
    const seen = new Set<string>();
    for (let tick = 0; tick < 400; tick++) {
      const f = firingFigure(42, tick, Frame.tank, 10, 10, 0, false)!;
      expect(firingFigure(42, tick, Frame.tank, 10, 10, 0, false)).toEqual(f);
      seen.add(`${f.dx},${f.dy}`);
    }
    expect(seen.size).toBe(10);
    // Another element's volley of the same hour leaves another place in its grid.
    const same = Array.from({ length: 100 }, (_, tick) => [firingFigure(42, tick, Frame.gun, 12, 12, 0, false)!, firingFigure(43, tick, Frame.gun, 12, 12, 0, false)!] as const);
    expect(same.filter(([a, b]) => a.dx === b.dx && a.dy === b.dy).length).toBeLessThan(5);
  });

  it('infantry in contact fires from its line, lying down', () => {
    const line = points(figureOffsets(7, shownSide(Frame.infantry, 64, true), figureCount(300, 500), 0));
    const f = firingFigure(7, 55, Frame.infantry, 300, 500, 0, true)!;
    expect(f.frame).toBe(Frame.prone);
    expect(line.some(([x, y]) => x === f.dx && y === f.dy)).toBe(true);
    expect(firingFigure(7, 55, Frame.infantry, 300, 500, 0, false)!.frame).toBe(Frame.infantry);
  });

  it('an element without a figure has none', () => {
    expect(firingFigure(7, 55, Frame.tank, 0.4, 10, 0, true)).toBeNull();
  });
});
