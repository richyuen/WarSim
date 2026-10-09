import { describe, expect, it } from 'vitest';
import { foundedName, foundedNth, provinceLabel } from '../../src/shared/nationNames';
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

/** The cell of every capital that is a city, by nation. */
function capitalCities(world: World): Map<number, number> {
  const cc = world.cities.cols;
  const cells = new Map<number, number>();
  world.cities.forEach((ci) => {
    if (cc.capitalOf[ci] !== 0) cells.set(cc.capitalOf[ci]!, cc.cell[ci]!);
  });
  return cells;
}

/**
 * The province of nation `id`'s capital: of the city's cell where the capital is a city (a city
 * on the shore has its coordinates in a sea cell of the coarse grid: PLAN 2.15e3).
 */
function capitalProvince(world: World, id: number, cities: Map<number, number>): number {
  const nc = world.nations.cols;
  const cell = cities.get(id) ?? Math.floor(nc.capitalY[id]!) * world.cells.w + Math.floor(nc.capitalX[id]!);
  return world.cells.province[cell]!;
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

  // PLAN 2.15e3: a city on the shore has its coordinates in a sea cell of the coarse grid, which
  // is in no province of the area, and the origin fell back to the area's first province.
  it('the origin is the province of the capital\'s cell, not of its coordinates', () => {
    const world = sim1938().world;
    const g = navOf(world).graph;
    const { owner, province, w } = world.cells;
    const cc = world.cities.cols;
    const withCity = new Set<number>();
    world.cities.forEach((ci) => withCity.add(province[cc.cell[ci]!]!));
    let shore = 0;
    let found: { city: number; holder: number; area: number[] } | null = null;
    world.cities.forEach((ci) => {
      if (cc.capitalOf[ci] !== 0) return;
      const holder = owner[cc.cell[ci]!]!;
      const p = province[cc.cell[ci]!]!;
      if (holder === 0 || p === 0 || p >= world.provinces.count) return;
      if (province[Math.floor(cc.y[ci]!) * w + Math.floor(cc.x[ci]!)] === p) return; // not on the shore
      shore++;
      if (found !== null) return;
      const q = (g.adj[p] ?? []).find((n) => n < world.provinces.count && !withCity.has(n) && owner[g.centre[n] ?? -1] === holder);
      if (q !== undefined) found = { city: ci, holder, area: [q, p] };
    });
    expect(shore, 'cities with their coordinates outside the province of their cell').toBeGreaterThan(10);
    expect(found, 'such a city beside a province without one').not.toBeNull();
    const { city, holder, area } = found!;
    const id = spawnRebels(world, area, holder);
    expect(cc.capitalOf[city], 'the city is the capital').toBe(id);
    expect(world.nations.cols.origin[id], 'origin').toBe(area[1]);
    expect(foundedName(id, world.nations.cols.origin[id]!, labels())).toBe(`Free ${labels()[area[1]! - 1]}`);
  });

  // PLAN 3.12Rh3: "Free Damascus declared war on Free Damascus" (seed 1938, the third year): a
  // province rose again while the nation it had founded lived, as its holder's puppet.
  it('a province that founds a second nation gives it a name of its own', () => {
    const world = sim1938().world;
    const l = labels();
    const { owner, province } = world.cells;
    const cc = world.cities.cols;
    let city = 0;
    world.cities.forEach((ci) => {
      if (city === 0 && cc.capitalOf[ci] === 0 && owner[cc.cell[ci]!] !== 0) city = ci;
    });
    const p = province[cc.cell[city]!]!;
    const holder = owner[cc.cell[city]!]!;
    const first = spawnRebels(world, [p], holder);
    const second = spawnRebels(world, [p], first);
    const third = spawnRebels(world, [p], second);
    const origins = world.nations.cols.origin;
    expect([origins[first], origins[second], origins[third]], 'the three origins').toEqual([p, p, p]);
    const name = (id: number): string => foundedName(id, origins[id]!, l, foundedNth(id, origins, l));
    expect([name(first), name(second), name(third)]).toEqual([`Free ${l[p - 1]}`, `Free ${l[p - 1]} II`, `Free ${l[p - 1]} III`]);
    // By the label, not the province: "Central" is ten provinces of the earth data.
    const twin = l.findIndex((s, i) => i !== p - 1 && l.indexOf(s) !== i && l.indexOf(s) !== p - 1);
    expect(twin, 'a label of two provinces').toBeGreaterThan(-1);
    const col = [0, l.indexOf(l[twin]!) + 1, twin + 1, p];
    expect([1, 2, 3].map((id) => foundedName(id, col[id]!, l, foundedNth(id, col, l)))).toEqual([`Free ${l[twin]}`, `Free ${l[twin]} II`, `Free ${l[p - 1]}`]);
    // A nation of a scenario has no origin and is no one's namesake; the numerals.
    expect(foundedNth(3, [0, 0, 0, p], l)).toBe(1);
    expect([4, 9, 14, 40, 1999].map((n) => foundedName(1, p, l, n).split(' ').pop())).toEqual(['IV', 'IX', 'XIV', 'XL', 'MCMXCIX']);
  });

  it('a revolt forced in every province of the 1938 start: every nation founded has a name', () => {
    const world = sim1938().world;
    const l = labels();
    const first = world.nations.highWater;
    for (let p = 1; p < world.provinces.count; p++) forceRevolt(world, p);
    const nc = world.nations.cols; // after the revolts: the table has grown (PLAN 2.12a)
    const cities = capitalCities(world);
    let founded = 0;
    const elsewhere: number[] = [];
    for (let id = first; id < world.nations.highWater; id++) {
      founded++;
      const origin = nc.origin[id]!;
      expect(origin, `nation ${id}: an origin`).toBeGreaterThan(0);
      expect(foundedName(id, origin, l), `nation ${id}, origin ${origin}`).not.toMatch(/^Free state \d+$/);
      if (capitalProvince(world, id, cities) !== origin) elsewhere.push(id);
    }
    expect(founded).toBeGreaterThan(300);
    // PLAN 2.15e3: a city on the shore named its nation after the area's first province.
    expect(elsewhere.length, 'nations with the capital outside the origin').toBe(0);
    expect(first).toBe(NATIONS_1938.length + 1);
  }, 300_000);
});
