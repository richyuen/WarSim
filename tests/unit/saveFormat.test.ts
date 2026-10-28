import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { sameStateFormat, STATE_FORMAT } from '../../src/shared/saveFormat';
import { collectSections } from '../../src/sim/core/state';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 7.152a AT (critic run 17, Stability 5): ADR-737's new column `formations.struck` broke
// every save made before it, and each new column would do it again with nothing to tell the
// player. A save carries its state format (`src/shared/saveFormat.ts`); this test pins the
// sections every load reads (those of the 1938 start: each table column and the world's core
// sections, by name and type) for each format, and fails when they change under the same
// number. The world's optional sections, which come with play, load when absent: not pinned.
//
// On a change of the sections: raise STATE_FORMAT, then run this test with SAVE_FORMAT_PIN=1 to
// add the new format's list to the pin file. Never edit an earlier format's list.

const PINS = path.join(__dirname, 'saveFormat.json');

function startSections(): string[] {
  const sim = new Sim({ scenario: '1938', seed: 7, assets: assets1938(SIZE_1938.w) });
  return [...new Set(collectSections(sim.world.parts()).map((s) => `${s.name}:${s.dtype}`))].sort();
}

describe('the state format of a save (PLAN 7.152a)', () => {
  it('pins the sections every load reads: a change of them raises STATE_FORMAT', () => {
    const pins = JSON.parse(readFileSync(PINS, 'utf8')) as Record<string, string[]>;
    const now = startSections();
    if (process.env.SAVE_FORMAT_PIN === '1' && pins[STATE_FORMAT] === undefined) {
      pins[STATE_FORMAT] = now;
      writeFileSync(PINS, `${JSON.stringify(pins, null, 2)}\n`);
    }
    const pinned = pins[STATE_FORMAT];
    expect(pinned, `no sections pinned for state format ${STATE_FORMAT}: run this test with SAVE_FORMAT_PIN=1`).toBeDefined();
    const added = now.filter((s) => !pinned!.includes(s));
    const dropped = pinned!.filter((s) => !now.includes(s));
    expect({ added, dropped }, `the sections a load reads changed under state format ${STATE_FORMAT}: raise STATE_FORMAT in src/shared/saveFormat.ts and pin (SAVE_FORMAT_PIN=1)`).toEqual({ added: [], dropped: [] });
    // Every format up to this one is pinned, and no two alike: a format is raised for a change.
    const formats = Object.keys(pins).map(Number).sort((a, b) => a - b);
    expect(formats).toEqual(Array.from({ length: STATE_FORMAT }, (_, i) => i + 1));
    const lists = formats.map((f) => pins[f]!.join(','));
    expect(new Set(lists).size).toBe(lists.length);
  }, 120_000);

  it('reads a save of this format only; a record without one is older', () => {
    expect(sameStateFormat(STATE_FORMAT)).toBe(true);
    expect(sameStateFormat(undefined)).toBe(false);
    expect(sameStateFormat(STATE_FORMAT - 1)).toBe(false);
    expect(sameStateFormat(STATE_FORMAT + 1)).toBe(false);
  });
});
