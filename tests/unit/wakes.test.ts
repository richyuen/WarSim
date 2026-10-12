import { describe, expect, it } from 'vitest';
import { PROXY_STRIDE } from '../../src/render/units/ProxyRenderer';
import { appendWakes, WAKE_ALPHA, WAKE_ASTERN, wakesFor } from '../../src/render/units/wakes';
import { Frame } from '../../src/shared/unitLooks';

// PLAN 4.7b: a ship under way has its wake, an instance of the wake's frame a sprite's length
// astern, white and paler; a ship at rest, a tank on the march, none.

/** Instances [x, y, facing, frame, alpha]: prev = cur, size 2. */
function instances(rows: [number, number, number, number, number][]): { data: Float32Array; colors: Uint8Array } {
  const data = new Float32Array((rows.length * 2 + 2) * PROXY_STRIDE);
  const colors = new Uint8Array((rows.length * 2 + 2) * 4);
  rows.forEach(([x, y, facing, frame, alpha], i) => {
    data.set([x, y, x, y, facing, 2, frame, alpha], i * PROXY_STRIDE);
    colors.set([200, 10, 10, 255], i * 4);
  });
  return { data, colors };
}

describe('wakes (PLAN 4.7b)', () => {
  it('a ship on the march has its wake astern; a ship at rest and a tank on the march none', () => {
    const { data, colors } = instances([
      [10, 20, 0, Frame.battleship + 0.6, 1], // under way, east
      [30, 40, Math.PI / 2, Frame.destroyer + 0.7, 0.8], // under way, south
      [50, 60, 0, Frame.carrier, 1], // at rest
      [70, 80, 0, Frame.tank + 0.6, 1], // a tank on the march
    ]);
    expect(wakesFor(data, 4)).toBe(2);
    expect(appendWakes(data, colors, 4, 4)).toBe(6);
    const w = (k: number, f: number): number => data[(4 + k) * PROXY_STRIDE + f]!;
    // The battleship's: two cells' sprite × WAKE_ASTERN to the west of it.
    expect(w(0, 0)).toBeCloseTo(10 - 2 * WAKE_ASTERN, 5);
    expect(w(0, 1)).toBeCloseTo(20, 5);
    expect(w(0, 6)).toBe(Frame.wake);
    expect(w(0, 7)).toBeCloseTo(WAKE_ALPHA, 5);
    // The destroyer's, facing south (+y): north of it.
    expect(w(1, 2)).toBeCloseTo(30, 5);
    expect(w(1, 3)).toBeCloseTo(40 - 2 * WAKE_ASTERN, 5);
    expect(w(1, 7)).toBeCloseTo(WAKE_ALPHA * 0.8, 5);
    // White, not the nation's.
    expect([...colors.slice(16, 20)]).toEqual([255, 255, 255, 255]);
  });
});
