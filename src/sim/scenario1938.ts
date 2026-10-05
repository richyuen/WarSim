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
import diplomacy1938 from '../../data/scenarios/1938/diplomacy.json' with { type: 'json' };
import economy1938 from '../../data/scenarios/1938/economy.json' with { type: 'json' };
import traitsJson from '../../data/traits/traits.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Meta } from '../shared/admin1';
import { addIslet } from '../shared/landMask';
import type { ScenarioAssets } from '../shared/protocol';
import { dayOfIso } from '../shared/calendar';
import type { CityDef } from './data/cities';
import { templateStrength, type OobGroup, type TemplateDef, type UnitTypeLite } from './data/oob';
import type { OwnershipRules } from './data/ownership';
import { buildPoliticalMap, type PoliticalMapInput } from './data/politicalMap';
import type { NationDef } from './data/schemas';
import type { StraitDef } from './data/terrain';
import { budgetOf } from './ai/economic';
import { cellWeight, ECON_PER_BN, industrialCapacity, MANPOWER_START_SHARE, monthlyAccounts, type EconomyTables } from './systems/economy';
import { equipFormation } from './systems/elements';
import { initProvinceCores } from './systems/revolts';
import { staticCe } from './systems/efficiency';
import { LOYALTY_BASE, LOYALTY_PER_AUTONOMY } from './systems/puppets';
import { PRODUCTION_COST_SCALE, TRAIN_TIME_SCALE } from './systems/production';
import type { CeMode } from './systems/efficiency';
import { Mobility } from './nav/grid';
import type { ScenarioRules } from './world';
import { sin } from './core/dmath';
import { millerLat, Y_TOP } from './data/projection';
import { World } from './world';

export const NATIONS_1938 = nations1938.nations as unknown as NationDef[];
export const TEMPLATES_LAND = templatesLand.templates as TemplateDef[];
/** Starting treasury in months of gross income (ADR-22). */
export const START_GOLD_MONTHS = 6;
/**
 * And not less than this many months of what the nation's budget is short with the army the
 * order of battle gives it (`budgetOf`; PLAN 2.13). Some thirty nations of 1938 have armies
 * their income does not carry (China's by half its income, Mongolia's by seven times), and for
 * 16 of them six months of income is less than a year of that: they begin with the money for
 * a year of their armies, and cut them as it runs out (`RUNWAY_MONTHS`), each cut a line in
 * the history. Before, they cut them in the first hour of the game.
 */
export const START_ARMY_MONTHS = 12;

const unitTypes = new Map((unitsLand.types as unknown as UnitTypeLite[]).map((u) => [u.id, u]));
const unitUpkeep = new Map((unitsLand.types as unknown as { id: string; upkeep: { gold: number } }[]).map((u) => [u.id, u.upkeep.gold]));
/** Template tables for the economy (upkeep and full strength per template index). */
export const ECONOMY_TABLES_1938: EconomyTables = {
  templateUpkeep: TEMPLATES_LAND.map((t) => t.elements.reduce((s, e) => s + (unitUpkeep.get(e.type) ?? 0) * e.count, 0)),
  templateStrength: TEMPLATES_LAND.map((t) => templateStrength(t, unitTypes).men),
};
/** Command rules: template cost and training time (PLAN 1.10, ADR-23). */
const unitCost = new Map((unitsLand.types as unknown as { id: string; cost: { gold: number; manpower: number; days: number } }[]).map((u) => [u.id, u.cost]));
const unitMove = new Map((unitsLand.types as unknown as { id: string; class: string; mobility: string; stats: { speed_kmh: number } }[]).map((u) => [u.id, u]));
const SUPPORT = new Set(['art', 'at', 'aa']);
/**
 * A formation moves like its slowest manoeuvre element (infantry, cavalry, motorised, mechanised,
 * armour): foot if any walks, else tracked if any is tracked, else motor. Support guns (artillery,
 * AT, AA) are towed or carried by the formation's own transport, so they do not slow it.
 */
function templateMobility(t: TemplateDef): { mobility: number; speedKmh: number } {
  const all = t.elements.map((e) => unitMove.get(e.type)!);
  const manoeuvre = all.filter((u) => !SUPPORT.has(u.class));
  const els = manoeuvre.length > 0 ? manoeuvre : all;
  const mobility = els.some((u) => u.mobility === 'foot') ? Mobility.foot : els.some((u) => u.mobility === 'tracked') ? Mobility.tracked : Mobility.motor;
  return { mobility, speedKmh: Math.min(...els.map((u) => u.stats.speed_kmh)) };
}
type UnitStats = { id: string; class: string; elementSize: number; cost: { manpower: number }; stats: { soft: number; hard: number; armor: number; piercing: number; hpPerUnit: number } };
const UNITS_LAND = unitsLand.types as unknown as UnitStats[];
const unitIndex = new Map(UNITS_LAND.map((u, i) => [u.id, i]));
/** The id of each unit type by its index in `RULES_1938.units` (its name is the i18n key `unit.<id>`). */
export const UNIT_IDS_1938: readonly string[] = UNITS_LAND.map((u) => u.id);
/** Template indices of the economic AI's build mix (PLAN 1.26). */
export const BUILD_MIX_1938 = {
  infantry: TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div'),
  cadre: TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div_cadre'),
  motorised: TEMPLATES_LAND.findIndex((t) => t.id === 'motorised_div'),
  panzer: TEMPLATES_LAND.findIndex((t) => t.id === 'panzer_div'),
};
export const RULES_1938: ScenarioRules = {
  units: UNITS_LAND.map((u) => ({
    cls: u.class,
    size: u.elementSize,
    menPerUnit: u.cost.manpower / u.elementSize,
    soft: u.stats.soft,
    hard: u.stats.hard,
    armor: u.stats.armor,
    piercing: u.stats.piercing,
    hpPerUnit: u.stats.hpPerUnit,
  })),
  templates: TEMPLATES_LAND.map((t) => ({
    ...templateMobility(t),
    elements: t.elements.map((e) => ({ unit: unitIndex.get(e.type)!, count: e.count })),
    gold: PRODUCTION_COST_SCALE * t.elements.reduce((s, e) => s + unitCost.get(e.type)!.gold * e.count, 0),
    manpower: t.elements.reduce((s, e) => s + unitCost.get(e.type)!.manpower * e.count, 0),
    days: TRAIN_TIME_SCALE * Math.max(...t.elements.map((e) => unitCost.get(e.type)!.days)),
  })),
};
const traitManpower = new Map((traitsJson.traits as { id: string; modifiers: { manpower?: number } }[]).map((t) => [t.id, t.modifiers.manpower ?? 0]));
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
export function fillEconomy(world: World, meta: readonly Admin1Meta[], cities: readonly { cell: number; size: number }[]): void {
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
  // Population (thousands) = GDP / GDP per head; unlisted units from their weight at the listed
  // average people per unit of weight.
  const people = new Float64Array(adm0s.length);
  let listedPeople = 0;
  adm0s.forEach((a, k) => {
    const g = gdp[a];
    if (g === undefined) return;
    people[k] = (g * 1e6) / (perCapita[a] ?? economy1938.defaultPerCapita);
    listedPeople += people[k]!;
  });
  adm0s.forEach((a, k) => {
    if (gdp[a] === undefined) people[k] = (countryWeight[k]! * listedPeople) / listedWeight;
  });
  const { pop } = world.cells;
  for (let i = 0; i < w * h; i++) {
    const k = provCountry[province[i]!]!;
    if (weight[i] === 0 || k < 0 || countryWeight[k] === 0) continue;
    const share = weight[i]! / countryWeight[k]!;
    econ[i] = Math.round(share * capacity[k]! * ECON_PER_BN);
    pop[i] = Math.round(share * people[k]!);
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

/** Starting treasury and manpower pool of every nation, from its land and the army it starts with. */
export function startTreasury(world: World): void {
  const accounts = monthlyAccounts(world, ECONOMY_TABLES_1938);
  const { gross, expenses, population } = accounts;
  world.nations.forEach((id) => {
    // The army of the start is paid for a year, whatever the income (PLAN 2.13): see START_ARMY_MONTHS.
    const { balance, need } = budgetOf(world, id, accounts);
    world.nations.cols.gold[id] = Math.max(START_GOLD_MONTHS * gross[id]!, START_ARMY_MONTHS * Math.max(0, need - balance));
    // Known before the first economy month (income map mode PLAN 1.30, economy panel PLAN 1.31a).
    world.nations.cols.income[id] = gross[id]!;
    world.nations.cols.expenses[id] = expenses[id]!;
    world.nations.cols.manpower[id] = MANPOWER_START_SHARE * population[id]!;
  });
}

export function createWorld1938(seed: number, assets: ScenarioAssets): World {
  const { w, h } = SIZE_1938;
  const world = new World(seed, w, h);
  world.landMask = assets.landMask ?? null;
  world.startDay = dayOfIso(scenario1938.startDate);
  const tags = TAGS_1938;
  const input = politicalMapInput1938(assets, w, h);
  const meta = input.meta;
  const map = buildPoliticalMap(input);
  // An island territory smaller than a cell was given a land cell (`reconcileIslands`); where it
  // is smaller than a pixel of the fine mask too, the mask has only sea there, and whatever
  // stood in the cell stood in the water of the picture. Such a cell gets an islet (PLAN
  // 2.15e2b, ADR-105). In the mask the world was given: the worker draws the coast from it.
  if (world.landMask) for (const cell of map.islandCells) addIslet(world.landMask, w, cell % w, Math.floor(cell / w));
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
    n.manpowerMult[id] = 1 + def.traits.reduce((s, t) => s + (traitManpower.get(t) ?? 0), 0);
    if (def.overlord) {
      n.overlord[id] = tags.indexOf(def.overlord.tag) + 1;
      n.autonomy[id] = def.overlord.autonomy;
      n.loyalty[id] = LOYALTY_BASE + LOYALTY_PER_AUTONOMY * def.overlord.autonomy;
    }
    n.fightToDeath[id] = def.fightToDeath ? 1 : 0;
    n.ceStatic[id] = staticCe(def.aggression);
    n.aggression[id] = def.aggression;
    n.efficiency[id] = 1;
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
  world.rules = RULES_1938;
  world.formations.reserve(map.formations.length);
  const f = world.formations.cols;
  for (const p of map.formations) {
    const id = world.formations.create();
    const ti = templateIndex.get(p.template)!;
    f.nation[id] = p.nation;
    [f.x[id], f.y[id]] = world.standPoint(p.x, p.y);
    f.facing[id] = 0;
    f.template[id] = ti;
    f.supply[id] = 1;
    equipFormation(world, id, ti); // sets strength from the elements
  }

  // Province cores (rightful owners) for unrest and revolts (PLAN 1.19).
  initProvinceCores(
    world,
    NATIONS_1938.flatMap((n, i) => (n.extraCores ? [{ nation: i + 1, adm0: n.extraCores.countries ?? [], adm1: n.extraCores.provinces ?? [] }] : [])),
    meta,
  );
  world.nations.forEach((id) => (world.nations.cols.revivalsLeft[id] = scenario1938.settings.revival.maxPerNation));

  // Alliances and guarantees (diplomacy.json).
  for (const a of diplomacy1938.alliances) {
    world.alliances.create(tags.indexOf(a.leader) + 1, a.members.map((t) => tags.indexOf(t) + 1), a.nameKey, a.unity);
  }
  for (const g of diplomacy1938.guarantees) world.alliances.guarantees.push({ guarantor: tags.indexOf(g.guarantor) + 1, target: tags.indexOf(g.target) + 1 });

  // Wars in progress (diplomacy.json), started before tick 0 (scores and exhaustion build from it).
  for (const war of diplomacy1938.wars) {
    const a = war.attackers.map((t) => tags.indexOf(t) + 1);
    const d = war.defenders.map((t) => tags.indexOf(t) + 1);
    const ftd = (side: number[]): boolean => side.some((m) => world.nations.cols.fightToDeath[m] === 1);
    world.wars.start(a, d, 0, [ftd(a), ftd(d)]);
  }

  startTreasury(world);
  // Scenario settings seed the world's (review in PLAN 1.41: only revoltMode was read before).
  // Revolts by region keep the nation count in SPEC §10's range (PLAN 1.40). The revival
  // cooldown stays the code's REVIVAL_COOLDOWN; a unit test pins the file to it.
  const set = scenario1938.settings;
  world.settings.revoltMode = set.revoltMode as 'province' | 'region';
  world.settings.ceMode = set.combatEfficiency as CeMode;
  world.settings.winnerTakesAll = set.winnerTakesAll;
  world.settings.loopingMap = set.loopingMap;
  world.settings.aiEnabled = set.aiEnabled;
  return world;
}
