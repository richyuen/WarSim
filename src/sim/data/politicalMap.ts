/**
 * The scenario map build chain (PLAN 1.3–1.7) in one pure call, shared by the worker and Node:
 * admin-1 province raster → terrain + crossings → island reconciliation → ownership → cities →
 * starting order of battle.
 */
import type { Admin1Geometry, Admin1Meta } from '../../shared/admin1';
import { placeCities, type CityDef, type PlacedCity } from './cities';
import { placeOob, type OobGroup, type PlacedFormation } from './oob';
import { buildOwnership, reconcileIslands, type OwnershipRules } from './ownership';
import { buildProvinceRaster } from './provinces';
import { loadTerrain, type CrossingResult, type StraitDef } from './terrain';

export interface PoliticalMapInput {
  w: number;
  h: number;
  geo: Admin1Geometry;
  meta: readonly Admin1Meta[];
  /** Shipped terrain raster for w×h (gunzipped). */
  terrainRaw: Uint8Array;
  straits: readonly StraitDef[];
  /** Nation tags; nation id = index + 1. */
  tags: readonly string[];
  rules: OwnershipRules;
  cities: readonly CityDef[];
  oob: readonly OobGroup[];
  /** Overlord tag per puppet tag (formations may deploy on their puppets' land). */
  overlordOf: ReadonlyMap<string, string>;
}

export interface PoliticalMap {
  provinceIds: Uint16Array;
  terrain: Uint8Array;
  crossings: CrossingResult[];
  /** adm0 codes given a land cell by `reconcileIslands`. */
  islands: string[];
  owner: Uint16Array;
  controller: Uint16Array;
  cities: PlacedCity[];
  formations: PlacedFormation[];
  /** OOB groups that found no allowed land near their anchor (indices). */
  unplacedGroups: number[];
  unmappedCountries: string[];
  unknownProvinces: string[];
  regionCells: Record<string, number>;
}

export function buildPoliticalMap(inp: PoliticalMapInput): PoliticalMap {
  const { w, h, meta, tags } = inp;
  const pr = buildProvinceRaster(inp.geo, meta, w, h);
  const { terrain, crossings } = loadTerrain(inp.terrainRaw, w, h, inp.straits);
  const islands = reconcileIslands(terrain, pr.ids, meta, w, h);
  const own = buildOwnership({ w, h, provinceIds: pr.ids, provinces: meta, terrain, tags, rules: inp.rules });
  const cities = placeCities(inp.cities, tags, own.owner, w, h);
  const oob = placeOob({ w, h, owner: own.owner, controller: own.controller, terrain, tags, overlordOf: inp.overlordOf, groups: inp.oob });
  return { provinceIds: pr.ids, terrain, crossings, islands, ...own, cities, formations: oob.formations, unplacedGroups: oob.unplaced };
}
