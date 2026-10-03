import { describe, expect, it } from 'vitest';
import { inflateSync } from 'node:zlib';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import { decodeRuns, encodeRuns, paletteMap } from '../../src/shared/mapImport';
import { Terrain } from '../../src/shared/terrain';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { xxhash32View } from '../../src/sim/core/hash';
import { assets1938 } from '../helpers/earth';
import { CELLS_PER_PIXEL, FIX_H, FIX_W, nationFixture, NATION_FIXTURE_PIXELS, terrainFixture, TERRAIN_FIXTURE_PIXELS } from '../helpers/importFixture';
import { nationId } from '../helpers/sim1938';

// PLAN 1.37a (unit part): palette mapping, RLE, and importLayer (water ↔ land, linked owner
// clearing, one undo step, save/load).

const { w: W, h: H } = SIZE_1938;
const color = (id: string): number => parseInt(terrainJson.terrain.find((t) => t.id === id)!.color.slice(1), 16);
const TERRAIN_PALETTE = terrainJson.terrain.map((t, value) => ({ rgb: parseInt(t.color.slice(1), 16), value }));
const [GER, POL] = ['GER', 'POL'].map(nationId) as number[];

/** Decodes the fixture PNG (8-bit RGB, filter 0 rows, as tools/data/png.ts writes) to RGBA. */
function decode(png: Buffer): Uint8Array {
  const idat = png.subarray(33 + 8, png.length - 12 - 4); // after signature + IHDR, before IEND; strip length+type
  const raw = inflateSync(idat);
  const rgba = new Uint8Array(FIX_W * FIX_H * 4);
  for (let y = 0; y < FIX_H; y++) {
    for (let x = 0; x < FIX_W; x++) {
      const s = y * (FIX_W * 3 + 1) + 1 + x * 3;
      rgba.set([raw[s]!, raw[s + 1]!, raw[s + 2]!, 255], (y * FIX_W + x) * 4);
    }
  }
  return rgba;
}

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
    const runs = encodeRuns(paletteMap(rgba, FIX_W, FIX_H, W, H, TERRAIN_PALETTE, 1000, 0));
    s.command({ kind: 'importLayer', layer: 'terrain', runs });
    s.applyNow();
    const { terrain, owner } = s.world.cells;
    expect(count(terrain, Terrain.Forest)).toBe(TERRAIN_FIXTURE_PIXELS.forest * CELLS_PER_PIXEL);
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
      expect(count(x.world.cells.terrain, Terrain.Forest)).toBe(TERRAIN_FIXTURE_PIXELS.forest * CELLS_PER_PIXEL);
      expect(x.world.edits.undo.length).toBe(2);
    }
    expect(t.hash()).toBe(s.hash());
  }, 120_000);
});
