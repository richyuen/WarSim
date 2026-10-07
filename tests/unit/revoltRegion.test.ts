import { describe, expect, it } from 'vitest';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { forceRevolt, REGION_KM2, REGION_MAX } from '../../src/sim/systems/revolts';
import { navOf, type World } from '../../src/sim/world';
import { assets1938, earthAdmin1 } from '../helpers/earth';
import { nationId } from '../helpers/sim1938';

// PLAN 3.9 (the critic's R3-B2, seed 6021 at a6f63ef): a region revolt was bounded by its number
// of provinces and by nothing else. On day 3043 eight provinces of the Soviet Far East (Sakha,
// Chukotka, Khabarovsk, Magadan, Zabaykalsky, Amur, Primorsky, Jewish: 4.5 % of the world's
// owned land) rose in one revolt and joined "Free Seoul", a rebel state of 0.18 % next to
// Primorsky; on day 3135 eight more (Krasnoyarsk, Yamalo-Nenets, Khanty-Mansi, Komi, Tomsk,
// Perm, Kirov, Mari El: 3.3 %) joined "Free Herat". A region is bounded by its land now
// (`REGION_KM2`, ADR-186).

const SOV = nationId('SOV');
const FRA = nationId('FRA');

function world1938(): World {
  const w = new Sim({ scenario: '1938', seed: 5, assets: assets1938(SIZE_1938.w) }).world;
  w.settings.revoltMode = 'region';
  return w;
}

/** The province of that name in that country (admin-0 code). */
function provinceOf(name: string, adm0: string): number {
  const m = earthAdmin1().meta.find((x) => x.name === name && x.adm0 === adm0);
  if (!m) throw new Error(`no province ${name} (${adm0})`);
  return m.id;
}

/** Every province whose centre `holder` owns is as restless as a province can be. */
function unrestEverywhere(w: World, holder: number): void {
  const g = navOf(w).graph;
  for (let p = 1; p < w.provinces.count; p++) if (w.cells.owner[g.centre[p] ?? -1] === holder) w.provinces.unrest[p] = 100;
}

/** The provinces in which `n` owns a cell. */
function provincesOf(w: World, n: number): number[] {
  const set = new Set<number>();
  w.cells.owner.forEach((o, c) => o === n && set.add(w.cells.province[c]!));
  return [...set].sort((a, b) => a - b);
}

const km2 = (w: World, n: number): number => w.landCounts().owned[n]!;

describe('a region revolt is bounded by its land (PLAN 3.9)', () => {
  it('the Soviet Far East does not rise as one state', () => {
    const w = world1938();
    unrestEverywhere(w, SOV);
    const first = w.nations.highWater;
    expect(forceRevolt(w, provinceOf('Amur', 'RUS'))).toBe(true);
    expect(w.nations.cols.living[first]).toBe(1);
    expect(provincesOf(w, first).length).toBeGreaterThan(1);
    expect(km2(w, first)).toBeLessThanOrEqual(REGION_KM2);
  });

  it('nor does it join the rebel state next to it in one piece (seed 6021, day 3043)', () => {
    const w = world1938();
    // The rebel state next door: Primorsky alone.
    w.settings.revoltMode = 'province';
    const rebel = w.nations.highWater;
    forceRevolt(w, provinceOf('Primorsky Krai', 'RUS'));
    expect(provincesOf(w, rebel)).toEqual([provinceOf('Primorsky Krai', 'RUS')]);
    const before = km2(w, rebel);
    w.settings.revoltMode = 'region';
    unrestEverywhere(w, SOV);
    const next = w.nations.highWater;
    // Khabarovsk lies between Amur and Primorsky: the region that holds it is next to the rebels.
    forceRevolt(w, provinceOf('Khabarovsk Krai', 'RUS'));
    expect(w.nations.highWater, 'the area joined the rebels, no nation was founded').toBe(next);
    expect(km2(w, rebel)).toBeGreaterThan(before);
    expect(km2(w, rebel) - before).toBeLessThanOrEqual(REGION_KM2);
  });

  it('a province larger than the bound rises whole and alone', () => {
    const w = world1938();
    unrestEverywhere(w, SOV);
    const sakha = provinceOf('Sakha Republic', 'RUS');
    let cells = 0;
    w.cells.province.forEach((p, c) => p === sakha && w.cells.owner[c] === SOV && cells++);
    const first = w.nations.highWater;
    forceRevolt(w, sakha);
    expect(provincesOf(w, first)).toEqual([sakha]);
    expect(w.nations.cols.cells[first]).toBe(cells);
    expect(km2(w, first)).toBeGreaterThan(REGION_KM2);
  });

  it('a region of small provinces is its eight provinces, as before', () => {
    const w = world1938();
    unrestEverywhere(w, FRA);
    const first = w.nations.highWater;
    forceRevolt(w, provinceOf('Aveyron', 'FRA'));
    expect(provincesOf(w, first).length).toBe(REGION_MAX);
    expect(km2(w, first)).toBeLessThan(REGION_KM2 / 10);
  });
});
