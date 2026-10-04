// Node-side access to the shipped earth assets and the 1938 political map, shared by unit and
// e2e tests (the worker builds the same map from the same bytes via buildPoliticalMap).
import citiesJson from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import oobJson from '../../data/scenarios/1938/oob.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Geometry, type Admin1Meta } from '../../src/shared/admin1';
import type { CityDef } from '../../src/sim/data/cities';
import type { OobGroup } from '../../src/sim/data/oob';
import { buildPoliticalMap, type PoliticalMap } from '../../src/sim/data/politicalMap';
import { NATIONS_1938, politicalMapInput1938 } from '../../src/sim/scenario1938';
import type { ScenarioAssets } from '../../src/shared/protocol';
import { earthAsset, loadAssets1938 } from '../../tools/headless/assets';

// The loader itself (manifest lookup, gunzip with a retry) is the headless tools': one copy.
export { EARTH_DIR, earthAsset, earthFile } from '../../tools/headless/assets';

let admin1: { geo: Admin1Geometry; meta: Admin1Meta[] } | undefined;
export function earthAdmin1(): { geo: Admin1Geometry; meta: Admin1Meta[] } {
  admin1 ??= { geo: decodeAdmin1(earthAsset('admin1-geometry')), meta: JSON.parse(earthAsset('admin1-meta').toString('utf8')) as Admin1Meta[] };
  return admin1;
}

export { NATIONS_1938, TAGS_1938 } from '../../src/sim/scenario1938';
export const CITIES_1938 = citiesJson.cities as unknown as CityDef[];
export const OOB_1938 = oobJson.groups as unknown as OobGroup[];
export const OVERLORDS_1938: ReadonlyMap<string, string> = new Map(NATIONS_1938.flatMap((n) => (n.overlord ? [[n.tag, n.overlord.tag] as const] : [])));

/** The decoded map assets the 1938 world is built from, at map width w. */
export function assets1938(w: number): ScenarioAssets {
  return loadAssets1938(w);
}

const maps = new Map<number, PoliticalMap>();
/** The 1938 political map at w×(w/2), built once per test file. */
export function politicalMap1938(w: number): PoliticalMap {
  let m = maps.get(w);
  if (!m) {
    m = buildPoliticalMap(politicalMapInput1938(assets1938(w), w, w / 2));
    maps.set(w, m);
  }
  return m;
}
