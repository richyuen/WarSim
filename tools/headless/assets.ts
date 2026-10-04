/**
 * Node loader for the shipped earth assets (public/data/earth): for headless 1938 runs, the data
 * tools and the tests (`tests/helpers/earth.ts`). Mirrors the worker's AssetStore: manifest lookup
 * by kind (and width), gunzip.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { ScenarioAssets } from '../../src/shared/protocol';

export const EARTH_DIR = path.resolve(import.meta.dirname, '../../public/data/earth');

/**
 * The gunzipped bytes of the shipped file `name`. Read again when the gunzip fails: three times
 * in two days a full, parallel vitest run reported "incorrect data check" on an unchanged asset
 * whose sha256 another test confirmed in the same run, and reading it again succeeded (BLOCKERS,
 * 2026-10-04: not reproduced outside vitest, not explained).
 */
export function earthFile(name: string): Buffer {
  for (let attempt = 1; ; attempt++) {
    try {
      return gunzipSync(readFileSync(path.join(EARTH_DIR, name)));
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
}

let manifest: { assets: { path: string; kind: string; width: number }[] } | undefined;

/** The gunzipped bytes of the shipped asset of `kind` (and width, when given). */
export function earthAsset(kind: string, width?: number): Buffer {
  manifest ??= JSON.parse(readFileSync(path.join(EARTH_DIR, 'manifest.json'), 'utf8')) as { assets: { path: string; kind: string; width: number }[] };
  const a = manifest.assets.find((x) => x.kind === kind && (width === undefined || x.width === width));
  if (!a) throw new Error(`no earth asset ${kind}${width === undefined ? '' : ` @${width}`}`);
  return earthFile(a.path);
}

/** The assets the 1938 scenario needs at map width w. */
export function loadAssets1938(w: number): ScenarioAssets {
  return { admin1Geometry: new Uint8Array(earthAsset('admin1-geometry')), admin1Meta: new Uint8Array(earthAsset('admin1-meta')), terrain: new Uint8Array(earthAsset('terrain', w)) };
}
