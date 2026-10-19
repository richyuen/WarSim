import { describe, expect, it } from 'vitest';
import { enemyPointers, pointerBox, POINTER_GAP, POINTER_INSET, type PointerSource } from '../../src/render/units/enemyPointers';

// PLAN 7.34d: a pointer at the frame's edge toward the enemy of a formation in contact, where that
// enemy's block is off the frame and the formation's is in it.

const VW = 1600;
const VH = 900;
const src = (id: number, x: number, y: number, enemy: number, ex: number, ey: number, nation = 9): PointerSource => ({ id, x, y, enemy, enemyNation: nation, ex, ey });

describe('enemyPointers', () => {
  it('points from the frame edge toward an enemy above the frame', () => {
    const [p] = enemyPointers([src(11, 800, 500, 549, 820, -300)], VW, VH);
    expect(p).toBeDefined();
    expect(p!.enemy).toBe(549);
    expect(p!.nation).toBe(9);
    expect(p!.from).toBe(11);
    // On the top edge, inset; on the line from the frame's middle to the enemy.
    expect(p!.y).toBeCloseTo(POINTER_INSET, 6);
    const along = (p!.x - 800) / (p!.y - 450);
    expect(along).toBeCloseTo((820 - 800) / (-300 - 450), 6);
    // Toward the enemy.
    const way = Math.atan2(-300 - p!.y, 820 - p!.x);
    expect(Math.abs(Math.atan2(Math.sin(p!.angle - way), Math.cos(p!.angle - way)))).toBeLessThan(1e-9);
  });

  it('has none for an enemy in the frame, a formation off it, or no enemy', () => {
    expect(enemyPointers([src(11, 800, 500, 549, 900, 300)], VW, VH)).toEqual([]);
    expect(enemyPointers([src(11, -50, 500, 549, -900, 300)], VW, VH)).toEqual([]);
    expect(enemyPointers([src(11, 800, 500, 0, 0, -900)], VW, VH)).toEqual([]);
  });

  it('has one pointer per enemy, for the first formation by id', () => {
    const out = enemyPointers([src(15, 900, 500, 549, 820, -300), src(11, 700, 500, 549, 820, -300)], VW, VH);
    expect(out.length).toBe(1);
    expect(out[0]!.from).toBe(11);
  });

  it('leaves out the farther of two pointers that would stand on each other', () => {
    const out = enemyPointers([src(11, 800, 500, 549, 820, -300), src(12, 800, 500, 550, 830, -1200)], VW, VH);
    expect(out.map((p) => p.enemy)).toEqual([549]);
    const apart = enemyPointers([src(11, 800, 500, 549, 820, -300), src(12, 800, 500, 550, 2400, 450)], VW, VH);
    expect(apart.map((p) => p.enemy).sort()).toEqual([549, 550]);
    expect(Math.hypot(apart[0]!.x - apart[1]!.x, apart[0]!.y - apart[1]!.y)).toBeGreaterThanOrEqual(POINTER_GAP);
  });

  it("slides along its edge off a page box over its place", () => {
    const box = { x: 760, y: 0, w: 120, h: 60 };
    const [p] = enemyPointers([src(11, 800, 500, 549, 820, -300)], VW, VH, [box]);
    expect(p!.y).toBeCloseTo(POINTER_INSET, 6);
    expect(p!.x < box.x || p!.x > box.x + box.w).toBe(true);
    // Still pointing at the enemy from where it stands.
    const way = Math.atan2(-300 - p!.y, 820 - p!.x);
    expect(p!.angle).toBeCloseTo(way, 9);
  });

  it('works on every side and at the corners', () => {
    for (const [ex, ey] of [[2400, 450], [-800, 450], [800, 1800], [3000, 3000], [-3000, -3000]] as const) {
      const [p] = enemyPointers([src(11, 800, 450, 549, ex, ey)], VW, VH);
      expect(p!.x).toBeGreaterThanOrEqual(POINTER_INSET - 1e-9);
      expect(p!.x).toBeLessThanOrEqual(VW - POINTER_INSET + 1e-9);
      expect(p!.y).toBeGreaterThanOrEqual(POINTER_INSET - 1e-9);
      expect(p!.y).toBeLessThanOrEqual(VH - POINTER_INSET + 1e-9);
      const onEdge = Math.min(p!.x - POINTER_INSET, VW - POINTER_INSET - p!.x, p!.y - POINTER_INSET, VH - POINTER_INSET - p!.y);
      expect(onEdge).toBeCloseTo(0, 6);
    }
  });

  it('keeps its arrow and its label off a box (a tag) its label would meet', () => {
    // A tag just under the top edge where the label would stand.
    const tag = { x: 860, y: 20, w: 100, h: 30 };
    const free = enemyPointers([src(11, 800, 500, 549, 820, -300)], VW, VH, [], 1, () => 150);
    const box0 = pointerBox(free[0]!.x, free[0]!.y, free[0]!.angle, 150, VW, VH);
    const meets = (a: typeof tag, b: typeof tag): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    expect(meets(box0, tag)).toBe(true);
    const [p] = enemyPointers([src(11, 800, 500, 549, 820, -300)], VW, VH, [tag], 1, () => 150);
    expect(meets(pointerBox(p!.x, p!.y, p!.angle, 150, VW, VH), tag)).toBe(false);
    expect(p!.y).toBeCloseTo(POINTER_INSET, 6);
  });
});
