import { describe, expect, it } from 'vitest';
import { ATLAS_PX, DARK_NATION, drawNationLabels, EDGE, GlyphSprites, nationNameKey, fadeNationLabels, ladderPx, layoutNationLabels, MIN_PX, nameInk, TRACKING, type NameState, type PlacedNationLabel } from '../../src/render/labels/nationLabels';
import { FADE_MS, SwitchBank, ZOOM_HYSTERESIS } from '../../src/render/timing';
import { LABEL_STRIDE } from '../../src/shared/nationLabels';

// PLAN 2.7e: the curved nation names as states. The layout is pure: it says what is wanted at a
// zoom, told by the view what is on and what still fades out. (That names are sized by area,
// curved and free of overlaps on the 1938 map is in tests/e2e/labels1938.spec.ts; the fades in
// tests/e2e/labelFades1938.spec.ts.)

const GEO = { w: 400, h: 200, kmPerCell: 100, wrapX: false };
const VW = 800;
const VH = 400;
/** A text is as wide as its letters × 0.6 of the font size. */
const measure = (text: string, px: number): number => text.length * px * 0.6;

/** Labels: [id, x0, y0, cx, cy, x2, y2, length, thickness, area], straight and level. */
function labels(list: readonly { id: number; x: number; y: number; length: number; thickness: number; area: number }[]): Float64Array {
  const out = new Float64Array(list.length * LABEL_STRIDE);
  list.forEach((l, i) => out.set([l.id, l.x - l.length / 2, l.y, l.x, l.y, l.x + l.length / 2, l.y, l.length, l.thickness, l.area], i * LABEL_STRIDE));
  return out;
}
// One name alone: 20 cells long, 3 thick. Its size is 2 × thickness × scale = 6 px per px/cell.
const ALONE = labels([{ id: 7, x: 200, y: 100, length: 20, thickness: 3, area: 60 }]);
const cam = (scale: number): { cx: number; cy: number; scale: number } => ({ cx: 200, cy: 100, scale });
const lay = (data: Float64Array, names: string[], scale: number, state?: NameState): ReturnType<typeof layoutNationLabels> => layoutNationLabels(data, names, cam(scale), GEO, VW, VH, measure, state);
const IN = MIN_PX / 6; // px per cell at which the name is 9 px

describe('nation names at rest', () => {
  it('a name is there from MIN_PX on, in full', () => {
    expect(lay(ALONE, ['Xy'], IN * 0.999)).toEqual([]);
    const [l] = lay(ALONE, ['Xy'], IN * 1.001);
    expect(l).toMatchObject({ id: 7, text: 'Xy', alpha: 1 });
    expect(l!.fontPx).toBeCloseTo(MIN_PX * 1.001, 9);
    expect(l!.glyphs).toHaveLength(2);
  });

  it('of two names in each other\'s way the one of the larger area is placed', () => {
    const two = labels([{ id: 1, x: 200, y: 100, length: 20, thickness: 3, area: 10 }, { id: 2, x: 201, y: 100, length: 20, thickness: 3, area: 90 }]);
    expect(lay(two, ['Small', 'Large'], 3).map((l) => l.text)).toEqual(['Large']);
  });
});

describe('nation names with the states of the frames before (PLAN 2.7e)', () => {
  const none: NameState = { held: () => false, visible: () => false };
  // Nation 7's name on: by its copy's key (PLAN 7.4f45; a map that does not loop has the one copy).
  const on: NameState = { held: (k) => k === nationNameKey(7, 0, 0, 1), visible: (k) => k === nationNameKey(7, 0, 0, 1) };

  it('a name that is on stays below MIN_PX by the hysteresis, and no further', () => {
    const inBand = IN / 1.08;
    expect(lay(ALONE, ['Xy'], inBand, none)).toEqual([]);
    expect(lay(ALONE, ['Xy'], inBand, on)).toMatchObject([{ id: 7, alpha: 1 }]);
    const below = (IN / ZOOM_HYSTERESIS) * 0.999;
    // Too small now, but still on screen: placed to fade out, wanting nothing, at the size it has.
    const [fading] = lay(ALONE, ['Xy'], below, on);
    expect(fading).toMatchObject({ id: 7, alpha: 0 });
    expect(fading!.fontPx).toBeLessThan(MIN_PX / ZOOM_HYSTERESIS);
    expect(fading!.glyphs).toHaveLength(2);
  });

  it('a name that a larger one pushes out is placed to fade, and does not hold its place against it', () => {
    const two = labels([{ id: 7, x: 200, y: 100, length: 20, thickness: 3, area: 10 }, { id: 2, x: 201, y: 100, length: 20, thickness: 3, area: 90 }]);
    const got = lay(two, ['Small', 'Large'], 3, on);
    expect(got.map((l) => [l.text, l.alpha])).toEqual([['Large', 1], ['Small', 0]]);
  });

  it('tells the names in view that have nothing to show: too small, or in the way', () => {
    const hidden: number[] = [];
    const state: NameState = { held: () => false, visible: () => false, hidden: (id) => hidden.push(id) };
    expect(lay(ALONE, ['Xy'], IN * 0.5, state)).toEqual([]);
    // By its copy's key (PLAN 7.4f45): on a map that does not loop, the one copy.
    expect(hidden).toEqual([nationNameKey(7, 0, 0, 1)]);
    const two = labels([{ id: 1, x: 200, y: 100, length: 20, thickness: 3, area: 10 }, { id: 2, x: 201, y: 100, length: 20, thickness: 3, area: 90 }]);
    hidden.length = 0;
    lay(two, ['Small', 'Large'], 3, state);
    expect(hidden).toEqual([nationNameKey(1, 0, 0, 1)]);
    // Out of view: not told. A pan brings such a name in at once.
    hidden.length = 0;
    // (At 0.75 px per cell the 800 px of the view span 1,067 cells: 1,000 cells east is outside.)
    const away = labels([{ id: 9, x: 1200, y: 100, length: 20, thickness: 3, area: 60 }]);
    expect(lay(away, ['Far'], IN * 0.5, state)).toEqual([]);
    expect(hidden).toEqual([]);
  });
});

// PLAN 2.7k (ADR-74, finding 6): a nation's name is one thing. Its state was kept by nation and
// wrap offset; where the camera's x wraps, the copy on screen is another offset's, and a name
// held on by the hysteresis went out in one frame at the date line.
describe('a name on a looping map (PLAN 2.7k)', () => {
  const LOOP = { w: 400, h: 200, kmPerCell: 100, wrapX: true };
  // Just east of the seam: from x = 0 to x = 20.
  const EDGE = labels([{ id: 7, x: 10, y: 100, length: 20, thickness: 3, area: 60 }]);
  const frame = (bank: SwitchBank<number>, now: number, cx: number, scale: number): PlacedNationLabel[] =>
    fadeNationLabels(bank, now, (state) => layoutNationLabels(EDGE, ['Xy'], { cx, cy: 100, scale }, LOOP, VW, VH, measure, state));
  const HELD = IN * (8.2 / MIN_PX); // the name at 8.2 px: under MIN_PX, inside the hysteresis band

  it('keeps its state when the camera crosses the seam', () => {
    const bank = new SwitchBank<number>();
    // The camera west of the seam, the name large enough to come in: on.
    expect(frame(bank, 0, 390, IN * 1.2)).toMatchObject([{ id: 7, alpha: 1 }]);
    // Zoomed out to 8.2 px: held.
    expect(frame(bank, 1000, 390, HELD)).toMatchObject([{ id: 7, alpha: 1 }]);
    // A pan across x = 0: the camera's x wraps, and the copy on screen is the other offset's.
    expect(frame(bank, 2000, 5, HELD)).toMatchObject([{ id: 7, alpha: 1 }]);
    expect(frame(bank, 3000, 395, HELD)).toMatchObject([{ id: 7, alpha: 1 }]);
    expect(bank.animating(3000)).toBe(false);
  });

  it('a name that is off at that size stays off on both sides of the seam', () => {
    const bank = new SwitchBank<number>();
    expect(frame(bank, 0, 390, HELD)).toEqual([]);
    expect(frame(bank, 1000, 5, HELD)).toEqual([]);
    // It comes in by a fade when the zoom brings it, as anywhere.
    expect(frame(bank, 2000, 5, IN * 1.2)).toMatchObject([{ id: 7, alpha: 0 }]);
    expect(frame(bank, 2000 + FADE_MS, 5, IN * 1.2)).toMatchObject([{ id: 7, alpha: 1 }]);
  });

  // PLAN 7.4f45: the two copies shared one switch, on while either was wanted, and a copy alone in
  // a larger name's way was not drawn: it went out in one frame. Each copy has its switch now.
  it("two copies of a name have a switch each: the one in a larger name's way fades out, the other stays, and it rests", () => {
    const bank = new SwitchBank<number>();
    const copy = (key: number, alpha: number): PlacedNationLabel => ({ id: 7, key, text: 'Xy', fontPx: 10, area: 1, glyphs: [], curved: false, alpha });
    const [a, b] = [nationNameKey(7, 10, 0, 400), nationNameKey(7, 410, 0, 400)];
    expect(a).not.toBe(b);
    // Both wanted, new to the view: on at once.
    expect(fadeNationLabels(bank, 0, () => [copy(a, 1), copy(b, 1)]).map((l) => l.alpha)).toEqual([1, 1]);
    // The second copy alone in a larger name's way: it fades out where it stands; the first stays.
    expect(fadeNationLabels(bank, 1000, () => [copy(a, 1), copy(b, 0)]).map((l) => l.alpha)).toEqual([1, 1]);
    const half = fadeNationLabels(bank, 1000 + FADE_MS / 2, () => [copy(a, 1), copy(b, 0)]).map((l) => l.alpha);
    expect(half[0]).toBe(1);
    expect(half[1]).toBeCloseTo(0.5, 12);
    expect(fadeNationLabels(bank, 1000 + FADE_MS, () => [copy(a, 1), copy(b, 0)]).map((l) => l.alpha)).toEqual([1, 0]);
    expect(bank.animating(1000 + FADE_MS + 100)).toBe(false);
    // Neither wanted: the first fades out too.
    const out = fadeNationLabels(bank, 4000 + FADE_MS / 2, () => [copy(a, 0)]).map((l) => l.alpha);
    void out;
    const later = fadeNationLabels(bank, 4000 + FADE_MS, () => [copy(a, 0)]).map((l) => l.alpha);
    expect(later[0]).toBeLessThan(1);
  });
});

describe('nation names drawn at sizes of a ladder (PLAN 7.1l5)', () => {
  it('a size of the ladder is within 4.5 % of the one asked for (half a step), and a zoom asks few of them', () => {
    const sizes = new Set<number>();
    for (let px = 7; px <= 64; px *= 1.004) {
      const q = ladderPx(px);
      expect(Math.abs(q / px - 1)).toBeLessThan(0.045);
      sizes.add(q);
    }
    // 7 to 64 px is 3.2 octaves: some 26 sizes, where every frame of a zoom had sizes of its own.
    expect(sizes.size).toBeLessThanOrEqual(27);
  });

  it('each glyph is drawn as large as the label, where it was, the font of the ladder scaled', () => {
    const calls: string[] = [];
    let font = '';
    let lineWidth = 0;
    let scale = 1;
    const ctx = {
      save: () => {},
      restore: () => { scale = 1; },
      translate: (x: number, y: number) => calls.push(`at ${x},${y}`),
      rotate: () => {},
      scale: (k: number) => { scale = k; },
      strokeText: (ch: string) => calls.push(`${ch} ${(parseFloat(/([\d.]+)px/.exec(font)![1]!) * scale).toFixed(3)} line ${(lineWidth * scale).toFixed(3)}`),
      fillText: () => {},
      set font(f: string) { font = f; },
      get font() { return font; },
      set lineWidth(w: number) { lineWidth = w; },
      get lineWidth() { return lineWidth; },
    } as unknown as CanvasRenderingContext2D;
    const label: PlacedNationLabel = { id: 1, key: 1, text: 'Ab', fontPx: 23.7, area: 1, curved: false, alpha: 1, glyphs: [{ ch: 'A', x: 10, y: 20, angle: 0 }, { ch: 'b', x: 25, y: 21, angle: 0.1 }] };
    drawNationLabels(ctx, [label], 'sans-serif');
    expect(ladderPx(23.7)).not.toBeCloseTo(23.7, 2);
    expect(calls).toEqual(['at 10,20', `A 23.700 line ${(23.7 * EDGE).toFixed(3)}`, 'at 25,21', `b 23.700 line ${(23.7 * EDGE).toFixed(3)}`]);
  });
});

describe('nation names in the hand of AoC (PLAN 7.4a, ADR-440)', () => {
  it('the glyphs are the name in capitals, spaced; the label keeps the name', () => {
    const [l] = lay(ALONE, ['Xy'], 3);
    expect(l!.text).toBe('Xy');
    expect(l!.glyphs.map((g) => g.ch)).toEqual(['X', 'Y']);
    // Two glyphs a letter's advance and the tracking apart.
    const gap = l!.glyphs[1]!.x - l!.glyphs[0]!.x;
    expect(gap).toBeCloseTo(l!.fontPx * (0.6 + TRACKING), 6);
  });

  it('the spaced capitals fit the curve: a long name is sized to lie within its ends', () => {
    // 20 cells × 6 px = 120 px of curve: ten capitals and nine gaps are sized to lie within it.
    const [l] = lay(ALONE, ['Abcdefghij'], 6);
    const first = l!.glyphs[0]!;
    const last = l!.glyphs.at(-1)!;
    const half = (l!.fontPx * 0.6) / 2;
    expect(last.x + half - (first.x - half)).toBeLessThanOrEqual(120 + 1e-6);
  });

  it('the casing is the one the caller gives: the capitals of a locale', () => {
    const [l] = layoutNationLabels(ALONE, ['ix'], cam(3), GEO, VW, VH, measure, undefined, (s) => s.toLocaleUpperCase('tr'));
    expect(l!.glyphs.map((g) => g.ch)).toEqual(['İ', 'X']);
  });

  it('a name is a darker shade of its land with a lighter edge; over a dark land the other way round', () => {
    const rgb = (css: string): number[] => /rgba\((\d+), (\d+), (\d+)/.exec(css)!.slice(1, 4).map(Number);
    const sum = (v: number[]): number => v[0]! + v[1]! + v[2]!;
    const pink = 0xc84b64; // Poland
    const ink = nameInk(pink);
    expect(sum(rgb(ink.fill))).toBeLessThan(0xc8 + 0x4b + 0x64);
    expect(sum(rgb(ink.edge))).toBeGreaterThan(0xc8 + 0x4b + 0x64);
    // Of the land's hue: red stays the largest channel.
    expect(rgb(ink.fill)[0]).toBe(Math.max(...rgb(ink.fill)));
    const grey = 0x5a5a5a; // Germany: a luminance of 0.10, under DARK_NATION
    expect(((0x5a / 255 + 0.055) / 1.055) ** 2.4).toBeLessThan(DARK_NATION);
    const dark = nameInk(grey);
    expect(sum(rgb(dark.fill))).toBeGreaterThan(3 * 0x5a);
    expect(sum(rgb(dark.edge))).toBeLessThan(3 * 0x5a);
  });

  it('each name is drawn in the ink of its own nation, and without a colour in the plain one', () => {
    const fills: string[] = [];
    const ctx = {
      save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, scale: () => {},
      strokeText: () => {}, fillText: function (this: { fillStyle: string }) { fills.push(this.fillStyle); },
      font: '', lineWidth: 0, fillStyle: '', strokeStyle: '', globalAlpha: 1, textAlign: '', textBaseline: '',
    } as unknown as CanvasRenderingContext2D;
    const one = (id: number): PlacedNationLabel => ({ id, key: id, text: 'A', fontPx: 20, area: 1, curved: false, alpha: 1, glyphs: [{ ch: 'A', x: 0, y: 0, angle: 0 }] });
    drawNationLabels(ctx, [one(1), one(2)], 'sans-serif', (id) => (id === 1 ? 0xc84b64 : undefined));
    expect(fills).toEqual([nameInk(0xc84b64).fill, 'rgba(20, 22, 30, 0.82)']);
  });
});

// PLAN 7.4f29: the glyphs drawn once into one atlas and then as pieces of it. Stroked and filled
// as text at their angles, each frame of a zoom from the world to T1 outlined them anew: 11 to 17
// frames of some 230 missed 60 Hz; with the atlas none (as with the names laid out and not drawn).
describe('the names drawn from a glyph atlas (PLAN 7.4f29)', () => {
  /** An atlas canvas that counts what is drawn into it. */
  const atlasCanvas = () => {
    const drawn: string[] = [];
    const ctx = {
      setTransform: () => {}, clearRect: () => {}, strokeText: (ch: string) => drawn.push(ch), fillText: () => {},
      font: '', textAlign: '', textBaseline: '', lineJoin: '', lineWidth: 0, strokeStyle: '', fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    return { canvas: { atlas: true } as unknown as CanvasImageSource, ctx, drawn };
  };
  /** The page's canvas at `dpr`: each piece drawn, its source and the size it is drawn at. */
  const target = (dpr: number) => {
    const out: { sx: number; sy: number; sw: number; sh: number; scale: number; at: string }[] = [];
    let scale = 1;
    let at = '';
    const ctx = {
      getTransform: () => ({ a: dpr, b: 0 }), save: () => {}, restore: () => { scale = 1; },
      translate: (x: number, y: number) => { at = `${x},${y}`; }, rotate: () => {}, scale: (k: number) => { scale = k; },
      drawImage: (_s: unknown, sx: number, sy: number, sw: number, sh: number) => out.push({ sx, sy, sw, sh, scale, at }),
      strokeText: () => { throw new Error('drawn as text'); }, fillText: () => {}, globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;
    return { ctx, out };
  };
  const label = (id: number, text: string, px: number): PlacedNationLabel => ({ id, key: id, text, fontPx: px, area: 1, curved: false, alpha: 1, glyphs: [...text].map((ch, i) => ({ ch, x: 10 * i, y: 5, angle: 0.1 * i })) });

  it('a glyph of a size and ink is drawn into the atlas once, and each frame as its piece', () => {
    const a = atlasCanvas();
    const sprites = new GlyphSprites(() => a);
    const t = target(2);
    drawNationLabels(t.ctx, [label(1, 'ABA', 23.7)], 'sans-serif', () => 0xc84b64, sprites);
    drawNationLabels(t.ctx, [label(1, 'ABA', 23.7)], 'sans-serif', () => 0xc84b64, sprites);
    // A and B once each, in the atlas; six pieces drawn, A's twice from one place.
    expect(a.drawn).toEqual(['A', 'B']);
    expect(sprites.made).toBe(2);
    expect(t.out).toHaveLength(6);
    expect(t.out[0]!.sx).toBe(t.out[2]!.sx);
    expect(t.out[1]!.sx).toBeGreaterThan(t.out[0]!.sx);
    // Drawn where the glyph is, at the label's size: the ladder's size × k, in device px ÷ the DPR.
    const k = 23.7 / ladderPx(23.7);
    expect(t.out[1]!.at).toBe('10,5');
    for (const p of t.out) expect(p.scale).toBeCloseTo(k / 2, 12);
    // Another ink, another glyph.
    drawNationLabels(t.ctx, [label(2, 'A', 23.7)], 'sans-serif', () => undefined, sprites);
    expect(a.drawn).toEqual(['A', 'B', 'A']);
  });

  it('a full atlas starts again; where no canvas can be made the names are drawn as text', () => {
    const a = atlasCanvas();
    const sprites = new GlyphSprites(() => a);
    // Glyphs of 64 px at a DPR of 2 are some 190 px a side: a 2048 px atlas holds about 100.
    const many = Array.from({ length: 300 }, (_, i) => String.fromCharCode(0x4e00 + i)).join('');
    const t = target(2);
    drawNationLabels(t.ctx, [label(1, many, 64)], 'sans-serif', () => 0x336699, sprites);
    expect(sprites.restarts).toBeGreaterThanOrEqual(2);
    expect(sprites.size).toBeLessThan(300);
    // Every glyph drawn, each from inside the atlas.
    expect(t.out).toHaveLength(300);
    for (const p of t.out) {
      expect(p.sx + p.sw).toBeLessThanOrEqual(ATLAS_PX);
      expect(p.sy + p.sh).toBeLessThanOrEqual(ATLAS_PX);
    }
    // No canvas: the text path, as before.
    const strokes: string[] = [];
    const ctx = {
      getTransform: () => ({ a: 1, b: 0 }), save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, scale: () => {},
      strokeText: (ch: string) => strokes.push(ch), fillText: () => {}, font: '', lineWidth: 0, globalAlpha: 1,
    } as unknown as CanvasRenderingContext2D;
    drawNationLabels(ctx, [label(1, 'AB', 20)], 'sans-serif', () => undefined, new GlyphSprites(() => null));
    expect(strokes).toEqual(['A', 'B']);
  });
});

// PLAN 7.4f45: a name whose curve crosses the seam, the view's left edge just past the seam: the
// copy beyond it reaches into the view. The layout took only the copies whose map meets the view.
describe('a nation name across the seam (PLAN 7.4f45)', () => {
  it('is laid out where its copy beyond the seam reaches into the view', () => {
    const LOOP = { w: 400, h: 200, kmPerCell: 100, wrapX: true };
    // From x 389 to 409, its middle (where its letters are) a cell west of the seam at 400.
    const ACROSS = labels([{ id: 7, x: 399, y: 100, length: 20, thickness: 3, area: 60 }]);
    const scale = IN * 1.5;
    // The view's left edge at x 400.2 (folded: 0.2): its letters reach over the seam into it.
    const camera = { cx: 0.2 + VW / 2 / scale, cy: 100, scale };
    const got = layoutNationLabels(ACROSS, ['Xy'], camera, LOOP, VW, VH, measure);
    const seen = got.filter((l) => l.alpha > 0 && l.glyphs.some((g) => g.x >= 0 && g.x <= VW));
    expect(seen.length, 'a copy with letters in the view').toBeGreaterThan(0);
  });
});
