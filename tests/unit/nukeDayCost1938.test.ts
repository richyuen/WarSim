import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { aftermath, industryHeld, industrySumCount, layFallout, nuclearSystem } from '../../src/sim/systems/nuclear';
import { declareWar } from '../../src/sim/systems/war';
import { assets1938 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 6.10 AT (critic R6-B1): the day's nuclear call did work by the map's cells for every place
// it weighed (each place's value summed the whole map's industry again: 170 to 240 ms a day on
// seed 6619 after the first strikes). Its work is now bounded by the warheads and wars: the
// industry by nation is summed once a day, and a place reads only the cells within its blast.

const { w: W, h: H } = SIZE_1938;
const [ENG, FRA, GER, SOV, ITA, JAP] = ['ENG', 'FRA', 'GER', 'SOV', 'ITA', 'JAP'].map(nationId) as [number, number, number, number, number, number];
const at = (lon: number, lat: number): [number, number] => cellOf(lon, lat, W, H);

/** `a`, its reads of the elements counted (the typed array's own methods left alone). */
function counted<A extends Uint32Array>(a: A): { array: A; reads: () => number } {
  let reads = 0;
  const array = new Proxy(a, {
    get(t, p) {
      if (typeof p === 'string' && p.length > 0 && p.charCodeAt(0) >= 48 && p.charCodeAt(0) <= 57) reads++;
      const v = Reflect.get(t, p) as unknown;
      return typeof v === 'function' ? (v as (...args: unknown[]) => unknown).bind(t) : v;
    },
  });
  return { array, reads: () => reads };
}

describe('the day\'s nuclear call: its work by the warheads and wars, not the map (PLAN 6.10)', () => {
  it('with fallout and outrage in the world and six nuclear nations in three wars: the industry summed once, the cells read about one pass of the map', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const w = s.world;
    w.settings.nukesEnabled = true;
    for (const n of [ENG, FRA, GER, SOV, ITA, JAP]) s.command({ kind: 'grantWarheads', nation: n, count: 3 });
    s.step(1);
    declareWar(w, GER, FRA, true);
    declareWar(w, SOV, ENG, true);
    declareWar(w, JAP, ITA, true);
    // What strikes leave: fallout over several places, outrage at the strikers, the taboo broken.
    for (const [x, y] of [at(13.4, 52.52), at(2.35, 48.86), at(37.62, 55.75), at(-0.13, 51.5)]) layFallout(w, 2, x, y);
    aftermath(w, FRA, 1, ...at(13.4, 52.52), { men: 0, people: 0, guns: 0, tanks: 0 });
    aftermath(w, SOV, 1, ...at(-0.13, 51.5), { men: 0, people: 0, guns: 0, tanks: 0 });
    w.nukeTaboo = 0.3;
    expect(w.fallout.size).toBeGreaterThan(0);
    while (w.tick % 24 !== 0) s.step(1);
    // The industry by nation: what the cells hold.
    const held = industryHeld(w);
    let germany = 0;
    for (let c = 0; c < w.cells.econ.length; c++) if (w.cells.controller[c] === GER) germany += w.cells.econ[c]!;
    expect(held[GER]).toBe(germany);
    expect(germany).toBeGreaterThan(0);
    // The day's call, its reads of the industry counted.
    const econ = w.cells.econ;
    const probe = counted(econ);
    w.cells.econ = probe.array;
    const sums = industrySumCount();
    try {
      nuclearSystem(w);
    } finally {
      w.cells.econ = econ;
    }
    process.stderr.write(`the day's call: ${probe.reads()} reads of ${econ.length} cells' industry, summed ${industrySumCount() - sums} time(s)\n`);
    expect(industrySumCount() - sums).toBe(1);
    // One pass of the map (two reads a cell with industry) and the places' blasts, not one pass a place.
    expect(probe.reads()).toBeLessThan(2 * econ.length);
  }, 120_000);
});
