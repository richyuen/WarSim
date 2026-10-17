import { describe, expect, it } from 'vitest';
import { contactLines, LINE_MAX_CELLS, PAIR_MAX_CELLS, type ContactForm } from '../../src/render/units/contactLines';

// PLAN 7.11a (critic run 7: "the front line between them cannot be read"): where two formations
// in contact face each other, a line between their blocks.

const form = (id: number, nation: number, x: number, y: number, facing: number, engaged = true): ContactForm => ({ id, nation, x, y, facing, engaged });

describe('the line of contact (PLAN 7.11a)', () => {
  it('two blocks front to front: one line halfway between their fronts, across the way between them, as long as their shared front', () => {
    // A faces east toward B, B west toward A, 0.06 apart. A deep, its front at 100.01; B's at 100.05.
    const forms = [form(1, 10, 100, 50, 0), form(2, 20, 100.06, 50, Math.PI)];
    const els = [
      { formation: 1, x: 99.95, y: 49.9 },
      { formation: 1, x: 100.01, y: 50.1 },
      { formation: 2, x: 100.05, y: 50.06 },
      { formation: 2, x: 100.08, y: 49.96 },
    ];
    const lines = contactLines(forms, els);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect(l.x).toBeCloseTo(100.03, 9);
    expect(l.y).toBeCloseTo(50, 9);
    expect(l.axis).toBeCloseTo(0, 9);
    // Across the axis (north-south) A reaches 0.1, B 0.06: the shared front, B's.
    expect(l.half).toBeCloseTo(0.06, 9);
    expect([l.a, l.b, l.nationA, l.nationB]).toEqual([1, 2, 10, 20]);
  });

  it('blocks of unlike depth: the line at the fronts, not at the middle of the blocks', () => {
    // A's block 0.4 deep behind its front at 100.1; B's front at 100.14: the line at 100.12.
    const forms = [form(1, 10, 99.9, 50, 0), form(2, 20, 100.16, 50, Math.PI)];
    const els = [
      { formation: 1, x: 99.7, y: 50 },
      { formation: 1, x: 100.1, y: 50.05 },
      { formation: 2, x: 100.14, y: 49.95 },
      { formation: 2, x: 100.18, y: 50 },
    ];
    expect(contactLines(forms, els)[0]!.x).toBeCloseTo(100.12, 9);
  });

  it('no line for blocks of one nation, not facing each other, not engaged, or too far apart', () => {
    expect(contactLines([form(1, 10, 100, 50, 0), form(2, 10, 100.06, 50, Math.PI)], [])).toEqual([]);
    expect(contactLines([form(1, 10, 100, 50, Math.PI / 2), form(2, 20, 100.06, 50, Math.PI)], [])).toEqual([]);
    expect(contactLines([form(1, 10, 100, 50, 0, false), form(2, 20, 100.06, 50, Math.PI)], [])).toEqual([]);
    expect(contactLines([form(1, 10, 100, 50, 0), form(2, 20, 100 + PAIR_MAX_CELLS + 0.01, 50, Math.PI)], [])).toEqual([]);
  });

  it('each block with its nearest enemy facing it; a pair once; a line no longer than LINE_MAX_CELLS', () => {
    // B between A and C: A–B and B–C? B faces A only, so A–B; C faces B but B does not face C.
    const forms = [form(1, 10, 100, 50, 0), form(2, 20, 100.06, 50, Math.PI), form(3, 10, 100.2, 50, Math.PI)];
    const els = [{ formation: 1, x: 100, y: 49 }];
    const lines = contactLines(forms, els);
    expect(lines.map((l) => [l.a, l.b])).toEqual([[1, 2]]);
    expect(lines[0]!.half).toBe(LINE_MAX_CELLS);
  });

  it('two of one side behind one another against one: one line, with the one in front', () => {
    // A (nation 10) faces east toward B and C (nation 20), B in front of C; B and C face west.
    const forms = [form(1, 10, 100, 50, 0), form(2, 20, 100.06, 50, Math.PI), form(3, 20, 100.2, 50.01, Math.PI)];
    expect(contactLines(forms, []).map((l) => [l.a, l.b])).toEqual([[1, 2]]);
  });

  it('the same lines whatever the order the formations come in', () => {
    const forms = [form(5, 10, 10, 10, 0), form(9, 20, 10.05, 10, Math.PI), form(7, 30, 10, 10.05, -Math.PI / 2), form(8, 40, 10, 10.0, Math.PI / 2, false)];
    expect(contactLines([...forms].reverse(), [])).toEqual(contactLines(forms, []));
  });
});
