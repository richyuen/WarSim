/**
 * The authoritative world state (SPEC §3). Everything here is serialized and hashed;
 * nothing outside this object influences a tick except queued commands.
 */
import { makeNavGrid, type NavGrid } from './nav/grid';
import { buildLaneGraph, portWaters, seaBasins, type LaneGraph, type SeaBasins, type SeaPassage } from './nav/lanes';
import { buildProvinceGraph, type CorridorRefusal, type ProvinceGraph } from './nav/provinceGraph';
import { buildSeaZones, type SeaSeed, type SeaZones } from './nav/seaZones';
import { buildAirZones, type AirZones } from './nav/airZones';
import type { Port } from './data/ports';
import type { Airbase } from './data/airbases';
import type { WingMission } from './systems/air';
import type { Sortie } from './systems/sorties';
import { isCommand, type Command, type LoggedCommand } from '../shared/commands';
import { FireLog, type EventKind } from '../shared/events';
import { xxhash32View } from './core/hash';
import { RngStreams } from './core/rng';
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';
import { Table } from './core/table';
import { Alliances } from './alliances';
import { Provinces } from './provinces';
import { Buffs } from './buffs';
import { Battles } from './battles';
import { History } from './history';
import { StatSeries } from './stats';
import { EditStack } from './editor';
import { CE_MODES, type CeMode } from './systems/efficiency';
import { Wars } from './wars';
import { LandCounts } from './landCounts';
import { borderChanged, scanBorder } from './border';
import type { TechMask, TechRule } from './tech';
import { cellInland, landPoint, landWay, maskField, maskSure, waterPoint, type LandMask } from '../shared/landMask';

export interface PendingCommand {
  seq: number;
  cmd: Command;
}

export const NATION_SCHEMA = {
  color: 'u32',
  capitalX: 'f64',
  capitalY: 'f64',
  /** Owned cells; maintained by World.setOwner. */
  cells: 'u32',
  /** 1 = exists on the map; 0 = dead (revivable through cores, PLAN 1.20). */
  living: 'u8',
  /** Treasury (PLAN 1.9); may go negative. */
  gold: 'f64',
  /** Last monthly gross income and expenses (economy panel, AI). */
  income: 'f64',
  expenses: 'f64',
  /** AoC-style income bonus, percent −100..100 (scenario / God Mode). */
  incomeBonus: 'i16',
  /** Multiplier from traits and techs (1 = none). */
  incomeMult: 'f64',
  /** 1 while bankrupt (gold below −BANKRUPT_MONTHS × gross income). */
  bankrupt: 'u8',
  /** Recruitable men (PLAN 1.10). */
  manpower: 'f64',
  /** Multiplier on manpower growth from traits (1 = none). */
  manpowerMult: 'f64',
  /** 1 = never accepts peace (scenario flag; sides inherit it at declaration). */
  fightToDeath: 'u8',
  /** Overlord nation id (0 = independent); puppets share their overlord's supply bloc. */
  overlord: 'u16',
  /** Puppet autonomy, loyalty and integration progress, 0..100 (PLAN 1.18). */
  autonomy: 'f64',
  loyalty: 'f64',
  integration: 'f64',
  /** Revolt suppression level 0..1 (PLAN 1.19) and, for a founded nation, its origin: the province of its capital when it was founded (PLAN 2.15b). */
  suppression: 'f64',
  origin: 'u32',
  /** For a founded nation, its people: the core of the land it rose on, before it became its own (PLAN 7.3c); 0 for a nation of the scenario. */
  people: 'u16',
  /** Revivals left and the earliest revival tick (PLAN 1.20); consecutive bankrupt months. */
  revivalsLeft: 'u8',
  /** Strategic AI (PLAN 1.24): aggression 0..100 (scenario; spawned nations get REBEL_AGGRESSION) and God switch-off. */
  aggression: 'u8',
  aiOff: 'u8',
  /** Formations ordered by the economic AI (PLAN 1.26: build-mix rotation). */
  builds: 'u32',
  /** Combat efficiency (PLAN 1.22): current value, scenario (static-mode) value, God lock. */
  efficiency: 'f64',
  ceStatic: 'f64',
  ceLocked: 'u8',
  revivalAt: 'u32',
  brokeMonths: 'u16',
  /** Men lost in combat and attrition, cumulative (PLAN 1.34b statistics). */
  casualties: 'f64',
  /** The techs it knows, a bit each (PLAN 3.1a, `sim/tech.ts`): bits 0..31 and 32..63 of the index into ScenarioRules.techs. */
  tech0: 'u32',
  tech1: 'u32',
  /** Research budget, gold per day (PLAN 3.1b, `systems/research.ts`); the economic AI sets it monthly. */
  research: 'f64',
} as const;

/** Research lines (PLAN 3.1b): one tech a nation is working on. */
export const RESEARCH_SCHEMA = {
  nation: 'u16',
  /** Index into ScenarioRules.techs. */
  tech: 'u16',
  /** Gold paid towards it so far. */
  paid: 'f64',
} as const;

/** Production queue rows (PLAN 1.10): one formation in training. */
export const PRODUCTION_SCHEMA = {
  nation: 'u16',
  /** Index into the scenario's template list. */
  template: 'u16',
  /** Day (ticks / 24) on whose 00:00 the formation is ready. */
  readyDay: 'u32',
} as const;

/** What a formation is of, by its template (PLAN 4.2a): a land formation, a fleet, an air wing. */
export const Domain = { land: 0, sea: 1, air: 2 } as const;
export type DomainId = (typeof Domain)[keyof typeof Domain];

/** Scenario rules the sim needs to apply commands (not state: fixed by the scenario). */
export interface TemplateRule {
  /** Of the land, or a fleet (PLAN 4.2a): all its elements are of the one domain. */
  domain: DomainId;
  /** Gold and manpower paid when queued. */
  gold: number;
  manpower: number;
  /** Training days. */
  days: number;
  /** Mobility class (nav/grid Mobility: 0 foot, 1 motor, 2 tracked; not read for a fleet) and march speed, km/h. */
  mobility: number;
  speedKmh: number;
  /**
   * Its share of that speed on each ground (PLAN 3.3b; `terrainMods.speed` of the unit data), by
   * terrain: the least of its manoeuvre elements', 1 where they have none. It multiplies the
   * pace the mobility class's move cost gives; the route is found by the move cost alone.
   */
  terrainSpeed: readonly number[];
  /** Fuel its elements burn in an hour on the march (PLAN 3.2b; `fuelPerHour` of the unit data × count). */
  fuel: number;
  /** Elements per unit type (PLAN 1.13): unit = index into ScenarioRules.units. */
  elements: readonly { unit: number; count: number }[];
  /** The techs a nation must know to raise it (PLAN 3.1a): those of its unit types, with their prerequisites. */
  techs: TechMask;
}

/** Combat-relevant unit type stats (PLAN 1.13; from data/units, per full element). */
export interface UnitRule {
  cls: string;
  /** Of the land, or a ship (PLAN 4.2a). */
  domain: DomainId;
  /** Men, guns or vehicles per element, and men per such unit (manpower ÷ elementSize). */
  size: number;
  menPerUnit: number;
  soft: number;
  hard: number;
  armor: number;
  piercing: number;
  hpPerUnit: number;
  /** Its fire at aircraft and its defence against them, a unit's (`aa`, `defense` of the unit data; read in the air, PLAN 5.3a). */
  aa: number;
  defense: number;
  /** An aircraft's bomb load, tons (`bomb_t` of the unit data, PLAN 5.5a); 0 for none. */
  bombT: number;
  /** Fuel an element of it burns in an hour on the march (`fuelPerHour` of the unit data). */
  fuel: number;
  /** Its guns' reach, km; how far it sees, km; how hard it is to see, 0..100 (`range_km`, `detection`, `stealth`; read at sea, PLAN 4.3a). */
  rangeKm: number;
  detection: number;
  stealth: number;
  /** Its torpedoes' damage an hour and reach, km, and its depth charges' damage at a submarine (PLAN 4.3b); 0 for none. */
  torpedo: number;
  torpedoKm: number;
  asw: number;
  /**
   * Its own figures for the ground (PLAN 3.3a; `terrainMods` of the unit data), by terrain, 1
   * where it has none: its fire at a target on that ground, and the fire it takes holding it.
   * They multiply the class's figures of `data/terrain.json`.
   */
  terrainAtk: readonly number[];
  terrainDef: readonly number[];
  /**
   * Its arm for the combined-arms rules (PLAN 3.4; `combinedArms.arms` and `gunsOnGuns.shooter`
   * of `data/combat.json`): a bit of `ARM_ALL`, or `ARM_AT`, 0 for a class of none.
   */
  arm: number;
}
/** Infantry 1, artillery 2, armour 4: a side of a battle with all three has the bonus. */
export const ARM_INFANTRY = 1;
export const ARM_ARTILLERY = 2;
export const ARM_ARMOUR = 4;
export const ARM_ALL = 7;
/** The AT guns (PLAN 3.4c): not one of the three arms. */
export const ARM_AT = 8;
export interface ScenarioRules {
  templates: readonly TemplateRule[];
  units: readonly UnitRule[];
  /** The tech tree (PLAN 3.1a); a tech's index is its bit in a nation's `tech0`/`tech1`. */
  techs: readonly TechRule[];
  /** Nations 1..n have a name in the scenario's nation table; a nation after them has the name in `World.names`, or that of the province it was founded in. */
  namedNations: number;
}

export const FORMATION_SCHEMA = {
  nation: 'u16',
  x: 'f64',
  y: 'f64',
  facing: 'f64',
  strength: 'u32',
  /** Index into the scenario's template list (0 for toy formations). */
  template: 'u16',
  /** Move order (PLAN 1.11): 1 while moving; path from originCell to targetCell (derived). */
  moving: 'u8',
  originCell: 'u32',
  targetCell: 'u32',
  /** Index of the last path cell reached, and the fraction of the way to the next one. */
  pathStep: 'u32',
  stepFrac: 'f64',
  /** Supply level 0..1 (PLAN 1.12). */
  supply: 'f64',
  /** Org 0..1 (PLAN 3.2c): its order; what moves on engines loses it with no supply. Combat reads it. */
  org: 'f64',
  /** 1 while in contact with an enemy (PLAN 1.13): holds position and fights. */
  engaged: 'u8',
  /** Hours of its retreat left (PLAN 3.5a): out of battles, of the fronts' pressure and of the AI's orders. 0 = none. */
  retreat: 'u8',
  /** 1 on a march home (PLAN 3.7h, ADR-169): `repatriationSystem`'s order, which crosses any nation's ground. Any other order and its arrival clear it. 2 on the walk back from a step that was barred in its middle (PLAN 3.7l, ADR-172). */
  home: 'u8',
} as const;

/** Authoritative unit proxies (SPEC §3.6, PLAN 1.13). */
export const ELEMENT_SCHEMA = {
  formation: 'u32',
  /** Position in the formation's slotted block. */
  slot: 'u16',
  /** Index into ScenarioRules.units. */
  unit: 'u16',
  /** Live men / guns / vehicles. */
  strength: 'u16',
  /** Damage carried towards the next lost unit (0..1 units). */
  wound: 'f64',
  /** Current target element (0 = none) and hours before re-targeting. */
  target: 'u32',
  cooldown: 'u8',
} as const;

/** Cities (PLAN 1.5/1.9a). Names and other static facts live in scenario data at `def`. */
export const CITY_SCHEMA = {
  /** Index into the scenario's cities.json. */
  def: 'u32',
  x: 'f64',
  y: 'f64',
  cell: 'u32',
  size: 'u8',
  /** Nation id whose capital this is (0 = none). */
  capitalOf: 'u16',
  /** Economy added to its cell when placed in the editor (removed with the city; PLAN 1.36). */
  econ: 'f64',
} as const;

/** Per-cell layers (SPEC §3.2), each of length W·H, row-major. */
export class CellLayers implements Stateful {
  readonly w: number;
  readonly h: number;
  owner: Uint16Array<ArrayBuffer>;
  controller: Uint16Array<ArrayBuffer>;
  terrain: Uint8Array<ArrayBuffer>;
  /** Admin-1 province id per cell (0 = none; SPEC §3.3). */
  province: Uint16Array<ArrayBuffer>;
  /** Industrial output per cell, $M per year (PLAN 1.9, systems/economy.ts). */
  econ: Uint32Array<ArrayBuffer>;
  /** Population per cell, thousands (PLAN 1.10: manpower). */
  pop: Uint32Array<ArrayBuffer>;
  /** Supply bloc whose network reaches the cell (0 = none; PLAN 1.12, refreshed every 6 h). */
  supply: Uint16Array<ArrayBuffer>;
  /** Consecutive hours an attacker has out-pressured the holder (PLAN 1.14). */
  flip: Uint8Array<ArrayBuffer>;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.owner = new Uint16Array(w * h);
    this.controller = new Uint16Array(w * h);
    this.terrain = new Uint8Array(w * h);
    this.province = new Uint16Array(w * h);
    this.econ = new Uint32Array(w * h);
    this.pop = new Uint32Array(w * h);
    this.supply = new Uint16Array(w * h);
    this.flip = new Uint8Array(w * h);
  }

  serialize(): Section[] {
    return [
      { name: 'cells.owner', dtype: 'u16', data: this.owner },
      { name: 'cells.controller', dtype: 'u16', data: this.controller },
      { name: 'cells.terrain', dtype: 'u8', data: this.terrain },
      { name: 'cells.province', dtype: 'u16', data: this.province },
      { name: 'cells.econ', dtype: 'u32', data: this.econ },
      { name: 'cells.pop', dtype: 'u32', data: this.pop },
      { name: 'cells.supply', dtype: 'u16', data: this.supply },
      { name: 'cells.flip', dtype: 'u8', data: this.flip },
    ];
  }

  deserialize(sections: readonly Section[]): void {
    const n = this.w * this.h;
    const owner = takeSection(sections, 'cells.owner', 'u16');
    const controller = takeSection(sections, 'cells.controller', 'u16');
    const terrain = takeSection(sections, 'cells.terrain', 'u8');
    const province = takeSection(sections, 'cells.province', 'u16');
    const econ = takeSection(sections, 'cells.econ', 'u32');
    const pop = takeSection(sections, 'cells.pop', 'u32');
    const supply = takeSection(sections, 'cells.supply', 'u16');
    const flip = takeSection(sections, 'cells.flip', 'u8');
    if (owner.length !== n || controller.length !== n || terrain.length !== n || province.length !== n || econ.length !== n || pop.length !== n || supply.length !== n || flip.length !== n) {
      throw new Error(`cell layers: expected ${n} cells`);
    }
    this.owner = owner.slice();
    this.controller = controller.slice();
    this.terrain = terrain.slice();
    this.province = province.slice();
    this.econ = econ.slice();
    this.pop = pop.slice();
    this.supply = supply.slice();
    this.flip = flip.slice();
  }
}

/** Side length of a dirty tile in cells (SPEC §2.4). */
export const TILE = 64;

/**
 * Derived, non-authoritative outputs of a tick: which 64×64 tiles changed and which events
 * happened. Never serialized or hashed; consumers (the snapshot server) drain them.
 */
export class TickOutputs {
  readonly tilesX: number;
  readonly tilesY: number;
  /** 1 = tile changed since the consumer last cleared it. */
  readonly dirtyTiles: Uint8Array;
  /** Flat [tick, kind, a, b, x, y] records since the consumer last drained. */
  events: number[] = [];
  /** Flat FIRE_STRIDE records [tick, subtick, shooter, target, unit, dmg, x0, y0, x1, y1] (SPEC §5.2.5). */
  readonly fires = new FireLog();

  constructor(w: number, h: number) {
    this.tilesX = Math.ceil(w / TILE);
    this.tilesY = Math.ceil(h / TILE);
    this.dirtyTiles = new Uint8Array(this.tilesX * this.tilesY);
  }

  markAllDirty(): void {
    this.dirtyTiles.fill(1);
  }

  /** The world's history log (state, PLAN 1.34a): historic kinds are recorded on emit. */
  history: History | null = null;

  emit(tick: number, kind: EventKind, a: number, b: number, x: number, y: number): void {
    this.events.push(tick, kind, a, b, x, y);
    this.history?.record(tick, kind, a, b, x, y);
  }
}


export const FIRE_STRIDE = 10;


/** Scalar globals + RNG + command log. */
class WorldCore implements Stateful {
  constructor(private readonly world: World) {}

  serialize(): Section[] {
    const w = this.world;
    const meta = new Float64Array([w.seed, w.tick, w.cells.w, w.cells.h, w.nextCommandSeq, w.startDay, w.settings.winnerTakesAll ? 1 : 0, w.settings.revoltMode === 'region' ? 1 : 0, CE_MODES.indexOf(w.settings.ceMode), w.settings.aiEnabled ? 0 : 1, w.settings.player, w.settings.loopingMap ? 0 : 1, w.settings.nukesEnabled ? 0 : 1]);
    // Pending (queued, not yet applied) commands are saved too, so a save taken between
    // enqueue and the next tick boundary loses nothing.
    const log = new TextEncoder().encode(JSON.stringify({ log: w.commandLog, pending: w.pending }));
    const sorted = (m: Map<number, string>): [number, string][] => [...m].sort((a, b) => a[0] - b[0]);
    const flags = [...w.flags].sort((a, b) => a[0] - b[0]).map(([n, px]) => [n, Array.from(px)] as [number, number[]]);
    const names = new TextEncoder().encode(JSON.stringify({ nations: sorted(w.names), cities: sorted(w.cityNames), flags }));
    // The paths of the formations on the march, by id: id, length, cells (PLAN 3.4Rl: a path is
    // found on the holders of the hour of its order, so it is state).
    const marching = [...w.paths].filter(([id]) => w.formations.has(id) && w.formations.cols.moving[id] === 1).sort((a, b) => a[0] - b[0]);
    const paths = new Int32Array(marching.reduce((n, [, p]) => n + 2 + p.length, 0));
    let at = 0;
    for (const [id, p] of marching) {
      paths[at++] = id;
      paths[at++] = p.length;
      paths.set(p, at);
      at += p.length;
    }
    return [
      { name: 'world.meta', dtype: 'f64', data: meta },
      { name: 'world.rng', dtype: 'u32', data: w.rng.save() },
      { name: 'world.commandLog', dtype: 'u8', data: log },
      { name: 'world.names', dtype: 'u8', data: names },
      { name: 'world.paths', dtype: 'i32', data: paths },
      // The sea battles (PLAN 4.3c), each [n, fleets, ships, range, a, b, lostA, lostB, x, y]:
      // only while there is one, so a world with no sea battle saves and hashes as before.
      // The embarked (PLAN 4.5a): [id, fleet, land, water, target] each, only while there is one.
      // The air wings' missions (PLAN 5.1e): [id, kind (0 patrol, 1 strike), x, y] each, only while there is one.
      ...(w.wingMission.size === 0 ? [] : [{ name: 'world.wingMission', dtype: 'f64' as const, data: Float64Array.from([...w.wingMission].sort((a, b) => a[0] - b[0]).flatMap(([id, m]) => [id, m.kind === 'strike' ? 1 : m.kind === 'supply' ? 2 : 0, m.x, m.y])) }]),
      // The bombs' damage to industry (PLAN 5.5a): [cell, damage] each, only while there is some.
      ...(w.bombDamage.size === 0 ? [] : [{ name: 'world.bombDamage', dtype: 'f64' as const, data: Float64Array.from([...w.bombDamage].sort((a, b) => a[0] - b[0]).flat()) }]),
      // The bombs' damage to ports (PLAN 5.5b): [port, damage] each, only while there is some.
      ...(w.portDamage.size === 0 ? [] : [{ name: 'world.portDamage', dtype: 'f64' as const, data: Float64Array.from([...w.portDamage].sort((a, b) => a[0] - b[0]).flat()) }]),
      // The air power flown by zone (PLAN 5.3c): [zone, nation, power] each, only while there is some.
      ...(w.airPower.size === 0 ? [] : [{ name: 'world.airPower', dtype: 'f64' as const, data: Float64Array.from([...w.airPower].sort((a, b) => a[0] - b[0]).flatMap(([z, m]) => [...m].sort((a, b) => a[0] - b[0]).flatMap(([n, p]) => [z, n, p]))) }]),
      // The air wings' sorties (PLAN 5.2b): [id, bx, by, tx, ty, launch, kmh, km, over] each, only while there is one.
      ...(w.sorties.size === 0 ? [] : [{ name: 'world.sorties', dtype: 'f64' as const, data: Float64Array.from([...w.sorties].sort((a, b) => a[0] - b[0]).flatMap(([id, o]) => [id, o.bx, o.by, o.tx, o.ty, o.launch, o.kmh, o.km, o.over])) }]),
      // The air wings' bases (PLAN 5.1d): [id, base] each, only while there is one.
      ...(w.wingBase.size === 0 ? [] : [{ name: 'world.wingBase', dtype: 'f64' as const, data: Float64Array.from([...w.wingBase].sort((a, b) => a[0] - b[0]).flat()) }]),
      // A player's order over the sea marching to its port (PLAN 4.9b): [id, target] each, only while there is one.
      ...(w.seaBound.size === 0 ? [] : [{ name: 'world.seaBound', dtype: 'f64' as const, data: Float64Array.from([...w.seaBound].sort((a, b) => a[0] - b[0]).flat()) }]),
      // The fleets placed by the editor that hold their place (PLAN 7.22c): [id, x, y] each, only while there is one.
      ...(w.station.size === 0 ? [] : [{ name: 'world.station', dtype: 'f64' as const, data: Float64Array.from([...w.station].sort((a, b) => a[0] - b[0]).flatMap(([id, [x, y]]) => [id, x, y])) }]),
      ...(w.embarked.size === 0 ? [] : [{ name: 'world.embarked', dtype: 'f64' as const, data: Float64Array.from([...w.embarked].sort((a, b) => a[0] - b[0]).flatMap(([id, e]) => [id, e.fleet, e.land, e.water, e.target])) }]),
      // Sea control (PLAN 4.4a): [zones + 1, holders..., days...], only while a zone is held.
      ...(w.seaControl === null || !w.seaControl.holder.some((h) => h !== 0) ? [] : [{ name: 'world.seaControl', dtype: 'f64' as const, data: Float64Array.from([w.seaControl.holder.length, ...w.seaControl.holder, ...w.seaControl.days]) }]),
      ...(w.seaBattles.length === 0 ? [] : [{ name: 'world.seaBattles', dtype: 'f64' as const, data: Float64Array.from(w.seaBattles.flatMap((b) => [b.fleets.length, ...b.fleets, ...b.ships, b.range, b.a, b.b, b.lostA, b.lostB, b.x, b.y])) }]),
      // The month's air war (PLAN 5.11a): [fight, a, b, va, vb, x, y] each, only while there is one.
      ...(w.airMonth.length === 0 ? [] : [{ name: 'world.airMonth', dtype: 'f64' as const, data: Float64Array.from(w.airMonth.flatMap((t) => [t.fight, t.a, t.b, t.va, t.vb, t.x, t.y])) }]),
      // The nations barred from nuclear weapons (PLAN 6.1a), only while there is one.
      ...(w.nukesBanned.size === 0 ? [] : [{ name: 'world.nukesBanned', dtype: 'f64' as const, data: Float64Array.from([...w.nukesBanned].sort((a, b) => a - b)) }]),
      // The warheads in flight (PLAN 6.2): [next id, then id, nation, missile, wing, bx, by, tx, ty, launch, arrive each], only while there is one.
      ...(w.nukeLaunches.length === 0 && w.nextLaunchId === 1 ? [] : [{ name: 'world.nukeLaunches', dtype: 'f64' as const, data: Float64Array.from([w.nextLaunchId, ...w.nukeLaunches.flatMap((l) => [l.id, l.nation, l.missile, l.wing, l.bx, l.by, l.tx, l.ty, l.launch, l.arrive])]) }]),
      // Outrage (PLAN 6.5b): [nation, outrage] each, by nation, only while there is some.
      ...(w.nukeOutrage.size === 0 ? [] : [{ name: 'world.nukeOutrage', dtype: 'f64' as const, data: Float64Array.from([...w.nukeOutrage].sort((a, b) => a[0] - b[0]).flat()) }]),
      ...(w.nukeDead.size === 0 ? [] : [{ name: 'world.nukeDead', dtype: 'f64' as const, data: Float64Array.from([...w.nukeDead].sort((a, b) => a[0] - b[0]).flat()) }]),
      // The shock of a strike (PLAN 6.5a): [nation, exhaustion] each, by nation, only while there is one.
      ...(w.nukeShock.size === 0 ? [] : [{ name: 'world.nukeShock', dtype: 'f64' as const, data: Float64Array.from([...w.nukeShock].sort((a, b) => a[0] - b[0]).flat()) }]),
      // The last days' bursts (PLAN 6.11b): [x, y, tick] each, in the order they burst, only while there is one.
      ...(w.nukeBursts.length === 0 ? [] : [{ name: 'world.nukeBursts', dtype: 'f64' as const, data: Float64Array.from(w.nukeBursts.flatMap((b) => [b.x, b.y, b.tick])) }]),
      // Their classes (PLAN 7.20: 1 fission, 2 thermonuclear), a section of their own: a save without it is of fission bursts.
      ...(w.nukeBursts.length === 0 ? [] : [{ name: 'world.nukeBurstYields', dtype: 'u8' as const, data: Uint8Array.from(w.nukeBursts.map((b) => b.yieldN)) }]),
      // The launches that are strikes back (PLAN 6.12e): their ids, in order, only while there is one.
      ...(w.nukeAnswers.size === 0 ? [] : [{ name: 'world.nukeAnswers', dtype: 'f64' as const, data: Float64Array.from([...w.nukeAnswers].sort((a, b) => a - b)) }]),
      // Grievances (PLAN 6.4b): [nation, by, until] each, by nation, only while there is one.
      ...(w.nukeGrievance.size === 0 ? [] : [{ name: 'world.nukeGrievance', dtype: 'f64' as const, data: Float64Array.from([...w.nukeGrievance].sort((a, b) => a[0] - b[0]).flatMap(([n, g]) => [n, g.by, g.until])) }]),
      // The nuclear taboo (PLAN 6.4a), only while it is under 1.
      ...(w.nukeTaboo === 1 ? [] : [{ name: 'world.nukeTaboo', dtype: 'f64' as const, data: Float64Array.of(w.nukeTaboo) }]),
      // Fallout (PLAN 6.3b): [cell, level] each, by cell, only while there is some.
      ...(w.fallout.size === 0 ? [] : [{ name: 'world.fallout', dtype: 'f64' as const, data: Float64Array.from([...w.fallout].sort((a, b) => a[0] - b[0]).flat()) }]),
      // The warheads (PLAN 6.1b): [nation, stock, paid] each, only while there is one.
      ...(w.warheads.size === 0 ? [] : [{ name: 'world.warheads', dtype: 'f64' as const, data: Float64Array.from([...w.warheads].sort((a, b) => a[0] - b[0]).flatMap(([n, h]) => [n, h.stock, h.paid])) }]),
      // Each nation's air totals (PLAN 5.11b): [nation, lost, bombed] each, only while there is one.
      ...(w.airTotals.size === 0 ? [] : [{ name: 'world.airTotals', dtype: 'f64' as const, data: Float64Array.from([...w.airTotals].sort((a, b) => a[0] - b[0]).flatMap(([n, t]) => [n, t.lost, t.bombed])) }]),
    ];
  }

  deserialize(sections: readonly Section[]): void {
    const w = this.world;
    const meta = takeSection(sections, 'world.meta', 'f64');
    const [seed = 0, tick = 0, cw = 0, ch = 0, nextSeq = 0, startDay = 0, winnerTakesAll = 0, revoltRegion = 0, ceMode = 0, aiOff = 0, player = 0, noLoop = 0, nukesOff = 0] = meta;
    if (cw !== w.cells.w || ch !== w.cells.h) throw new Error(`map size mismatch: save ${cw}×${ch}, world ${w.cells.w}×${w.cells.h}`);
    w.seed = seed;
    w.tick = tick;
    w.nextCommandSeq = nextSeq;
    w.startDay = startDay;
    w.settings = { winnerTakesAll: winnerTakesAll === 1, revoltMode: revoltRegion === 1 ? 'region' : 'province', ceMode: CE_MODES[ceMode] ?? 'dynamic', aiEnabled: aiOff !== 1, player, loopingMap: noLoop !== 1, nukesEnabled: nukesOff !== 1 };
    w.rng.load(takeSection(sections, 'world.rng', 'u32'));
    const parsed = JSON.parse(new TextDecoder().decode(takeSection(sections, 'world.commandLog', 'u8'))) as {
      log: LoggedCommand[];
      pending: PendingCommand[];
    };
    w.commandLog = parsed.log;
    w.pending = parsed.pending;
    // God Mode names (PLAN 1.32); saves from before it have no section.
    const names = sections.find((s) => s.name === 'world.names');
    w.namesVersion++;
    // PLAN 1.32 saves hold a bare array of nation names; PLAN 1.36 adds city names.
    const nm = names ? (JSON.parse(new TextDecoder().decode(names.data as Uint8Array)) as [number, string][] | { nations: [number, string][]; cities: [number, string][]; flags?: [number, number[]][] }) : [];
    w.names = new Map(Array.isArray(nm) ? nm : nm.nations);
    w.cityNames = new Map(Array.isArray(nm) ? [] : nm.cities);
    w.flags = new Map((Array.isArray(nm) ? [] : (nm.flags ?? [])).map(([n, px]) => [n, Uint32Array.from(px)]));
    w.flagsVersion++;
    // Saves from before PLAN 3.4Rl have no paths: each is found again at its formation's next step.
    w.paths.clear();
    const paths = sections.find((s) => s.name === 'world.paths')?.data as Int32Array | undefined;
    for (let at = 0; paths && at < paths.length; at += 2 + paths[at + 1]!) w.paths.set(paths[at]!, paths.slice(at + 2, at + 2 + paths[at + 1]!));
    const control = sections.find((s) => s.name === 'world.seaControl')?.data as Float64Array | undefined;
    w.seaControl = control ? { holder: Uint16Array.from(control.subarray(1, 1 + control[0]!)), days: Uint8Array.from(control.subarray(1 + control[0]!, 1 + 2 * control[0]!)) } : null;
    w.seaLinks = new Map();
    w.seaBound = new Map();
    w.wingBase = new Map();
    w.bombDamage = new Map();
    const damage = sections.find((s) => s.name === 'world.bombDamage')?.data as Float64Array | undefined;
    for (let at = 0; damage && at < damage.length; at += 2) w.bombDamage.set(damage[at]!, damage[at + 1]!);
    w.portDamage = new Map();
    const shut = sections.find((s) => s.name === 'world.portDamage')?.data as Float64Array | undefined;
    for (let at = 0; shut && at < shut.length; at += 2) w.portDamage.set(shut[at]!, shut[at + 1]!);
    w.airPower = new Map();
    const power = sections.find((s) => s.name === 'world.airPower')?.data as Float64Array | undefined;
    for (let at = 0; power && at < power.length; at += 3) {
      const z = power[at]!;
      if (!w.airPower.has(z)) w.airPower.set(z, new Map());
      w.airPower.get(z)!.set(power[at + 1]!, power[at + 2]!);
    }
    w.sorties = new Map();
    const sorties = sections.find((s) => s.name === 'world.sorties')?.data as Float64Array | undefined;
    for (let at = 0; sorties && at < sorties.length; at += 9) {
      const v = sorties;
      w.sorties.set(v[at]!, { bx: v[at + 1]!, by: v[at + 2]!, tx: v[at + 3]!, ty: v[at + 4]!, launch: v[at + 5]!, kmh: v[at + 6]!, km: v[at + 7]!, over: v[at + 8]! });
    }
    w.wingMission = new Map();
    const missions = sections.find((s) => s.name === 'world.wingMission')?.data as Float64Array | undefined;
    for (let at = 0; missions && at < missions.length; at += 4) w.wingMission.set(missions[at]!, { kind: missions[at + 1] === 1 ? 'strike' : missions[at + 1] === 2 ? 'supply' : 'patrol', x: missions[at + 2]!, y: missions[at + 3]! });
    const wings = sections.find((s) => s.name === 'world.wingBase')?.data as Float64Array | undefined;
    for (let at = 0; wings && at < wings.length; at += 2) w.wingBase.set(wings[at]!, wings[at + 1]!);
    const bound = sections.find((s) => s.name === 'world.seaBound')?.data as Float64Array | undefined;
    for (let at = 0; bound && at < bound.length; at += 2) w.seaBound.set(bound[at]!, bound[at + 1]!);
    w.station = new Map();
    const stations = sections.find((s) => s.name === 'world.station')?.data as Float64Array | undefined;
    for (let at = 0; stations && at < stations.length; at += 3) w.station.set(stations[at]!, [stations[at + 1]!, stations[at + 2]!]);
    w.embarked = new Map();
    const emb = sections.find((s) => s.name === 'world.embarked')?.data as Float64Array | undefined;
    for (let at = 0; emb && at < emb.length; at += 5) w.embarked.set(emb[at]!, { fleet: emb[at + 1]!, land: emb[at + 2]!, water: emb[at + 3]!, target: emb[at + 4]! });
    w.seaBattles = [];
    const sea = sections.find((s) => s.name === 'world.seaBattles')?.data as Float64Array | undefined;
    for (let at = 0; sea && at < sea.length; ) {
      const n = sea[at++]!;
      const fleets = Array.from(sea.subarray(at, at + n));
      const ships = Array.from(sea.subarray(at + n, at + 2 * n));
      at += 2 * n;
      const [range, a, b, lostA, lostB, x, y] = Array.from(sea.subarray(at, at + 7)) as [number, number, number, number, number, number, number];
      at += 7;
      w.seaBattles.push({ fleets, ships, range, a, b, lostA, lostB, x, y });
    }
    w.airMonth = [];
    const air = sections.find((s) => s.name === 'world.airMonth')?.data as Float64Array | undefined;
    for (let at = 0; air && at + 7 <= air.length; at += 7) w.airMonth.push({ fight: air[at]!, a: air[at + 1]!, b: air[at + 2]!, va: air[at + 3]!, vb: air[at + 4]!, x: air[at + 5]!, y: air[at + 6]! });
    w.nukesBanned = new Set(Array.from((sections.find((s) => s.name === 'world.nukesBanned')?.data as Float64Array | undefined) ?? []));
    w.nukeLaunches = [];
    const nl = sections.find((s) => s.name === 'world.nukeLaunches')?.data as Float64Array | undefined;
    w.nextLaunchId = nl && nl.length > 0 ? nl[0]! : 1;
    for (let at = 1; nl && at + 10 <= nl.length; at += 10) w.nukeLaunches.push({ id: nl[at]!, nation: nl[at + 1]!, missile: nl[at + 2]!, wing: nl[at + 3]!, bx: nl[at + 4]!, by: nl[at + 5]!, tx: nl[at + 6]!, ty: nl[at + 7]!, launch: nl[at + 8]!, arrive: nl[at + 9]! });
    w.nukeTaboo = (sections.find((s) => s.name === 'world.nukeTaboo')?.data as Float64Array | undefined)?.[0] ?? 1;
    w.nukeOutrage = new Map();
    const ou = sections.find((s) => s.name === 'world.nukeOutrage')?.data as Float64Array | undefined;
    for (let at = 0; ou && at + 2 <= ou.length; at += 2) w.nukeOutrage.set(ou[at]!, ou[at + 1]!);
    w.nukeDead = new Map();
    const nd = sections.find((s) => s.name === 'world.nukeDead')?.data as Float64Array | undefined;
    for (let at = 0; nd && at + 2 <= nd.length; at += 2) w.nukeDead.set(nd[at]!, nd[at + 1]!);
    w.nukeShock = new Map();
    const sh = sections.find((s) => s.name === 'world.nukeShock')?.data as Float64Array | undefined;
    for (let at = 0; sh && at + 2 <= sh.length; at += 2) w.nukeShock.set(sh[at]!, sh[at + 1]!);
    w.nukeBursts = [];
    const nb = sections.find((s) => s.name === 'world.nukeBursts')?.data as Float64Array | undefined;
    const ny = sections.find((s) => s.name === 'world.nukeBurstYields')?.data as Uint8Array | undefined;
    for (let at = 0; nb && at + 3 <= nb.length; at += 3) w.nukeBursts.push({ x: nb[at]!, y: nb[at + 1]!, tick: nb[at + 2]!, yieldN: ny?.[at / 3] ?? 1 });
    w.nukeAnswers = new Set((sections.find((s) => s.name === 'world.nukeAnswers')?.data as Float64Array | undefined) ?? []);
    w.nukeGrievance = new Map();
    const gr = sections.find((s) => s.name === 'world.nukeGrievance')?.data as Float64Array | undefined;
    for (let at = 0; gr && at + 3 <= gr.length; at += 3) w.nukeGrievance.set(gr[at]!, { by: gr[at + 1]!, until: gr[at + 2]! });
    w.fallout = new Map();
    const fo = sections.find((s) => s.name === 'world.fallout')?.data as Float64Array | undefined;
    for (let at = 0; fo && at + 2 <= fo.length; at += 2) w.fallout.set(fo[at]!, fo[at + 1]!);
    w.warheads = new Map();
    const heads = sections.find((s) => s.name === 'world.warheads')?.data as Float64Array | undefined;
    for (let at = 0; heads && at + 3 <= heads.length; at += 3) w.warheads.set(heads[at]!, { stock: heads[at + 1]!, paid: heads[at + 2]! });
    w.airTotals = new Map();
    const tot = sections.find((s) => s.name === 'world.airTotals')?.data as Float64Array | undefined;
    for (let at = 0; tot && at + 3 <= tot.length; at += 3) w.airTotals.set(tot[at]!, { lost: tot[at + 1]!, bombed: tot[at + 2]! });
    // Derived caches describe the previous state: drop them (rebuilt on demand).
    w.elementIndex = null;
    w.contacts = null;
    w.deployed = null;
    w.deployedBefore = null;
    w.deployedTick = -1;
    // The nav caches and the seas' are of the map: kept if the map loaded is the same (`checkNav`).
    w.navStale = true;
    w.frontier = null;
    w.provinceCells = null;
    w.dropLandCounts();
    w.terrainVersion++;
    w.citiesVersion++;
    w.flipping = null;
    w.supplyDirty = true;
    w.out.fires.length = 0;
    w.out.markAllDirty();
  }
}

/** What the nav caches are built from: the terrain, the provinces and whether the map loops. */
export function navKeyOf(world: World): string {
  const { terrain, province } = world.cells;
  return `${world.settings.loopingMap ? 1 : 0}:${terrain.length}:${xxhash32View(terrain)}:${xxhash32View(province)}`;
}

/**
 * The grid of `grid` for a world of the same map with its own terrain layer: the same derived
 * rasters, and no search of its own yet (scratch, the last barred search and the pockets are
 * memos of the searches made on it), so it is the grid a build gives.
 */
export function freshGrid(grid: NavGrid, terrain: Uint8Array): NavGrid {
  return { ...grid, terrain, scratch: null, barred: null, pockets: null };
}

/**
 * After a load (`navStale`): the nav caches are kept where the map loaded is the one they were
 * built from, and dropped where it is not (ADR-279: 0.3 s to build again on every load).
 */
function checkNav(world: World): void {
  if (!world.navStale) return;
  world.navStale = false;
  if (world.nav && world.navKey === navKeyOf(world)) {
    world.nav = { grid: freshGrid(world.nav.grid, world.cells.terrain), graph: world.nav.graph };
    return;
  }
  world.nav = null;
  world.sea = null;
  world.lanes = null;
  world.portSea = null;
}

/** The navigation grid and province graph for the world's static layers (built once, cached). */
export function navOf(world: World): { grid: NavGrid; graph: ProvinceGraph } {
  checkNav(world);
  if (!world.nav) {
    const grid = makeNavGrid(world.cells.terrain, world.cells.w, world.cells.h, world.settings.loopingMap);
    world.nav = { grid, graph: buildProvinceGraph(grid, world.cells.province) };
    world.navKey = navKeyOf(world);
  }
  return world.nav;
}

/** The nav caches if they are built (and still the map's), else null: nothing is built. */
export function navBuilt(world: World): { grid: NavGrid; graph: ProvinceGraph } | null {
  checkNav(world);
  return world.nav;
}

/** The sea zones for the world's terrain and its map's seeds (PLAN 4.1a; built once, cached). */
export function seaOf(world: World): SeaZones {
  checkNav(world);
  return (world.sea ??= buildSeaZones(navOf(world).grid, world.seaSeeds, new Set(world.seaIce)));
}

/** The lane graph over the sea zones and the map's passages, with the world's ports (PLAN 4.1b, 4.1c; built once, cached). */
export function laneOf(world: World): LaneGraph {
  checkNav(world);
  return (world.lanes ??= buildLaneGraph(navOf(world).grid, seaOf(world), world.seaPassages, world.ports, world.portReach));
}

const basins = new WeakMap<SeaZones, SeaBasins>();
const airZones = new WeakMap<ProvinceGraph, WeakMap<SeaZones, AirZones>>();

/** The world's air zones (`buildAirZones`, PLAN 5.1a): built once for its province graph and sea zones, cached by them. */
export function airOf(world: World): AirZones {
  const nav = navOf(world);
  const z = seaOf(world);
  let bySea = airZones.get(nav.graph);
  if (!bySea) airZones.set(nav.graph, (bySea = new WeakMap()));
  let a = bySea.get(z);
  if (!a) bySea.set(z, (a = buildAirZones(nav.grid, nav.graph, z)));
  return a;
}

/** The world's sea basins (`seaBasins`, PLAN 4.8o): built once for its zones, cached by them. */
export function basinOf(world: World): SeaBasins {
  const z = seaOf(world);
  let b = basins.get(z);
  if (!b) basins.set(z, (b = seaBasins(navOf(world).grid, z, world.seaPassages)));
  return b;
}

/** Per port of the world, its water as the lane graph has it, or -1 (`portWaters`: by the zones alone, not the lanes; built once, cached where `sea` is). */
export function portSeaOf(world: World): Int32Array {
  checkNav(world);
  return (world.portSea ??= portWaters(navOf(world).grid, seaOf(world), world.ports, world.portReach));
}

/**
 * Each province's cells (ADR-279): province p's are `cells[start[p]]…cells[start[p + 1] - 1]`, in
 * the order of the cell index, as a scan of the map meets them (built once, cached; a load drops it).
 */
export function provinceCellsOf(world: World): { start: Int32Array; cells: Int32Array } {
  if (!world.provinceCells) {
    const { province } = world.cells;
    let count = world.provinces.count;
    for (let c = 0; c < province.length; c++) if (province[c]! >= count) count = province[c]! + 1;
    const start = new Int32Array(count + 1);
    for (let c = 0; c < province.length; c++) start[province[c]! + 1]!++;
    for (let p = 0; p < count; p++) start[p + 1]! += start[p]!;
    const at = start.slice(0, count);
    const cells = new Int32Array(province.length);
    for (let c = 0; c < province.length; c++) cells[at[province[c]!]!++] = c;
    world.provinceCells = { start, cells };
  }
  return world.provinceCells;
}

/**
 * A sea battle (PLAN 4.3c): its fleets, with the ships each had when it came in; its range, km;
 * its two sides' first nations (`a`, the first fleet's; `b`, the first of the fleets at war with
 * it) and the ships each side lost; where it began.
 */
export type { SeaControl } from './systems/seaControl';
import type { SeaControl } from './systems/seaControl';
import type { Embarked } from './systems/amphibious';

/**
 * A tally of the month's air war (PLAN 5.11a): `fight` 1 for the fights of nations a and b (a
 * the lower id; va, vb the aircraft each side lost), 0 for the strikes of a on b (va the strikes,
 * vb what they took); (x, y) where the first was.
 */
export interface AirTally {
  fight: number;
  a: number;
  b: number;
  va: number;
  vb: number;
  x: number;
  y: number;
}

/**
 * A warhead in flight (PLAN 6.2): its nation, by missile (1) or bomber (0, `wing` its strategic
 * bomber wing), from (bx, by) to (tx, ty), launched at tick `launch`, there at `arrive` (hours).
 */
export interface NukeLaunch {
  id: number;
  nation: number;
  missile: number;
  wing: number;
  bx: number;
  by: number;
  tx: number;
  ty: number;
  launch: number;
  arrive: number;
}

/** Adds to nation `n`'s air totals (PLAN 5.11b): aircraft it lost, what strikes took of it. */
export function addAirTotal(world: World, n: number, lost: number, bombed: number): void {
  if (lost === 0 && bombed === 0) return;
  const t = world.airTotals.get(n);
  if (t) {
    t.lost += lost;
    t.bombed += bombed;
  } else world.airTotals.set(n, { lost, bombed });
}

/** Adds to the month's tally of `fight` of a and b (PLAN 5.11a), made where (x, y) is the first. */
export function tallyAir(world: World, fight: number, a: number, b: number, va: number, vb: number, x: number, y: number): void {
  const t = world.airMonth.find((r) => r.fight === fight && r.a === a && r.b === b);
  if (t) {
    t.va += va;
    t.vb += vb;
  } else world.airMonth.push({ fight, a, b, va, vb, x, y });
}

export interface SeaBattle {
  fleets: number[];
  ships: number[];
  range: number;
  a: number;
  b: number;
  lostA: number;
  lostB: number;
  x: number;
  y: number;
}

/** The range of the sea battle fleet `id` is in, km; undefined for none (PLAN 4.3a). */
export function seaRangeOf(world: World, id: number): number | undefined {
  return world.seaBattles.find((b) => b.fleets.includes(id))?.range;
}

/** The most bumps of `World.heldKeys` whose nodes are logged (`World.heldLog`). */
const HELD_LOG_KEPT = 4096;
/** The most changes of a cell's controller whose holders are logged (`World.flipLog`). */
const FLIP_LOG_KEPT = 16384;

export class World {
  seed: number;
  /** Ticks elapsed; 1 tick = 1 sim hour (ADR-5). */
  tick = 0;
  /** Scenario start date as days since 1970-01-01 (shared/calendar): tick 0 is its 00:00. */
  startDay = 0;
  rng: RngStreams;
  cells: CellLayers;
  nations = new Table('nations', NATION_SCHEMA, 8);
  formations = new Table('formations', FORMATION_SCHEMA, 128);
  cities = new Table('cities', CITY_SCHEMA, 16);
  production = new Table('production', PRODUCTION_SCHEMA, 16);
  research = new Table('research', RESEARCH_SCHEMA, 16);
  elements = new Table('elements', ELEMENT_SCHEMA, 1024);
  wars = new Wars();
  alliances = new Alliances();
  provinces = new Provinces();
  buffs = new Buffs();
  battles = new Battles();
  /** History log (PLAN 1.34a). */
  history = new History();
  /** Monthly statistics series (PLAN 1.34b). */
  stats = new StatSeries();
  /** Custom 36×24 pixel flags by nation (PLAN 1.37b), saved in the names section. */
  flags = new Map<number, Uint32Array>();
  /** Derived: bumped when flags change (the UI re-fetches them). */
  flagsVersion = 0;
  /** Editor undo/redo stack (PLAN 1.35). */
  edits = new EditStack();
  /** Derived: bumped when the editor changes terrain (the renderer re-fetches the layer). */
  terrainVersion = 0;
  /** Derived: bumped when cities change (placed, removed, capital) for the map's city layer. */
  citiesVersion = 0;
  /**
   * Derived (not state): a full supply refresh is needed (load, overlords, raw layer writes; code
   * that writes `cells.controller` directly must set it). Cell-level changes through
   * setController/setOwner instead record the nations involved in `supplyDirtyNations`, and only
   * their blocs are reflooded (review after PLAN 1.25).
   *
   * Not state, and it must not matter that it is not: a refresh of the marked blocs gives the
   * network a full refresh gives (PLAN 2.11j), so a loaded world, which refreshes in full, goes
   * on as the world that was saved.
   */
  supplyDirty = true;
  supplyDirtyNations = new Set<number>();
  /**
   * Derived (not state): the blocs in whose network a changed cell lay, by the layer's own mark.
   * A nation's bloc is looked up at the refresh, and by then it may have none (a puppet that
   * was annexed left its cells in its overlord's network: PLAN 2.11j).
   */
  supplyDirtyBlocs = new Set<number>();
  /**
   * Derived (not state): the blocs whose lands joined by sea changed (`markSeaLinks`, PLAN 4.4c):
   * flooded whole at the refresh, cells of their own changed or not (ADR-272).
   */
  supplySeaBlocs = new Set<number>();
  /**
   * Derived (not state): the cells whose controller or owner changed since the last refresh, each
   * with what it was then (controller × 65536 + owner). A partial refresh mends the network at
   * these cells (PLAN 3.10d1b); what a cell was says whether a city was a source, and which
   * blocs have a changed cell of their own.
   */
  supplyChanged = new Map<number, number>();
  /**
   * Derived (not state): per supply bloc, the row spans its floods filled, as [start, end)
   * cell pairs (the first `n` entries of `spans`; `base` of them from its last flood of the
   * whole bloc, the rest from the mending since), and the crossing lanes among them. Every cell
   * of the bloc's network is in a span; a span may hold cells that are no longer in it
   * (ADR-196). Valid from a full refresh on; a full refresh rebuilds it.
   */
  supplySpans = new Map<number, { spans: Int32Array; n: number; base: number; lanes: number[] }>();
  /** Derived (not state): bumped by every controller change (label re-derivation, PLAN 1.29). */
  controlChanges = 0;
  /** Derived (not state): bumped by every owner change through `setOwner` (`seaReach`'s hour, PLAN 7.1l2). */
  ownerChanges = 0;
  /**
   * Derived (not state): the holders of each change by `setController` from `flipLogBase` on,
   * `from · 65536 + to` (`flipLog[k - flipLogBase]` is that of change k + 1). What is kept of
   * which cells are open to a nation is checked against it (`passageOf`'s `joined`, PLAN 7.1i).
   * A write of `controller` without the setter is not logged: `dropLandCounts` must follow it,
   * and what is kept by `World.heldKeys` is made again then.
   */
  flipLog: number[] = [];
  flipLogBase = 0;
  /** Derived (not state): the cell of each change of `flipLog`, at the same index (PLAN 7.30b). */
  flipCells: number[] = [];
  /**
   * Derived (not state): by formation, the operational AI's last order refused for want of a way
   * (`askMove`, PLAN 1.42g): from the cell it stood on, to the cell, of the template, on the ground
   * open by `ok`, when `flipLog` had `flips` changes (`to` -1: none refused so but for the way's
   * length); and on that ground, the cells it was refused for the way's length (`long`, PLAN 1.42h);
   * of a refusal of `to` by the cells of a corridor, what it read (`corridor`, PLAN 7.30b) and the
   * count of `flipLog` up to which it is known to hold (`since`).
   * Dropped with the land counts.
   */
  refusedOrders = new Map<number, { from: number; to: number; template: number; grid: NavGrid; ok: Uint8Array; flips: number; long: number[]; corridor?: CorridorRefusal | undefined; since: number }>();
  /** Derived: bumped when God Mode renames a nation (labels re-derive, PLAN 1.32b). */
  namesVersion = 0;
  /** Global settings (state, saved in world.meta). */
  settings: { winnerTakesAll: boolean; revoltMode: 'province' | 'region'; ceMode: CeMode; aiEnabled: boolean; player: number; loopingMap: boolean; nukesEnabled: boolean } = {
    winnerTakesAll: false,
    revoltMode: 'province',
    ceMode: 'dynamic',
    aiEnabled: true,
    nukesEnabled: true,
    /** The nation the player controls (0 = none; PLAN 1.33, saved so a load keeps control). */
    player: 0,
    /** The map wraps east–west (PLAN 1.39b1 new-game option; scenario default on). */
    loopingMap: true,
  };
  /** Derived (not state): territory frontier cells and the wars version it was built for. */
  frontier: Set<number> | null = null;
  /** Derived (not state): cells by node of the province graph and holder (`heldByNode`). */
  private held: { graph: ProvinceGraph; count: Map<number, number> } | null = null;
  /**
   * Derived (not state): bumped when a key of `heldByNode` comes or goes, and when the map is
   * counted again: what is built from its keys alone is the same while this is (`passageOf`).
   */
  heldKeys = 0;
  /**
   * Derived (not state): the node of each bump of `heldKeys` from `heldLogBase` on
   * (`heldLog[k - heldLogBase]` is that of the bump to k + 1). A count again starts it afresh.
   */
  heldLog: number[] = [];
  heldLogBase = 0;
  /** Derived (not state): land tallies, kept by setOwner/setController once built. */
  private land: LandCounts | null = null;
  /** Derived (not state): the border index (`border.ts`, PLAN 7.1l1), kept by setController once built. */
  private border: Uint32Array | null = null;
  /** Derived (not state): the frontier set as a byte per cell (valid whenever `frontier` is). */
  frontierMask: Uint8Array | null = null;
  /** Derived (not state): the frontier cells of each 8 × 8 block of cells (with `frontierMask`, PLAN 7.1h). */
  frontierBlocks: Uint8Array | null = null;
  /** Derived (not state): cells with non-zero `cells.flip`; null = rebuild by scan. */
  flipping: Set<number> | null = null;
  frontierWars = -1;
  /** Derived (not state): live element ids per formation, ascending; null = rebuild. */
  elementIndex: Map<number, number[]> | null = null;
  /**
   * Derived, for where the blocks of formations in contact stand (PLAN 2.14c1, `deployOf` in
   * systems/elements.ts): each such formation's nearest enemy in contact, set by `findBattles`
   * every hour, and the deployments worked out from it so far. Null: not worked out (a load, a
   * command); they come again from the state.
   */
  contacts: Map<number, number> | null = null;
  /**
   * What the hour's battles took of each formation that is still there: [formation, its strength
   * before, after]. Written by `combatSystem`, read by `orgLossSystem` in the same tick (PLAN
   * 3.5a). Derived, not state.
   */
  battleLosses: number[] = [];
  deployed: Map<number, { x: number; y: number; facing: number } | null> | null = null;
  /**
   * Where the formations that an order or the march has moved in the tick `movedTick` stood
   * before it: x, y, facing (`noteMove`, `elementPlaceBefore` in systems/elements.ts). Derived.
   */
  movedFrom = new Map<number, [number, number, number]>();
  movedTick = -1;
  /** The deployments of the hour before (see elementPlaceBefore in systems/elements.ts); null: not known. */
  deployedBefore: Map<number, { x: number; y: number; facing: number } | null> | null = null;
  /**
   * The tick `deployAll` last ran in. Before it runs in a tick, `deployed` is still the hour
   * before's, what was last drawn, and `deployedBefore` the hour before that (PLAN 5.8w13). Derived.
   */
  deployedTick = -1;
  /** Scenario rules for commands (set by the Sim; not state). */
  rules: ScenarioRules | null = null;
  /**
   * The fine land mask (PLAN 2.9a, ADR-79): static data of the map, not state (not saved, not
   * hashed). With it a formation stands on land where a cell is partly sea; without it (the toy
   * world, a world built without its asset) every rule below gives the place it is asked about.
   */
  landMask: LandMask | null = null;
  /** Derived (not state): where a formation stands in a cell, for the cells that have been asked for. */
  private readonly cellPoints = new Map<number, [number, number]>();

  /**
   * Whether (`x`, `y`), in cells, is a place to stand on: surely land by the fine mask
   * (`maskSure`: in a land pixel, and land in the picture drawn from the mask, whose shore
   * wanders inside a pixel: PLAN 2.9b). True where there is no mask to ask, on the map: beyond
   * an edge of it there is nowhere to stand, mask or none (`onMap`).
   */
  onLand(x: number, y: number): boolean {
    if (!this.onMap(x, y)) return false;
    const mask = this.landMask;
    if (!mask) return true;
    // Most places asked about are inland, and combat asks for every shot: a cell's answer is
    // kept (1 inland: every place in it will do; 2 by the coast: the mask is asked).
    const { w, h } = this.cells;
    const cx = Math.floor(x);
    const cy = Math.floor(y);
    if (cx >= 0 && cx < w && cy >= 0 && cy < h) {
      const inland = (this.inland ??= new Uint8Array(w * h));
      const cell = cy * w + cx;
      if (inland[cell] === 0) inland[cell] = cellInland(mask, w, cx, cy, this.settings.loopingMap) ? 1 : 2;
      if (inland[cell] === 1) return true;
    }
    return maskSure(mask, w, h, x, y, this.settings.loopingMap);
  }
  /**
   * Whether (`x`, `y`), in cells, is on the map: not above or below it, and not beside a map
   * that does not loop (PLAN 3.12Rse3). Beside one that loops is on it: a place worked out from
   * a formation's (a block's, a slot's) is left unfolded there, x under 0 or `w` and over.
   */
  onMap(x: number, y: number): boolean {
    const { w, h } = this.cells;
    return y >= 0 && y < h && (this.settings.loopingMap || (x >= 0 && x < w));
  }
  /** Derived (not state): for each cell asked about, whether all of it is surely land (see `onLand`). */
  private inland: Uint8Array | null = null;

  /**
   * Where a formation stands in `cell`: its middle; or, where the fine mask has water at the
   * middle, the cell's land point (the point of it furthest from water). A cell without any
   * land in the mask (a crossing, land painted in the editor) keeps its middle.
   *
   * A cell's middle is a corner of four mask pixels: it counts as land when all four are. With
   * one of them alone, the elements whose slots lie the other way had no land between them and
   * their formation, and stood in a heap on its place (25 of the 33 drawn in at the 1938 start).
   */
  cellPoint(cell: number): [number, number] {
    const w = this.cells.w;
    const cx = cell % w;
    const cy = (cell - cx) / w;
    const mid: [number, number] = [cx + 0.5, cy + 0.5];
    // (At the middle the four pixels count alike: surely land there is all four of them land.)
    if (!this.landMask || this.onLand(mid[0], mid[1])) return mid;
    let p = this.cellPoints.get(cell);
    if (!p) this.cellPoints.set(cell, (p = landPoint(this.landMask, w, cx, cy, this.settings.loopingMap) ?? mid));
    return [p[0], p[1]];
  }

  /**
   * Where a fleet stands in the water cell `cell` (PLAN 4.2b): its middle, or where the fine
   * mask has land there the cell's water point (the point of it furthest from land); null for
   * a cell with no water in the mask. Without a mask the middle.
   */
  seaPoint(cell: number): [number, number] | null {
    const { w, h } = this.cells;
    const cx = cell % w;
    const cy = (cell - cx) / w;
    const mask = this.landMask;
    if (!mask) return [cx + 0.5, cy + 0.5];
    // The middle is a corner of four pixels: open water when none of them is land.
    if (maskField(mask, w, h, cx + 0.5, cy + 0.5, this.settings.loopingMap) === 0) return [cx + 0.5, cy + 0.5];
    return waterPoint(mask, w, cx, cy, this.settings.loopingMap);
  }

  /**
   * Whether formation `id` is a fleet (PLAN 4.2b): of a sea template of the rules
   * (`TemplateRule.domain`). The rules of the land (the march, supply, contact and fire, the
   * ground a formation holds, the AI's orders) ask this and leave a fleet alone.
   */
  /** A fleet, or a land formation aboard one (PLAN 4.5a): on the water, where no rule of the land reads it. */
  afloat(id: number): boolean {
    return this.isFleet(id) || this.embarked.has(id);
  }

  /** A formation of an air template (PLAN 5.1b): an air wing, at its base (`wingBase`, PLAN 5.1d). */
  isWing(id: number): boolean {
    return this.rules?.templates?.[this.formations.cols.template[id]!]?.domain === Domain.air;
  }

  /**
   * Off the land (PLAN 5.1d): afloat (a fleet, or an army aboard one), or an air wing. No rule of
   * the land (the march, supply, contact and fire, the ground held, a garrison, the army's men and
   * upkeep, the AI's orders) reads it.
   */
  offLand(id: number): boolean {
    return this.afloat(id) || this.isWing(id);
  }

  /** A formation of a sea template (PLAN 4.2a). */
  isFleet(id: number): boolean {
    return this.rules?.templates?.[this.formations.cols.template[id]!]?.domain === Domain.sea;
  }

  /**
   * (`x`, `y`) where the fine mask has it on land; else where a formation stands in the cell
   * that holds it. A point off the map is in no cell and comes back as it is (PLAN 3.12Rse3:
   * with the mask it was given the nearest cell of the map's edge).
   */
  standPoint(x: number, y: number): [number, number] {
    if (this.onLand(x, y) || !this.onMap(x, y)) return [x, y];
    const w = this.cells.w;
    const cx = Math.min(w - 1, Math.max(0, Math.floor(x)));
    const cy = Math.min(this.cells.h - 1, Math.max(0, Math.floor(y)));
    return this.cellPoint(cy * w + cx);
  }

  /** Derived (not state): the way of each step asked about, by its two cells, the lower first (`stepWay`); and the grid they were found on. */
  private readonly stepWays = new Map<number, Float64Array | null>();
  private stepWaysGrid: NavGrid | null = null;

  /**
   * The way of a march's step between the neighbouring cells `a` and `b`, from the lower cell's
   * point to the higher one's, where the straight line between the two points is not clear of
   * the fine mask's water (PLAN 4.1d2, `landWay`): x and y by turns, the last x unfolded over
   * the seam, and after the places the length to each of them. Null where the line is clear,
   * where the mask has no way over land between the two, and without a mask: the step is the
   * straight line then. A way keeps to the step's two cells (a diagonal step's four) and to the
   * cells beside them that are of the same land on the cell grid (`NavGrid.component`): never
   * a cell no route enters. On a grid made anew (terrain painted) the ways are found anew.
   */
  stepWay(a: number, b: number): Float64Array | null {
    if (!this.landMask) return null;
    const lo = a < b ? a : b;
    const hi = a < b ? b : a;
    const grid = navOf(this).grid;
    if (this.stepWaysGrid !== grid) {
      this.stepWays.clear();
      this.stepWaysGrid = grid;
    }
    const key = lo * this.cells.terrain.length + hi;
    let way = this.stepWays.get(key);
    if (way !== undefined) return way;
    const w = this.cells.w;
    const h = this.cells.h;
    const land = grid.component[lo]!;
    const p = this.cellPoint(lo);
    const q = this.cellPoint(hi);
    if (q[0] - p[0] > w / 2) q[0] -= w;
    else if (p[0] - q[0] > w / 2) q[0] += w;
    const line = landWay(this.landMask, w, p, q, this.settings.loopingMap, undefined, (cx, cy) => cy >= 0 && cy < h && cx >= 0 && cx < w && land !== 0 && grid.component[cy * w + cx] === land);
    way = null;
    if (line) {
      const n = line.length / 2;
      way = new Float64Array(3 * n);
      way.set(line);
      for (let i = 1; i < n; i++) {
        const dx = line[2 * i]! - line[2 * i - 2]!;
        const dy = line[2 * i + 1]! - line[2 * i - 1]!;
        way[2 * n + i] = way[2 * n + i - 1]! + Math.sqrt(dx * dx + dy * dy);
      }
    }
    this.stepWays.set(key, way);
    return way;
  }

  /**
   * The path of each formation on the march, saved by the core part (PLAN 3.4Rl). One that is
   * missing is found again (`formationPath`). The navigation graph is a derived cache.
   */
  paths = new Map<number, Int32Array>();
  /** The sea battles going on (PLAN 4.3a, 4.3c; `navalCombatSystem`): state, saved while there is one. */
  seaBattles: SeaBattle[] = [];
  /**
   * The month's air war so far (PLAN 5.11a): its fights with losses by the two nations leading
   * them and its strikes by striker and struck, told in the log at the month's end
   * (`runEconomyMonth`) and cleared. State, saved while not empty.
   */
  airMonth: AirTally[] = [];
  /**
   * Each nation's air war so far (PLAN 5.11b): the aircraft it lost, in the air and to flak, and
   * the men, guns and vehicles strikes took of it. State, a section of its own saved while not
   * empty, so that a save from before loads (with none), as a column of the nations' table would not.
   */
  airTotals = new Map<number, { lost: number; bombed: number }>();
  /** The nations God Mode has barred from nuclear weapons (PLAN 6.1a, `setNukes`): state, saved while not empty. */
  nukesBanned = new Set<number>();
  /** Each nation's warheads and the gold paid toward the next (PLAN 6.1b, `nuclearSystem`): state, a section of its own saved while not empty. */
  warheads = new Map<number, { stock: number; paid: number }>();
  /** The warheads in flight (PLAN 6.2, `nuclearSystem`), and the id the next launch takes: state, a section of its own saved while there is one. */
  nukeLaunches: NukeLaunch[] = [];
  /** Fallout by cell, 0 to 1 (PLAN 6.3b, `nuclear.ts`): state, a section of its own saved while not empty. */
  fallout = new Map<number, number>();
  /** The nuclear taboo, 0 to 1 (PLAN 6.4a, `nuclear.ts`): 1 until the first burst; state, saved while under 1. */
  nukeTaboo = 1;
  /** The bursts of the last RESTRIKE_DAYS, oldest first (PLAN 6.11b, `nuclear.ts`): state, saved while not empty. */
  nukeBursts: { x: number; y: number; tick: number; yieldN: number }[] = [];
  /** Who struck each nation last and until when it may strike back (PLAN 6.4b): state, saved while not empty. */
  nukeGrievance = new Map<number, { by: number; until: number }>();
  /** The launches in flight that are strikes back (PLAN 6.12e): their bursts give no grievance. */
  nukeAnswers = new Set<number>();
  /** War exhaustion a nation struck carries, decaying (PLAN 6.5a): state, saved while not empty. */
  nukeShock = new Map<number, number>();
  /** The world's outrage at each nation that struck another's land, 0 to 100, decaying (PLAN 6.5b): state, saved while not empty. */
  nukeOutrage = new Map<number, number>();
  /** The dead of nuclear bursts on each nation's land, men and people, all told (PLAN 7.12: its statistics); state, saved while not empty. */
  nukeDead = new Map<number, number>();
  nextLaunchId = 1;
  /** The land formations aboard transports (PLAN 4.5a, `amphibiousSystem`), by id: state, saved while not empty. */
  embarked = new Map<number, Embarked>();
  /**
   * A player's land formations marching to a port to go over the sea (PLAN 4.9b), by id: the cell
   * their order was for. State, saved while not empty; `amphibiousSystem` embarks them at the end
   * of the march.
   */
  seaBound = new Map<number, number>();
  /**
   * Fleets placed by the editor (PLAN 7.22c), by id: the place (cells) each holds. The naval AI
   * keeps such a fleet there, and brings it back after a battle, until a player orders it away or
   * it breaks off beaten (`breakOff`). State, saved while not empty.
   */
  station = new Map<number, [number, number]>();
  /**
   * The air wings' bases (PLAN 5.1d), by wing: an airbase's index + 1, or a carrier's fleet as its
   * id negated; 0 for a wing whose carrier is gone (`airSystem` loses it). State, saved while not empty.
   */
  wingBase = new Map<number, number>();
  /** The air wings' missions (PLAN 5.1e, `orderMission`): state, saved while not empty; the scheduler of PLAN 5.2 reads them. */
  wingMission = new Map<number, WingMission>();
  /**
   * The air wings' sorties (PLAN 5.2b, `airSystem`), by wing: in the air, or home and turning
   * round until `sortieEnd` + `TURNAROUND_HOURS`. State, saved while not empty; where one is is
   * `sortieAt`'s, never stored.
   */
  sorties = new Map<number, Sortie>();
  /** Per air zone, per nation, the air power it flew there, fading (PLAN 5.3c, `airPowerSystem`): state, saved while not empty. */
  airPower = new Map<number, Map<number, number>>();
  /** Per cell, the share of its industry bombs put out of work (PLAN 5.5a, `bombIndustry`): state, saved while not empty; repaired day by day. */
  bombDamage = new Map<number, number>();
  /** Per port (index in `ports`), the bombs' damage to it (PLAN 5.5b, `bombPorts`): state, saved while not empty; shut at a half. */
  portDamage = new Map<number, number>();
  /** Per bloc, the land components its cities feed at the last refresh hour (PLAN 4.4c, `markSeaLinks`): derived. */
  seaLinks = new Map<number, string>();
  /** Who holds each sea zone (PLAN 4.4a, `seaControlSystem`): state, saved while a zone is held; null until its first day. */
  seaControl: SeaControl | null = null;
  nav: { grid: NavGrid; graph: ProvinceGraph } | null = null;
  /** What `nav` was built from (`navKeyOf`), and whether a load has come since (`checkNav`: kept, or dropped with the seas'). */
  navKey = '';
  navStale = false;
  /** Each province's cells (`provinceCellsOf`; derived, dropped on load). */
  provinceCells: { start: Int32Array; cells: Int32Array } | null = null;
  /**
   * The seeds of the map's named seas (PLAN 4.1a): static data of the map, not state (not saved,
   * not hashed). None on the toy world: its water is given zones with no name.
   */
  seaSeeds: readonly SeaSeed[] = [];
  /** The seas of `seaSeeds`, by name, that ice closes to a fleet (PLAN 4.2d): static data of the map, as the seeds are. */
  seaIce: readonly string[] = [];
  /** The sea zones: a derived cache, as `nav` is, and dropped where it is. */
  sea: SeaZones | null = null;
  /** The map's passages (PLAN 4.1b): static data of the map, as `seaSeeds` is. None on the toy world. */
  seaPassages: readonly SeaPassage[] = [];
  /**
   * The ports and naval bases (PLAN 4.1c, `placePorts`): static data of the scenario, as the
   * seeds are, not state. Who holds a port is who holds its cell. None on the toy world.
   */
  ports: readonly Port[] = [];
  /** How far from its cell a port's water may be, cells (the scenario's `reachCells`). */
  portReach = 0;
  /**
   * The airbases (PLAN 5.1c, `placeAirbases`): static data of the scenario, as the ports are, not
   * state. Who holds a base is who holds its cell. None on the toy world.
   */
  airbases: readonly Airbase[] = [];
  /** Each port's water (`portSeaOf`): a derived cache, dropped where `sea` is. */
  portSea: Int32Array | null = null;
  /** The lane graph: a derived cache, dropped where `sea` is. */
  lanes: LaneGraph | null = null;
  commandLog: LoggedCommand[] = [];
  /** Custom nation names from God Mode (PLAN 1.32); state, saved with the core. */
  names = new Map<number, string>();
  /** Names of cities placed in the editor (PLAN 1.36), by city row; state, saved with `names`. */
  cityNames = new Map<number, string>();
  /** Commands queued since the last tick boundary, applied in seq order at the next tick. */
  pending: PendingCommand[] = [];
  nextCommandSeq = 0;
  /** Derived outputs (dirty tiles, events): not state. */
  readonly out: TickOutputs;
  private readonly core = new WorldCore(this);

  /**
   * This map's cells to a cell of its map's default size (ADR-416): 1 at the 1938 world's M and in
   * the toy world; 0.5 at S, 2 at L. A reach given in cells of the default size is this
   * many times as many cells here, the same km (`atSize`). A power of two at S, M and L: the
   * reaches there are exact.
   */
  readonly sizeScale: number;

  /** A reach of `cells` cells of the map's default size, in this map's cells. */
  atSize(cells: number): number {
    return cells * this.sizeScale;
  }

  /**
   * The same, whole, at least 1: a radius that a loop walks cell by cell, a bucket's side. At
   * the default size it is `cells` (a whole number there); at S a reach of 1 stays 1.
   */
  atSizeWhole(cells: number): number {
    return Math.max(1, Math.round(cells * this.sizeScale));
  }

  /**
   * A snap of `cells` cells of the map's default size, onto the raster's land or water from a
   * point given in degrees (PLAN 7.1b7): the larger of its cells and its km. At a finer size the
   * point is as many km from its land as before, more cells; at a coarser one the raster's own
   * cells are what it is out by.
   */
  atSizeSnap(cells: number): number {
    return cells * Math.max(1, this.sizeScale);
  }

  /** An area of `cells` cells of the map's default size, in this map's cells: the scale's square (PLAN 7.1b3). */
  atSizeArea(cells: number): number {
    return cells * this.sizeScale * this.sizeScale;
  }

  constructor(seed: number, w: number, h: number, sizeScale = 1) {
    this.sizeScale = sizeScale;
    this.seed = seed >>> 0;
    this.rng = new RngStreams(this.seed);
    this.cells = new CellLayers(w, h);
    this.out = new TickOutputs(w, h);
    this.out.history = this.history;
    this.out.markAllDirty();
  }

  /**
   * Sets the controller of cell `i`, marking its tile dirty when it changes. Invalidates the
   * frontier set unless the caller (the territory system) maintains it itself.
   */
  setController(i: number, nation: number, keepFrontier = false): void {
    const c = this.cells;
    if (c.controller[i] === nation) return;
    if (this.land) {
      const km2 = this.land.rowKm2[Math.floor(i / c.w)]!;
      this.land.cell(c.owner[i]!, c.controller[i]!, -km2);
      this.land.cell(c.owner[i]!, nation, km2);
    }
    if (this.held) {
      const node = this.held.graph.nodeOf[i]!;
      if (node !== 0) {
        const from = node * 65536 + c.controller[i]!;
        const left = this.held.count.get(from)! - 1;
        if (left === 0) {
          this.held.count.delete(from);
          this.heldBump(node);
        } else this.held.count.set(from, left);
        const to = node * 65536 + nation;
        const had = this.held.count.get(to);
        if (had === undefined) this.heldBump(node);
        this.held.count.set(to, (had ?? 0) + 1);
      }
    }
    this.controlChanges++;
    if (this.flipLog.length >= FLIP_LOG_KEPT) {
      this.flipLogBase += this.flipLog.length;
      this.flipLog = [];
      this.flipCells = [];
    }
    this.flipLog.push(c.controller[i]! * 65536 + nation);
    this.flipCells.push(i);
    this.supplyDirtyNations.add(c.controller[i]!);
    this.supplyDirtyNations.add(nation);
    if (c.supply[i] !== 0) this.supplyDirtyBlocs.add(c.supply[i]!);
    if (!this.supplyChanged.has(i)) this.supplyChanged.set(i, c.controller[i]! * 65536 + c.owner[i]!);
    c.controller[i] = nation;
    if (this.border) borderChanged(this.border, c.controller, c.w, c.h, i);
    if (!keepFrontier) this.frontier = null;
    const x = i % c.w;
    const y = (i - x) / c.w;
    this.out.dirtyTiles[Math.floor(y / TILE) * this.out.tilesX + Math.floor(x / TILE)] = 1;
  }

  /** Sets the owner of cell `i` (peace terms, annexation, God Mode), marking its tile dirty. */
  setOwner(i: number, nation: number): void {
    const c = this.cells;
    if (c.owner[i] === nation) return;
    this.supplyDirtyNations.add(c.owner[i]!);
    this.supplyDirtyNations.add(nation);
    if (c.supply[i] !== 0) this.supplyDirtyBlocs.add(c.supply[i]!);
    if (!this.supplyChanged.has(i)) this.supplyChanged.set(i, c.controller[i]! * 65536 + c.owner[i]!);
    // Owned-cell counts follow every ownership change (review in PLAN 1.32: they were set once
    // at scenario creation and went stale, so panel and ranking land never moved).
    const nc = this.nations.cols;
    if (c.owner[i] !== 0 && this.nations.has(c.owner[i]!)) nc.cells[c.owner[i]!] = nc.cells[c.owner[i]!]! - 1;
    if (nation !== 0 && this.nations.has(nation)) nc.cells[nation] = nc.cells[nation]! + 1;
    if (this.land) {
      const km2 = this.land.rowKm2[Math.floor(i / c.w)]!;
      this.land.cell(c.owner[i]!, c.controller[i]!, -km2);
      this.land.cell(nation, c.controller[i]!, km2);
    }
    c.owner[i] = nation;
    this.ownerChanges++;
    const x = i % c.w;
    const y = (i - x) / c.w;
    this.out.dirtyTiles[Math.floor(y / TILE) * this.out.tilesX + Math.floor(x / TILE)] = 1;
  }

  /** Land tallies of the current map in km² (built by a scan on first use, then kept by the setters). */
  landCounts(): LandCounts {
    return (this.land ??= LandCounts.scan(this.cells.owner, this.cells.controller, this.cells.w, this.cells.h));
  }

  /** Forget the land tallies (cells were written without the setters, e.g. by a load). */
  dropLandCounts(): void {
    this.land = null;
    this.held = null;
    this.border = null;
    this.refusedOrders.clear();
  }

  /** The border index of the current map (`border.ts`; built by a scan on first use, then kept by `setController`). */
  borderBits(): Uint32Array {
    return (this.border ??= scanBorder(this.cells.controller, this.cells.w, this.cells.h));
  }

  /** A key of `heldByNode` in `node` came or went. The log keeps HELD_LOG_KEPT bumps at most. */
  private heldBump(node: number): void {
    if (this.heldLog.length >= HELD_LOG_KEPT) {
      this.heldLogBase += this.heldLog.length;
      this.heldLog = [];
    }
    this.heldLog.push(node);
    this.heldKeys++;
  }

  /**
   * How many cells of each node of the province graph each holder has: node · 65536 + holder →
   * cells, no zero entries (PLAN 3.4Rl: which provinces have ground open to a nation's march).
   * Built by a scan on first use, then kept by `setController`.
   */
  heldByNode(): Map<number, number> {
    const graph = navOf(this).graph;
    if (this.held?.graph !== graph) {
      const count = new Map<number, number>();
      const { controller } = this.cells;
      const nodeOf = graph.nodeOf;
      // Cells come in runs of one node and holder: count the run, then add it once.
      let runKey = -1;
      let run = 0;
      for (let i = 0; i <= nodeOf.length; i++) {
        const key = i < nodeOf.length && nodeOf[i] !== 0 ? nodeOf[i]! * 65536 + controller[i]! : -1;
        if (key === runKey) {
          run++;
          continue;
        }
        if (runKey >= 0) count.set(runKey, (count.get(runKey) ?? 0) + run);
        runKey = key;
        run = 1;
      }
      this.held = { graph, count };
      this.heldKeys++;
      this.heldLog = [];
      this.heldLogBase = this.heldKeys;
    }
    return this.held.count;
  }

  /**
   * Queue a command for the next tick boundary. One of a kind the sim does not know is refused
   * (false): it is not queued, takes no sequence number and never reaches the command log, so
   * the game is that of a sim that never got it (PLAN 2.12b).
   */
  enqueue(cmd: Command): boolean {
    if (!isCommand(cmd)) return false;
    this.pending.push({ seq: this.nextCommandSeq++, cmd });
    return true;
  }

  /** Authoritative parts in a fixed order (the save/hash layout). */
  parts(): Stateful[] {
    return [this.core, this.cells, this.nations, this.formations, this.cities, this.production, this.research, this.elements, this.wars, this.alliances, this.provinces, this.buffs, this.battles, this.history, this.stats, this.edits];
  }

  cellIndex(x: number, y: number): number {
    return y * this.cells.w + x;
  }
}
