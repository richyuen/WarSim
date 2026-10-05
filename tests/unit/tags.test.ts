import { describe, expect, it } from 'vitest';
import { layoutTags, TAG_GAP, TAG_TRIES, type TagInput } from '../../src/render/units/tags';

// PLAN 2.14a: the tags of T2 and T3. The layout alone (the drawing is in tests/e2e/tags1938.spec.ts).

const measure = (text: string): number => text.length * 6;
const item = (id: number, strength: number, x0: number, y0: number, x1: number, y1: number): TagInput => ({ id, nation: 1, strength, text: '12.4k', name: `Infantry division ${id}`, engaged: false, x0, y0, x1, y1 });
const over = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('formation tags: the layout (PLAN 2.14a)', () => {
  it('a tag stands above its formation, centred on it, a gap away', () => {
    const { placed, left } = layoutTags([item(7, 9000, 400, 300, 460, 340)], measure, 1400, 800);
    expect(left).toBe(0);
    const t = placed[0]!;
    expect(t.id).toBe(7);
    expect(t.y + t.h).toBe(300 - TAG_GAP);
    expect(t.gap).toBe(TAG_GAP);
    expect(Math.abs(t.x + t.w / 2 - 430)).toBeLessThanOrEqual(1);
  });

  it('two formations on one spot: the weaker one has its tag below (the nearest free place), and the order of the list does not matter', () => {
    const a = item(1, 9000, 400, 300, 460, 340);
    const b = item(2, 5000, 405, 302, 465, 342);
    const one = layoutTags([a, b], measure, 1400, 800).placed;
    const two = layoutTags([b, a], measure, 1400, 800).placed;
    expect(one).toEqual(two);
    expect(one.map((t) => t.id)).toEqual([1, 2]);
    expect(over(one[0]!, one[1]!)).toBe(false);
    // Since PLAN 2.14c1 (two in contact stand front to front): below its own block, a gap away, not a place higher.
    expect(one[1]!.y).toBe(342 + TAG_GAP);
    expect(one[1]!.gap).toBe(TAG_GAP);
  });

  it('a formation that reaches out of the view has its tag in the view, by the part that shows', () => {
    // Its box runs off the left and the top: a division that fills the screen at T3.
    const { placed } = layoutTags([item(3, 9000, -900, -500, 300, 600)], measure, 1400, 800);
    const t = placed[0]!;
    expect(t.x).toBeGreaterThanOrEqual(0);
    expect(t.y).toBeGreaterThanOrEqual(0);
    expect(t.x + t.w).toBeLessThanOrEqual(1400);
    expect(t.gap).toBe(0); // it stands on its own elements
    // One wholly outside has none.
    expect(layoutTags([item(4, 9000, 1500, 100, 1600, 200)], measure, 1400, 800).placed).toEqual([]);
  });

  it('more formations on one spot than there are places: the weakest are left out and counted, none overlaps', () => {
    const many = Array.from({ length: 2 * TAG_TRIES + 3 }, (_, k) => item(k + 1, 9000 - k, 400, 300, 460, 340));
    const { placed, left } = layoutTags(many, measure, 1400, 800);
    expect(placed.length + left).toBe(many.length);
    expect(left).toBe(3);
    expect(placed.map((t) => t.id)).toEqual(Array.from({ length: 2 * TAG_TRIES }, (_, k) => k + 1));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(over(placed[i]!, placed[j]!), `${i} on ${j}`).toBe(false);
  });
});
