/**
 * The authoritative world state (SPEC §3). Everything here is serialized and hashed;
 * nothing outside this object influences a tick except queued commands.
 */
import { makeNavGrid, type NavGrid } from './nav/grid';
import { buildLaneGraph, type LaneGraph, type SeaPassage } from './nav/lanes';
import { buildProvinceGraph, type ProvinceGraph } from './nav/provinceGraph';
import { buildSeaZones, type SeaSeed, type SeaZones } from './nav/seaZones';
import type { Port } from './data/ports';
import { isCommand, type Command, type LoggedCommand } from '../shared/commands';
import type { EventKind } from '../shared/events';
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
import type { TechMask, TechRule } from './tech';
import { cellInland, landPoint, landWay, maskSure, type LandMask } from '../shared/landMask';

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

/** Scenario rules the sim needs to apply commands (not state: fixed by the scenario). */
export interface TemplateRule {
  /** Gold and manpower paid when queued. */
  gold: number;
  manpower: number;
  /** Training days. */
  days: number;
  /** Mobility class (nav/grid Mobility: 0 foot, 1 motor, 2 tracked) and march speed, km/h. */
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
  /** Men, guns or vehicles per element, and men per such unit (manpower ÷ elementSize). */
  size: number;
  menPerUnit: number;
  soft: number;
  hard: number;
  armor: number;
  piercing: number;
  hpPerUnit: number;
  /** Fuel an element of it burns in an hour on the march (`fuelPerHour` of the unit data). */
  fuel: number;
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
  fires: number[] = [];

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
    const meta = new Float64Array([w.seed, w.tick, w.cells.w, w.cells.h, w.nextCommandSeq, w.startDay, w.settings.winnerTakesAll ? 1 : 0, w.settings.revoltMode === 'region' ? 1 : 0, CE_MODES.indexOf(w.settings.ceMode), w.settings.aiEnabled ? 0 : 1, w.settings.player, w.settings.loopingMap ? 0 : 1]);
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
    ];
  }

  deserialize(sections: readonly Section[]): void {
    const w = this.world;
    const meta = takeSection(sections, 'world.meta', 'f64');
    const [seed = 0, tick = 0, cw = 0, ch = 0, nextSeq = 0, startDay = 0, winnerTakesAll = 0, revoltRegion = 0, ceMode = 0, aiOff = 0, player = 0, noLoop = 0] = meta;
    if (cw !== w.cells.w || ch !== w.cells.h) throw new Error(`map size mismatch: save ${cw}×${ch}, world ${w.cells.w}×${w.cells.h}`);
    w.seed = seed;
    w.tick = tick;
    w.nextCommandSeq = nextSeq;
    w.startDay = startDay;
    w.settings = { winnerTakesAll: winnerTakesAll === 1, revoltMode: revoltRegion === 1 ? 'region' : 'province', ceMode: CE_MODES[ceMode] ?? 'dynamic', aiEnabled: aiOff !== 1, player, loopingMap: noLoop !== 1 };
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
    // Derived caches describe the previous state: drop them (rebuilt on demand).
    w.elementIndex = null;
    w.contacts = null;
    w.deployed = null;
    w.deployedBefore = null;
    w.nav = null;
    w.sea = null;
    w.lanes = null;
    w.frontier = null;
    w.dropLandCounts();
    w.terrainVersion++;
    w.citiesVersion++;
    w.flipping = null;
    w.supplyDirty = true;
    w.out.fires.length = 0;
    w.out.markAllDirty();
  }
}

/** The navigation grid and province graph for the world's static layers (built once, cached). */
export function navOf(world: World): { grid: NavGrid; graph: ProvinceGraph } {
  if (!world.nav) {
    const grid = makeNavGrid(world.cells.terrain, world.cells.w, world.cells.h, world.settings.loopingMap);
    world.nav = { grid, graph: buildProvinceGraph(grid, world.cells.province) };
  }
  return world.nav;
}

/** The sea zones for the world's terrain and its map's seeds (PLAN 4.1a; built once, cached). */
export function seaOf(world: World): SeaZones {
  return (world.sea ??= buildSeaZones(navOf(world).grid, world.seaSeeds));
}

/** The lane graph over the sea zones and the map's passages, with the world's ports (PLAN 4.1b, 4.1c; built once, cached). */
export function laneOf(world: World): LaneGraph {
  return (world.lanes ??= buildLaneGraph(navOf(world).grid, seaOf(world), world.seaPassages, world.ports, world.portReach));
}

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
  /** Derived: bumped when God Mode renames a nation (labels re-derive, PLAN 1.32b). */
  namesVersion = 0;
  /** Global settings (state, saved in world.meta). */
  settings: { winnerTakesAll: boolean; revoltMode: 'province' | 'region'; ceMode: CeMode; aiEnabled: boolean; player: number; loopingMap: boolean } = {
    winnerTakesAll: false,
    revoltMode: 'province',
    ceMode: 'dynamic',
    aiEnabled: true,
    /** The nation the player controls (0 = none; PLAN 1.33, saved so a load keeps control). */
    player: 0,
    /** The map wraps east–west (PLAN 1.39b1 new-game option; scenario default on). */
    loopingMap: true,
  };
  /** Derived (not state): territory frontier cells and the wars version it was built for. */
  frontier: Set<number> | null = null;
  /** Derived (not state): cells by node of the province graph and holder (`heldByNode`). */
  private held: { graph: ProvinceGraph; count: Map<number, number> } | null = null;
  /** Derived (not state): land tallies, kept by setOwner/setController once built. */
  private land: LandCounts | null = null;
  /** Derived (not state): the frontier set as a byte per cell (valid whenever `frontier` is). */
  frontierMask: Uint8Array | null = null;
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
  nav: { grid: NavGrid; graph: ProvinceGraph } | null = null;
  /**
   * The seeds of the map's named seas (PLAN 4.1a): static data of the map, not state (not saved,
   * not hashed). None on the toy world: its water is given zones with no name.
   */
  seaSeeds: readonly SeaSeed[] = [];
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

  constructor(seed: number, w: number, h: number) {
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
        if (left === 0) this.held.count.delete(from);
        else this.held.count.set(from, left);
        this.held.count.set(node * 65536 + nation, (this.held.count.get(node * 65536 + nation) ?? 0) + 1);
      }
    }
    this.controlChanges++;
    this.supplyDirtyNations.add(c.controller[i]!);
    this.supplyDirtyNations.add(nation);
    if (c.supply[i] !== 0) this.supplyDirtyBlocs.add(c.supply[i]!);
    if (!this.supplyChanged.has(i)) this.supplyChanged.set(i, c.controller[i]! * 65536 + c.owner[i]!);
    c.controller[i] = nation;
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
