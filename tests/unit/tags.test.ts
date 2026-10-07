import { describe, expect, it } from 'vitest';
import { layoutTags, TAG_GAP, TAG_SIDES, TAG_TRIES, type TagInput } from '../../src/render/units/tags';

// PLAN 2.14a: the tags of T2 and T3. The layout alone (the drawing is in tests/e2e/tags1938.spec.ts).

const measure = (text: string): number => text.length * 6;
const item = (id: number, strength: number, x0: number, y0: number, x1: number, y1: number): TagInput => ({ id, nation: 1, strength, text: '12.4k', name: `Infantry division ${id}`, engaged: false, x0, y0, x1, y1 });
/** The places a tag tries: the rings, four sides each (PLAN 3.7g; two sides until then). */
const PLACES = TAG_SIDES * TAG_TRIES;
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
    // Since PLAN 3.7g a ring of places has four (above, below, left, right), not two: the
    // block is in the middle of the view, where every one of them has room.
    const many = Array.from({ length: PLACES + 3 }, (_, k) => item(k + 1, 9000 - k, 670, 380, 730, 420));
    const { placed, left } = layoutTags(many, measure, 1400, 800);
    expect(placed.length + left).toBe(many.length);
    expect(left).toBe(3);
    expect(placed.map((t) => t.id)).toEqual(Array.from({ length: PLACES }, (_, k) => k + 1));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(over(placed[i]!, placed[j]!), `${i} on ${j}`).toBe(false);
  });

  // PLAN 2.14f3: the formation whose panel is open takes its place before the stronger ones.
  it('the picked formation has its tag above its block and is not the one left out, however weak it is', () => {
    const many = Array.from({ length: PLACES + 3 }, (_, k) => item(k + 1, 9000 - k, 670, 380, 730, 420));
    const weakest = many.length;
    const picked = many.map((m) => (m.id === weakest ? { ...m, picked: true } : m));
    const { placed, left } = layoutTags(picked, measure, 1400, 800);
    expect(left).toBe(3);
    expect(placed[0]!.id).toBe(weakest);
    expect(placed[0]!.picked).toBe(true);
    expect(placed[0]!.y + placed[0]!.h).toBe(380 - TAG_GAP);
    expect(placed.filter((t) => t.picked).length).toBe(1);
    // The others as before, one fewer: the weakest of them gave up its place.
    expect(placed.slice(1).map((t) => t.id)).toEqual(Array.from({ length: PLACES - 1 }, (_, k) => k + 1));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(over(placed[i]!, placed[j]!), `${i} on ${j}`).toBe(false);
    // Unpicked, it is left out, and no tag says it is picked.
    const plain = layoutTags(many, measure, 1400, 800).placed;
    expect(plain.some((t) => t.id === weakest || t.picked)).toBe(false);
  });

  // PLAN 3.7g (ADR-168): a tag is tied to its elements.
  describe('a tag and the elements of other formations (PLAN 3.7g)', () => {
    const box = (i: TagInput): { x: number; y: number; w: number; h: number } => ({ x: i.x0, y: i.y0, w: i.x1 - i.x0, h: i.y1 - i.y0 });
    const tagOf = (placed: ReturnType<typeof layoutTags>['placed'], id: number): (typeof placed)[number] => placed.find((t) => t.id === id)!;
    // Three columns side by side, 22 and 25 px apart, as the tank battle demo's ground had
    // them at 100 m/px (PLAN 3.7g's first diagnosis): the western one is the weakest.
    const west = item(395, 233, 680, 394, 700, 433);
    const mid = item(431, 7000, 705, 408, 719, 439);
    const east = item(419, 6700, 729, 419, 745, 450);
    const columns = [west, mid, east];

    it('three columns side by side: no tag lies on another formation\'s elements, the western one\'s is left of its block, and one stands off with a line', () => {
      const { placed, left } = layoutTags(columns, measure, 1400, 800);
      expect(left).toBe(0);
      for (const t of placed) for (const f of columns) if (f.id !== t.id) expect(over(t, box(f)), `the tag of ${t.id} on the elements of ${f.id}`).toBe(false);
      for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(over(placed[i]!, placed[j]!), `${placed[i]!.id} on ${placed[j]!.id}`).toBe(false);
      const w = tagOf(placed, 395);
      expect(w.x + w.w).toBe(680 - TAG_GAP);
      expect(w.gap).toBe(TAG_GAP);
      expect(w.line).toBe(false);
      // A tag by its block has no line; one that gave way has one, to the middle of its elements.
      for (const t of placed) expect(t.line, `the line of ${t.id}, ${t.gap} px off`).toBe(t.gap > TAG_GAP + 1);
      const off = placed.filter((t) => t.line);
      expect(off.map((t) => t.id)).toEqual([431]);
      expect([off[0]!.tx, off[0]!.ty]).toEqual([(705 + 719) / 2, (408 + 439) / 2]);
    });

    it('the layout does not depend on the order of the list', () => {
      const one = layoutTags(columns, measure, 1400, 800).placed;
      for (const list of [[east, mid, west], [mid, west, east], [east, west, mid]]) expect(layoutTags(list, measure, 1400, 800).placed).toEqual(one);
    });

    it('two blocks one above the other: the upper one\'s tag above, the lower one\'s below, each by its own', () => {
      const upper = item(1, 5000, 400, 300, 460, 330);
      const lower = item(2, 9000, 400, 336, 460, 366);
      const { placed } = layoutTags([upper, lower], measure, 1400, 800);
      // The stronger is the lower: its first place, above, is on the upper one's elements.
      expect(tagOf(placed, 2).y).toBe(366 + TAG_GAP);
      expect(tagOf(placed, 1).y + tagOf(placed, 1).h).toBe(300 - TAG_GAP);
      for (const t of placed) expect([t.gap, t.line]).toEqual([TAG_GAP, false]);
    });

    it('a formation alone, and one whose neighbours are out of its tag\'s way, stand as before: above, no line', () => {
      const far = item(9, 9000, 900, 300, 960, 340);
      const { placed } = layoutTags([item(7, 5000, 400, 300, 460, 340), far], measure, 1400, 800);
      for (const t of placed) expect([t.y + t.h, t.gap, t.line]).toEqual([300 - TAG_GAP, TAG_GAP, false]);
    });

    it('every place on a neighbour\'s elements: it still has a tag, at the first free place', () => {
      // A neighbour's elements all over the view (a division that fills the screen at T3).
      const all = item(1, 9000, -50, -50, 1450, 850);
      const small = item(2, 500, 670, 380, 730, 420);
      const { placed, left } = layoutTags([all, small], measure, 1400, 800);
      expect(left).toBe(0);
      const t = tagOf(placed, 2);
      expect(t.y + t.h).toBe(380 - TAG_GAP);
      expect(t.line).toBe(false);
      expect(over(t, tagOf(placed, 1))).toBe(false);
    });

    it('a block at the view\'s left edge has no place to its left: its tag is not held in the view onto its own elements', () => {
      const edge = item(1, 500, 10, 380, 60, 420);
      const upper = item(2, 9000, 0, 330, 200, 376);
      const lower = item(3, 8000, 0, 424, 200, 470);
      const t = tagOf(layoutTags([edge, upper, lower], measure, 1400, 800).placed, 1);
      expect(t.x).toBe(60 + TAG_GAP);
      expect(t.gap).toBe(TAG_GAP);
    });
  });

  // PLAN 3.10c1b (ADR-188): a tag by its block, with a neighbour's tag nearer to the block's middle.
  describe('a tag that is not the nearest to its own elements (PLAN 3.10c1b)', () => {
    // The tank battle demo at 60 m/px on the game of PLAN 3.10c1 (seed 2, day 22.8): the
    // brigade's column is 69 px tall, the division east of it is the stronger and has its tag
    // above, 112 px wide, over the top of the column too. The brigade's stands below, a gap off.
    const named = (id: number, strength: number, name: string, x0: number, y0: number, x1: number, y1: number): TagInput => ({ ...item(id, strength, x0, y0, x1, y1), name });
    const brigade = named(395, 873, 'Tank brigade 395', 664.3, 366.4, 706.4, 435);
    const east = named(410, 4100, 'Light infantry division 410', 720, 368.8, 751.6, 426.8);
    const south = named(418, 7100, 'Light infantry division 418', 737.4, 426.8, 782.3, 486.6);
    // The widths the page measured: tags of 77 and 112 px.
    const wide = (text: string): number => (text === 'Tank brigade 395' ? 71 : text.startsWith('Light') ? 106 : 30);
    const far = (t: { x: number; y: number; w: number; h: number }, x: number, y: number): number => Math.hypot(Math.max(t.x - x, x - (t.x + t.w), 0), Math.max(t.y - y, y - (t.y + t.h), 0));

    it('the view of the demo: the brigade\'s tag is where it was, a gap below its column, and has a line; the others have none', () => {
      const { placed, left } = layoutTags([brigade, east, south], wide, 1400, 800);
      expect(left).toBe(0);
      const of = (id: number): (typeof placed)[number] => placed.find((t) => t.id === id)!;
      expect([of(410).x, of(410).y, of(410).w]).toEqual([680, 335, 112]);
      expect([of(395).x, of(395).y, of(395).w]).toEqual([647, 439, 77]);
      expect(of(395).gap).toBeCloseTo(TAG_GAP, 5);
      // The division's tag is nearer to the middle of the column than the brigade's own.
      const [mx, my] = [of(395).tx, of(395).ty];
      expect(far(of(410), mx, my)).toBeLessThan(far(of(395), mx, my));
      expect(placed.filter((t) => t.line).map((t) => t.id)).toEqual([395]);
    });

    it('every tag is the nearest to the middle of its own elements or has a line to them', () => {
      for (const list of [[brigade, east, south], [brigade, east], [east, south]]) {
        const { placed } = layoutTags(list, wide, 1400, 800);
        for (const t of placed) {
          const nearest = placed.reduce((a, b) => (far(b, t.tx, t.ty) < far(a, t.tx, t.ty) ? b : a));
          expect(far(nearest, t.tx, t.ty) >= far(t, t.tx, t.ty) || t.line, `the tag of ${t.id}`).toBe(true);
        }
      }
    });

    it('the brigade alone with the division south of it: above its column, no line', () => {
      const t = layoutTags([brigade, south], wide, 1400, 800).placed.find((p) => p.id === 395)!;
      expect(t.y + t.h).toBeLessThanOrEqual(366.4 - TAG_GAP + 1);
      expect(t.line).toBe(false);
    });
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
