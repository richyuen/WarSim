import { describe, expect, it } from 'vitest';
import { LABEL_STRIDE, LabelField } from '../../src/shared/nationLabels';
import { deriveNationLabels } from '../../src/worker/deriveLabels';

// PLAN 1.29: label curves derived from control (worker side, pure).

const W = 200;
const H = 100;

function grid(fill: (x: number, y: number) => number): Uint16Array {
  const g = new Uint16Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) g[y * W + x] = fill(x, y);
  return g;
}

const field = (d: Float64Array, id: number, f: keyof typeof LabelField): number => {
  for (let i = 0; i < d.length; i += LABEL_STRIDE) if (d[i] === id) return d[i + LabelField[f]]!;
  return NaN;
};

describe('nation label curves (PLAN 1.29)', () => {
  it('follow an elongated territory along its long axis, left to right', () => {
    // A 60 × 8 band from (20, 40) rising 1 cell per 4 to the right.
    const g = grid((x, y) => (x >= 20 && x < 80 && Math.abs(y - (40 - (x - 20) / 4)) < 4 ? 1 : 0));
    const d = deriveNationLabels(g, W, H, false);
    expect(d.length).toBe(LABEL_STRIDE);
    const x0 = field(d, 1, 'x0');
    const x2 = field(d, 1, 'x2');
    const y0 = field(d, 1, 'y0');
    const y2 = field(d, 1, 'y2');
    expect(x2).toBeGreaterThan(x0 + 30); // reads left to right along the band
    expect(y2).toBeLessThan(y0); // and rises with it
    expect(field(d, 1, 'thickness')).toBeLessThan(6);
    expect(field(d, 1, 'length')).toBeGreaterThan(30);
  });

  it("labels the capital's component, not the largest one", () => {
    // Nation 2: a small home (25 × 6) and a big colony (60 × 30).
    const g = grid((x, y) => ((x >= 10 && x < 35 && y >= 10 && y < 16) || (x >= 100 && x < 160 && y >= 50 && y < 80) ? 2 : 0));
    const home = 12 * W + 20;
    const withCap = deriveNationLabels(g, W, H, false, new Map([[2, home]]));
    expect(field(withCap, 2, 'x0')).toBeLessThan(40);
    const without = deriveNationLabels(g, W, H, false);
    expect(field(without, 2, 'x0')).toBeGreaterThan(90);
  });

  it('keeps a component across the date line in one piece (x unwrapped)', () => {
    const g = grid((x, y) => ((x < 15 || x >= W - 15) && y >= 30 && y < 40 ? 3 : 0));
    const d = deriveNationLabels(g, W, H, true);
    const len = field(d, 3, 'length');
    expect(len).toBeGreaterThan(15); // spans ~30 cells across the seam, not two halves
    expect(field(d, 3, 'x2') - field(d, 3, 'x0')).toBeLessThan(40);
  });

  it('skips territories too small to name', () => {
    const g = grid((x, y) => (x < 4 && y < 4 ? 4 : 0));
    expect(deriveNationLabels(g, W, H, false).length).toBe(0);
  });
});
