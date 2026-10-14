import { describe, expect, it } from 'vitest';
import { EventKind } from '../../src/shared/events';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { REGION_KM2 } from '../../src/sim/systems/revolts';
import { assets1938 } from '../helpers/earth';
import { revoltLand } from '../helpers/revoltLand';

// PLAN 5.8w6 (seed 2 at tick 27,721, `aiSweep2`): in one hour a nation founded by a revolt and,
// by defection to it as its core nation (PLAN 2.15d, `LandCeded`), given a second area of the
// same holder's: each area within a region's bound, both over one. The sweep's measure held
// them to one; it holds them to one a handover.

describe('the sweep\'s measure of a revolt\'s land (PLAN 3.9, 5.8w6)', () => {
  it('a revolt and a defection to one nation in one hour: a region\'s bound each; a revolt alone with the same land: over', () => {
    const w = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) }).world;
    const SOV = TAGS_1938.indexOf('SOV') + 1;
    const to = TAGS_1938.indexOf('MON') + 1;
    const { owner, province, w: width } = w.cells;
    const rowKm2 = w.landCounts().rowKm2;
    // The Soviet Union's provinces under a region's bound each, by km².
    const km2 = new Map<number, number>();
    for (let c = 0; c < owner.length; c++) if (owner[c] === SOV) km2.set(province[c]!, (km2.get(province[c]!) ?? 0) + rowKm2[Math.floor(c / width)]!);
    const small = [...km2].filter(([, a]) => a < REGION_KM2 / 4).sort((a, b) => a[0] - b[0]);
    // Two areas, each under the bound, together over it.
    const areas: number[][] = [[], []];
    const sums = [0, 0];
    for (const [p, a] of small) {
      const k = sums[0]! + a < REGION_KM2 * 0.9 ? 0 : sums[1]! + a < REGION_KM2 * 0.9 ? 1 : -1;
      if (k < 0) break;
      areas[k]!.push(p);
      sums[k] = sums[k]! + a;
    }
    expect(sums[0]! + sums[1]!).toBeGreaterThan(REGION_KM2);
    const before = owner.slice();
    const give = new Set(areas.flat());
    for (let c = 0; c < owner.length; c++) if (owner[c] === SOV && give.has(province[c]!)) w.setOwner(c, to);
    const name = (n: number): string => `nation ${n}`;
    const both = [0, EventKind.RevoltSpawned, to, SOV, 0, 0, 0, EventKind.LandCeded, to, SOV, 0, 0];
    expect(revoltLand(w, before, both, name)).toEqual([]);
    const one = [0, EventKind.RevoltSpawned, to, SOV, 0, 0];
    expect(revoltLand(w, before, one, name)).toHaveLength(1);
  });
});
