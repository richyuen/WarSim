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

  // PLAN 2.14f3: the formation whose panel is open takes its place before the stronger ones.
  it('the picked formation has its tag above its block and is not the one left out, however weak it is', () => {
    const many = Array.from({ length: 2 * TAG_TRIES + 3 }, (_, k) => item(k + 1, 9000 - k, 400, 300, 460, 340));
    const weakest = many.length;
    const picked = many.map((m) => (m.id === weakest ? { ...m, picked: true } : m));
    const { placed, left } = layoutTags(picked, measure, 1400, 800);
    expect(left).toBe(3);
    expect(placed[0]!.id).toBe(weakest);
    expect(placed[0]!.picked).toBe(true);
    expect(placed[0]!.y + placed[0]!.h).toBe(300 - TAG_GAP);
    expect(placed.filter((t) => t.picked).length).toBe(1);
    // The others as before, one fewer: the weakest of them gave up its place.
    expect(placed.slice(1).map((t) => t.id)).toEqual(Array.from({ length: 2 * TAG_TRIES - 1 }, (_, k) => k + 1));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(over(placed[i]!, placed[j]!), `${i} on ${j}`).toBe(false);
    // Unpicked, it is left out, and no tag says it is picked.
    const plain = layoutTags(many, measure, 1400, 800).placed;
    expect(plain.some((t) => t.id === weakest || t.picked)).toBe(false);
  });

  // PLAN 2.14f2: the war banners and the bottom bar are in the way as another tag is.
  describe('what the page has above the map', () => {
    // A formation cut by the bottom edge, with something above it: its tag's first free place
    // was below, held in the view, which is where the bar is.
    const above = item(1, 9000, 660, 700, 740, 760);
    const cut = item(2, 8000, 660, 770, 740, 900);
    const bar = { x: 500, y: 762, w: 400, h: 32 };

    it('without them the tag of a formation at the bottom edge stands at the edge', () => {
      const t = layoutTags([above, cut], measure, 1400, 800).placed.find((p) => p.id === 2)!;
      expect(over(t, bar)).toBe(true);
    });

    it('a tag gives way to a box in its place: the next free place, a gap clear of the box', () => {
      const { placed, left } = layoutTags([above, cut], measure, 1400, 800, 1, [bar]);
      expect(left).toBe(0);
      for (const t of placed) expect(over(t, { x: bar.x - TAG_GAP, y: bar.y - TAG_GAP, w: bar.w + 2 * TAG_GAP, h: bar.h + 2 * TAG_GAP }), `tag ${t.id}`).toBe(false);
      expect(over(placed[0]!, placed[1]!)).toBe(false);
      // The stronger formation's tag is where it was.
      expect(placed[0]).toEqual(layoutTags([above, cut], measure, 1400, 800).placed[0]);
    });

    it('a box beside the tag is not in its way: boxes, not a band across the view', () => {
      const aside = { x: 900, y: 762, w: 300, h: 32 };
      expect(layoutTags([above, cut], measure, 1400, 800, 1, [aside]).placed).toEqual(layoutTags([above, cut], measure, 1400, 800).placed);
    });

    it('boxes on every place: the tag is left out and counted', () => {
      const { placed, left } = layoutTags([item(5, 9000, 660, 300, 740, 340)], measure, 1400, 800, 1, [{ x: 0, y: 0, w: 1400, h: 800 }]);
      expect(placed).toEqual([]);
      expect(left).toBe(1);
    });
  });
});
