import { describe, expect, it } from 'vitest';
import { FIRE_STRIDE } from '../../src/shared/events';
import { Weapon } from '../../src/shared/unitLooks';
import { ANIM_TAIL_MS } from '../../src/render/timing';
import { FireFx, lifeOf, LOOKS, MAX_SHOTS, MAX_SPREAD_MS, MIN_SPREAD_MS, originOf, phasesOf, SCATTER_CELLS, STEP_SPREAD_MS, type CloseTier } from '../../src/render/fx/fire';
import { ATLAS_FRAME, muzzleOf } from '../../src/render/units/atlas';
import { figureCells, firingFigure, type FiringFigure } from '../../src/render/units/individuals';
import { TURN_MS, TurretAims } from '../../src/render/units/turrets';
import { Frame } from '../../src/shared/unitLooks';

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

  // PLAN 3.6e1: a turret turns onto its target in TURN_MS, from the snapshot's arrival at the earliest.
  it('a shot of cannon starts the turn of a turret after its minute, and its turret is on the target then', () => {
    for (const tickMs of [0, 1000 / 24, 1000, 5000]) {
      const fx = new FireFx();
      const list = [0, 1, 30, 59].flatMap((subtick, i) => [{ shooter: 10 + i, subtick, weapon: Weapon.cannon, x1: 10, y1: 19 }, { shooter: 20 + i, subtick }, { shooter: 30 + i, subtick, weapon: Weapon.shell }]);
      add(fx, list, 1000, tickMs);
      const start = (shooter: number): number => fx.shots.find((s) => s.shooter === shooter)!.start;
      for (let i = 0; i < 4; i++) {
        // The same spread as the rifles and the guns of its minute, later by the turn.
        expect(start(10 + i) - start(20 + i)).toBeCloseTo(TURN_MS, 9);
        expect(start(30 + i)).toBe(start(20 + i));
      }
      expect(start(20)).toBe(1000);
      const aims = new TurretAims();
      aims.add(fx.shots, 1000, tickMs);
      const HULL = 0.4;
      for (let i = 0; i < 4; i++) {
        // On the hull as the snapshot arrives, on the line to the target (north) as the shot leaves.
        expect(aims.angleAt(10 + i, HULL, 1000)).toBe(HULL);
        expect(aims.angleAt(10 + i, HULL, start(10 + i))).toBeCloseTo(-Math.PI / 2, 9);
      }
    }
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
    // Its minute, and a cannon's wait for its turret (PLAN 3.6e1).
    const T = 1500 + TURN_MS;
    expect(s.start).toBe(T);
    const over = { flash: 1, tracer: 1, impact: 1 };
    expect(phasesOf(s, T - 1)).toEqual(over); // not begun
    expect(phasesOf(s, T)).toEqual({ flash: 0, tracer: 0, impact: 1 });
    expect(phasesOf(s, T + l.flash / 2)).toMatchObject({ flash: 0.5, impact: 1 });
    expect(phasesOf(s, T + l.flight)).toEqual({ flash: 1, tracer: 1, impact: 0 });
    expect(phasesOf(s, T + l.flight + l.impact / 2)).toEqual({ flash: 1, tracer: 1, impact: 0.5 });
    expect(phasesOf(s, T + lifeOf(Weapon.cannon))).toEqual(over);
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

// PLAN 3.6c: at T3 a shot leaves the muzzle of one of its shooter's figures.
describe('where a shot starts', () => {
  const FIGURE: FiringFigure = { dx: 0.004, dy: -0.006, frame: Frame.tankMedium, side: 4, facing: 0.5 };
  const figures = (shooter: number): FiringFigure | null => (shooter === 1 ? FIGURE : null);
  const shot = (shooter = 1, weapon: Weapon = Weapon.cannon) => {
    const fx = new FireFx();
    fx.add(1, records([{ shooter, weapon, x0: 10, y0: 20, x1: 10, y1: 19 }]), 0, 0, GEO, figures);
    return fx.shots[0]!;
  };
  /** The turret is a quarter turn right of the hull. */
  const close = (share: number, minPx = 2.5): CloseTier => ({ share, minPx, turret: (_id, hull) => hull + Math.PI / 2 });
  /** 4,000 px a cell: a figure of a 4 x 4 grid is 22 px. */
  const SCALE = 4000;

  it('a shot takes the figure of its shooter from the snapshot that brought it, or none', () => {
    const asked: [number, number][] = [];
    const fx = new FireFx();
    fx.add(2, records([{ shooter: 1, tick: 77 }, { shooter: 2, tick: 77 }]), 0, 0, GEO, (shooter, tick) => {
      asked.push([shooter, tick]);
      return figures(shooter);
    });
    expect(asked).toEqual([[1, 77], [2, 77]]);
    expect(fx.shots.map((s) => s.from)).toEqual([FIGURE, null]);
    // A view that holds no elements for figures.
    const far = new FireFx();
    add(far, [{ shooter: 1 }], 0);
    expect(far.shots[0]!.from).toBeNull();
  });

  it('without the close tier, or without a figure, it is the slot and the line to the target', () => {
    const slot = { x: 10, y: 20, angle: -Math.PI / 2, atBarrel: 0, side: 0 };
    expect(originOf(shot(), 0, SCALE, 1)).toEqual(slot);
    expect(originOf(shot(), 0, SCALE, 1, close(0))).toEqual(slot);
    expect(originOf(shot(2), 0, SCALE, 1, close(1))).toEqual(slot);
  });

  it('a tank fires from the muzzle of its turret, where the turret points now', () => {
    const o = originOf(shot(), 123, SCALE, 1, close(1));
    const side = figureCells(4);
    const reach = (29 / ATLAS_FRAME) * side;
    expect(muzzleOf(Frame.tankMedium)).toEqual([29 / ATLAS_FRAME, 0]);
    // The turret's angle, not the hull's.
    expect(o.angle).toBe(0.5 + Math.PI / 2);
    expect(o.x).toBeCloseTo(10 + 0.004 + Math.cos(o.angle) * reach, 12);
    expect(o.y).toBeCloseTo(20 - 0.006 + Math.sin(o.angle) * reach, 12);
    expect(o.atBarrel).toBe(1);
    expect(o.side).toBe(side);
    // The same at any time while the turret stands.
    expect(originOf(shot(), 456, SCALE, 1, close(1))).toEqual(o);
  });

  it('a gun and a rifle fire along their own facing, the rifle from the man\'s right hand', () => {
    const at = (frame: number): { along: number; right: number } => {
      const s = { ...shot(), from: { ...FIGURE, frame, side: 8 } };
      const o = originOf(s, 0, SCALE, 1, close(1));
      expect(o.angle).toBe(0.5);
      const dx = o.x - 10 - 0.004;
      const dy = o.y - 20 + 0.006;
      return { along: (dx * Math.cos(0.5) + dy * Math.sin(0.5)) / figureCells(8), right: (-dx * Math.sin(0.5) + dy * Math.cos(0.5)) / figureCells(8) };
    };
    expect(at(Frame.gun).along).toBeCloseTo(30 / 64, 9);
    expect(at(Frame.gun).right).toBeCloseTo(0, 9);
    expect(at(Frame.infantry).right).toBeCloseTo(10 / 64, 9);
    expect(at(Frame.prone).along).toBeCloseTo(30 / 64, 9);
    // What has no barrel drawn fires from its middle.
    expect(at(Frame.halftrack).along).toBeCloseTo(0, 9);
    expect(at(Frame.halftrack).right).toBeCloseTo(0, 9);
  });

  it('the barrel is as long as the sprite is drawn: at its least size, and with the unit-size setting', () => {
    const reach = (scale: number, size: number): number => {
      const o = originOf(shot(), 0, scale, size, close(1));
      return Math.hypot(o.x - 10.004, o.y - 19.994) * scale;
    };
    expect(reach(SCALE, 1)).toBeCloseTo((29 / 64) * figureCells(4) * SCALE, 6);
    expect(reach(SCALE, 1.5)).toBeCloseTo((29 / 64) * figureCells(4) * SCALE * 1.5, 6);
    // 300 px a cell: the figure would be 1.7 px and is drawn at 2.5.
    expect(reach(300, 1)).toBeCloseTo((29 / 64) * 2.5, 6);
  });

  it('goes from the slot to the muzzle with the share of the figures', () => {
    const full = originOf(shot(), 0, SCALE, 1, close(1));
    const half = originOf(shot(), 0, SCALE, 1, close(0.5));
    expect(half.x).toBeCloseTo((10 + full.x) / 2, 12);
    expect(half.y).toBeCloseTo((20 + full.y) / 2, 12);
    expect(half.atBarrel).toBe(0.5);
  });

  it('the figure of a volley is the same in every frame and after a reload', () => {
    const a = firingFigure(1, 100, Frame.tank, 10, 10, 0, true);
    expect(firingFigure(1, 100, Frame.tank, 10, 10, 0, true)).toEqual(a);
  });
});

describe('FireFx.clear', () => {
  it('PLAN 3.7n (a game loaded into this one): no shot, and a shooter whose shot was on screen fires at once', () => {
    const fx = new FireFx();
    add(fx, [{ shooter: 1 }, { shooter: 2 }], 1000);
    expect(fx.animating(1001)).toBe(true);
    fx.clear();
    expect(fx.shots).toEqual([]);
    expect(fx.animating(1001)).toBe(false);
    // The loaded game's shooter 1 is not held back by the shot of the game before.
    add(fx, [{ shooter: 1, tick: 101 }], 1002);
    expect(fx.shots.map((s) => [s.shooter, s.start])).toEqual([[1, 1002]]);
    expect(fx.skipped).toBe(0);
  });
});
