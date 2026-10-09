import { describe, expect, it } from 'vitest';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import { decodeRuns, encodeRuns, paletteMap } from '../../src/shared/mapImport';
import { Terrain } from '../../src/shared/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { xxhash32View } from '../../src/sim/core/hash';
import { assets1938 } from '../helpers/earth';
import { CELLS_PER_PIXEL, decode, FIX_H, FIX_W, importedCounts, nationFixture, NATION_FIXTURE_PIXELS, terrainFixture, TERRAIN_FIXTURE_PIXELS } from '../helpers/importFixture';
import { nationId } from '../helpers/sim1938';

// PLAN 1.37a (unit part): palette mapping, RLE, and importLayer (water ↔ land, linked owner
// clearing, one undo step, save/load).

const { w: W, h: H } = SIZE_1938;
const color = (id: string): number => parseInt(terrainJson.terrain.find((t) => t.id === id)!.color.slice(1), 16);
const TERRAIN_PALETTE = terrainJson.terrain.map((t, value) => ({ rgb: parseInt(t.color.slice(1), 16), value }));
const [GER, POL] = ['GER', 'POL'].map(nationId) as number[];


const count = (a: ArrayLike<number>, v: number): number => {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === v) n++;
  return n;
};

describe('map import (PLAN 1.37a)', () => {
  it('maps the terrain fixture to the expected cell counts', () => {
    const rgba = decode(terrainFixture({ water: color('water'), plains: color('plains'), forest: color('forest'), mountains: color('mountains') }));
    const v = paletteMap(rgba, FIX_W, FIX_H, W, H, TERRAIN_PALETTE, 1000, 0);
    expect(count(v, Terrain.Water)).toBe(TERRAIN_FIXTURE_PIXELS.water * CELLS_PER_PIXEL);
    expect(count(v, Terrain.Plains)).toBe(TERRAIN_FIXTURE_PIXELS.plains * CELLS_PER_PIXEL);
    expect(count(v, Terrain.Forest)).toBe(TERRAIN_FIXTURE_PIXELS.forest * CELLS_PER_PIXEL);
    expect(count(v, Terrain.Mountains)).toBe(TERRAIN_FIXTURE_PIXELS.mountains * CELLS_PER_PIXEL);
  });

  it('far colours fall back; runs round-trip and reject a wrong length', () => {
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 250, 0, 255]); // 2×1: red, almost green
    const v = paletteMap(rgba, 2, 1, 4, 1, [{ rgb: 0x00ff00, value: 7 }], 10, 0);
    expect(Array.from(v)).toEqual([0, 0, 7, 7]);
    expect(encodeRuns(v)).toEqual([0, 2, 7, 2]);
    expect(Array.from(decodeRuns([0, 2, 7, 2], 4)!)).toEqual([0, 0, 7, 7]);
    expect(decodeRuns([0, 2, 7, 1], 4)).toBeNull();
    expect(decodeRuns([0, 5], 4)).toBeNull();
  });

  it('a terrain import turns land into water (owners cleared, linked) and undoes in one step', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.world.settings.aiEnabled = false;
    const owner0 = s.world.cells.owner.slice();
    const terrain0 = s.world.cells.terrain.slice();
    const rgba = decode(terrainFixture({ water: color('water'), plains: color('plains'), forest: color('forest'), mountains: color('mountains') }));
    const values = paletteMap(rgba, FIX_W, FIX_H, W, H, TERRAIN_PALETTE, 1000, 0);
    const runs = encodeRuns(values);
    const cityCells: number[] = [];
    s.world.cities.forEach((id) => cityCells.push(s.world.cities.cols.cell[id]!));
    const expected = importedCounts(values, terrain0, cityCells, TERRAIN_PALETTE.length, Terrain.Water);
    s.command({ kind: 'importLayer', layer: 'terrain', runs });
    s.applyNow();
    const { terrain, owner } = s.world.cells;
    for (const k of [Terrain.Water, Terrain.Plains, Terrain.Forest, Terrain.Mountains]) expect(count(terrain, k), `class ${k}`).toBe(expected[k]);
    for (let c = 0; c < terrain.length; c += 997) if (terrain[c] === Terrain.Water) expect(owner[c]).toBe(0);
    expect(s.world.edits.undo.length).toBe(2); // terrain + linked owner clearing
    expect(s.world.edits.undo[1]!.linked).toBe(true);
    // Nations on the land half.
    const nat = decode(nationFixture(s.world.nations.cols.color[GER!]!, s.world.nations.cols.color[POL!]!));
    s.command({ kind: 'importLayer', layer: 'nation', runs: encodeRuns(paletteMap(nat, FIX_W, FIX_H, W, H, [{ rgb: s.world.nations.cols.color[GER!]!, value: GER! }, { rgb: s.world.nations.cols.color[POL!]!, value: POL! }], 40, 0)) });
    s.applyNow();
    expect(count(s.world.cells.owner, GER!)).toBe(NATION_FIXTURE_PIXELS.ger * CELLS_PER_PIXEL);
    expect(count(s.world.cells.owner, POL!)).toBe(NATION_FIXTURE_PIXELS.pol * CELLS_PER_PIXEL);
    // Save/load keeps the linked stack; two undos (nation, then terrain + its link) restore all.
    const t = new Sim({ scenario: '1938', seed: 2, assets: assets1938(W) });
    t.load(s.save());
    expect(t.hash()).toBe(s.hash());
    for (const x of [s, t]) {
      x.command({ kind: 'editUndo' });
      x.command({ kind: 'editUndo' });
      x.applyNow();
      // Hashes, not toEqual: a failing toEqual on 2 M cells builds a diff for minutes.
      expect(xxhash32View(x.world.cells.terrain)).toBe(xxhash32View(terrain0));
      expect(xxhash32View(x.world.cells.owner)).toBe(xxhash32View(owner0));
      x.command({ kind: 'editRedo' });
      x.applyNow();
      expect(count(x.world.cells.terrain, Terrain.Forest)).toBe(expected[Terrain.Forest]);
      expect(x.world.edits.undo.length).toBe(2);
    }
    expect(t.hash()).toBe(s.hash());
  }, 120_000);
});

// Review in PLAN 1.41: a terrain import keeps land under cities (islands, never drowned cities)
// and moves formations left on water to the nearest land.
describe('map import keeps cities and formations on land', () => {
  it('city cells stay land; stranded formations move ashore', () => {
    const s = new Sim({ scenario: '1938', seed: 1, assets: assets1938(W) });
    s.world.settings.aiEnabled = false;
    // All water, as an extreme import.
    const runs = encodeRuns(new Uint16Array(W * H).fill(Terrain.Water));
    const cityCells: number[] = [];
    s.world.cities.forEach((id) => cityCells.push(s.world.cities.cols.cell[id]!));
    s.command({ kind: 'importLayer', layer: 'terrain', runs });
    s.applyNow();
    const t = s.world.cells.terrain;
    expect(cityCells.every((c) => t[c] !== Terrain.Water)).toBe(true);
    expect(count(t, Terrain.Water)).toBe(W * H - new Set(cityCells).size);
    // Every formation of the land stands on land (a city island) or was removed. A fleet stands
    // on water as before, or was removed where a city island took its cell (PLAN 4.2b).
    const fc = s.world.formations.cols;
    let fleets = 0;
    s.world.formations.forEach((f) => {
      const on = t[Math.floor(fc.y[f]!) * W + Math.floor(fc.x[f]!)];
      if (s.world.afloat(f)) {
        fleets++;
        expect(on).toBe(Terrain.Water);
      } else expect(on).not.toBe(Terrain.Water);
    });
    expect(fleets).toBeGreaterThan(150);
  }, 120_000);
});
