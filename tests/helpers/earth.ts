// Node-side access to the shipped earth assets and the 1938 political map, shared by unit and
// e2e tests (the worker builds the same map from the same bytes via buildPoliticalMap).
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import straitsJson from '../../data/maps/earth/straits.json' with { type: 'json' };
import citiesJson from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import nationsJson from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import rulesJson from '../../data/scenarios/1938/ownership.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Geometry, type Admin1Meta } from '../../src/shared/admin1';
import type { CityDef } from '../../src/sim/data/cities';
import type { OwnershipRules } from '../../src/sim/data/ownership';
import { buildPoliticalMap, type PoliticalMap } from '../../src/sim/data/politicalMap';
import type { NationDef } from '../../src/sim/data/schemas';
import type { StraitDef } from '../../src/sim/data/terrain';

export const EARTH_DIR = path.resolve(import.meta.dirname, '../../public/data/earth');

interface ManifestAsset {
  path: string;
  kind: string;
  width: number;
}
const manifest = JSON.parse(readFileSync(path.join(EARTH_DIR, 'manifest.json'), 'utf8')) as { assets: ManifestAsset[] };

/** The gunzipped bytes of the shipped asset of `kind` (and width, when given). */
export function earthAsset(kind: string, width?: number): Buffer {
  const a = manifest.assets.find((x) => x.kind === kind && (width === undefined || x.width === width));
  if (!a) throw new Error(`no asset ${kind}${width === undefined ? '' : ` @${width}`}`);
  return gunzipSync(readFileSync(path.join(EARTH_DIR, a.path)));
}

let admin1: { geo: Admin1Geometry; meta: Admin1Meta[] } | undefined;
export function earthAdmin1(): { geo: Admin1Geometry; meta: Admin1Meta[] } {
  admin1 ??= { geo: decodeAdmin1(earthAsset('admin1-geometry')), meta: JSON.parse(earthAsset('admin1-meta').toString('utf8')) as Admin1Meta[] };
  return admin1;
}

export const STRAITS = straitsJson.straits as unknown as StraitDef[];
export const NATIONS_1938 = nationsJson.nations as unknown as NationDef[];
export const TAGS_1938 = NATIONS_1938.map((n) => n.tag);
export const RULES_1938 = rulesJson as unknown as OwnershipRules;
export const CITIES_1938 = citiesJson.cities as unknown as CityDef[];

const maps = new Map<number, PoliticalMap>();
/** The 1938 political map at w×(w/2), built once per test file. */
export function politicalMap1938(w: number): PoliticalMap {
  let m = maps.get(w);
  if (!m) {
    const { geo, meta } = earthAdmin1();
    m = buildPoliticalMap({ w, h: w / 2, geo, meta, terrainRaw: new Uint8Array(earthAsset('terrain', w)), straits: STRAITS, tags: TAGS_1938, rules: RULES_1938, cities: CITIES_1938 });
    maps.set(w, m);
  }
  return m;
}
