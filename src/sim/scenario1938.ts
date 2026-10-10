/**
 * The 1938 world (PLAN 1.9a): the map build chain (`buildPoliticalMap`) over the shipped earth
 * assets at the scenario's map size, turned into sim state: cell layers (owner, controller,
 * terrain, province), the nation table (id = index + 1 in nations.json), cities and the
 * starting order of battle. Static facts (names, traits, templates) stay in scenario data and
 * are looked up by id; only what changes during play is state.
 */
import earthMap from '../../data/maps/earth/map.json' with { type: 'json' };
import earthIce from '../../data/maps/earth/ice.json' with { type: 'json' };
import earthPassages from '../../data/maps/earth/passages.json' with { type: 'json' };
import earthSeas from '../../data/maps/earth/seas.json' with { type: 'json' };
import type { SeaPassage } from './nav/lanes';
import type { SeaSeed } from './nav/seaZones';
import earthStraits from '../../data/maps/earth/straits.json' with { type: 'json' };
import combatJson from '../../data/combat.json' with { type: 'json' };
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import fleets1938 from '../../data/scenarios/1938/fleets.json' with { type: 'json' };
import ports1938 from '../../data/scenarios/1938/ports.json' with { type: 'json' };
import nations1938 from '../../data/scenarios/1938/nations.json' with { type: 'json' };
import oob1938 from '../../data/scenarios/1938/oob.json' with { type: 'json' };
import ownership1938 from '../../data/scenarios/1938/ownership.json' with { type: 'json' };
import scenario1938 from '../../data/scenarios/1938/scenario.json' with { type: 'json' };
import techAir from '../../data/tech/air.json' with { type: 'json' };
import techArmor from '../../data/tech/armor.json' with { type: 'json' };
import techElectronics from '../../data/tech/electronics.json' with { type: 'json' };
import techIndustry from '../../data/tech/industry.json' with { type: 'json' };
import techLand from '../../data/tech/land.json' with { type: 'json' };
import techNaval from '../../data/tech/naval.json' with { type: 'json' };
import techNuclear from '../../data/tech/nuclear.json' with { type: 'json' };
import templatesLand from '../../data/templates/land.json' with { type: 'json' };
import templatesSea from '../../data/templates/sea.json' with { type: 'json' };
import unitsLand from '../../data/units/land.json' with { type: 'json' };
import unitsSea from '../../data/units/sea.json' with { type: 'json' };
import diplomacy1938 from '../../data/scenarios/1938/diplomacy.json' with { type: 'json' };
import economy1938 from '../../data/scenarios/1938/economy.json' with { type: 'json' };
import traitsJson from '../../data/traits/traits.json' with { type: 'json' };
import { decodeAdmin1, type Admin1Meta } from '../shared/admin1';
import { addIslet } from '../shared/landMask';
import type { ScenarioAssets } from '../shared/protocol';
import { TERRAIN_IDS, type TerrainId } from '../shared/terrain';
import { dayOfIso } from '../shared/calendar';
import type { CityDef, PlacedCity } from './data/cities';
import { placeFleets, type FleetGroup } from './data/fleets';
import { placePorts, portWater, type PortRules } from './data/ports';
import { templateStrength, type OobGroup, type PlacedFormation, type TemplateDef, type UnitTypeLite } from './data/oob';
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
import { PRODUCTION_COST_SCALE, SHIP_TIME_SCALE, TRAIN_TIME_SCALE } from './systems/production';
import type { CeMode } from './systems/efficiency';
import { Mobility } from './nav/grid';
import { grantStartTechs, MAX_TECHS, techClosure, type TechRule } from './tech';
import { Domain, type DomainId, type ScenarioRules } from './world';
import { sin } from './core/dmath';
import { millerLat, Y_TOP } from './data/projection';
import { World } from './world';

export const NATIONS_1938 = nations1938.nations as unknown as NationDef[];
export const TEMPLATES_LAND = templatesLand.templates as TemplateDef[];
export const TEMPLATES_SEA = templatesSea.templates as TemplateDef[];
/** Every template of the rules, by its index: the land's, then the sea's (PLAN 4.2a). A formation and an order are saved with it. */
export const TEMPLATES_1938: readonly TemplateDef[] = [...TEMPLATES_LAND, ...TEMPLATES_SEA];
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

type UnitDef = UnitTypeLite & {
  mobility: string;
  techReq?: string;
  cost: { gold: number; manpower: number; days: number };
  upkeep: { gold: number };
  stats: { soft: number; hard: number; armor: number; piercing: number; hpPerUnit: number; fuelPerHour: number; speed_kmh: number; range_km: number; detection: number; stealth: number; torpedo?: number; torpedo_km?: number; asw?: number };
  terrainMods: Partial<Record<TerrainId, { atk: number; def: number; speed: number }>>;
};
/** The unit types of the rules, by their index: the land's, then the sea's (PLAN 4.2a). An element is saved with its type's index. */
const UNITS: readonly UnitDef[] = [...(unitsLand.types as unknown as UnitDef[]), ...(unitsSea.types as unknown as UnitDef[])];
const unitTypes = new Map(UNITS.map((u) => [u.id, u]));
const tankTypes = new Set(UNITS.filter((u) => u.class.startsWith('armor')).map((u) => u.id));
const upkeepOfElements = (t: TemplateDef, only?: ReadonlySet<string>): number => t.elements.reduce((s, e) => s + (only && !only.has(e.type) ? 0 : unitTypes.get(e.type)!.upkeep.gold * e.count), 0);
/** Template tables for the economy (upkeep, full strength and the tanks' share of the upkeep per template index). */
export const ECONOMY_TABLES_1938: EconomyTables = {
  templateUpkeep: TEMPLATES_1938.map((t) => upkeepOfElements(t)),
  templateStrength: TEMPLATES_1938.map((t) => templateStrength(t, unitTypes).men),
  templateArmour: TEMPLATES_1938.map((t) => upkeepOfElements(t, tankTypes) / (upkeepOfElements(t) || 1)),
};
const SUPPORT = new Set(['art', 'at', 'aa']);
const DOMAINS: Record<string, DomainId> = Domain;
/**
 * A formation moves like its slowest manoeuvre element (infantry, cavalry, motorised, mechanised,
 * armour): foot if any walks, else tracked if any is tracked, else motor. Support guns (artillery,
 * AT, AA) are towed or carried by the formation's own transport, so they do not slow it. The same
 * elements give it its share of that speed on each ground (PLAN 3.3b): the least of theirs.
 * A fleet (PLAN 4.2a) sails at the pace of its slowest ship; its mobility class is the land
 * grid's and is not read.
 */
function templateMobility(t: TemplateDef): { domain: DomainId; mobility: number; speedKmh: number; terrainSpeed: number[]; fuel: number } {
  const all = t.elements.map((e) => unitTypes.get(e.type)!);
  const domain = DOMAINS[all[0]!.domain]!;
  if (all.some((u) => DOMAINS[u.domain] !== domain)) throw new Error(`template ${t.id}: units of more than one domain`);
  const manoeuvre = all.filter((u) => !SUPPORT.has(u.class));
  const els = manoeuvre.length > 0 ? manoeuvre : all;
  const mobility = els.some((u) => u.mobility === 'foot') ? Mobility.foot : els.some((u) => u.mobility === 'tracked') ? Mobility.tracked : Mobility.motor;
  const fuel = t.elements.reduce((s, e) => s + unitTypes.get(e.type)!.stats.fuelPerHour * e.count, 0);
  const terrainSpeed = TERRAIN_IDS.map((g) => Math.min(...els.map((u) => u.terrainMods[g]?.speed ?? 1)));
  return { domain, mobility, speedKmh: Math.min(...els.map((u) => u.stats.speed_kmh)), terrainSpeed, fuel };
}
const unitIndex = new Map(UNITS.map((u, i) => [u.id, i]));
/** The id of each unit type by its index in `RULES_1938.units` (its name is the i18n key `unit.<id>`). */
export const UNIT_IDS_1938: readonly string[] = UNITS.map((u) => u.id);
/** Template indices of the economic AI's build mix (PLAN 1.26). */
export const BUILD_MIX_1938 = {
  infantry: TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div'),
  cadre: TEMPLATES_LAND.findIndex((t) => t.id === 'infantry_div_cadre'),
  motorised: TEMPLATES_LAND.findIndex((t) => t.id === 'motorised_div'),
  armour: ['mbt_div', 'heavy_panzer_div', 'panzer_div_2', 'panzer_div'].map((id) => TEMPLATES_LAND.findIndex((t) => t.id === id)),
};
/**
 * The tech tree (PLAN 3.1a), the files in the order of the schema's categories. A tech's place
 * here is its bit in a nation's state: a tech put in before the last one moves the bits of
 * those after it, and a save from before then means other techs by them.
 */
const TECH_DEFS = [techIndustry, techLand, techArmor, techNaval, techAir, techElectronics, techNuclear].flatMap((f) => f.techs as { id: string; category: string; year: number; cost: { gold: number; days: number }; prereqs: string[] }[]);
if (TECH_DEFS.length > MAX_TECHS) throw new Error(`${TECH_DEFS.length} techs: a nation's techs are ${MAX_TECHS} bits`);
const techIndex = new Map(TECH_DEFS.map((t, i) => [t.id, i]));
const TECHS_1938: readonly TechRule[] = TECH_DEFS.map((t) => ({ id: t.id, year: t.year, prereqs: t.prereqs.map((p) => techIndex.get(p)!), category: t.category, gold: t.cost.gold, days: t.cost.days }));
/** Tech indices the nation table gives a nation at the start, by nation id. */
const GIVEN_TECHS_1938 = new Map(NATIONS_1938.flatMap((n, i) => (n.techs ? [[i + 1, n.techs.map((t) => techIndex.get(t)!)] as const] : [])));
/** The arm of a unit class, as a bit: infantry 1, artillery 2, armour 4 (`ARM_ALL`), the AT guns 8 (`ARM_AT`). */
const ARM_OF_CLASS = new Map<string, number>([combatJson.combinedArms.arms.infantry, combatJson.combinedArms.arms.artillery, combatJson.combinedArms.arms.armour, combatJson.gunsOnGuns.shooter].flatMap((classes, i) => classes.map((c) => [c, 1 << i] as const)));
export const RULES_1938: ScenarioRules = {
  namedNations: NATIONS_1938.length,
  techs: TECHS_1938,
  units: UNITS.map((u) => ({
    cls: u.class,
    domain: DOMAINS[u.domain]!,
    size: u.elementSize,
    menPerUnit: u.cost.manpower / u.elementSize,
    soft: u.stats.soft,
    hard: u.stats.hard,
    armor: u.stats.armor,
    piercing: u.stats.piercing,
    hpPerUnit: u.stats.hpPerUnit,
    fuel: u.stats.fuelPerHour,
    rangeKm: u.stats.range_km,
    detection: u.stats.detection,
    stealth: u.stats.stealth,
    torpedo: u.stats.torpedo ?? 0,
    torpedoKm: u.stats.torpedo_km ?? 0,
    asw: u.stats.asw ?? 0,
    terrainAtk: TERRAIN_IDS.map((t) => u.terrainMods[t]?.atk ?? 1),
    terrainDef: TERRAIN_IDS.map((t) => u.terrainMods[t]?.def ?? 1),
    arm: ARM_OF_CLASS.get(u.class) ?? 0,
  })),
  templates: TEMPLATES_1938.map((t) => ({
    ...templateMobility(t),
    elements: t.elements.map((e) => ({ unit: unitIndex.get(e.type)!, count: e.count })),
    techs: techClosure(
      TECHS_1938,
      t.elements.flatMap((e) => {
        const req = unitTypes.get(e.type)!.techReq;
        return req === undefined ? [] : [techIndex.get(req)!];
      }),
    ),
    gold: PRODUCTION_COST_SCALE * t.elements.reduce((s, e) => s + unitTypes.get(e.type)!.cost.gold * e.count, 0),
    manpower: t.elements.reduce((s, e) => s + unitTypes.get(e.type)!.cost.manpower * e.count, 0),
    // A fleet's ships are built side by side in its nation's yards, each in its own days (PLAN 4.2e).
    days: (unitTypes.get(t.elements[0]!.type)!.domain === 'sea' ? SHIP_TIME_SCALE : TRAIN_TIME_SCALE) * Math.max(...t.elements.map((e) => unitTypes.get(e.type)!.cost.days)),
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
/** The ports and naval bases of the 1938 scenario (PLAN 4.1c). */
export const PORTS_1938 = ports1938 as unknown as PortRules;
/** The fleets of the 1938 start (PLAN 4.2b). */
export const FLEETS_1938 = fleets1938.groups as unknown as FleetGroup[];

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

/** A scenario file's settings, as far as the world has them (review in PLAN 1.41: only revoltMode was read before). */
export function applyScenarioSettings(world: World, set: (typeof scenario1938)['settings']): void {
  world.settings.revoltMode = set.revoltMode as 'province' | 'region';
  world.settings.ceMode = set.combatEfficiency as CeMode;
  world.settings.winnerTakesAll = set.winnerTakesAll;
  world.settings.loopingMap = set.loopingMap;
  world.settings.aiEnabled = set.aiEnabled;
}

/** The placed cities as rows of the world, in their order; a capital gives its nation its place. They keep their index into cities.json (`def`), so names resolve without state. */
export function addCities(world: World, cities: readonly PlacedCity[]): void {
  world.cities.reserve(cities.length);
  const cc = world.cities.cols;
  const n = world.nations.cols;
  for (const p of cities) {
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
}

/** The placed formations of the start as rows of the world, in their order: on sure land, whole, in supply. */
export function addFormations(world: World, formations: readonly PlacedFormation[]): void {
  const templateIndex = new Map(TEMPLATES_LAND.map((t, i) => [t.id, i]));
  world.formations.reserve(formations.length);
  const f = world.formations.cols;
  for (const p of formations) {
    const id = world.formations.create();
    const ti = templateIndex.get(p.template)!;
    f.nation[id] = p.nation;
    [f.x[id], f.y[id]] = world.standPoint(p.x, p.y);
    f.facing[id] = 0;
    f.template[id] = ti;
    f.supply[id] = 1;
    f.org[id] = 1;
    equipFormation(world, id, ti); // sets strength from the elements
  }
}

/**
 * The fleets of the start as rows of the world, after the land's (PLAN 4.2b): each group at the
 * water of its base (`portWater`, `placeFleets`), at a place of its cell that is water in the
 * fine mask (`World.seaPoint`); whole, in supply. `ports` are the rows of the scenario's
 * ports.json, by which the world's ports know their base (`Port.def`). It throws for a group
 * that found no water.
 */
export function addFleets(world: World, groups: readonly FleetGroup[], ports: PortRules, tags: readonly string[]): void {
  const { w, h, terrain } = world.cells;
  const wrapX = world.settings.loopingMap;
  const waterOf = new Map<string, number>();
  for (const p of world.ports) if (p.def >= 0) waterOf.set(ports.ports[p.def]!.name, portWater(p, terrain, w, h, world.portReach, wrapX));
  const placed = placeFleets({ w, h, terrain, wrapX, tags, groups, waterOf, stands: (cell) => world.seaPoint(cell) !== null });
  if (placed.unplaced.length) throw new Error(`fleets: ${placed.unplaced.map((i) => `${groups[i]!.nation} at ${groups[i]!.port}`).join(', ')} found no water`);
  const templateIndex = new Map(TEMPLATES_1938.map((t, i) => [t.id, i]));
  world.formations.reserve(world.formations.count + placed.fleets.length);
  const f = world.formations.cols;
  for (const p of placed.fleets) {
    const id = world.formations.create();
    const ti = templateIndex.get(p.template)!;
    f.nation[id] = p.nation;
    [f.x[id], f.y[id]] = world.seaPoint(p.cell)!;
    f.facing[id] = 0;
    f.template[id] = ti;
    f.supply[id] = 1;
    f.org[id] = 1;
    equipFormation(world, id, ti); // sets strength from the elements: a fleet's is its crews
  }
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
  world.seaSeeds = earthSeas.seas as unknown as SeaSeed[];
  world.seaPassages = earthPassages.passages as unknown as SeaPassage[];
  world.seaIce = earthIce.closed;
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

  addCities(world, map.cities);
  const placed = placePorts(PORTS_1938, map.cities, tags, map.owner, map.terrain, w, h);
  if (placed.unplaced.length) throw new Error(`1938 ports: ${placed.unplaced.map((i) => PORTS_1938.ports[i]!.name).join(', ')} found no land`);
  world.ports = placed.ports;
  world.portReach = PORTS_1938.reachCells;
  world.rules = RULES_1938;
  addFormations(world, map.formations);

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

  // Scenario settings seed the world's. Revolts by region keep the nation count in SPEC §10's
  // range (PLAN 1.40). The revival cooldown stays the code's REVIVAL_COOLDOWN; a unit test pins
  // the file to it.
  applyScenarioSettings(world, scenario1938.settings);
  // The fleets (PLAN 4.2b): after the settings, as their water is found on the map as it loops;
  // before the techs (a nation knows what its ships need) and the treasury (a navy is paid).
  addFleets(world, FLEETS_1938, PORTS_1938, tags);
  grantStartTechs(world, GIVEN_TECHS_1938);
  startTreasury(world);
  return world;
}
