import { describe, expect, it } from 'vitest';
import { landStandings, ownedAreas } from '../../src/sim/landArea';
import { cellAreaByRow, makeNavGrid } from '../../src/sim/nav/grid';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 1.42d, ADR-52: land is measured by true area, not by cells of the Miller map.

const id = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;

describe('cell area (ADR-52)', () => {
  it('is the product of the nav grid row scales and shrinks towards the poles', () => {
    const w = 64;
    const h = 32;
    const area = cellAreaByRow(w, h);
    const g = makeNavGrid(new Uint8Array(w * h), w, h, true);
    for (let r = 0; r < h; r++) expect(area[r]).toBe(g.kx[r]! * g.ky[r]!);
    for (let r = 1; r <= h / 2 - 1; r++) expect(area[r]!).toBeGreaterThan(area[r - 1]!);
    expect(area[h / 2]! / area[1]!).toBeGreaterThan(4);
  });

  it('a nation with more cells near the pole owns less land than one at the equator', () => {
    const w = 64;
    const h = 32;
    const owner = new Uint16Array(w * h);
    for (let x = 0; x < 30; x++) owner[2 * w + x] = 1; // 30 cells in a polar row
    for (let x = 0; x < 10; x++) owner[16 * w + x] = 2; // 10 cells on the equator
    const a = ownedAreas(owner, w, h, 3);
    const row = cellAreaByRow(w, h);
    expect(a[0]).toBe(0);
    expect(a[1]).toBeCloseTo(30 * row[2]!, 6);
    expect(a[2]).toBeCloseTo(10 * row[16]!, 6);
    expect(a[2]!).toBeGreaterThan(a[1]!);
  });
});

describe('land of the 1938 start by area (PLAN 1.42d)', () => {
  const sim = new Sim({ scenario: '1938', seed: 1, assets: assets1938(SIZE_1938.w) });
  const land = landStandings(sim.world);
  const within = (v: number, want: number, tol: number): void => {
    expect(v).toBeGreaterThan(want * (1 - tol));
    expect(v).toBeLessThan(want * (1 + tol));
  };

  it('the large nations have their true areas', () => {
    within(land.owned, 133e6, 0.02);
    const want: [string, number][] = [
      ['SOV', 21.2e6],
      ['USA', 9.3e6],
      ['CAN', 9.1e6],
      ['DEN', 2.0e6],
      ['AST', 8.1e6],
      ['BRA', 8.5e6],
    ];
    for (const [tag, km2] of want) within(land.area[id(tag)]!, km2, 0.03);
    within(land.area[id('SOV')]! / land.owned, 0.159, 0.03);
  });

  it('ranks by area: the Soviet Union leads and Denmark is not in the top ten', () => {
    expect(land.ranked[0]).toBe(id('SOV'));
    expect(land.ranked.slice(0, 10)).not.toContain(id('DEN'));
    const nc = sim.world.nations.cols;
    const byCells = [...land.ranked].sort((a, b) => nc.cells[b]! - nc.cells[a]! || a - b);
    expect(byCells.slice(0, 10)).toContain(id('DEN')); // the artefact the measure removes
    for (let i = 1; i < land.ranked.length; i++) expect(land.area[land.ranked[i - 1]!]!).toBeGreaterThanOrEqual(land.area[land.ranked[i]!]!);
  });
});
