import { describe, expect, it } from 'vitest';
import { layoutTags, TAG_FLAG_W, TAG_GAP, TAG_LINE_FROM, TAG_NAME_FONT, TAG_PAD, TAG_SIDES, TAG_STRENGTH_FONT, TAG_TRIES, type PlacedTag, type TagInput, type TagObstacle } from '../../src/render/units/tags';

// PLAN 2.14a: the tags of T2 and T3. The layout alone (the drawing is in tests/e2e/tags1938.spec.ts).

const measure = (text: string): number => text.length * 6;
const item = (id: number, strength: number, x0: number, y0: number, x1: number, y1: number): TagInput => ({ id, nation: 1, strength, text: '12.4k', name: `Infantry division ${id}`, engaged: false, x0, y0, x1, y1 });
/** The places a tag tries: the rings, four sides each (PLAN 3.7g; two sides until then). */
const PLACES = TAG_SIDES * TAG_TRIES;
const over = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// PLAN 7.1l4: the layout asks its questions of the boxes in a grid, not of every box. This is
// the layout as it was, each question asked of every box: the two must place every tag alike.
const overlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const far = (t: { x: number; y: number; w: number; h: number }, x: number, y: number): number => Math.hypot(Math.max(t.x - x, x - (t.x + t.w), 0), Math.max(t.y - y, y - (t.y + t.h), 0));
function layoutPlain(items: readonly TagInput[], measure: (text: string, font: string) => number, vw: number, vh: number, scale = 1, avoid: readonly TagObstacle[] = []): { placed: PlacedTag[]; left: number } {
  const placed: PlacedTag[] = [];
  let left = 0;
  const pad = TAG_PAD * scale;
  const lineH = 12 * scale;
  const h = 2 * lineH + 2 * pad;
  const edge = 2;
  const kept = avoid.map((o) => ({ x: o.x - TAG_GAP, y: o.y - TAG_GAP, w: o.w + 2 * TAG_GAP, h: o.h + 2 * TAG_GAP }));
  const sorted = [...items].sort((a, b) => Number(b.picked === true) - Number(a.picked === true) || b.strength - a.strength || a.id - b.id);
  for (const it of sorted) {
    // The part of the formation that is in the view.
    const vx0 = Math.max(it.x0, 0);
    const vx1 = Math.min(it.x1, vw);
    const vy0 = Math.max(it.y0, 0);
    const vy1 = Math.min(it.y1, vh);
    if (vx1 < vx0 || vy1 < vy0) continue;
    const w = Math.ceil(Math.max(TAG_FLAG_W * scale + pad + measure(it.text, TAG_STRENGTH_FONT(scale)), measure(it.name, TAG_NAME_FONT(scale))) + 2 * pad);
    const x = Math.round(Math.min(Math.max((vx0 + vx1) / 2 - w / 2, edge), Math.max(edge, vw - w - edge)));
    const stepY = h + TAG_GAP;
    const stepX = w + TAG_GAP;
    const above = vy0 - TAG_GAP - h;
    const below = vy1 + TAG_GAP;
    const beside = (vy0 + vy1) / 2 - h / 2;
    const maxX = Math.max(edge, vw - w - edge);
    const maxY = Math.max(edge, vh - h - edge);
    const tries: { x: number; y: number }[] = [];
    /** How many of them are by the block: the first place on each side. */
    let byBlock = 0;
    // Above, then below, then left and right, then a place further out on each side: the
    // nearest free one. (Two formations in contact stand front to front, PLAN 2.14c1: one has
    // its tag above its block and the other below, each by its own. Blocks side by side,
    // ADR-168: the places beside a block are the ones clear of its neighbours.)
    for (let k = 0; k < TAG_TRIES; k++) {
      // In the view: one that would stand above its top edge stands at it, on its own elements.
      tries.push({ x, y: Math.round(Math.min(Math.max(above - k * stepY, edge), maxY)) }, { x, y: Math.round(Math.min(Math.max(below + k * stepY, edge), maxY)) });
      // A place beside the block that the view has no room for is none: held in the view it would be a place above or below again.
      const y = Math.round(Math.min(Math.max(beside, edge), maxY));
      const lx = Math.round(vx0 - TAG_GAP - w - k * stepX);
      const rx = Math.round(vx1 + TAG_GAP + k * stepX);
      if (lx >= edge) tries.push({ x: lx, y });
      if (rx <= maxX) tries.push({ x: rx, y });
      if (k === 0) byBlock = tries.length;
    }
    const tx = (vx0 + vx1) / 2;
    const ty = (vy0 + vy1) / 2;
    let done = false;
    // First a place by the block, clear of every other formation's elements, that is not
    // nearer to the middle of another block than that block's own tag, placed before it (PLAN
    // 3.11f: a reader would take it for that block's); then the nearest place clear of the
    // elements; with none, any free place.
    for (const pass of [0, 1, 2]) {
      const clear = pass < 2;
      for (const at of pass === 0 ? tries.slice(0, byBlock) : tries) {
        const box = { x: at.x, y: at.y, w, h };
        if (kept.some((o) => overlap(o, box)) || placed.some((p) => overlap(p, box))) continue;
        if (clear && items.some((o) => o !== it && box.x < o.x1 && o.x0 < box.x + w && box.y < o.y1 && o.y0 < box.y + h)) continue;
        if (pass === 0 && placed.some((p) => far(box, p.tx, p.ty) < far(p, p.tx, p.ty))) continue;
        // Nor one that a tag placed before it is nearer to this block's middle than (PLAN
        // 4.2b1): it would have a line (ADR-188) where a place by the block has none.
        if (pass === 0 && placed.some((p) => far(p, tx, ty) < far(box, tx, ty))) continue;
        // How far the tag's box is from its elements' (0 when it lies on them).
        const gap = Math.max(vx0 - (box.x + w), box.x - vx1, vy0 - (box.y + h), box.y - vy1, 0);
        placed.push({ id: it.id, nation: it.nation, strength: it.strength, text: it.text, name: it.name, engaged: it.engaged, picked: it.picked === true, ...box, gap, line: gap > TAG_LINE_FROM, tx: (vx0 + vx1) / 2, ty: (vy0 + vy1) / 2, flag: false });
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) left++;
  }
  // A tag by its own block is not always the one a reader takes for the block's (ADR-188):
  // by a tall block, "below" is further from its middle than a neighbour's tag over its top.
  // Such a tag has a line too.
  for (const t of placed) {
    if (t.line) continue;
    const own = far(t, t.tx, t.ty);
    if (placed.some((o) => o !== t && far(o, t.tx, t.ty) < own)) t.line = true;
  }
  return { placed, left };
}

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

    // Until PLAN 4.2b1 (ADR-249) the brigade's tag stood below its column (647, 439) with a
    // line: the division's tag was nearer to the column's middle. Such a place is not taken
    // now while a place by the block has no nearer tag: it stands beside the column.
    it('the view of the demo: the brigade\'s tag stands beside its column, a gap off, the nearest tag to its middle, and none has a line', () => {
      const { placed, left } = layoutTags([brigade, east, south], wide, 1400, 800);
      expect(left).toBe(0);
      const of = (id: number): (typeof placed)[number] => placed.find((t) => t.id === id)!;
      expect([of(410).x, of(410).y, of(410).w]).toEqual([680, 335, 112]);
      expect([of(395).x, of(395).y, of(395).w]).toEqual([Math.round(664.3 - TAG_GAP - 77), Math.round((366.4 + 435) / 2 - of(395).h / 2), 77]);
      expect(of(395).gap).toBeLessThanOrEqual(TAG_GAP + 1);
      // The division's tag is further from the middle of the column than the brigade's own.
      const [mx, my] = [of(395).tx, of(395).ty];
      expect(far(of(410), mx, my)).toBeGreaterThan(far(of(395), mx, my));
      expect(placed.filter((t) => t.line).map((t) => t.id)).toEqual([]);
    });

    it('with no place by its column clear of the others, the brigade\'s tag stands below as it did, and has its line', () => {
      // A block west of the column: the place beside it is on that block's elements.
      const west = named(300, 500, 'Tank brigade 300', 590, 380, 650, 420);
      const { placed } = layoutTags([brigade, east, south, west], wide, 1400, 800);
      const t = placed.find((p) => p.id === 395)!;
      expect([t.x, t.y]).toEqual([647, 439]);
      expect(t.line).toBe(true);
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

  // PLAN 3.11f: `tags1938` at 150 m/px after PLAN 3.11c4. Two divisions in contact stand side by
  // side, each block 18 px wide and 33 tall. The western one's tag is above; the eastern one's
  // "below" is under both blocks, and was as near to the western block's middle as that block's
  // own tag (20 px each) until the elements stood off their slots: then 1.6 px nearer.
  describe('a place that is nearer to another block than that block\'s own tag (PLAN 3.11f)', () => {
    const west = item(1055, 12447, 679.9, 383.4, 698, 417.2);
    const east = item(1056, 12445, 701.7, 383.3, 719.6, 415.8);
    const far = (t: { x: number; y: number; w: number; h: number }, x: number, y: number): number => Math.hypot(Math.max(t.x - x, x - (t.x + t.w), 0), Math.max(t.y - y, y - (t.y + t.h), 0));

    it('two blocks side by side: the second tag does not take the place below, it stands beside its block, and neither has a line', () => {
      const { placed, left } = layoutTags([west, east], measure, 1400, 800);
      expect(left).toBe(0);
      const [w, e] = [placed.find((t) => t.id === 1055)!, placed.find((t) => t.id === 1056)!];
      expect(w.y + w.h).toBe(Math.round(383.4 - TAG_GAP - w.h) + w.h);
      expect(e.x).toBe(Math.round(719.6 + TAG_GAP));
      for (const t of placed) {
        expect(t.gap, `the gap of ${t.id}`).toBeLessThanOrEqual(TAG_GAP + 1);
        expect(t.line, `the line of ${t.id}`).toBe(false);
        for (const o of placed) if (o !== t) expect(far(o, t.tx, t.ty), `the tag of ${o.id} from the middle of ${t.id}`).toBeGreaterThan(far(t, t.tx, t.ty));
      }
      expect(layoutTags([east, west], measure, 1400, 800).placed).toEqual(placed);
    });

    // PLAN 4.2b1 (ADR-249): the two with the eastern one the stronger by a man, as `tags1938`
    // had them once the start of 1938 held fleets (which of the two loses a man more goes by
    // the ids of their elements): the eastern block's top at 383.76 and the western one's foot
    // at 417.28, from the tags' gaps in that view; the other edges near those above. The
    // eastern tag is above, its foot at 380; the western one's "below", at 421, is 20.7 px
    // from its own block's middle and the eastern tag 20.3: it had a line (ADR-188).
    it('the eastern block the stronger: the western tag stands beside its block, and neither has a line', () => {
      const [w2, e2] = [item(1055, 12446, 679.9, 383.4, 698, 417.28), item(1056, 12447, 701.7, 383.76, 719.6, 416.5)];
      const { placed, left } = layoutTags([w2, e2], measure, 1400, 800);
      expect(left).toBe(0);
      const [w, e] = [placed.find((t) => t.id === 1055)!, placed.find((t) => t.id === 1056)!];
      expect(e.y).toBe(Math.round(383.76 - TAG_GAP - e.h));
      // Its place below is the one a reader would take for the other block's.
      expect(far(e, w.tx, w.ty)).toBeLessThan(far({ x: w.x, y: Math.round(417.28 + TAG_GAP), w: w.w, h: w.h }, w.tx, w.ty));
      expect(w.x).toBe(Math.round(679.9 - TAG_GAP - w.w));
      for (const t of placed) {
        expect(t.gap, `the gap of ${t.id}`).toBeLessThanOrEqual(TAG_GAP + 1);
        expect(t.line, `the line of ${t.id}`).toBe(false);
        for (const o of placed) if (o !== t) expect(far(o, t.tx, t.ty), `the tag of ${o.id} from the middle of ${t.id}`).toBeGreaterThan(far(t, t.tx, t.ty));
      }
      expect(layoutTags([e2, w2], measure, 1400, 800).placed).toEqual(placed);
    });

    it('with no other place clear of the first block, the tag stands below as before, and the first has its line', () => {
      // A third block east of the second: the place beside it is on that block's elements.
      const third = item(900, 300, 723, 383, 741, 416);
      const { placed } = layoutTags([west, east, third], measure, 1400, 800);
      const e = placed.find((t) => t.id === 1056)!;
      expect(e.y).toBe(Math.round(415.8 + TAG_GAP));
      expect(placed.find((t) => t.id === 1055)!.line).toBe(true);
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

describe('formation tags: the layout by a grid (PLAN 7.1l4)', () => {
  it('places every tag where the layout that asks every box does, in crowded views', () => {
    let seed = 12345;
    const rnd = (): number => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32);
    let lines = 0;
    let lefts = 0;
    for (let scene = 0; scene < 60; scene++) {
      const vw = 600 + Math.floor(rnd() * 1400);
      const vh = 400 + Math.floor(rnd() * 700);
      const n = 20 + Math.floor(rnd() * 400);
      const items: TagInput[] = [];
      for (let i = 0; i < n; i++) {
        // Blocks of every size, some reaching out of the view, some strengths alike.
        const bw = 10 + rnd() * (rnd() < 0.1 ? 900 : 120);
        const bh = 10 + rnd() * (rnd() < 0.1 ? 600 : 80);
        const x0 = rnd() * (vw + 200) - 100 - bw / 2;
        const y0 = rnd() * (vh + 200) - 100 - bh / 2;
        const it = item(1 + i, 1000 * Math.floor(rnd() * 20), x0, y0, x0 + bw, y0 + bh);
        it.text = `${(it.strength / 1000).toFixed(1)}k`;
        it.picked = i === 3 && scene % 2 === 0;
        items.push(it);
      }
      const avoid: TagObstacle[] = scene % 3 === 0 ? [{ x: vw / 2 - 150, y: vh - 40, w: 300, h: 40 }] : [];
      const scale = scene % 4 === 0 ? 1.5 : 1;
      const grid = layoutTags(items, measure, vw, vh, scale, avoid);
      const plain = layoutPlain(items, measure, vw, vh, scale, avoid);
      expect(grid).toEqual(plain);
      lines += plain.placed.filter((t) => t.line).length;
      lefts += plain.left;
    }
    // The scenes have tags with lines and tags left out: each of the layout's questions is asked.
    expect(lines).toBeGreaterThan(100);
    expect(lefts).toBeGreaterThan(100);
  });
});
