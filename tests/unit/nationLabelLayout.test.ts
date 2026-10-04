import { describe, expect, it } from 'vitest';
import { fadeNationLabels, layoutNationLabels, MIN_PX, type NameState, type PlacedNationLabel } from '../../src/render/labels/nationLabels';
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
  const on: NameState = { held: (id) => id === 7, visible: (id) => id === 7 };

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
    expect(hidden).toEqual([7]);
    const two = labels([{ id: 1, x: 200, y: 100, length: 20, thickness: 3, area: 10 }, { id: 2, x: 201, y: 100, length: 20, thickness: 3, area: 90 }]);
    hidden.length = 0;
    lay(two, ['Small', 'Large'], 3, state);
    expect(hidden).toEqual([1]);
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

  it('two copies of a name share one switch: on when either is wanted, and it rests', () => {
    const bank = new SwitchBank<number>();
    const copy = (alpha: number): PlacedNationLabel => ({ id: 7, text: 'Xy', fontPx: 10, area: 1, glyphs: [], curved: false, alpha });
    // In view with nothing to show: off.
    fadeNationLabels(bank, 0, (state) => {
      state.hidden!(7);
      return [];
    });
    // One copy wanted, the other alone in a larger name's way: the name fades in, and the copy
    // in the way is not drawn.
    expect(fadeNationLabels(bank, 1000, () => [copy(1), copy(0)]).map((l) => l.alpha)).toEqual([0, 0]);
    const half = fadeNationLabels(bank, 1000 + FADE_MS / 2, () => [copy(1), copy(0)]).map((l) => l.alpha);
    expect(half[0]).toBeCloseTo(0.5, 12);
    expect(half[1]).toBe(0);
    // Whichever comes first.
    expect(fadeNationLabels(bank, 1000 + FADE_MS, () => [copy(0), copy(1)]).map((l) => l.alpha)).toEqual([0, 1]);
    expect(bank.animating(1000 + FADE_MS + 100)).toBe(false);
    // One copy with nothing to show while the other is wanted: no turn.
    const kept = fadeNationLabels(bank, 3000, (state) => {
      state.hidden!(7);
      return [copy(1)];
    });
    expect(kept.map((l) => l.alpha)).toEqual([1]);
    expect(bank.animating(3000)).toBe(false);
    // Neither wanted: both fade out together.
    expect(fadeNationLabels(bank, 4000, () => [copy(0), copy(0)]).map((l) => l.alpha)).toEqual([1, 1]);
    const out = fadeNationLabels(bank, 4000 + FADE_MS / 2, () => [copy(0), copy(0)]).map((l) => l.alpha);
    expect(out[0]).toBeCloseTo(0.5, 12);
    expect(out[1]).toBeCloseTo(0.5, 12);
  });
});
