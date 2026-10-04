import { describe, expect, it } from 'vitest';
import { layoutNationLabels, MIN_PX, type NameState } from '../../src/render/labels/nationLabels';
import { ZOOM_HYSTERESIS } from '../../src/render/timing';
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
  it('a name is there from MIN_PX on, with its key, in full', () => {
    expect(lay(ALONE, ['Xy'], IN * 0.999)).toEqual([]);
    const [l] = lay(ALONE, ['Xy'], IN * 1.001);
    expect(l).toMatchObject({ id: 7, key: '7:0', text: 'Xy', alpha: 1 });
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
  const on: NameState = { held: (k) => k === '7:0', visible: (k) => k === '7:0' };

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
    const hidden: string[] = [];
    const state: NameState = { held: () => false, visible: () => false, hidden: (k) => hidden.push(k) };
    expect(lay(ALONE, ['Xy'], IN * 0.5, state)).toEqual([]);
    expect(hidden).toEqual(['7:0']);
    const two = labels([{ id: 1, x: 200, y: 100, length: 20, thickness: 3, area: 10 }, { id: 2, x: 201, y: 100, length: 20, thickness: 3, area: 90 }]);
    hidden.length = 0;
    lay(two, ['Small', 'Large'], 3, state);
    expect(hidden).toEqual(['1:0']);
    // Out of view: not told. A pan brings such a name in at once.
    hidden.length = 0;
    // (At 0.75 px per cell the 800 px of the view span 1,067 cells: 1,000 cells east is outside.)
    const away = labels([{ id: 9, x: 1200, y: 100, length: 20, thickness: 3, area: 60 }]);
    expect(lay(away, ['Far'], IN * 0.5, state)).toEqual([]);
    expect(hidden).toEqual([]);
  });
});
