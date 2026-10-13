import { describe, expect, it } from 'vitest';
import { Pcg32 } from '../../src/sim/core/rng';
import { Leg, PATROL_MAX_HOURS, legHours, patrolHours, sortieAt, sortieEnd, type Sortie } from '../../src/sim/systems/sorties';

// PLAN 5.2a: a sortie's flight is a pure function of what it was launched with: where it is at
// any time, fractional hours too, and on which leg. A property test over random sorties.

const W = 2048;
const rng = new Pcg32(5, 2, 0, 7);
function randomSortie(): Sortie {
  const kmh = rng.range(150, 900);
  return {
    bx: rng.range(0, W),
    by: rng.range(0, 1024),
    tx: rng.range(0, W),
    ty: rng.range(0, 1024),
    launch: rng.nextInt(10000),
    kmh,
    km: rng.range(0, 3000),
    over: rng.chance(0.5) ? 0 : rng.range(0, PATROL_MAX_HOURS),
  };
}
/** The cells between two places, the short way round. */
const gap = (ax: number, ay: number, bx: number, by: number): number => {
  let dx = Math.abs(ax - bx);
  if (dx > W / 2) dx = W - dx;
  return Math.sqrt(dx * dx + (ay - by) * (ay - by));
};

describe('a sortie\'s flight (PLAN 5.2a)', () => {
  it('the same sortie and time give the same place, whatever was asked before; the sortie is not changed', () => {
    for (let k = 0; k < 500; k++) {
      const s = randomSortie();
      const copy = { ...s };
      const t = s.launch + rng.range(-5, 2 * legHours(s) + s.over + 5);
      const a = sortieAt(s, t, W);
      for (let j = 0; j < 5; j++) sortieAt(s, s.launch + rng.range(-5, 50), W);
      expect(sortieAt({ ...s }, t, W)).toEqual(a);
      expect(s).toEqual(copy);
    }
  });

  it('home before and after, out then over then back between; at the target over it; on the map', () => {
    for (let k = 0; k < 500; k++) {
      const s = randomSortie();
      const h = legHours(s);
      expect(sortieAt(s, s.launch - 0.5, W)).toEqual({ x: s.bx, y: s.by, leg: Leg.Home });
      expect(sortieAt(s, sortieEnd(s), W)).toEqual({ x: s.bx, y: s.by, leg: Leg.Home });
      expect(sortieAt(s, s.launch, W)).toEqual({ x: s.bx, y: s.by, leg: Leg.Out });
      let last: Leg = Leg.Out;
      for (let i = 0; i < 40; i++) {
        const t = s.launch + ((i + 0.5) / 40) * (sortieEnd(s) - s.launch);
        const p = sortieAt(s, t, W);
        expect(p.leg).toBeGreaterThanOrEqual(last);
        last = p.leg;
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThan(W);
        if (p.leg === Leg.Over) expect(gap(p.x, p.y, s.tx, s.ty)).toBeLessThan(1e-9);
      }
      if (s.over > 0) expect(sortieAt(s, s.launch + h + s.over / 2, W).leg).toBe(Leg.Over);
    }
  });

  it('it flies at its speed: the share of the way from its base is the share of its leg flown, the short way round', () => {
    for (let k = 0; k < 500; k++) {
      const s = randomSortie();
      const h = legHours(s);
      if (h < 0.01) continue;
      const whole = gap(s.bx, s.by, s.tx, s.ty);
      for (const f of [0.1, 0.37, 0.5, 0.9]) {
        const out = sortieAt(s, s.launch + f * h, W);
        expect(out.leg).toBe(Leg.Out);
        expect(gap(out.x, out.y, s.bx, s.by)).toBeCloseTo(f * whole, 6);
        expect(gap(out.x, out.y, s.tx, s.ty)).toBeCloseTo((1 - f) * whole, 6);
        // Back the same way: at the same share of its leg home it is as far from its target.
        const back = sortieAt(s, s.launch + h + s.over + f * h, W);
        expect(back.leg).toBe(Leg.Back);
        expect(gap(back.x, back.y, s.tx, s.ty)).toBeCloseTo(f * whole, 6);
      }
    }
  });

  it('a patrol stays over its zone for the fuel its range leaves it, at most 4 hours; none beyond its range', () => {
    // A fighter group: 800 km at 480 km/h; a strategic bomber group 3,000 km at 420.
    expect(patrolHours(800, 480, 0)).toBeCloseTo(1600 / 480, 12);
    expect(patrolHours(3000, 420, 0)).toBe(PATROL_MAX_HOURS);
    expect(patrolHours(800, 480, 600)).toBeCloseTo(400 / 480, 12);
    expect(patrolHours(800, 480, 800)).toBe(0);
    expect(patrolHours(800, 480, 900)).toBe(0);
    for (let k = 0; k < 200; k++) {
      const [range, kmh] = [rng.range(300, 3000), rng.range(150, 900)];
      const [a, b] = [rng.range(0, range), rng.range(0, range)].sort((x, y) => x - y) as [number, number];
      expect(patrolHours(range, kmh, a)).toBeGreaterThanOrEqual(patrolHours(range, kmh, b));
      // Its whole flight is within its fuel: out, over, back no more than twice its range.
      expect(2 * b + kmh * patrolHours(range, kmh, b)).toBeLessThanOrEqual(2 * range + 1e-9);
    }
  });
});
