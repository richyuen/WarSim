import { describe, expect, it } from 'vitest';
import { Frame } from '../../src/shared/unitLooks';
import { ANIM_TAIL_MS } from '../../src/render/timing';
import { figureCells, figureOffsets, gridSide } from '../../src/render/units/individuals';
import { flameOf, FLAME_MS, HULL_LIFE_MS, HULL_OUT_MS, HullFx, hullOpacity, MAX_HULLS, SMOKE_MS, tanksLost, type HullElements } from '../../src/render/fx/hulls';

// PLAN 3.6d: the tanks an element loses between two snapshots burn where they stood. The drawing
// is checked in the browser (tests/e2e/burning1938.spec.ts); here which tanks, where and how long.

interface El {
  id: number;
  strength: number;
  frame?: number;
  formation?: number;
  size?: number;
  x?: number;
  y?: number;
  facing?: number;
}
function section(list: readonly El[]): HullElements {
  return {
    count: list.length,
    id: list.map((e) => e.id),
    formation: list.map((e) => e.formation ?? 3),
    frame: list.map((e) => e.frame ?? Frame.tank),
    strength: list.map((e) => e.strength),
    size: list.map((e) => e.size ?? 10),
    x: list.map((e) => e.x ?? 100),
    y: list.map((e) => e.y ?? 50),
    facing: list.map((e) => e.facing ?? 0),
  };
}

const burnt = (before: HullElements, after: HullElements, now: number): ReturnType<typeof tanksLost> => tanksLost(before, after, now, () => true);
const add = (fx: HullFx, before: HullElements | null, after: HullElements, now: number): number => fx.add(before, after, now, () => true);

describe('tanksLost', () => {
  it('a hull for each tank an element has lost: its last figures, where they stood before', () => {
    const before = section([{ id: 7, strength: 10, x: 120.5, y: 40.25, facing: 1.1 }]);
    const after = section([{ id: 7, strength: 7, x: 121, y: 41, facing: 2 }]);
    const lost = burnt(before, after, 5000);
    expect(lost.map((h) => h.figure)).toEqual([7, 8, 9]);
    const side = gridSide(Frame.tank, 10);
    const off = figureOffsets(7, side, 10, 1.1);
    for (const h of lost) {
      expect(h).toMatchObject({ element: 7, frame: Frame.tank, facing: 1.1, cells: figureCells(side), burns: true, born: 5000 });
      expect(h.x).toBe(120.5 + off[h.figure * 2]!);
      expect(h.y).toBe(40.25 + off[h.figure * 2 + 1]!);
    }
    // The tanks that are left stand where they stood: the hulls are on none of their places.
    const left = figureOffsets(7, side, 7, 1.1);
    for (const h of lost) for (let k = 0; k < 7; k++) expect(Math.hypot(h.x - 120.5 - left[k * 2]!, h.y - 40.25 - left[k * 2 + 1]!)).toBeGreaterThan(figureCells(side) / 2);
  });

  it('none for an element first seen, for one that is gone, or for one that has lost nothing', () => {
    const before = section([{ id: 1, strength: 10 }, { id: 2, strength: 4 }, { id: 3, strength: 6 }]);
    const after = section([{ id: 1, strength: 10 }, { id: 3, strength: 8 }, { id: 4, strength: 2 }]);
    expect(burnt(before, after, 0)).toEqual([]);
    expect(burnt(section([]), after, 0)).toEqual([]);
    expect(burnt(before, section([]), 0)).toEqual([]);
  });

  it('tanks only: a battalion, a battery and a half-track company leave none', () => {
    const one = (frame: number, size: number, a: number, b: number): number => burnt(section([{ id: 5, frame, size, strength: a }]), section([{ id: 5, frame, size, strength: b }]), 0).length;
    expect(one(Frame.infantry, 500, 500, 100)).toBe(0);
    expect(one(Frame.gun, 12, 12, 6)).toBe(0);
    expect(one(Frame.halftrack, 10, 10, 6)).toBe(0);
    expect(one(Frame.tank, 10, 10, 6)).toBe(4);
    expect(one(Frame.tankMedium, 10, 10, 6)).toBe(4);
    expect(one(Frame.tankHeavy, 10, 10, 9)).toBe(1);
  });

  it('an id that is another element by now (a loaded game) leaves none', () => {
    const before = section([{ id: 9, strength: 10, formation: 3 }]);
    expect(burnt(before, section([{ id: 9, strength: 4, formation: 8 }]), 0)).toEqual([]);
    expect(burnt(before, section([{ id: 9, strength: 4, frame: Frame.tankHeavy }]), 0)).toEqual([]);
    expect(burnt(before, section([{ id: 9, strength: 4, size: 12 }]), 0)).toEqual([]);
    expect(burnt(before, section([{ id: 9, strength: 4 }]), 0)).toHaveLength(6);
  });

  it('lost under fire it burns; lost otherwise it was left behind, its turret in line', () => {
    const before = section([{ id: 1, strength: 10 }, { id: 2, strength: 10 }]);
    const after = section([{ id: 1, strength: 9 }, { id: 2, strength: 8 }]);
    const lost = tanksLost(before, after, 0, (id) => id === 2);
    expect(lost.map((h) => [h.element, h.figure, h.burns])).toEqual([[1, 9, false], [2, 8, true], [2, 9, true]]);
    expect(lost[0]!.askew).toBe(0);
    expect(lost[1]!.askew).not.toBe(0);
    // No flame at any time, and there for as long.
    expect(flameOf(lost[0]!, 100)).toBe(0);
    expect(flameOf(lost[1]!, 100)).toBe(1);
    expect(hullOpacity(lost[0]!, FLAME_MS + SMOKE_MS)).toBe(1);
    expect(hullOpacity(lost[0]!, HULL_LIFE_MS)).toBe(0);
  });

  it('each hull has its turret thrown round its own way, the same every time', () => {
    const lost = burnt(section([{ id: 11, strength: 10 }, { id: 12, strength: 10 }]), section([{ id: 11, strength: 0 }, { id: 12, strength: 0 }]), 0);
    expect(lost).toHaveLength(20);
    expect(new Set(lost.map((h) => h.askew)).size).toBe(20);
    for (const h of lost) expect(Math.abs(h.askew)).toBeLessThanOrEqual(1.2);
    expect(burnt(section([{ id: 11, strength: 10 }, { id: 12, strength: 10 }]), section([{ id: 11, strength: 0 }, { id: 12, strength: 0 }]), 77).map((h) => h.askew)).toEqual(lost.map((h) => h.askew));
  });
});

describe('a hull on the render clock', () => {
  const [h] = burnt(section([{ id: 1, strength: 10 }]), section([{ id: 1, strength: 9 }]), 1000);

  it('burns, then smokes, then fades', () => {
    expect(flameOf(h!, 1000)).toBe(1);
    expect(flameOf(h!, 1000 + FLAME_MS - 2000)).toBe(1);
    const dying = flameOf(h!, 1000 + FLAME_MS - 500);
    expect(dying).toBeGreaterThan(0);
    expect(dying).toBeLessThan(0.5);
    expect(flameOf(h!, 1000 + FLAME_MS)).toBe(0);
    // There at once: its tank stood there the frame before.
    expect(hullOpacity(h!, 1000)).toBe(1);
    expect(hullOpacity(h!, 1000 + FLAME_MS + SMOKE_MS)).toBe(1);
    expect(hullOpacity(h!, 1000 + FLAME_MS + SMOKE_MS + HULL_OUT_MS / 2)).toBeCloseTo(0.5, 6);
    expect(hullOpacity(h!, 1000 + HULL_LIFE_MS)).toBe(0);
  });

  it('a frame earlier than its snapshot shows it new, not gone', () => {
    expect(hullOpacity(h!, 990)).toBe(1);
    expect(flameOf(h!, 990)).toBe(1);
  });
});

describe('HullFx', () => {
  const whole = section([{ id: 1, strength: 10 }, { id: 2, strength: 10 }]);

  it('keeps the hulls of the losses and drops those that have faded when a snapshot arrives', () => {
    const fx = new HullFx();
    expect(add(fx, null, whole, 0)).toBe(0);
    expect(fx.animating(0)).toBe(false);
    expect(add(fx, whole, section([{ id: 1, strength: 8 }, { id: 2, strength: 10 }]), 100)).toBe(2);
    expect(fx.until).toBe(100 + HULL_LIFE_MS);
    expect(add(fx, section([{ id: 1, strength: 8 }, { id: 2, strength: 10 }]), section([{ id: 1, strength: 8 }, { id: 2, strength: 9 }]), 5000)).toBe(1);
    expect(fx.hulls.map((h) => [h.element, h.figure, h.born])).toEqual([[1, 8, 100], [1, 9, 100], [2, 9, 5000]]);
    expect(fx.animating(5000 + HULL_LIFE_MS)).toBe(true);
    expect(fx.animating(5000 + HULL_LIFE_MS + ANIM_TAIL_MS)).toBe(false);
    // A snapshot without a loss: the first two are over, the third is not.
    expect(add(fx, whole, whole, 100 + HULL_LIFE_MS)).toBe(0);
    expect(fx.hulls.map((h) => h.element)).toEqual([2]);
    expect(add(fx, null, whole, 5000 + HULL_LIFE_MS)).toBe(0);
    expect(fx.hulls).toEqual([]);
    expect(fx.animating(5000 + HULL_LIFE_MS)).toBe(false);
  });

  it('holds no more than MAX_HULLS: the oldest go', () => {
    const fx = new HullFx();
    const n = MAX_HULLS / 10 + 5;
    const full = section(Array.from({ length: n }, (_, i) => ({ id: i + 1, strength: 10 })));
    const none = section(Array.from({ length: n }, (_, i) => ({ id: i + 1, strength: 0 })));
    add(fx, section([{ id: 9000, strength: 10 }]), section([{ id: 9000, strength: 9 }]), 0);
    add(fx, full, none, 10);
    expect(fx.hulls).toHaveLength(MAX_HULLS);
    expect(fx.hulls.some((h) => h.element === 9000)).toBe(false);
    expect(fx.hulls[MAX_HULLS - 1]).toMatchObject({ element: n, figure: 9 });
  });
});
