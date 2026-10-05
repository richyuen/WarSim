import { describe, expect, it } from 'vitest';
import { foundedName, provinceLabel } from '../../src/shared/nationNames';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { forceRevolt, spawnRebels } from '../../src/sim/systems/revolts';
import { navOf, type World } from '../../src/sim/world';
import { assets1938, earthAdmin1 } from '../helpers/earth';

// PLAN 2.15b (the critic's R2-B6): no nation without a name. A nation no scenario names is
// called "Free <province>" after its origin, and "Free state N" where that gives nothing. Two
// ways to the number were left after PLAN 2.12a: seven provinces of the data have no name, and
// the origin was the first province of the area, which need not be where the capital is.

const sim1938 = (seed = 5): Sim => new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
const labels = (): string[] => earthAdmin1().meta.map(provinceLabel);

/** The province of nation `id`'s capital. */
function capitalProvince(world: World, id: number): number {
  const nc = world.nations.cols;
  return world.cells.province[Math.floor(nc.capitalY[id]!) * world.cells.w + Math.floor(nc.capitalX[id]!)]!;
}

describe('the names of founded nations (PLAN 2.15b)', () => {
  it('every province of the earth data has a name, or its country has', () => {
    const { meta } = earthAdmin1();
    const nameless = meta.filter((m) => m.name.trim() === '');
    console.log(`provinces without a name of their own: ${nameless.length} of ${meta.length} (${nameless.map((m) => `${m.id} ${m.admin}`).join(', ')})`);
    expect(meta.filter((m) => provinceLabel(m) === '').map((m) => m.id)).toEqual([]);
    for (const m of nameless) expect(foundedName(200, m.id, labels())).toBe(`Free ${m.admin}`);
  });

  it('the number names a nation only where there is no origin', () => {
    const l = labels();
    expect(foundedName(128, 0, l)).toBe('Free state 128');
    for (let p = 1; p <= l.length; p++) expect(foundedName(128, p, l), `province ${p}`).not.toMatch(/^Free state \d+$/);
  });

  it('the origin is the province of the capital, not the first of the area', () => {
    const world = sim1938().world;
    const g = navOf(world).graph;
    const { owner, province } = world.cells;
    const cc = world.cities.cols;
    const withCity = new Set<number>();
    world.cities.forEach((ci) => withCity.add(province[cc.cell[ci]!]!));
    // A city that is no capital, and a neighbouring province of the same holder without a city.
    let found: { city: number; holder: number; area: number[] } | null = null;
    world.cities.forEach((ci) => {
      if (found !== null || cc.capitalOf[ci] !== 0) return;
      const holder = owner[cc.cell[ci]!]!;
      const p = province[cc.cell[ci]!]!;
      if (holder === 0 || p === 0 || p >= world.provinces.count) return;
      const q = (g.adj[p] ?? []).find((n) => n < world.provinces.count && !withCity.has(n) && owner[g.centre[n] ?? -1] === holder);
      if (q !== undefined) found = { city: ci, holder, area: [q, p] };
    });
    expect(found, 'a city beside a province without one').not.toBeNull();
    const { city, holder, area } = found!;
    const id = spawnRebels(world, area, holder);
    expect(cc.capitalOf[city], 'the city is the capital').toBe(id);
    expect(world.nations.cols.origin[id], 'origin').toBe(area[1]);
    expect(foundedName(id, world.nations.cols.origin[id]!, labels())).toBe(`Free ${labels()[area[1]! - 1]}`);
  });

  it('a revolt forced in every province of the 1938 start: every nation founded has a name', () => {
    const world = sim1938().world;
    const l = labels();
    const first = world.nations.highWater;
    for (let p = 1; p < world.provinces.count; p++) forceRevolt(world, p);
    const nc = world.nations.cols; // after the revolts: the table has grown (PLAN 2.12a)
    let founded = 0;
    let elsewhere = 0;
    for (let id = first; id < world.nations.highWater; id++) {
      founded++;
      const origin = nc.origin[id]!;
      expect(origin, `nation ${id}: an origin`).toBeGreaterThan(0);
      expect(foundedName(id, origin, l), `nation ${id}, origin ${origin}`).not.toMatch(/^Free state \d+$/);
      // (A capital off the nation's land is PLAN 2.15e: there the origin is the area's first.)
      if (capitalProvince(world, id) !== origin) elsewhere++;
    }
    console.log(`forced revolts: ${founded} nations founded, ${elsewhere} with the capital outside the origin`);
    expect(founded).toBeGreaterThan(300);
    expect(first).toBe(NATIONS_1938.length + 1);
  }, 300_000);
});
