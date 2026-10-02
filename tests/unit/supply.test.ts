import { describe, expect, it } from 'vitest';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938, TEMPLATES_LAND } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { blocOf, refreshSupplyNetwork } from '../../src/sim/systems/supply';
import type { World } from '../../src/sim/world';
import { assets1938 } from '../helpers/earth';

// PLAN 1.12 supply v1. AT: an encircled formation's supply → 0 within a day and it attrits.

const W = SIZE_1938.w;
const H = SIZE_1938.h;
const nationId = (tag: string): number => NATIONS_1938.findIndex((n) => n.tag === tag) + 1;
const INF = TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div');
const cellAt = (lon: number, lat: number): number => {
  const [x, y] = cellOf(lon, lat, W, H);
  return Math.floor(y) * W + Math.floor(x);
};

function spawnAt(world: World, tag: string, cell: number): number {
  const f = world.formations;
  const id = f.create();
  f.cols.nation[id] = nationId(tag);
  f.cols.template[id] = INF;
  f.cols.x[id] = (cell % W) + 0.5;
  f.cols.y[id] = Math.floor(cell / W) + 0.5;
  f.cols.strength[id] = 10_000;
  f.cols.supply[id] = 1;
  return id;
}
const spawn = (world: World, tag: string, lon: number, lat: number): number => spawnAt(world, tag, cellAt(lon, lat));

/** A cell of `tag` near (lon, lat) with no city within `r` cells and all land within `r`. */
function quietCell(world: World, tag: string, lon: number, lat: number, r: number): number {
  const cityCells = new Set<number>();
  world.cities.forEach((id) => void cityCells.add(world.cities.cols.cell[id]!));
  const c0 = cellAt(lon, lat);
  for (let d = 0; d < 30; d++) {
    for (let k = -d; k <= d; k++) {
      for (const c of [c0 + k + d * W, c0 + k - d * W, c0 + d + k * W, c0 - d + k * W]) {
        let ok = world.cells.controller[c] === nationId(tag);
        for (let dy = -r; ok && dy <= r; dy++) {
          for (let dx = -r; ok && dx <= r; dx++) {
            const n = c + dy * W + dx;
            if (cityCells.has(n) || world.cells.controller[n] === 0) ok = false;
          }
        }
        if (ok) return c;
      }
    }
  }
  throw new Error('no quiet cell');
}

/** Hands a ring (radius r0..r1 cells, Chebyshev) around `centre` to `tag`: a pocket inside. */
function encircle(world: World, centre: number, tag: string, r0: number, r1: number): void {
  const cx = centre % W;
  const cy = (centre - cx) / W;
  for (let dy = -r1; dy <= r1; dy++) {
    for (let dx = -r1; dx <= r1; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < r0) continue;
      const c = (cy + dy) * W + cx + dx;
      if (world.cells.controller[c] !== 0) world.cells.controller[c] = nationId(tag);
    }
  }
}

describe('supply v1 (PLAN 1.12)', () => {
  it('a nation supplies its own territory; Germany and Poland have separate networks', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    refreshSupplyNetwork(s.world);
    expect(s.world.cells.supply[cellAt(10.0, 51.0)]).toBe(nationId('GER'));
    expect(s.world.cells.supply[cellAt(20.0, 52.0)]).toBe(nationId('POL'));
    expect(s.world.cells.supply[cellAt(-30.0, 40.0)]).toBe(0); // Atlantic
  });

  it('puppets share their overlord’s supply bloc', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const puppet = NATIONS_1938.find((n) => n.overlord);
    expect(puppet).toBeDefined();
    expect(blocOf(s.world, nationId(puppet!.tag))).toBe(nationId(puppet!.overlord!.tag));
  });

  it('an encircled formation runs out of supply within a day and attrits; a supplied one does not', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const pocket = quietCell(s.world, 'SOV', 45.0, 62.0, 4); // Russian north, no city in the pocket
    const cut = spawnAt(s.world, 'SOV', pocket);
    const free = spawn(s.world, 'POL', 20.0, 52.0);
    encircle(s.world, pocket, 'GER', 2, 4);
    s.step(24);
    const f = s.world.formations.cols;
    expect(s.world.cells.supply[pocket]).toBe(0);
    expect(f.supply[cut]).toBe(0);
    expect(f.strength[cut]).toBeLessThan(10_000);
    expect(f.supply[free]).toBe(1);
    expect(f.strength[free]).toBe(10_000);
    // Attrition continues: about 2%+ per day out of supply.
    const after1 = f.strength[cut]!;
    s.step(24 * 5);
    expect(f.strength[cut]!).toBeLessThan(after1 * 0.92);
  });

  it('supply is restored when the pocket is relieved', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    const pocket = quietCell(s.world, 'SOV', 45.0, 62.0, 4);
    const id = spawnAt(s.world, 'SOV', pocket);
    const before = new Uint16Array(s.world.cells.controller);
    encircle(s.world, pocket, 'GER', 2, 4);
    s.step(24);
    expect(s.world.formations.cols.supply[id]).toBe(0);
    s.world.cells.controller.set(before);
    s.step(24);
    expect(s.world.formations.cols.supply[id]).toBe(1);
  });

  it('supply state survives save/load (network layer and formation supply are state)', () => {
    const run = (split: boolean): number => {
      const s = new Sim({ scenario: '1938', seed: 3, assets: assets1938(W) });
      const pocket = quietCell(s.world, 'SOV', 45.0, 62.0, 4);
      spawnAt(s.world, 'SOV', pocket);
      encircle(s.world, pocket, 'GER', 2, 4);
      s.step(9); // mid refresh interval
      if (!split) {
        s.step(40);
        return s.hash();
      }
      const t = new Sim({ scenario: '1938', seed: 4, assets: assets1938(W) });
      t.load(s.save());
      t.step(40);
      return t.hash();
    };
    expect(run(true)).toBe(run(false));
  });

  it('the network refresh is fast enough to run every 6 hours', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    refreshSupplyNetwork(s.world);
    const t0 = performance.now();
    for (let i = 0; i < 5; i++) refreshSupplyNetwork(s.world);
    expect((performance.now() - t0) / 5).toBeLessThan(60);
  });
});
