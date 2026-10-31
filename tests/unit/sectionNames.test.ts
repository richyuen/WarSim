import { describe, expect, it } from 'vitest';
import { sectionNames } from '../../src/shared/sectionNames';
import { missingSections } from '../../src/shared/stateCheck';
import { decodeSections, encodeSections } from '../../src/sim/core/sections';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 7.168: the title screen reads a save's sections from their directory alone
// (`sectionNames`, no sim), and refuses one lacking a section this version's loads read.
describe("a save's sections, read without a sim", () => {
  const sim = new Sim({ scenario: '1938', seed: 55, assets: assets1938(SIZE_1938.w) });
  sim.step(72);
  const bytes = sim.save();

  it("lists what decodeSections does, in order, for a 1938 world's save (version 2, runs among its sections)", () => {
    expect(sectionNames(bytes)).toEqual(decodeSections(bytes).map((s) => `${s.name}:${s.dtype}`));
  });

  it("a save of this version lacks nothing; one without formations.struck and world.airStart (as run 10's) lacks the first", () => {
    expect(missingSections(bytes)).toEqual([]);
    // world.airStart comes with the 1938 start alone: a random or toy world's save loads without it.
    const old = encodeSections(decodeSections(bytes).filter((s) => s.name !== 'formations.struck' && s.name !== 'world.airStart'));
    expect(missingSections(old)).toEqual(['formations.struck:u8']);
    expect(missingSections(encodeSections(decodeSections(bytes).filter((s) => s.name !== 'world.airStart')))).toEqual([]);
  });

  it('bytes that are not sections, or are cut short, lack every section', () => {
    expect(missingSections(new TextEncoder().encode('hello')).length).toBeGreaterThan(100);
    expect(missingSections(bytes.subarray(0, bytes.length >> 1)).length).toBeGreaterThan(100);
  });
});
