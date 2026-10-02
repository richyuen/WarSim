/**
 * Node loader for the shipped earth assets (public/data/earth), for headless 1938 runs. Mirrors
 * the worker's AssetStore: manifest lookup by kind (and width), gunzip.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { ScenarioAssets } from '../../src/shared/protocol';

const EARTH_DIR = path.resolve(import.meta.dirname, '../../public/data/earth');

function asset(kind: string, width?: number): Uint8Array {
  const manifest = JSON.parse(readFileSync(path.join(EARTH_DIR, 'manifest.json'), 'utf8')) as { assets: { path: string; kind: string; width: number }[] };
  const a = manifest.assets.find((x) => x.kind === kind && (width === undefined || x.width === width));
  if (!a) throw new Error(`no earth asset ${kind}${width === undefined ? '' : ` @${width}`}`);
  return new Uint8Array(gunzipSync(readFileSync(path.join(EARTH_DIR, a.path))));
}

/** The assets the 1938 scenario needs at map width w. */
export function loadAssets1938(w: number): ScenarioAssets {
  return { admin1Geometry: asset('admin1-geometry'), admin1Meta: asset('admin1-meta'), terrain: asset('terrain', w) };
}
