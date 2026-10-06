/**
 * The authoritative world state (SPEC §3). Everything here is serialized and hashed;
 * nothing outside this object influences a tick except queued commands.
 */
import { makeNavGrid, type NavGrid } from './nav/grid';
import { buildProvinceGraph, type ProvinceGraph } from './nav/provinceGraph';
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
import { cellInland, landPoint, maskSure, type LandMask } from '../shared/landMask';

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
  /** Elements per unit type (PLAN 1.13): unit = index into ScenarioRules.units. */
  elements: readonly { unit: number; count: number }[];
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
}
export interface ScenarioRules {
  templates: readonly TemplateRule[];
  units: readonly UnitRule[];
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
  /** 1 while in contact with an enemy (PLAN 1.13): holds position and fights. */
  engaged: 'u8',
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
    return [
      { name: 'world.meta', dtype: 'f64', data: meta },
      { name: 'world.rng', dtype: 'u32', data: w.rng.save() },
      { name: 'world.commandLog', dtype: 'u8', data: log },
      { name: 'world.names', dtype: 'u8', data: names },
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
    // Derived caches describe the previous state: drop them (rebuilt on demand).
    w.paths.clear();
    w.elementIndex = null;
    w.contacts = null;
    w.deployed = null;
    w.deployedBefore = null;
    w.nav = null;
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
   * Derived (not state): per supply bloc, the row spans its last flood filled, as [start, end)
   * cell pairs (the first `n` entries of `spans`), and the crossing lanes among them. Valid
   * from a full refresh on; a full refresh rebuilds it.
   */
  supplySpans = new Map<number, { spans: Int32Array; n: number; lanes: number[] }>();
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
  deployed: Map<number, { x: number; y: number; facing: number } | null> | null = null;
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
   * wanders inside a pixel: PLAN 2.9b). True where there is no mask to ask.
   */
  onLand(x: number, y: number): boolean {
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

  /** (`x`, `y`) where the fine mask has it on land; else where a formation stands in the cell that holds it. */
  standPoint(x: number, y: number): [number, number] {
    if (this.onLand(x, y)) return [x, y];
    const w = this.cells.w;
    const cx = Math.min(w - 1, Math.max(0, Math.floor(x)));
    const cy = Math.min(this.cells.h - 1, Math.max(0, Math.floor(y)));
    return this.cellPoint(cy * w + cx);
  }

  /** Derived caches (not state): formation paths and the navigation graph. */
  paths = new Map<number, Int32Array>();
  nav: { grid: NavGrid; graph: ProvinceGraph } | null = null;
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
    this.controlChanges++;
    this.supplyDirtyNations.add(c.controller[i]!);
    this.supplyDirtyNations.add(nation);
    if (c.supply[i] !== 0) this.supplyDirtyBlocs.add(c.supply[i]!);
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
    return [this.core, this.cells, this.nations, this.formations, this.cities, this.production, this.elements, this.wars, this.alliances, this.provinces, this.buffs, this.battles, this.history, this.stats, this.edits];
  }

  cellIndex(x: number, y: number): number {
    return y * this.cells.w + x;
  }
}
