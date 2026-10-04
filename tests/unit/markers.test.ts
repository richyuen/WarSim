import { describe, expect, it } from 'vitest';
import { HANDOVER_MS } from '../../src/render/units/handover';
import { AT_REST, BAR_LINGER_MS, MARKER_SHRINK, markerMorph, MORPH_MS, strengthText } from '../../src/render/units/markers';

// PLAN 2.1: the T1 markers' strength labels. The layer's opacity is the business of the two
// handovers at its edges (PLAN 1.45a toward T0, PLAN 2.7b toward T2: tests/unit/handover.test.ts).
// The fades by zoom that this file used to check are gone: a camera resting inside one showed
// two layers half-faded.

describe('T1 markers (PLAN 2.1)', () => {
  it('strength text: exact under 1,000, thousands with one decimal above', () => {
    expect(strengthText(0)).toBe('0');
    expect(strengthText(999)).toBe('999');
    expect(strengthText(1000)).toBe('1.0k');
    expect(strengthText(12345)).toBe('12.3k');
    expect(strengthText(12350)).toBe('12.3k'); // toFixed rounding of 12.35
    // From a million on: millions with two decimals (a folded counter over Europe holds 1.5 M men).
    expect(strengthText(999_949)).toBe('999.9k');
    expect(strengthText(999_950)).toBe('1.00M');
    expect(strengthText(1_476_400)).toBe('1.48M');
    expect(strengthText(24_726_000)).toBe('24.73M');
  });
});

// PLAN 2.7c: the marker on its way into the T2 sprites. The box fades and shrinks into the group
// while the sprites fade in; the strength bar and the number stay for that time and go after it.
describe('the marker → elements morph (PLAN 2.7c)', () => {
  const first = HANDOVER_MS / MORPH_MS;
  const frame = 16 / MORPH_MS; // progress in a 16 ms frame

  it('at T1 the marker is as it always was; at T2 nothing of it is left', () => {
    expect(markerMorph(0)).toEqual({ elements: 0, morph: AT_REST });
    expect(markerMorph(1)).toEqual({ elements: 1, morph: { box: 0, scale: 1 - MARKER_SHRINK, bar: 0 } });
    expect(MORPH_MS).toBe(HANDOVER_MS + BAR_LINGER_MS);
  });

  it('the box and the sprites cross-fade in the first part, as at the other tier boundaries', () => {
    for (let p = 0; p <= first; p += first / 20) {
      const m = markerMorph(p);
      expect(m.elements + m.morph.box).toBeCloseTo(1, 12);
      expect(m.morph.bar, `the bar at ${p}`).toBe(1); // it lingers
    }
    expect(markerMorph(first / 2)).toMatchObject({ elements: 0.5, morph: { box: 0.5, scale: 1 - MARKER_SHRINK / 2, bar: 1 } });
    expect(markerMorph(first).elements).toBe(1);
  });

  it('then the bar goes, the box gone and no smaller', () => {
    const end = markerMorph(first).morph;
    expect(end).toEqual({ box: 0, scale: 1 - MARKER_SHRINK, bar: 1 });
    expect(markerMorph((1 + first) / 2).morph.bar).toBeCloseTo(0.5, 12);
    for (let p = first; p <= 1; p += (1 - first) / 20) expect(markerMorph(p).morph).toMatchObject({ box: 0, scale: 1 - MARKER_SHRINK });
  });

  it('no part moves faster than the eye follows, in 16 ms frames', () => {
    let last = markerMorph(0);
    let fastestEdge = 0;
    for (let p = frame; p <= 1 + frame; p += frame) {
      const m = markerMorph(Math.min(1, p));
      expect(m.elements - last.elements).toBeGreaterThanOrEqual(0);
      expect(m.elements - last.elements).toBeLessThan(0.1);
      expect(last.morph.bar - m.morph.bar).toBeGreaterThanOrEqual(0);
      expect(last.morph.bar - m.morph.bar).toBeLessThan(0.12);
      expect(m.morph.scale).toBeLessThanOrEqual(last.morph.scale);
      // A corner of the box: half its width and half its height from the centre, in px.
      fastestEdge = Math.max(fastestEdge, (13 + 8.5) * (last.morph.scale - m.morph.scale));
      last = m;
    }
    // A fifth of a pixel a frame for the two edges at a corner together: the shrink is steady.
    expect(fastestEdge).toBeLessThan(0.2);
    expect(fastestEdge).toBeGreaterThan(0.15);
  });

  it('progress out of range is the nearer end', () => {
    expect(markerMorph(-0.5)).toEqual(markerMorph(0));
    expect(markerMorph(1.5)).toEqual(markerMorph(1));
  });
});
