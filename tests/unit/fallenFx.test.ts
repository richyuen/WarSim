import { describe, expect, it } from 'vitest';
import { FormationFlag } from '../../src/shared/protocol';
import { Frame, Wreck } from '../../src/shared/unitLooks';
import { figureCells, figureOffsets, gridSide } from '../../src/render/units/individuals';
import { fallenLost, HULL_LIFE_MS, HullFx, hullOpacity, MAX_FALLEN, tanksLost, type HullElements } from '../../src/render/fx/hulls';

// PLAN 3.11d: what an element that is not of tanks loses between two snapshots lies where it
// stood: the fallen of a battalion, a broken gun, a half-track. The drawing is checked in the
// browser (tests/e2e/fallen1938.spec.ts); here which figures, where, and for how long.

interface El {
  id: number;
  strength: number;
  frame?: number;
  size?: number;
  x?: number;
  y?: number;
  facing?: number;
  /** In contact (the default here: yes), and fired at since the snapshot before (yes). */
  engaged?: boolean;
  hit?: boolean;
}
function section(list: readonly El[]): HullElements {
  return {
    count: list.length,
    id: list.map((e) => e.id),
    formation: list.map(() => 3),
    frame: list.map((e) => e.frame ?? Frame.infantry),
    strength: list.map((e) => e.strength),
    size: list.map((e) => e.size ?? 500),
    x: list.map((e) => e.x ?? 100),
    y: list.map((e) => e.y ?? 50),
    facing: list.map((e) => e.facing ?? 0),
    flags: list.map((e) => (e.engaged === false ? 0 : FormationFlag.engaged)),
    hit: list.map((e) => (e.hit === false ? 0 : 1)),
  };
}

describe('fallenLost', () => {
  it('a battalion under fire: a mark for each figure it has no more, where that figure lay in its firing line', () => {
    // 64 figures of 500 men; 480 men are 62.
    const before = section([{ id: 7, strength: 500, x: 120.5, y: 40.25, facing: 1.1 }]);
    const after = section([{ id: 7, strength: 480, x: 121, y: 41, facing: 2 }]);
    const lost = fallenLost(before, after, 5000);
    expect(lost.map((m) => m.figure)).toEqual([62, 63]);
    const side = gridSide(Frame.infantry, 64);
    const line = figureOffsets(7, side, 64, 1.1, true);
    for (const m of lost) {
      expect(m).toMatchObject({ element: 7, kind: Wreck.men, cells: figureCells(side), burns: true, born: 5000 });
      expect(m.x).toBe(120.5 + line[m.figure * 2]!);
      expect(m.y).toBe(40.25 + line[m.figure * 2 + 1]!);
    }
    // Each lies its own way, the same every time.
    expect(lost[0]!.angle).not.toBe(lost[1]!.angle);
    expect(fallenLost(before, after, 9).map((m) => m.angle)).toEqual(lost.map((m) => m.angle));
  });

  it('a battalion fired at on the march: where its figure stood in its ranks', () => {
    const before = section([{ id: 7, strength: 500, facing: 0.4, engaged: false }]);
    const [m] = fallenLost(before, section([{ id: 7, strength: 490, engaged: false }]), 0);
    const ranks = figureOffsets(7, 8, 64, 0.4, false);
    expect(m!.figure).toBe(63);
    expect(m!.x).toBe(100 + ranks[126]!);
    expect(m!.y).toBe(50 + ranks[127]!);
  });

  it('none while the men lost are less than a figure, for an element first seen, or for one that is gone', () => {
    // 497 men are 64 figures still.
    expect(fallenLost(section([{ id: 1, strength: 500 }]), section([{ id: 1, strength: 497 }]), 0)).toEqual([]);
    expect(fallenLost(section([]), section([{ id: 1, strength: 100 }]), 0)).toEqual([]);
    expect(fallenLost(section([{ id: 1, strength: 500 }]), section([]), 0)).toEqual([]);
    expect(fallenLost(section([{ id: 1, strength: 300 }]), section([{ id: 1, strength: 400 }]), 0)).toEqual([]);
  });

  it('men lost with no fire on them leave none: they are gone, not fallen', () => {
    expect(fallenLost(section([{ id: 1, strength: 500 }]), section([{ id: 1, strength: 400, hit: false }]), 0)).toEqual([]);
  });

  it('a gun and a half-track: broken under fire, left behind without it', () => {
    const one = (frame: number, size: number, a: number, b: number, hit: boolean): ReturnType<typeof fallenLost> => fallenLost(section([{ id: 5, frame, size, strength: a }]), section([{ id: 5, frame, size, strength: b, hit }]), 0);
    expect(one(Frame.gun, 12, 12, 10, true).map((m) => [m.kind, m.figure, m.burns])).toEqual([[Wreck.gun, 10, true], [Wreck.gun, 11, true]]);
    expect(one(Frame.gun, 12, 12, 11, false).map((m) => [m.kind, m.figure, m.burns])).toEqual([[Wreck.gun, 11, false]]);
    expect(one(Frame.halftrack, 500, 500, 480, true).map((m) => [m.kind, m.figure, m.burns])).toEqual([[Wreck.vehicle, 62, true], [Wreck.vehicle, 63, true]]);
    expect(one(Frame.halftrack, 500, 500, 490, false).map((m) => [m.kind, m.burns])).toEqual([[Wreck.vehicle, false]]);
    // A gun stands in its ranks in contact too: the firing line is the infantry's.
    const gun = one(Frame.gun, 12, 12, 11, true)[0]!;
    const off = figureOffsets(5, gridSide(Frame.gun, 12), 12, 0);
    expect([gun.x, gun.y]).toEqual([100 + off[22]!, 50 + off[23]!]);
  });

  it('a tank leaves its hull and no mark; a ship and an aircraft leave neither', () => {
    const pair = (frame: number): [HullElements, HullElements] => [section([{ id: 5, frame, size: 10, strength: 10 }]), section([{ id: 5, frame, size: 10, strength: 6 }])];
    for (const frame of [Frame.tank, Frame.tankMedium, Frame.tankHeavy]) {
      expect(fallenLost(...pair(frame), 0)).toEqual([]);
      expect(tanksLost(...pair(frame), 0)).toHaveLength(4);
    }
    for (const frame of [Frame.ship, Frame.aircraft]) expect(fallenLost(...pair(frame), 0)).toEqual([]);
  });
});

describe('HullFx with the fallen', () => {
  const whole = section([{ id: 1, strength: 500 }, { id: 2, strength: 500 }]);
  const thinned = section([{ id: 1, strength: 470 }, { id: 2, strength: 500 }]);

  it('holds the marks of a snapshot beside its hulls, for a hull\'s time', () => {
    const fx = new HullFx();
    expect(fx.add(null, whole, 0)).toBe(0);
    // What `add` answers is the hulls it made, as before.
    expect(fx.add(whole, thinned, 100)).toBe(0);
    expect(fx.hulls).toHaveLength(0);
    expect(fx.fallen.map((m) => [m.element, m.figure])).toEqual([[1, 61], [1, 62], [1, 63]]);
    expect(fx.animating(100)).toBe(true);
    expect(fx.until).toBe(100 + HULL_LIFE_MS);
    expect(hullOpacity(fx.fallen[0]!, 100)).toBe(1);
    expect(hullOpacity(fx.fallen[0]!, 100 + HULL_LIFE_MS)).toBe(0);
    // The next snapshot after their time takes them away.
    fx.add(thinned, thinned, 200 + HULL_LIFE_MS);
    expect(fx.fallen).toHaveLength(0);
  });

  it('a load takes them away, and no more than MAX_FALLEN are held: the oldest go', () => {
    const fx = new HullFx();
    fx.add(whole, thinned, 100);
    fx.clear();
    expect(fx.fallen).toHaveLength(0);
    expect(fx.animating(100)).toBe(false);
    const many = Array.from({ length: 60 }, (_, k) => ({ id: 10 + k, strength: 500 }));
    const none = many.map((e) => ({ ...e, strength: 1 }));
    // 63 figures of each of 60 battalions.
    fx.add(section(many), section(none), 0);
    expect(fx.fallen).toHaveLength(MAX_FALLEN);
    expect(fx.fallen[fx.fallen.length - 1]).toMatchObject({ element: 69, figure: 63 });
  });
});
