import { describe, expect, it } from 'vitest';
import { PROXY_STRIDE } from '../../src/render/units/ProxyRenderer';
import { appendTurrets } from '../../src/render/units/turrets';
import { Frame, turretOf } from '../../src/shared/unitLooks';

// PLAN 3.6a: a tank is two sprites, its hull and, after every other instance, its turret at the
// hull's place. Until then a tank was one frame with the gun drawn on, which nothing could turn.

/** Instances [prevX, prevY, x, y, facing, size, frame (+ 0.5 moving), alpha] with a tint each. */
function instances(frames: readonly number[], room: number): { data: Float32Array; colors: Uint8Array } {
  const data = new Float32Array((frames.length + room) * PROXY_STRIDE);
  const colors = new Uint8Array((frames.length + room) * 4);
  frames.forEach((f, i) => {
    data.set([i + 0.25, 2 * i, i + 0.5, 2 * i + 1, 0.1 * i, 0.01 * (i + 1), f, 1 - 0.05 * i], i * PROXY_STRIDE);
    colors.set([10 * i, 20 + i, 30 + i, 255], i * 4);
  });
  return { data, colors };
}

describe('appendTurrets', () => {
  const frames = [Frame.infantry, Frame.tank, Frame.gun, Frame.tankMedium + 0.5, Frame.prone, Frame.tankHeavy, Frame.halftrack + 0.5, Frame.tank + 0.5];
  const hulls = [1, 3, 5, 7];

  it('a turret for every hull and for nothing else, after the instances, which stand as they did', () => {
    const { data, colors } = instances(frames, hulls.length);
    const before = data.slice(0, frames.length * PROXY_STRIDE);
    const owner = new Uint32Array(hulls.length);
    expect(appendTurrets(data, colors, frames.length, owner)).toBe(frames.length + hulls.length);
    expect(Array.from(data.subarray(0, frames.length * PROXY_STRIDE))).toEqual(Array.from(before));
    expect(Array.from(owner)).toEqual(hulls);
  });

  it('a turret is at its hull\'s place, of its size, facing, opacity and tint, and moves when it does', () => {
    const { data, colors } = instances(frames, hulls.length);
    appendTurrets(data, colors, frames.length);
    hulls.forEach((h, k) => {
      const t = (frames.length + k) * PROXY_STRIDE;
      const o = h * PROXY_STRIDE;
      for (const field of [0, 1, 2, 3, 4, 5, 7]) expect(data[t + field], `turret ${k} field ${field}`).toBe(data[o + field]);
      expect(Math.floor(data[t + 6]!)).toBe(turretOf(Math.floor(frames[h]!)));
      expect(data[t + 6]! % 1).toBe(frames[h]! % 1);
      expect(Array.from(colors.subarray((frames.length + k) * 4, (frames.length + k) * 4 + 4))).toEqual(Array.from(colors.subarray(h * 4, h * 4 + 4)));
    });
  });

  it('no hulls, no turrets', () => {
    const { data, colors } = instances([Frame.infantry, Frame.gun, Frame.halftrack, Frame.ship], 0);
    expect(appendTurrets(data, colors, 4)).toBe(4);
  });
});
