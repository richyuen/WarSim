/**
 * The 1938 world (PLAN 1.9a): the map build chain (`buildPoliticalMap`) over the shipped earth
 * assets at the scenario's map size, turned into sim state: cell layers (owner, controller,
 * terrain, province), the nation table (id = index + 1 in nations.json), cities and the
 * starting order of battle. Static facts (names, traits, templates) stay in scenario data and
 * are looked up by id; only what changes during play is state.
 */
import earthMap from '../../data/maps/earth/map.json' with { type: 'json' };
import earthStraits from '../../data/maps/earth/straits.json' with { type: 'json' };
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import nations1938 from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import oob1938 from '../../data/scenarios/1938/oob.json' with { type: 'json' };
import ownership1938 from '../../data/scenarios/1938/ownership.json' with { type: 'json' };
import scenario1938 from '../../data/scenarios/1938/scenario.json' with { type: 'json' };
import templatesLand from '../../data/templates/land.json' with { type: 'json' };
import unitsLand from '../../data/units/land.json' with { type: 'json' };
import economy1938 from '../../data/scenarios/1938/economy.json' with { type: 'json' };
import traitsJson from '../../data/traits/traits.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Meta } from '../shared/admin1';
import type { ScenarioAssets } from '../shared/protocol';
import { dayOfIso } from '../shared/calendar';
import type { CityDef } from './data/cities';
import { templateStrength, type OobGroup, type TemplateDef, type UnitTypeLite } from './data/oob';
import type { OwnershipRules } from './data/ownership';
import { buildPoliticalMap, type PoliticalMapInput } from './data/politicalMap';
import type { NationDef } from './data/schemas';
import type { StraitDef } from './data/terrain';
import { cellWeight, ECON_PER_BN, industrialCapacity, monthlyAccounts, type EconomyTables } from './systems/economy';
import { sin } from './core/dmath';
import { millerLat, Y_TOP } from './data/projection';
import { World } from './world';

export const NATIONS_1938 = nations1938.nations as unknown as NationDef[];
export const TEMPLATES_LAND = templatesLand.templates as TemplateDef[];
/** Starting treasury in months of gross income (ADR-22). */
export const START_GOLD_MONTHS = 6;

const unitTypes = new Map((unitsLand.types as unknown as UnitTypeLite[]).map((u) => [u.id, u]));
const unitUpkeep = new Map((unitsLand.types as unknown as { id: string; upkeep: { gold: number } }[]).map((u) => [u.id, u.upkeep.gold]));
/** Template tables for the economy (upkeep and full strength per template index). */
export const ECONOMY_TABLES_1938: EconomyTables = {
  templateUpkeep: TEMPLATES_LAND.map((t) => t.elements.reduce((s, e) => s + (unitUpkeep.get(e.type) ?? 0) * e.count, 0)),
  templateStrength: TEMPLATES_LAND.map((t) => templateStrength(t, unitTypes).men),
};
const traitIncome = new Map((traitsJson.traits as { id: string; modifiers: { income?: number } }[]).map((t) => [t.id, t.modifiers.income ?? 0]));

const sizeId = scenario1938.size ?? earthMap.defaultSize;
const size = earthMap.sizes.find((s) => s.id === sizeId)!;
/** Map size of the 1938 scenario (M by default). */
export const SIZE_1938 = { w: size.w, h: size.h };

function parseColor(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

/**
 * Cell industrial output (PLAN 1.9, ADR-22): each NE admin-0 unit's industrial capacity
 * (economy.json GDP × (GDP per head / US)^INDUSTRY_EXP) spread over its land cells by
 * `cellWeight`. Units without a GDP entry are estimated from their weight at the default GDP
 * per head, relative to the listed units.
 */
function fillEconomy(world: World, meta: readonly Admin1Meta[], cities: readonly { cell: number; size: number }[]): void {
  const { w, h, terrain, province, econ } = world.cells;
  const zone = (r: number): number => sin(millerLat(Y_TOP - (r / h) * Math.PI)) - sin(millerLat(Y_TOP - ((r + 1) / h) * Math.PI));
  const equatorZone = zone(Math.floor((h * Y_TOP) / Math.PI));
  const rowArea = new Float64Array(h);
  for (let r = 0; r < h; r++) rowArea[r] = zone(r) / equatorZone;
  const citySize = new Uint8Array(w * h);
  for (const p of cities) citySize[p.cell] = Math.max(citySize[p.cell]!, p.size);
  // Country index per province (adm0 codes sorted for a stable order).
  const adm0s = [...new Set(meta.map((m) => m.adm0))].sort();
  const countryOf = new Map(adm0s.map((a, i) => [a, i]));
  const provCountry = new Int32Array(meta.length + 1).fill(-1);
  meta.forEach((m, i) => (provCountry[i + 1] = countryOf.get(m.adm0)!));
  const weight = new Float64Array(w * h);
  const countryWeight = new Float64Array(adm0s.length);
  for (let i = 0; i < w * h; i++) {
    const k = provCountry[province[i]!]!;
    if (terrain[i]! < 2 || k < 0) continue;
    weight[i] = cellWeight(terrain[i]!, rowArea[Math.floor(i / w)]!, citySize[i]!);
    countryWeight[k]! += weight[i]!;
  }
  const gdp = economy1938.gdp as Record<string, number>;
  const perCapita = economy1938.perCapita as Record<string, number>;
  const capacity = new Float64Array(adm0s.length);
  let listedCap = 0;
  let listedWeight = 0;
  adm0s.forEach((a, k) => {
    const g = gdp[a];
    if (g === undefined) return;
    capacity[k] = industrialCapacity(g, perCapita[a] ?? economy1938.defaultPerCapita, economy1938.usPerCapita);
    listedCap += capacity[k]!;
    listedWeight += countryWeight[k]!;
  });
  // Unlisted units: capacity per unit of weight scaled from the listed average to default GDP per head.
  const perWeight = (listedCap / listedWeight) * industrialCapacity(1, economy1938.defaultPerCapita, economy1938.usPerCapita);
  adm0s.forEach((a, k) => {
    if (gdp[a] === undefined) capacity[k] = countryWeight[k]! * perWeight;
  });
  for (let i = 0; i < w * h; i++) {
    const k = provCountry[province[i]!]!;
    if (weight[i] === 0 || k < 0 || countryWeight[k] === 0) continue;
    econ[i] = Math.round(((weight[i]! / countryWeight[k]!) * capacity[k]! * ECON_PER_BN));
  }
}

export const TAGS_1938 = NATIONS_1938.map((n) => n.tag);

/** Inputs of the 1938 map build chain at w×h (shared by the sim world and the worker's views). */
export function politicalMapInput1938(assets: ScenarioAssets, w: number, h: number): PoliticalMapInput {
  return {
    w,
    h,
    geo: decodeAdmin1(assets.admin1Geometry),
    meta: JSON.parse(new TextDecoder().decode(assets.admin1Meta)) as Admin1Meta[],
    terrainRaw: assets.terrain,
    straits: earthStraits.straits as unknown as StraitDef[],
    tags: TAGS_1938,
    rules: ownership1938 as unknown as OwnershipRules,
    cities: cities1938.cities as unknown as CityDef[],
    oob: oob1938.groups as unknown as OobGroup[],
    overlordOf: new Map(NATIONS_1938.flatMap((n) => (n.overlord ? [[n.tag, n.overlord.tag] as const] : []))),
  };
}

export function createWorld1938(seed: number, assets: ScenarioAssets): World {
  const { w, h } = SIZE_1938;
  const world = new World(seed, w, h);
  world.startDay = dayOfIso(scenario1938.startDate);
  const tags = TAGS_1938;
  const input = politicalMapInput1938(assets, w, h);
  const meta = input.meta;
  const map = buildPoliticalMap(input);
  if (map.unplacedGroups.length) throw new Error(`1938 OOB: ${map.unplacedGroups.length} groups found no land`);
  const c = world.cells;
  c.owner.set(map.owner);
  c.controller.set(map.controller);
  c.terrain.set(map.terrain);
  c.province.set(map.provinceIds);

  fillEconomy(world, meta, map.cities);

  const cellsOf = new Uint32Array(tags.length + 1);
  for (const o of map.owner) cellsOf[o]!++;
  world.nations.reserve(NATIONS_1938.length);
  const n = world.nations.cols;
  NATIONS_1938.forEach((def, i) => {
    const id = world.nations.create();
    if (id !== i + 1) throw new Error('nation ids must follow nations.json order');
    n.color[id] = parseColor(def.color);
    n.cells[id] = cellsOf[id]!;
    n.living[id] = def.alive === false ? 0 : 1;
    n.incomeBonus[id] = def.incomeBonus;
    n.incomeMult[id] = 1 + def.traits.reduce((s, t) => s + (traitIncome.get(t) ?? 0), 0);
  });

  // Cities keep their index into cities.json (`def`), so names resolve without state.
  world.cities.reserve(map.cities.length);
  const cc = world.cities.cols;
  for (const p of map.cities) {
    const id = world.cities.create();
    cc.def[id] = p.def;
    cc.x[id] = p.x;
    cc.y[id] = p.y;
    cc.cell[id] = p.cell;
    cc.size[id] = p.size;
    cc.capitalOf[id] = p.capitalOf;
    if (p.capitalOf !== 0) {
      n.capitalX[p.capitalOf] = p.x;
      n.capitalY[p.capitalOf] = p.y;
    }
  }

  const templateIndex = new Map(TEMPLATES_LAND.map((t, i) => [t.id, i]));
  const menOf = ECONOMY_TABLES_1938.templateStrength;
  world.formations.reserve(map.formations.length);
  const f = world.formations.cols;
  for (const p of map.formations) {
    const id = world.formations.create();
    const ti = templateIndex.get(p.template)!;
    f.nation[id] = p.nation;
    f.x[id] = p.x;
    f.y[id] = p.y;
    f.facing[id] = 0;
    f.template[id] = ti;
    f.strength[id] = menOf[ti]!;
  }

  // Starting treasury: START_GOLD_MONTHS of gross income.
  const { gross } = monthlyAccounts(world, ECONOMY_TABLES_1938);
  world.nations.forEach((id) => {
    world.nations.cols.gold[id] = START_GOLD_MONTHS * gross[id]!;
  });
  return world;
}
