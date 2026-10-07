import { describe, expect, it } from 'vitest';
import { marchFraction, PROXY_STRIDE } from '../../src/render/units/ProxyRenderer';
import type { Shot } from '../../src/render/fx/fire';
import { appendTurrets, HOLD_MS, RETURN_MS, TURN_MS, turnBetween, TurretAims } from '../../src/render/units/turrets';
import { Frame, turretOf, Weapon } from '../../src/shared/unitLooks';

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
  const frames = [Frame.infantry, Frame.tank, Frame.gun, Frame.tankMedium + marchFraction(3), Frame.prone, Frame.tankHeavy, Frame.halftrack + marchFraction(6), Frame.tank + marchFraction(7)].map(Math.fround);
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
      // The fraction is "on the march" and the phase of the shake: the turret's is its hull's.
      expect(data[t + 6]! - Math.floor(data[t + 6]!)).toBeCloseTo(frames[h]! - Math.floor(frames[h]!), 5);
      expect(data[t + 6]! % 1 > 0.25).toBe(frames[h]! % 1 > 0.25);
      expect(Array.from(colors.subarray((frames.length + k) * 4, (frames.length + k) * 4 + 4))).toEqual(Array.from(colors.subarray(h * 4, h * 4 + 4)));
    });
  });

  it('no hulls, no turrets', () => {
    const { data, colors } = instances([Frame.infantry, Frame.gun, Frame.halftrack, Frame.ship], 0);
    expect(appendTurrets(data, colors, 4)).toBe(4);
  });
});

// The frame field's fraction says that a sprite is on the march, and where it is in its walk.
// The phase is the sprite's own: by the place it stands on (as 3.6a first had it) it changed
// with every tick, and a marching block's walk jumped at each tick's end.
describe('marchFraction', () => {
  it('is "moving" to every reader, leaves the frame its whole number, and is the same for a sprite whenever asked', () => {
    for (let id = 0; id < 5000; id++) {
      const f = marchFraction(id);
      expect(f).toBeGreaterThanOrEqual(0.5);
      expect(f).toBeLessThan(0.995);
      expect(marchFraction(id)).toBe(f);
      for (const frame of Object.values(Frame)) expect(Math.floor(Math.fround(frame + f))).toBe(frame);
    }
  });

  it('spreads the sprites over the walk', () => {
    const tenths = new Array<number>(10).fill(0);
    for (let id = 1; id <= 5000; id++) tenths[Math.floor(((marchFraction(id) - 0.5) / 0.49) * 10)]!++;
    for (const n of tenths) expect(n).toBeGreaterThan(400);
  });
});

// PLAN 3.6b: a turret is on its target as its shot leaves, and back on its hull after a silence.
describe('TurretAims', () => {
  const shot = (shooter: number, start: number, x1: number, y1: number, weapon: Weapon = Weapon.cannon): Shot => ({ shooter, target: 99, weapon, x0: 10, y0: 10, x1, y1, dx: 0, dy: 0, start, from: null });
  const HULL = 0.3;
  const NORTH_EAST = Math.atan2(-1, 1);

  it('turns from the hull\'s facing to the target before the shot, stays, and comes back', () => {
    const aims = new TurretAims();
    expect(aims.animating(0)).toBe(false);
    aims.add([shot(7, 1400, 11, 9)], 1000, 0);
    const t0 = 1400 - TURN_MS;
    // Not yet turning: the shot is later in the tick. Another element's turrets never turn.
    expect(aims.angleAt(7, HULL, 1000)).toBe(HULL);
    expect(aims.angleAt(7, HULL, t0)).toBe(HULL);
    expect(aims.angleAt(8, HULL, 1400)).toBe(HULL);
    // Half-way at half the time (the ease is symmetric), on the target when the shot leaves.
    expect(aims.angleAt(7, HULL, t0 + TURN_MS / 2)).toBeCloseTo((HULL + NORTH_EAST) / 2, 9);
    expect(aims.angleAt(7, HULL, 1400)).toBe(NORTH_EAST);
    expect(aims.angleAt(7, HULL, 1400 + HOLD_MS - 1)).toBe(NORTH_EAST);
    expect(aims.angleAt(7, HULL, 1400 + HOLD_MS + RETURN_MS / 2)).toBeCloseTo((HULL + NORTH_EAST) / 2, 9);
    expect(aims.angleAt(7, HULL, 1400 + HOLD_MS + RETURN_MS)).toBeCloseTo(HULL, 12);
    expect(aims.angleAt(7, HULL, 1e9)).toBeCloseTo(HULL, 12);
    expect(aims.animating(1400 + HOLD_MS + RETURN_MS - 1)).toBe(true);
    expect(aims.animating(1400 + HOLD_MS + RETURN_MS + 60)).toBe(false);
  });

  it('a shot at the snapshot\'s arrival: the turn begins then', () => {
    const aims = new TurretAims();
    aims.add([shot(7, 1000, 11, 9)], 1000, 0);
    expect(aims.angleAt(7, HULL, 1000)).toBe(HULL);
    expect(aims.angleAt(7, HULL, 1000 + TURN_MS)).toBe(NORTH_EAST);
  });

  it('goes the shorter way round', () => {
    const aims = new TurretAims();
    // Hull to the south-west by west (−170°), target to the north-west by west (+170°): 20° over west.
    const hull = (-170 * Math.PI) / 180;
    aims.add([shot(7, 1000, 10 - Math.cos((10 * Math.PI) / 180), 10 + Math.sin((10 * Math.PI) / 180))], 1000, 0);
    for (let t = 1000; t < 1000 + TURN_MS; t += 10) {
      const a = aims.angleAt(7, hull, t);
      expect(a).toBeLessThanOrEqual(hull + 1e-12);
      expect(a).toBeGreaterThanOrEqual(hull - (20 * Math.PI) / 180 - 1e-9);
    }
    expect(Math.cos(aims.angleAt(7, hull, 1000 + TURN_MS))).toBeCloseTo(Math.cos((170 * Math.PI) / 180), 9);
    for (const [a, b] of [[0, 3], [3, -3], [-3, 3], [6, -6], [0.1, 0.1 + 2 * Math.PI]] as const) {
      expect(Math.abs(turnBetween(a, b, 1) - a)).toBeLessThanOrEqual(Math.PI + 1e-12);
      expect(Math.cos(turnBetween(a, b, 1))).toBeCloseTo(Math.cos(b), 9);
      expect(Math.sin(turnBetween(a, b, 1))).toBeCloseTo(Math.sin(b), 9);
    }
  });

  it('comes back to the own number of the hull when hull and target lie either side of west', () => {
    const aims = new TurretAims();
    // Hull at −3 rad, target at +3: 0.28 rad apart over west, 6 apart as numbers.
    aims.add([shot(7, 1000, 10 + Math.cos(3), 10 + Math.sin(3))], 1000, 0);
    const back = 1000 + HOLD_MS;
    for (let t = back; t < back + RETURN_MS; t += 10) {
      const a = aims.angleAt(7, -3, t);
      // Over west: up from 3 through π, never down through 0.
      expect(a).toBeGreaterThanOrEqual(3 - 1e-9);
      expect(a).toBeLessThanOrEqual(3 + (2 * Math.PI - 6) + 1e-9);
    }
    expect(aims.angleAt(7, -3, back + RETURN_MS)).toBe(-3);
    expect(aims.angleAt(7, -3, 1e9)).toBe(-3);
  });

  it('a second shot turns the turret on from where it is: on its last target, or on its way back', () => {
    const second = (start: number): TurretAims => {
      const aims = new TurretAims();
      aims.add([shot(7, 1000, 11, 9)], 1000, 0);
      aims.add([shot(7, start, 10, 11)], start - 300, 0);
      return aims;
    };
    const SOUTH = Math.PI / 2;
    // While it holds.
    const held = second(1800);
    expect(held.angleAt(7, HULL, 1800 - TURN_MS)).toBe(NORTH_EAST);
    expect(held.angleAt(7, HULL, 1800)).toBe(SOUTH);
    // In the middle of its way back.
    const start = 1000 + HOLD_MS + RETURN_MS / 2 + TURN_MS;
    const back = second(start);
    expect(back.angleAt(7, HULL, start - TURN_MS)).toBeCloseTo((HULL + NORTH_EAST) / 2, 9);
    expect(back.angleAt(7, HULL, start)).toBe(SOUTH);
    // No step anywhere: at most a few degrees in 5 ms.
    for (const aims of [held, back]) {
      let last = aims.angleAt(7, HULL, 900);
      for (let t = 905; t < 1000 + 2 * (HOLD_MS + RETURN_MS); t += 5) {
        const a = aims.angleAt(7, HULL, t);
        expect(Math.abs(a - last), `at ${t}`).toBeLessThan(0.12);
        last = a;
      }
    }
  });

  it('stays on its target from one tick\'s shot to the next in a slow game', () => {
    const aims = new TurretAims();
    // A tick of 4 s: the next hour's shot comes 4 s after this one.
    aims.add([shot(7, 1000, 11, 9)], 1000, 4000);
    expect(aims.angleAt(7, HULL, 1000 + 4500)).toBe(NORTH_EAST);
    expect(aims.angleAt(7, HULL, 1000 + 6000 + RETURN_MS)).toBeCloseTo(HULL, 12);
  });

  it('follows a hull that turns, and comes back to where the hull faces then', () => {
    const aims = new TurretAims();
    aims.add([shot(7, 1000, 11, 9)], 1000, 0);
    expect(aims.angleAt(7, 2, 1000 + TURN_MS)).toBe(NORTH_EAST);
    expect(aims.angleAt(7, 2, 1000 + HOLD_MS + RETURN_MS)).toBeCloseTo(2, 12);
  });

  it('rifles and guns that fall where they stand turn nothing; aims that are over are dropped', () => {
    const aims = new TurretAims();
    aims.add([shot(7, 1000, 11, 9, Weapon.smallArms), shot(8, 1000, 11, 9, Weapon.shell), shot(9, 1000, 10, 10)], 1000, 0);
    for (const id of [7, 8, 9]) expect(aims.angleAt(id, HULL, 1000 + TURN_MS)).toBe(HULL);
    expect(aims.animating(1000)).toBe(false);
    aims.add([shot(7, 1000, 11, 9)], 1000, 0);
    aims.add([shot(8, 9000, 11, 9)], 9000, 0);
    // Element 7's aim is gone: asked at a time when it held, the answer is the hull.
    expect(aims.angleAt(7, HULL, 1200)).toBe(HULL);
    expect(aims.angleAt(8, HULL, 9000 + TURN_MS)).toBe(NORTH_EAST);
  });
});

describe('TurretAims.clear', () => {
  it('PLAN 3.7n (a game loaded into this one): every turret is on its hull\'s line', () => {
    const aims = new TurretAims();
    const shot: Shot = { shooter: 7, target: 99, weapon: Weapon.cannon, x0: 10, y0: 10, x1: 11, y1: 9, dx: 0, dy: 0, start: 1000 + TURN_MS, from: null };
    aims.add([shot], 1000, 0);
    expect(aims.angleAt(7, 0.3, 1000 + TURN_MS)).toBe(Math.atan2(-1, 1));
    expect(aims.animating(1000 + TURN_MS)).toBe(true);
    aims.clear();
    expect(aims.angleAt(7, 0.3, 1000 + TURN_MS)).toBe(0.3);
    expect(aims.animating(1000 + TURN_MS)).toBe(false);
  });
});
