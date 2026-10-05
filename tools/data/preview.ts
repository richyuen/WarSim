// Scenario previews (PLAN 1.43c): the political map of a scenario's start as a PNG for the title
// screen, `public/data/scenarios/<id>/preview.png`. Built from the shipped earth assets and the
// scenario data only, so `npm run data -- --previews` needs none of the pipeline's downloads.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { ScenarioAssets, ScenarioId } from '../../src/shared/protocol';
import { RANDOM_NATIONS, scenarioPreviewPath } from '../../src/shared/scenarios';
import { isLand } from '../../src/shared/terrain';
import { buildPoliticalMap } from '../../src/sim/data/politicalMap';
import { createRandomWorld } from '../../src/sim/randomWorld';
import { NATIONS_1938, politicalMapInput1938, SIZE_1938 } from '../../src/sim/scenario1938';
import { loadAssets1938 } from '../headless/assets';
import { decodePng, encodePng } from './png';

export const PREVIEW_W = 1024;
export const PREVIEW_H = 512;
/** The sea and the unowned land of the game's map (src/app/MapView.ts, src/render/map/mapShader.ts). */
export const SEA_RGB = [0x1d, 0x35, 0x57] as const;
export const UNOWNED_RGB = [158, 158, 148] as const;
const BORDER_RGB = [15, 15, 20] as const;

/**
 * A political map as RGB bytes (w·h·3): every land cell in the colour of the nation that holds it
 * (`colors[id]` = 0xRRGGBB), a dark line where the holder changes to the east or south, a darker
 * coast; x wraps.
 */
export function politicalPreviewRgb(w: number, h: number, holder: Uint16Array, terrain: Uint8Array, colors: readonly number[]): Uint8Array {
  const rgb = new Uint8Array(w * h * 3);
  const land = (x: number, y: number): boolean => y >= 0 && y < h && isLand(terrain[y * w + ((x + w) % w)]!);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      let c: readonly number[] = SEA_RGB;
      if (land(x, y)) {
        const id = holder[i]!;
        const col = colors[id];
        c = id === 0 || col === undefined ? UNOWNED_RGB : [(col >> 16) & 255, (col >> 8) & 255, col & 255];
        const east = y * w + ((x + 1) % w);
        const south = i + w;
        const border = (land(x + 1, y) && holder[east] !== id) || (land(x, y + 1) && holder[south] !== id);
        const coast = !land(x - 1, y) || !land(x + 1, y) || !land(x, y - 1) || !land(x, y + 1);
        if (border) c = c.map((v, k) => Math.round(v * 0.2 + BORDER_RGB[k]! * 0.8));
        else if (coast) c = c.map((v) => Math.round(v * 0.75));
      }
      rgb.set(c, i * 3);
    }
  }
  return rgb;
}

/** The 1938 scenario's start at the preview size, from the shipped assets. */
export function preview1938(): Uint8Array {
  const map = buildPoliticalMap(politicalMapInput1938(loadAssets1938(PREVIEW_W), PREVIEW_W, PREVIEW_H));
  return politicalPreviewRgb(PREVIEW_W, PREVIEW_H, map.controller, map.terrain, [0, ...NATIONS_1938.map((n) => parseInt(n.color.slice(1), 16))]);
}

/** The random world the title screen shows: one of them, the one this seed gives (ADR-110). */
export const PREVIEW_RANDOM_SEED = 7;

/**
 * A random world's start at the preview size: the world the game builds for `seed` and `nations`
 * (at the game's size, from `assets`), every second cell of every second row.
 */
export function previewRandom(assets: ScenarioAssets, seed = PREVIEW_RANDOM_SEED, nations: number = RANDOM_NATIONS.default): Uint8Array {
  const world = createRandomWorld(seed, nations, assets);
  const { w, h } = SIZE_1938;
  const step = w / PREVIEW_W;
  if (step !== Math.floor(step) || h / step !== PREVIEW_H) throw new Error(`the preview is not a whole fraction of ${w}×${h}`);
  const holder = new Uint16Array(PREVIEW_W * PREVIEW_H);
  const terrain = new Uint8Array(PREVIEW_W * PREVIEW_H);
  for (let y = 0; y < PREVIEW_H; y++) {
    for (let x = 0; x < PREVIEW_W; x++) {
      const from = y * step * w + x * step;
      holder[y * PREVIEW_W + x] = world.cells.controller[from]!;
      terrain[y * PREVIEW_W + x] = world.cells.terrain[from]!;
    }
  }
  const colors = [0];
  for (let id = 1; id <= world.nations.count; id++) colors.push(world.nations.cols.color[id]! & 0xffffff);
  return politicalPreviewRgb(PREVIEW_W, PREVIEW_H, holder, terrain, colors);
}

/** Repo-relative path of a scenario's preview (served from `public/`). */
export const previewPath = (scenario: ScenarioId): string => `public/${scenarioPreviewPath(scenario)}`;

/**
 * Writes the previews whose pixels changed (with `check`: writes nothing); returns the paths that
 * changed. Pixels are compared, not file bytes: a PNG's bytes depend on the zlib that packed it.
 */
export function writePreviews(root: string, check: boolean): string[] {
  const changed: string[] = [];
    const previews: [ScenarioId, Uint8Array][] = [
    ['1938', preview1938()],
    ['random', previewRandom(loadAssets1938(SIZE_1938.w))],
  ];
  for (const [scenario, rgb] of previews) {
    const rel = previewPath(scenario);
    const file = path.join(root, rel);
    const same = existsSync(file) && Buffer.from(decodePng(readFileSync(file)).rgb).equals(Buffer.from(rgb));
    if (same) continue;
    changed.push(rel);
    if (check) continue;
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, encodePng(rgb, PREVIEW_W, PREVIEW_H));
  }
  return changed;
}
