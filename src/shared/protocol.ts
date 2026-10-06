import type { GameOptions } from './gameOptions';
import type { LandMask } from './landMask';
/**
 * Main ↔ worker messages (SPEC §2.3) and the snapshot layout (SPEC §2.4).
 *
 * Flow control: the worker sends at most one snapshot per ack. Main acks from
 * requestAnimationFrame and transfers the snapshot's buffers back for reuse. While main
 * is busy, ticks keep running: dirty tiles accumulate and events queue, so a later
 * snapshot carries everything that changed (coalescing) and no event is lost.
 */
import type { Command } from './commands';

export type ScenarioId = 'toy' | '1938' | 'random';

/** Decoded map assets a real-map scenario is built from (PLAN 1.9a). */
export interface ScenarioAssets {
  admin1Geometry: Uint8Array;
  /** JSON Admin1Meta[] bytes. */
  admin1Meta: Uint8Array;
  /** Terrain raster at the scenario's map size. */
  terrain: Uint8Array;
  /**
   * The fine land mask (PLAN 2.9a): where on a coastal cell a formation and its elements stand.
   * A world built without it stands on the cells' middles, and is another world: its hash
   * differs. Every way of building the 1938 world gives it (the worker, the Node loader).
   */
  landMask?: LandMask;
}

export interface SimInit {
  scenario: ScenarioId;
  seed: number;
  /** Required for '1938' and 'random'. In the worker, `init` loads them from `assetBase` when absent. */
  assets?: ScenarioAssets;
  /** New-game options (PLAN 1.39b1): looping map, random aggression/traits/gold, CE mode. */
  options?: GameOptions;
}

/** Ticks per second, or 'max' (as fast as the worker can run). */
export type Speed = number | 'max';

/** Level-of-detail tier (SPEC §8). 1.5 = elements start to appear. */
export type Tier = 0 | 1 | 1.5 | 2 | 3;

/** What main is looking at. Changes only what is sent, never sim state (invariant I4). */
export interface Subscription {
  /** World-unit box [x0, y0, x1, y1]; x wraps on looping maps (x1 may exceed the map width). */
  bbox: [number, number, number, number];
  /** Continuous zoom level. */
  z: number;
  tier: Tier;
  wantsElements: boolean;
}

/** Requests that expect a `reply` carry a caller-chosen `reqId`. */
export type ToWorker =
  /** `assetBase`: URL of the map asset directory, for scenarios built from map assets. */
  | { type: 'init'; reqId: number; init: SimInit; assetBase?: string }
  | { type: 'step'; reqId: number; n: number }
  /**
   * A command for the next tick boundary. `now` (God Mode UI, PLAN 1.32b) applies it at once,
   * between ticks, as `Sim.applyNow` does in Node; a plain `cmd` stays pending until the next step.
   */
  | { type: 'cmd'; cmd: Command; now?: boolean }
  | { type: 'hash'; reqId: number }
  /** PLAN 1.32: a JSON summary of the world (`Inspection`) for tests and the critic. */
  | { type: 'inspect'; reqId: number; full?: boolean }
  /** PLAN 1.34a: the history log as JSON `HistoryRow[]` in the reply bytes. */
  | { type: 'history'; reqId: number }
  /**
   * PLAN 2.14b: one formation as JSON `FormationDetail` in the reply bytes (`null` when it is gone).
   * With `generation` (that of an earlier reply): that formation and no other, so `null` too
   * when another has taken its id since (PLAN 2.16Ri).
   */
  | { type: 'formation'; reqId: number; id: number; generation?: number }
  /** PLAN 2.14e: the largest battle of war `war` as JSON `WarBattle` in the reply bytes (`null` when it has none). */
  | { type: 'warBattle'; reqId: number; war: number }
  /** PLAN 1.34b: the statistics series as raw f32 bytes (STAT_STRIDE records). */
  | { type: 'stats'; reqId: number }
  | { type: 'save'; reqId: number }
  /** PLAN 1.38: the world as a scenario (run history dropped): state bytes + their hash. */
  | { type: 'exportScenario'; reqId: number }
  | { type: 'load'; reqId: number; bytes: Uint8Array }
  | { type: 'speed'; speed: Speed }
  | { type: 'pause'; paused: boolean }
  | { type: 'subscribe'; sub: Subscription }
  | { type: 'ack'; seq: number; buffers: ArrayBuffer[] }
  /** Builds the admin-1 province raster at w×h from the map assets under `assetBase`. */
  | { type: 'buildProvinces'; reqId: number; assetBase: string; w: number; h: number; withIds: boolean }
  /** Loads the w×h terrain raster from `assetBase` and applies the map's crossings (PLAN 1.2). */
  | { type: 'buildTerrain'; reqId: number; assetBase: string; w: number; h: number }
  /** Builds the 1938 political map (provinces + terrain + ownership) at w×h (PLAN 1.3). */
  | { type: 'buildPolitical'; reqId: number; assetBase: string; w: number; h: number };

/** Result of `buildProvinces` (PLAN 0.19). */
export interface ProvinceBuildResult {
  w: number;
  h: number;
  provinces: number;
  present: number;
  forced: number;
  missing: number;
  landCells: number;
  /** xxHash32 of the id raster (determinism check against Node). */
  hash: number;
  ms: { fetch: number; decode: number; raster: number; total: number };
  /** Province id per cell, when requested. */
  ids?: Uint16Array;
}

export interface SimStatus {
  tick: number;
  hash: number;
}

/** Per-nation record in `Snapshot.nations` (stride NATION_STRIDE). */
/**
 * `alliance` = the nation's alliance leader id (0 = none; PLAN 1.17 alliance map mode);
 * `overlord` = its overlord id (0 = independent; PLAN 1.18 puppet map mode);
 * `income` = last month's gross income (PLAN 1.30 income map mode);
 * `living` = 1, or 0 for a destroyed nation: its row stays (its colour is still on the charts),
 * its capital is where it last was and is no capital any more (PLAN 2.7g);
 * `founded` = 1 for a nation founded in the game, which no scenario gives a flag (PLAN 2.15c).
 */
export const NationField = { id: 0, color: 1, cells: 2, capitalX: 3, capitalY: 4, alliance: 5, overlord: 6, income: 7, living: 8, founded: 9 } as const;
export const NATION_STRIDE = 10;

export interface SnapshotTiles {
  /** Tile side in cells. */
  size: number;
  tilesX: number;
  tilesY: number;
  count: number;
  /** Tile indices (ty·tilesX + tx). */
  ids: Uint32Array;
  /** count·size² cells per layer, row-major within each tile; cells past the map edge are 0. */
  owner: Uint16Array;
  controller: Uint16Array;
}

export interface SnapshotFormations {
  count: number;
  id: Uint32Array;
  nation: Uint16Array;
  x: Float64Array;
  y: Float64Array;
  /** Position one tick before `Snapshot.tick` (for interpolation). */
  prevX: Float64Array;
  prevY: Float64Array;
  facing: Float32Array;
  strength: Uint32Array;
  /** Template index (symbol and full strength via `mapLayers.templates`; PLAN 2.1). */
  template: Uint16Array;
  /** Bit 0: moving; bit 1: engaged (PLAN 2.1 markers). */
  flags: Uint8Array;
  /** Order target cell while moving (row-major index), else 0. */
  target: Uint32Array;
}

/**
 * Elements of the formations inside the subscribed bbox (PLAN 2.3), only when the subscription
 * `wantsElements` at tier ≥ 1.5. Positions are slot poses (`sim/core/pose`), the same the sim
 * uses, so every tier agrees.
 */
export interface SnapshotElements {
  count: number;
  id: Uint32Array;
  formation: Uint32Array;
  nation: Uint16Array;
  /** Atlas frame of the element's unit class (shared/unitLooks Frame). */
  frame: Uint8Array;
  strength: Uint16Array;
  /** The element's units when whole (the unit type's element size): T3 draws a battalion by its share of it (PLAN 2.10b, ADR-80). */
  size: Uint16Array;
  x: Float64Array;
  y: Float64Array;
  prevX: Float64Array;
  prevY: Float64Array;
  facing: Float32Array;
  /** FormationFlag bits of the element's formation. */
  flags: Uint8Array;
  /** True when the cap cut the list short. */
  truncated: boolean;
}

/** Most elements one snapshot carries (SPEC §6: ≤ 40k). */
export const MAX_SNAPSHOT_ELEMENTS = 40_000;

/** Tier from metres per CSS pixel (SPEC §8 table; 1.5 is the T1→T2 hand-over band). */
export function tierOf(mPerPx: number): Tier {
  return mPerPx > 2000 ? 0 : mPerPx > 450 ? 1 : mPerPx > 300 ? 1.5 : mPerPx > 30 ? 2 : 3;
}

/** Formation flags in `SnapshotFormations.flags`. */
export const FormationFlag = { moving: 1, engaged: 2 } as const;

/**
 * Whether a formation with these flags is on the march: it has a march (`moving`) and is not
 * held in contact (`engaged`). The sim moves it then and only then (`movementSystem`: "in
 * contact: holds and fights"), so that is when its sprites walk (PLAN 2.11e).
 */
export function marching(flags: number): boolean {
  return (flags & FormationFlag.moving) !== 0 && (flags & FormationFlag.engaged) === 0;
}

export interface SnapshotEvents {
  count: number;
  /** count·EVENT_STRIDE records [seq, tick, kind, a, b, x, y] (shared/events). */
  data: Float64Array;
  /** Events dropped from the queue because it hit its hard cap (should stay 0). */
  dropped: number;
}

/**
 * Fire events since the last snapshot with an end inside the subscribed bbox (PLAN 2.4): only
 * for a subscription with `wantsElements` at tier ≥ 1.5, as the elements are.
 */
export interface SnapshotFires {
  count: number;
  /** count·FIRE_STRIDE records (shared/events `FireField`; the weapon slot holds a `Weapon` of shared/unitLooks). */
  data: Float64Array;
  /** Fires dropped because the queue hit its cap: a snapshot that spans many ticks (should stay 0 at ×5). */
  dropped: number;
}

export interface Snapshot {
  seq: number;
  tick: number;
  speed: Speed;
  paused: boolean;
  /** Expected wall-clock ms per tick at the current speed (0 when paused). */
  tickMs: number;
  tiles: SnapshotTiles;
  nations: { count: number; data: Float64Array };
  /** Pairs of nations at war, flattened [a0, b0, a1, b1, …] (map modes, PLAN 1.30). */
  wars: Uint16Array;
  formations: SnapshotFormations;
  elements: SnapshotElements;
  /** Active Major Battles as flat [x, y, …] (battle markers, PLAN 2.1). */
  majors: Float32Array;
  events: SnapshotEvents;
  fires: SnapshotFires;
  /** Every pooled buffer backing the arrays above, transferred to main and returned on ack. */
  buffers: ArrayBuffer[];
}

/** Result of `buildTerrain` (PLAN 1.2). */
export interface TerrainBuildResult {
  w: number;
  h: number;
  /** Cells per class, indexed by Terrain (src/shared/terrain.ts). */
  counts: number[];
  crossings: { id: string; cells: number; linked: boolean }[];
  /** xxHash32 of the class raster. */
  hash: number;
  ms: { fetch: number; decode: number; total: number };
  /** Class per cell (u8). */
  terrain: Uint8Array;
}

/** A placed city (PLAN 1.5): true position in cells, owning nation, capital role (0 = none). */
export interface CityInfo {
  name: string;
  x: number;
  y: number;
  size: number;
  owner: number;
  capitalOf: number;
}

/** A starting formation marker (PLAN 1.7): position in cells, nation id, template id. */
export interface FormationInfo {
  x: number;
  y: number;
  nation: number;
  template: string;
}

/** Result of `buildPolitical` (PLAN 1.3). */
export interface PoliticalBuildResult {
  w: number;
  h: number;
  /** Owned cells per nation id (index 0 = unowned/water). */
  cells: number[];
  /** xxHash32 of owner and controller rasters. */
  ownerHash: number;
  controllerHash: number;
  ms: { total: number };
  owner: Uint16Array;
  controller: Uint16Array;
  cities: CityInfo[];
  formations: FormationInfo[];
}

import type { LandCoverage } from './landCoverage';

export type FromWorker =
  /**
   * `status.hash` is NaN for read-only queries (inspect, history, stats: not computed).
   * `scenarioHash`: the state hash of exported scenario bytes (PLAN 1.38).
   */
  | { type: 'reply'; reqId: number; status: SimStatus; bytes?: Uint8Array; scenarioHash?: number }
  | { type: 'error'; reqId: number; message: string; stack: string }
  | { type: 'snapshot'; snap: Snapshot }
  /** A command was not carried out; `reason` is a `Refusal` (shared/commands; PLAN 2.17a). */
  | { type: 'refused'; reason: number }
  | { type: 'provinces'; reqId: number; result: ProvinceBuildResult }
  | { type: 'terrain'; reqId: number; result: TerrainBuildResult }
  | { type: 'political'; reqId: number; result: PoliticalBuildResult }
  /**
   * Static map layers for the renderer (PLAN 1.28b), sent once after a real-geography init:
   * land coverage for the fine coastline, the terrain layer and terrain colours (0xRRGGBB).
   */
  | {
      type: 'mapLayers';
      land: LandCoverage;
      terrain: { w: number; h: number; data: Uint8Array };
      terrainColors: number[];
      /** City dots and names (positions in cells; size 1..5; capital at send time). */
      cities: { id: number; name: string; x: number; y: number; size: number; capital: boolean }[];
      /** Admin-1 province per cell (revolts map mode, PLAN 1.30b). */
      province: Uint16Array;
      /** Buildable land templates (index = command template id; PLAN 1.33b). */
      templates: TemplateInfo[];
      /** The scenario's techs (index = the tech's bit in `NationStat.techs`; PLAN 3.1e). */
      techs: TechInfo[];
    }
  /**
   * The land's height for the hillshade (PLAN 2.8a): metres, one value a cell of the map (`w` ×
   * `h` = the map's size), row-major. Sent once after `mapLayers`, so that the map does not wait
   * for it; a map without an elevation asset of its size sends none.
   */
  | { type: 'elevation'; w: number; h: number; data: Int16Array }
  /**
   * The fine land mask the world was built with (PLAN 2.9a): a copy for the page, which draws the
   * coast of T2 and T3 from it. Sent once after `mapLayers`; a world without one sends none.
   */
  | { type: 'landMask'; mask: LandMask }
  /** Custom pixel flags (PLAN 1.37b): [nation, runs][] (runs as in `setFlag`), after init and on change. */
  | { type: 'flags'; custom: [number, number[]][] }
  /** City dots and names again after editor city edits (PLAN 1.36). */
  | { type: 'cityLayer'; cities: { id: number; name: string; x: number; y: number; size: number; capital: boolean }[] }
  /** The terrain layer again after editor terrain edits (PLAN 1.35). */
  | { type: 'terrainLayer'; data: Uint8Array; landChanged: boolean }
  /** Unrest per province id, 0..100 (index 0 unused; PLAN 1.30b), sent when it changes. */
  | { type: 'provinceStats'; unrest: Uint8Array }
  /** Nation label curves (PLAN 1.29; LABEL_STRIDE records) and per-label names (i18n key, or '=' + literal). */
  | { type: 'labels'; data: Float64Array; names: string[] }
  /** Per-nation panel data and active wars (PLAN 1.31), at most once a second while ticks advance. */
  | { type: 'nationStats'; tick: number; nations: NationStat[]; wars: WarStat[]; dead: { id: number; name: string; color: number }[]; aiEnabled: boolean; player: number; edits: { undo: number; redo: number } };

/** A buildable land template for the production UI (PLAN 1.33b). */
export interface TemplateInfo {
  nameKey: string;
  gold: number;
  manpower: number;
  days: number;
  men: number;
  /** Marker symbol class from the template's elements (PLAN 2.1). */
  symbol: UnitSymbol;
  /** The techs a nation must know to raise it, as bits (PLAN 3.1a; `NationStat.techs`). */
  techs: readonly [number, number];
}

/** A tech for the nation panel (PLAN 3.1e): its name and what its research costs. */
export interface TechInfo {
  nameKey: string;
  gold: number;
  days: number;
}

export type UnitSymbol = 'infantry' | 'armour' | 'motorised' | 'cavalry' | 'mountain' | 'garrison';

/** One living nation for the UI panels (PLAN 1.31). Names are i18n keys or '=' + literal. */
export interface NationStat {
  id: number;
  name: string;
  color: number;
  cells: number;
  /** Owned land in km² and as a share of all owned land (ADR-52: area, not cells). */
  area: number;
  landShare: number;
  gold: number;
  income: number;
  expenses: number;
  incomeBonus: number;
  bankrupt: boolean;
  manpower: number;
  /** Men in its formations, and their count. */
  men: number;
  formations: number;
  efficiency: number;
  alliance: { id: number; name: string; leader: number; unity: number; loyalty: number } | null;
  overlord: number;
  autonomy: number;
  loyalty: number;
  integration: number;
  puppets: number[];
  enemies: number[];
  aiOff: boolean;
  /** AI aggression 0..100 and income multiplier from traits (PLAN 1.39b1 options). */
  aggression: number;
  incomeMult: number;
  /** Formations in training: template index and the day (ticks / 24) they are ready. */
  queue: { template: number; readyDay: number }[];
  /** The techs it knows, as bits 0..31 and 32..63 (PLAN 3.1a). */
  techs: readonly [number, number];
  /** Its research budget in gold per month, like `income` (the sim holds it per day; PLAN 3.1b). */
  research: number;
  /** What it is researching, in the order the lines were opened: index into `mapLayers.techs` and the gold paid. */
  lines: { tech: number; paid: number }[];
}

/**
 * Reply to `formation` (PLAN 2.14b): what the formation panel shows, as the sim has it. The
 * view's snapshot has a formation's place and strength, and its elements only at close zoom:
 * the panel asks, so that it says the same at every zoom.
 */
export interface FormationDetail {
  id: number;
  /**
   * How often the id has been given out (`Table.generation`): with the id it says which
   * formation this is, in this worker and between two loads. Ids are given out again.
   */
  generation: number;
  tick: number;
  nation: number;
  /** Index of its template (the view has the template's name), and the men of a whole one (0 = no template). */
  template: number;
  full: number;
  /** Men now. */
  strength: number;
  /** Supply 0..1. */
  supply: number;
  engaged: boolean;
  moving: boolean;
  x: number;
  y: number;
  /** Its elements by unit type, in the template's order: how many elements, their units now and when whole. */
  units: { nameKey: string; cls: string; elements: number; strength: number; size: number }[];
}

/**
 * Reply to `warBattle` (PLAN 2.14e): the largest battle of a war and where to look at it, for
 * the click on the war's banner (`largestBattle` in sim/systems/warBattle.ts).
 */
export interface WarBattle {
  war: number;
  tick: number;
  /**
   * Where to look, in cells: the middle between the blocks of the two formations in `formations`,
   * an attacker's and a defender's in contact, the pair with the most men among those that
   * are each other's nearest enemy (they stand front to front, a kilometre apart).
   */
  x: number;
  y: number;
  formations: [number, number];
  /** Formations and men of the battle: [attackers, defenders]. */
  count: [number, number];
  men: [number, number];
}

/** Reply to `inspect` (PLAN 1.32): enough sim state to assert God Mode effects. */
export interface Inspection {
  tick: number;
  /** World seed (PLAN 1.39a). */
  seed: number;
  settings: { winnerTakesAll: boolean; revoltMode: string; ceMode: string; aiEnabled: boolean; player: number; loopingMap: boolean };
  /** Every nation ever created (dead ones too), with its display name key ('=' + literal). */
  nations: (NationStat & { living: boolean })[];
  wars: WarStat[];
  alliances: { id: number; name: string; leader: number; members: number[]; unity: number }[];
  buffs: { id: number; kind: string; targetKind: string; target: number; magnitude: number; until: number }[];
  majors: { id: number; camps: [number[], number[]] }[];
  corridors: number;
  /** Unrest per province id (`full` only, else empty). */
  unrest: number[];
  /** Cells per terrain class (PLAN 1.37a import AT). */
  terrainCounts: number[];
  /** xxhash32 of the cell layers (PLAN 1.35 editor AT). */
  rasters: { owner: number; controller: number; terrain: number };
  /** Editor stack depths. */
  edits: { undo: number; redo: number };
  /** Cities (PLAN 1.36; `full` only, else empty): row, display name, position, size, capital of. */
  cities: { id: number; name: string; x: number; y: number; size: number; capitalOf: number }[];
  /**
   * Formations (`full` only, else empty; PLAN 2.1): the formation's strength and, independently,
   * the men summed over its elements (Σ element units × men per unit).
   */
  formations: { id: number; nation: number; strength: number; elementMen: number; elements: number; x: number; y: number }[];
  /** Nations with a core or claim per province that has any (PLAN 1.36; `full` only, else empty). */
  cores: { province: number; nations: number[] }[];
}

/** An active war (PLAN 1.31): side leaders first; score > 0 favours the attackers. */
export interface WarStat {
  id: number;
  attackers: number[];
  defenders: number[];
  score: number;
  startTick: number;
  /**
   * Whether the war has a battle now: formations of its two sides in contact (PLAN 2.14f5b3,
   * ADR-96; `warsWithBattle`). True where `warBattle` has an answer, as of this message's tick.
   */
  battle: boolean;
}
