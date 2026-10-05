import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ScenarioId } from '../../src/shared/protocol';
import { LISTED_SCENARIOS, SCENARIO_INFO } from '../../src/shared/scenarios';
import { Terrain } from '../../src/shared/terrain';
import { cellOf } from '../../src/sim/data/terrain';
import { NATIONS_1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { decodePng, encodePng } from '../../tools/data/png';
import { politicalPreviewRgb, preview1938, previewPath, previewRandom, PREVIEW_H, PREVIEW_RANDOM_SEED, PREVIEW_W, SEA_RGB, UNOWNED_RGB } from '../../tools/data/preview';
import { assets1938 } from '../helpers/earth';

// PLAN 1.43c: the title screen's map of a scenario's start is a committed image made by
// `npm run data -- --previews`. It must be the map the scenario data gives today, and the nation
// count beside it must be the sim's.

const root = path.resolve(import.meta.dirname, '../..');
const rgbOf = (hex: string): number[] => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

describe('scenario previews (PLAN 1.43c)', () => {
  it('every listed scenario has a preview image', () => {
    for (const id of LISTED_SCENARIOS) expect(existsSync(path.join(root, previewPath(id))), id).toBe(true);
  });

  it('the committed 1938 preview is the political map of its start', () => {
    const png = decodePng(readFileSync(path.join(root, previewPath('1938'))));
    expect([png.w, png.h]).toEqual([PREVIEW_W, PREVIEW_H]);
    const rgb = preview1938();
    // If this fails after a change of the scenario's data or the map assets: npm run data -- --previews
    expect(Buffer.from(png.rgb).equals(Buffer.from(rgb)), 'preview.png is out of date').toBe(true);

    // Known places, well inside their nations, in the nations' colours; the open sea in the sea colour.
    const at = (lon: number, lat: number): number[] => {
      const [x, y] = cellOf(lon, lat, PREVIEW_W, PREVIEW_H);
      const i = (Math.floor(y) * PREVIEW_W + Math.floor(x)) * 3;
      return Array.from(rgb.subarray(i, i + 3));
    };
    const places: [string, number, number][] = [
      ['SOV', 60, 60],
      ['USA', -100, 40],
      ['BRA', -52, -10],
      ['AST', 134, -25],
      ['CHI', 104, 30],
      ['RAJ', 78, 22],
      ['ARG', -65, -35],
    ];
    for (const [tag, lon, lat] of places) expect(at(lon, lat), tag).toEqual(rgbOf(NATIONS_1938.find((n) => n.tag === tag)!.color));
    expect(at(-40, 30), 'mid-Atlantic').toEqual([...SEA_RGB]);
    expect(at(-150, -20), 'South Pacific').toEqual([...SEA_RGB]);
  });

  // PLAN 2.16c: the random world's picture is one random world, the one the game builds for the
  // preview's seed with the number of nations of a game that asks for none.
  it('the committed preview of the random world is the world its seed gives in the game', () => {
    const png = decodePng(readFileSync(path.join(root, previewPath('random'))));
    expect([png.w, png.h]).toEqual([PREVIEW_W, PREVIEW_H]);
    const rgb = previewRandom(assets1938(SIZE_1938.w));
    // If this fails after a change of the random world's rules or the map assets: npm run data -- --previews
    expect(Buffer.from(png.rgb).equals(Buffer.from(rgb)), 'preview.png is out of date').toBe(true);

    // The game's world of that seed: at the capital of every nation whose capital the picture
    // has as a cell of its own land, well inside, the picture has the nation's colour.
    const sim = new Sim({ scenario: 'random', seed: PREVIEW_RANDOM_SEED, assets: assets1938(SIZE_1938.w) });
    const { cells, nations } = sim.world;
    expect(nations.count).toBe(SCENARIO_INFO.random.nations);
    const step = SIZE_1938.w / PREVIEW_W;
    const inside = (x: number, y: number, id: number): boolean => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (cells.controller[(y + dy) * step * SIZE_1938.w + (x + dx) * step] !== id) return false;
      return true;
    };
    const colours = new Set<number>();
    let seen = 0;
    for (let id = 1; id <= nations.count; id++) {
      const colour = nations.cols.color[id]! & 0xffffff;
      colours.add(colour);
      const x = Math.floor(nations.cols.capitalX[id]! / step);
      const y = Math.floor(nations.cols.capitalY[id]! / step);
      if (y < 2 || y >= PREVIEW_H - 2 || x < 2 || x >= PREVIEW_W - 2 || !inside(x, y, id)) continue;
      seen++;
      const i = (y * PREVIEW_W + x) * 3;
      expect((rgb[i]! << 16) | (rgb[i + 1]! << 8) | rgb[i + 2]!, `nation ${id}`).toBe(colour);
    }
    expect(seen).toBeGreaterThan(nations.count / 2);
    expect(colours.size).toBe(nations.count);
    // Another seed, another picture.
    expect(Buffer.from(previewRandom(assets1938(SIZE_1938.w), PREVIEW_RANDOM_SEED + 1)).equals(Buffer.from(rgb))).toBe(false);
  });

  it('draws nations in their colours, a border where the holder changes and a darker coast', () => {
    // 5 × 4: a row of sea, then land held by nation 1 (two cells), nation 2 (two cells) and nobody.
    const W = 5;
    const H = 4;
    const terrain = new Uint8Array(W * H).fill(Terrain.Plains);
    terrain.fill(Terrain.Water, 0, W);
    const holder = new Uint16Array(W * H);
    for (let y = 1; y < H; y++) holder.set([1, 1, 2, 2, 0], y * W);
    const rgb = politicalPreviewRgb(W, H, holder, terrain, [0, 0xff0000, 0x00ff00]);
    const at = (x: number, y: number): number[] => Array.from(rgb.subarray((y * W + x) * 3, (y * W + x) * 3 + 3));
    expect(at(0, 0)).toEqual([...SEA_RGB]);
    // An inner row (no sea next to it): plain colours, and a border on the western side of each change.
    expect(at(0, 2)).toEqual([255, 0, 0]);
    expect(at(1, 2)).toEqual([63, 12, 16]); // nation 1 beside nation 2: 20% red + 80% border
    expect(at(2, 2)).toEqual([0, 255, 0]);
    expect(at(3, 2)).toEqual([12, 63, 16]); // nation 2 beside unowned land
    // x wraps: the unowned cell has nation 1 to its east.
    expect(at(4, 2)).toEqual(UNOWNED_RGB.map((v, k) => Math.round(v * 0.2 + [15, 15, 20][k]! * 0.8)));
    // The row below the sea is coast: darker where there is no border. So is the last row: beyond
    // the map's edge is sea, as on the game's map.
    expect(at(0, 1)).toEqual([191, 0, 0]);
    expect(at(2, 1)).toEqual([0, 191, 0]);
    expect(at(1, 1)).toEqual([63, 12, 16]);
    expect(at(0, 3)).toEqual([191, 0, 0]);
  });

  it('the PNG codec round-trips its own images and refuses others', () => {
    const rgb = Uint8Array.from({ length: 7 * 5 * 3 }, (_, i) => (i * 37) & 255);
    const back = decodePng(encodePng(rgb, 7, 5));
    expect([back.w, back.h]).toEqual([7, 5]);
    expect(Array.from(back.rgb)).toEqual(Array.from(rgb));
    const rgba = Buffer.from(encodePng(rgb, 7, 5));
    rgba[25] = 6; // colour type RGBA in IHDR
    expect(() => decodePng(rgba)).toThrow('not an 8-bit RGB PNG');
  });

  it('the nation count of a scenario is the number alive when its sim starts', () => {
    const living = (id: ScenarioId): number => {
      const w = new Sim(id === '1938' ? { scenario: id, seed: 1, assets: assets1938(SIZE_1938.w) } : { scenario: id, seed: 1 }).world;
      let n = 0;
      for (let i = 1; i <= w.nations.count; i++) n += w.nations.cols.living[i]!;
      return n;
    };
    expect(SCENARIO_INFO['1938'].nations).toBe(living('1938'));
    expect(SCENARIO_INFO.toy.nations).toBe(living('toy'));
  });
});
