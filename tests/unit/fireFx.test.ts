import { describe, expect, it } from 'vitest';
import { FIRE_STRIDE, Weapon, weaponOf } from '../../src/shared/events';
import { LAND_CLASSES } from '../../src/sim/data/schemas';
import { ANIM_TAIL_MS } from '../../src/render/timing';
import { FireFx, lifeOf, LOOKS, MAX_SHOTS, MAX_SPREAD_MS, MIN_SPREAD_MS, phasesOf, SCATTER_CELLS, STEP_SPREAD_MS } from '../../src/render/fx/fire';

// PLAN 2.4a: the shots the view makes of a snapshot's FireEvents. The drawing itself is checked
// in the browser (tests/e2e/fire1938.spec.ts); here the rules of what becomes a shot and when.

const GEO = { w: 2048, h: 1024, kmPerCell: 19.57, wrapX: true };

interface Rec {
  tick?: number;
  subtick?: number;
  shooter: number;
  target?: number;
  weapon?: Weapon;
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
}
function records(list: readonly Rec[]): Float64Array {
  const out = new Float64Array(list.length * FIRE_STRIDE);
  list.forEach((r, i) => out.set([r.tick ?? 100, r.subtick ?? 0, r.shooter, r.target ?? 9000 + r.shooter, r.weapon ?? Weapon.smallArms, 0.4, r.x0 ?? 10, r.y0 ?? 20, r.x1 ?? 11, r.y1 ?? 21], i * FIRE_STRIDE));
  return out;
}
function add(fx: FireFx, list: readonly Rec[], now: number, tickMs = 1000): void {
  fx.add(list.length, records(list), now, tickMs, GEO);
}

describe('weaponOf', () => {
  it('artillery lobs shells, guns and tanks fire flat, the rest small arms', () => {
    expect(weaponOf('art')).toBe(Weapon.shell);
    for (const cls of ['at', 'aa', 'armor_l', 'armor_m', 'armor_h']) expect(weaponOf(cls), cls).toBe(Weapon.cannon);
    for (const cls of ['inf', 'mot', 'mech']) expect(weaponOf(cls), cls).toBe(Weapon.smallArms);
    // Every land class has a look.
    for (const cls of LAND_CLASSES) expect(LOOKS[weaponOf(cls)]).toBeDefined();
  });
});

describe('FireFx.add', () => {
  it('makes one shot of each record, as the sim gave it', () => {
    const fx = new FireFx();
    add(fx, [{ shooter: 7, target: 12, weapon: Weapon.shell, x0: 100.25, y0: 50.5, x1: 101.75, y1: 49.125 }, { shooter: 8 }], 5000);
    expect(fx.shots).toHaveLength(2);
    expect(fx.shots[0]).toMatchObject({ shooter: 7, target: 12, weapon: Weapon.shell, x0: 100.25, y0: 50.5, x1: 101.75, y1: 49.125, start: 5000 });
    expect(fx.skipped).toBe(0);
    expect(fx.from).toBe(5000);
    expect(fx.until).toBe(5000 + lifeOf(Weapon.shell));
  });

  it('spreads the shots of a tick over its wall time by the minute of the hour', () => {
    const starts = (tickMs: number): number[] => {
      const fx = new FireFx();
      add(fx, [{ shooter: 1, subtick: 0 }, { shooter: 2, subtick: 30 }, { shooter: 3, subtick: 59 }], 1000, tickMs);
      return fx.shots.map((s) => s.start - 1000);
    };
    expect(starts(1000)).toEqual([0, 500, (59 / 60) * 1000]);
    // A fast game does not fire in salvoes; a slow one does not hold shots back for seconds.
    expect(starts(1000 / 24)[1]).toBe(MIN_SPREAD_MS / 2);
    expect(starts(5000)[1]).toBe(MAX_SPREAD_MS / 2);
    // A tick stepped while paused has no wall time.
    expect(starts(0)[1]).toBe(STEP_SPREAD_MS / 2);
  });

  it('unwraps a shot across the seam of a looping map the short way', () => {
    const fx = new FireFx();
    add(fx, [{ shooter: 1, x0: 2047.5, x1: 0.5 }, { shooter: 2, x0: 0.25, x1: 2047.25 }], 0);
    expect(fx.shots.map((s) => s.x1)).toEqual([2048.5, -0.75]);
    const flat = new FireFx();
    flat.add(1, records([{ shooter: 1, x0: 2047.5, x1: 0.5 }]), 0, 1000, { ...GEO, wrapX: false });
    expect(flat.shots[0]!.x1).toBe(0.5);
  });

  it('a shooter shows one shot at a time: events while it is on screen are skipped and counted', () => {
    const fx = new FireFx();
    const life = lifeOf(Weapon.smallArms);
    add(fx, [{ shooter: 1, tick: 100 }, { shooter: 2, tick: 100 }], 0);
    add(fx, [{ shooter: 1, tick: 101 }, { shooter: 3, tick: 101 }], life - 1);
    expect(fx.shots.map((s) => s.shooter)).toEqual([1, 2, 3]);
    expect(fx.skipped).toBe(1);
    // When its shot is over the shooter fires again, and the old shots are gone.
    add(fx, [{ shooter: 1, tick: 102 }], life);
    expect(fx.shots.map((s) => [s.shooter, s.start])).toEqual([[3, life - 1], [1, life]]);
    expect(fx.skipped).toBe(1);
  });

  it('a shot that starts when the last one is over is not skipped', () => {
    const fx = new FireFx();
    add(fx, [{ shooter: 1, subtick: 0 }], 0);
    // Arrives while the first is on screen, but its minute puts it after the first one's end.
    add(fx, [{ shooter: 1, subtick: 30, tick: 101 }], 100);
    expect(fx.shots.map((s) => s.start)).toEqual([0, 600]);
    expect(fx.skipped).toBe(0);
  });

  it('holds at most MAX_SHOTS', () => {
    const fx = new FireFx();
    add(fx, Array.from({ length: MAX_SHOTS + 25 }, (_, i) => ({ shooter: i + 1 })), 0);
    expect(fx.shots).toHaveLength(MAX_SHOTS);
    expect(fx.skipped).toBe(25);
  });

  it('a snapshot without fire only clears the shots that are over', () => {
    const fx = new FireFx();
    add(fx, [{ shooter: 1 }, { shooter: 2, weapon: Weapon.shell }], 0);
    const until = fx.until;
    add(fx, [], lifeOf(Weapon.smallArms));
    expect(fx.shots.map((s) => s.shooter)).toEqual([2]);
    expect([fx.from, fx.until]).toEqual([0, until]);
  });

  it('shots land around the target: the same for the same volley, elsewhere for the next', () => {
    const fx = new FireFx();
    add(fx, Array.from({ length: 200 }, (_, i) => ({ shooter: i + 1, tick: 100 })), 0);
    const first = fx.shots.map((s) => [s.dx, s.dy]);
    for (const [dx, dy] of first) {
      expect(Math.abs(dx!)).toBeLessThanOrEqual(SCATTER_CELLS);
      expect(Math.abs(dy!)).toBeLessThanOrEqual(SCATTER_CELLS);
    }
    // Spread over the square, not on one point or one line.
    expect(new Set(first.map(([dx]) => Math.round((dx! / SCATTER_CELLS) * 4))).size).toBeGreaterThanOrEqual(8);
    expect(new Set(first.map(([, dy]) => Math.round((dy! / SCATTER_CELLS) * 4))).size).toBeGreaterThanOrEqual(8);
    const again = new FireFx();
    add(again, Array.from({ length: 200 }, (_, i) => ({ shooter: i + 1, tick: 100 })), 777);
    expect(again.shots.map((s) => [s.dx, s.dy])).toEqual(first);
    const next = new FireFx();
    add(next, Array.from({ length: 200 }, (_, i) => ({ shooter: i + 1, tick: 101 })), 0);
    expect(next.shots.filter((s, i) => s.dx === first[i]![0] && s.dy === first[i]![1]).length).toBeLessThan(5);
    // The points of the sim are left as they are.
    expect(fx.shots.every((s) => s.x1 === 11 && s.y1 === 21)).toBe(true);
  });
});

describe('a shot in time', () => {
  it('flash and tracer from the start, the impact after the flight, then nothing', () => {
    const fx = new FireFx();
    add(fx, [{ shooter: 1, weapon: Weapon.cannon, subtick: 30 }], 1000);
    const s = fx.shots[0]!;
    const l = LOOKS[Weapon.cannon];
    expect(s.start).toBe(1500);
    const over = { flash: 1, tracer: 1, impact: 1 };
    expect(phasesOf(s, 1499)).toEqual(over); // not begun
    expect(phasesOf(s, 1500)).toEqual({ flash: 0, tracer: 0, impact: 1 });
    expect(phasesOf(s, 1500 + l.flash / 2)).toMatchObject({ flash: 0.5, impact: 1 });
    expect(phasesOf(s, 1500 + l.flight)).toEqual({ flash: 1, tracer: 1, impact: 0 });
    expect(phasesOf(s, 1500 + l.flight + l.impact / 2)).toEqual({ flash: 1, tracer: 1, impact: 0.5 });
    expect(phasesOf(s, 1500 + lifeOf(Weapon.cannon))).toEqual(over);
  });

  it('animating lasts to the end of the last shot, whatever the frame clock says before', () => {
    const fx = new FireFx();
    expect(fx.animating(0)).toBe(false);
    add(fx, [{ shooter: 1 }, { shooter: 2, weapon: Weapon.shell, subtick: 59 }], 1000);
    const end = 1000 + (59 / 60) * 1000 + lifeOf(Weapon.shell);
    expect(fx.until).toBe(end);
    // The frame that draws a snapshot can carry a time from before it arrived.
    expect(fx.animating(990)).toBe(true);
    expect(fx.animating(end - 1)).toBe(true);
    expect(fx.animating(end + ANIM_TAIL_MS - 1)).toBe(true);
    expect(fx.animating(end + ANIM_TAIL_MS)).toBe(false);
  });
});
