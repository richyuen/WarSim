import { describe, expect, it } from 'vitest';
import type { ScenarioAssets } from '../../src/shared/protocol';
import { Terrain } from '../../src/shared/terrain';
import { RANDOM_NATIONS } from '../../src/shared/scenarios';
import { createRandomWorld, randomNationCount } from '../../src/sim/randomWorld';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 2.16a: the random world, the earth shared out among nations the seed makes.

const assets: ScenarioAssets = assets1938(SIZE_1938.w);
const sim = (seed: number, nations?: number): Sim => new Sim({ scenario: 'random', seed, assets, ...(nations !== undefined ? { options: { nations } } : {}) });

describe('random world (PLAN 2.16a)', () => {
  const a = sim(7, 60);
  const w = a.world;

  it('the same seed and count give the same world; another seed or count another', () => {
    expect(sim(7, 60).hash()).toBe(a.hash());
    expect(sim(8, 60).hash()).not.toBe(a.hash());
    expect(sim(7, 61).hash()).not.toBe(a.hash());
  });

  it('has the number of nations asked for, within its limits', () => {
    expect(w.nations.count).toBe(60);
    expect(sim(7).world.nations.count).toBe(RANDOM_NATIONS.default);
    expect(randomNationCount(1)).toBe(RANDOM_NATIONS.min);
    expect(randomNationCount(1e6)).toBe(RANDOM_NATIONS.max);
    expect(randomNationCount(12.4)).toBe(12);
    expect(randomNationCount(NaN)).toBe(RANDOM_NATIONS.default);
  });

  for (const [seed, count] of [
    [7, 60],
    [31337, RANDOM_NATIONS.max],
    [5, RANDOM_NATIONS.min],
  ] as const) {
    it(`seed ${seed}, ${count} nations: each lives, with land, a capital on it, a name of its own, a colour and an army`, () => {
      const world = seed === 7 ? w : createRandomWorld(seed, count, assets);
      const nc = world.nations.cols;
      const { owner, controller, terrain, province } = world.cells;
      expect(world.nations.count).toBe(count);
      const cells = new Uint32Array(count + 1);
      let unowned = 0;
      for (let c = 0; c < owner.length; c++) {
        if (terrain[c]! >= Terrain.Plains && province[c]! > 0) {
          if (owner[c] === 0) unowned++;
          cells[owner[c]!]!++;
        } else expect(owner[c]).toBe(0);
        expect(controller[c]).toBe(owner[c]);
      }
      // No land of a province is left without an owner.
      expect(unowned).toBe(0);
      const capitals = new Map<number, number>();
      world.cities.forEach((ci) => {
        const of = world.cities.cols.capitalOf[ci]!;
        if (of === 0) return;
        expect(capitals.has(of), `two capitals of ${of}`).toBe(false);
        capitals.set(of, world.cities.cols.cell[ci]!);
      });
      const armies = new Uint32Array(count + 1);
      world.formations.forEach((f) => {
        const fc = world.formations.cols;
        armies[fc.nation[f]!]!++;
        expect(fc.strength[f]).toBeGreaterThan(0);
        // It stands on its own nation's land.
        expect(owner[Math.floor(fc.y[f]!) * world.cells.w + Math.floor(fc.x[f]!)]).toBe(fc.nation[f]);
      });
      const names = new Set<string>();
      const colours = new Set<number>();
      world.nations.forEach((id) => {
        expect(nc.living[id], `living ${id}`).toBe(1);
        expect(cells[id], `cells ${id}`).toBeGreaterThan(0);
        expect(nc.cells[id]).toBe(cells[id]);
        expect(owner[capitals.get(id)!], `capital of ${id}`).toBe(id);
        expect(nc.capitalX[id]! + nc.capitalY[id]!).toBeGreaterThan(0);
        expect(world.names.get(id), `name ${id}`).toBeTruthy();
        names.add(world.names.get(id)!);
        colours.add(nc.color[id]!);
        expect(armies[id], `army ${id}`).toBeGreaterThan(0);
        expect(nc.gold[id]).toBeGreaterThanOrEqual(0);
        expect(nc.manpower[id]).toBeGreaterThanOrEqual(0);
      });
      // No capital on an islet (PLAN 2.16Re): its piece of land has a dozen cells. Before the
      // rule a world of 200 had nations of one cell.
      const piece = navOf(world).grid.component;
      const pieceCells = new Map<number, number>();
      for (let c = 0; c < owner.length; c++) if (terrain[c]! >= Terrain.Plains && province[c]! > 0) pieceCells.set(piece[c]!, (pieceCells.get(piece[c]!) ?? 0) + 1);
      for (const [id, cell] of capitals) expect(pieceCells.get(piece[cell]!), `the land of ${id}'s capital`).toBeGreaterThanOrEqual(12);
      expect(colours.size).toBe(count);
      // Two provinces of the earth may share a name (a "Central" in several countries); few do.
      expect(names.size).toBeGreaterThanOrEqual(count - 3);
      expect(world.formations.count).toBeLessThanOrEqual(900 + count);
      expect(world.wars.list.length).toBe(0);
    });
  }

  it('the nations differ in size, and none holds half the land', () => {
    const cells = Array.from({ length: w.nations.count }, (_, i) => w.nations.cols.cells[i + 1]!).sort((x, y) => x - y);
    const land = cells.reduce((s, x) => s + x, 0);
    expect(cells.at(-1)!).toBeLessThan(0.5 * land);
    expect(cells.at(-1)!).toBeGreaterThan(5 * cells[Math.floor(cells.length / 2)]!);
  });

  it('runs, saves and loads: a month, the same hash after a round trip', () => {
    const b = sim(7, 60);
    b.step(24 * 31);
    const saved = b.save();
    const c = sim(7, 60);
    c.load(saved);
    expect(c.hash()).toBe(b.hash());
    b.step(24);
    c.step(24);
    expect(c.hash()).toBe(b.hash());
  });
});
