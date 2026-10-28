import { describe, expect, it } from 'vitest';
import { collectSections } from '../../src/sim/core/state';
import { decodeSections, encodeSections } from '../../src/sim/core/sections';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { at1938 } from '../helpers/checkpoint';
import { assets1938 } from '../helpers/earth';

// PLAN 7.149 AT (critic run 17, R17-B1): a save from before ADR-737 lacks `formations.struck`.
// Its load threw part-way through the world's parts, after the map, date and tick had been
// replaced, and the game ran on with the rest of the old world. A save that does not fit is
// refused whole: the world held before the load is left as it was, section for section.

/** The save bytes of `sim` with the section `name` taken out. */
function without(sim: Sim, name: string): Uint8Array {
  const sections = decodeSections(sim.save());
  const at = sections.findIndex((s) => s.name === name);
  expect(at).toBeGreaterThan(0);
  sections.splice(at, 1);
  return encodeSections(sections);
}

describe('a save that does not fit the world (PLAN 7.149)', () => {
  it('is refused whole: the world before the load hashes the same and steps on the same', () => {
    // The save of another world (a month on), so a part replaced before the refusal would show.
    const save = without(at1938(7, 24 * 30), 'formations.struck');
    const held = new Sim({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
    held.step(24);
    const twin = new Sim({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
    twin.step(24);
    const before = held.hash();
    expect(() => held.load(save)).toThrow(/formations\.struck/);
    expect(held.tick).toBe(24);
    expect(held.hash()).toBe(before);
    // Every section as it was, by name and bytes.
    const a = collectSections(held.world.parts());
    const b = collectSections(twin.world.parts());
    expect(a.map((s) => s.name)).toEqual(b.map((s) => s.name));
    expect(encodeSections(a)).toEqual(encodeSections(b));
    // And the refused world runs on as the one never offered the save.
    held.step(48);
    twin.step(48);
    expect(held.hash()).toBe(twin.hash());
  });

  it('a section of another type is refused the same way', () => {
    const sections = decodeSections(at1938(7, 24 * 30).save());
    const at = sections.findIndex((s) => s.name === 'formations.struck');
    const s = sections[at]!;
    sections[at] = { name: s.name, dtype: s.dtype === 'f64' ? 'f32' : 'f64', data: s.dtype === 'f64' ? new Float32Array(s.data.length) : new Float64Array(s.data.length) };
    const held = new Sim({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
    const before = held.hash();
    expect(() => held.load(encodeSections(sections))).toThrow(/formations\.struck/);
    expect(held.hash()).toBe(before);
  });

  it('a whole save still loads, with sections the world before it did not have', () => {
    const later = at1938(7, 24 * 30);
    const fresh = new Sim({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
    // Some sections come with play (the air war's, the sea's): a save is not judged by the names of the world it replaces.
    expect(collectSections(later.world.parts()).length).toBeGreaterThan(collectSections(fresh.world.parts()).length);
    fresh.load(later.save());
    expect(fresh.hash()).toBe(later.hash());
  });
});
