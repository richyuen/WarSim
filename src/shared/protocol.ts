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
import type { TickerRow } from './history';

/** `restraintOf`'s reasons but `none` (PLAN 7.37f; `src/sim/systems/nuclear.ts`, `RestraintReason`). */
export type RestraintWhy = 'puppet' | 'aiOff' | 'nukesOff' | 'avenging' | 'paused' | 'noThreat' | 'noPlace' | 'mad' | 'deterred' | 'alliance' | 'outrage' | 'taboo' | 'dead' | 'noValue' | 'notDesperate' | 'doctrine' | 'noMeans' | 'outOfRange' | 'strikes';

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
  /** PLAN 7.4f34: nation `nation`'s month in parts as JSON `EconomyBreakdown` in the reply bytes (`null` with no economy). */
  | { type: 'economy'; reqId: number; nation: number }
  /** PLAN 2.14e: the largest battle of war `war` as JSON `WarBattle` in the reply bytes (`null` when it has none). */
  | { type: 'warBattle'; reqId: number; war: number }
  /** PLAN 1.34b: the statistics series as raw f32 bytes (SERIES_STRIDE records: `chartRows`, PLAN 5.11c). */
  | { type: 'stats'; reqId: number }
  | { type: 'save'; reqId: number }
  /** PLAN 1.38: the world as a scenario (run history dropped): state bytes + their hash. */
  | { type: 'exportScenario'; reqId: number }
  | { type: 'load'; reqId: number; bytes: Uint8Array }
  | { type: 'speed'; speed: Speed }
  | { type: 'pause'; paused: boolean }
  /** Whether the worker pauses itself at the tick of a nuclear strike (PLAN 7.109a: the host's pause came a second late, ~155 game hours at Max). */
  | { type: 'nukePause'; on: boolean }
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

/** Numbers a formation in `SnapshotFormations.block`: x, y, and x, y a tick before. */
export const BLOCK_STRIDE = 4;

export interface SnapshotFormations {
  count: number;
  id: Uint32Array;
  /**
   * How often each id has been given out (`Table.generation`): a formation made with a dead one's
   * id has another (PLAN 7.4f23). Not state: an observer's means to tell the two apart.
   */
  generation: Uint32Array;
  nation: Uint16Array;
  /** Its place in the rules: where its T1 marker stands, and what the T0 counters count by. */
  x: Float64Array;
  y: Float64Array;
  /** Position one tick before `Snapshot.tick` (for interpolation). */
  prevX: Float64Array;
  prevY: Float64Array;
  /**
   * Where its block stands (PLAN 3.11a, ADR-198), `BLOCK_STRIDE` numbers a formation: x, y,
   * and x, y a tick before. Its place in the rules, or, for one in contact, where it is
   * deployed against the enemy (`deployOf`, up to `DEPLOY_REACH` from that place). The middle
   * of its elements: where the close tiers, the click and the camera have the formation.
   * (One array and not four: a snapshot's buffers are pooled one by one.)
   */
  block: Float64Array;
  /** What the block faces: the enemy, for one in contact. */
  facing: Float32Array;
  strength: Uint32Array;
  /** Template index (symbol and full strength via `mapLayers.templates`; PLAN 2.1). */
  template: Uint16Array;
  /** Bit 0: moving; bit 1: engaged (PLAN 2.1 markers). */
  flags: Uint8Array;
  /** Order target cell while moving (row-major index), else 0. */
  target: Uint32Array;
  /** The formation it is in contact with, its nearest enemy in contact (`contactsOf`, PLAN 7.34d), else 0. */
  enemy: Uint32Array;
  /**
   * The way left of a fleet under way (PLAN 4.7d, `wayLine`): the points its order line turns
   * at, `x, y` in cells by twos, formation i's from `wayStart[i]` to `wayStart[i + 1]` (in
   * numbers; none for one at rest). Of a march on land, its place and where it will stand (the
   * target cell's `cellPoint`, PLAN 7.4g3). `wayStart` has count + 1 entries.
   */
  wayStart: Uint32Array;
  way: Float32Array;
}

/**
 * Elements of the formations inside the subscribed bbox (PLAN 2.3), only when the subscription
 * `wantsElements` at tier ≥ 1 (PLAN 7.21c1: a T1 marker shows its elements; ≥ 1.5 before).
 * Positions are slot poses (`sim/core/pose`), the same the sim uses, so every tier agrees.
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
  /**
   * 1 where the element was fired at since the snapshot before, by anything and from anywhere
   * (PLAN 3.6e5); all 0 below tier 1.5, where no fire is kept (PLAN 7.21c1). The fires of a
   * snapshot are those with an end in the box; an element is sent with its formation, in the box
   * or not.
   */
  hit: Uint8Array;
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
/** Bit 2 (PLAN 7.4g2): on the retreat (`retreat` hours left), drawn on its T1 marker. */
export const FormationFlag = { moving: 1, engaged: 2, retreating: 4 } as const;

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
 * for a subscription with `wantsElements` at tier ≥ 1.5, where the elements are drawn (they are
 * sent from tier 1: PLAN 7.21c1).
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
  /**
   * The sea battles going on (PLAN 4.10b), SEA_STRIDE each: [x, y, r, a, b, cx, cy, sx, sy, px,
   * py, pw, ph]: its place, the cells from it to its furthest fleet, and its two sides' leaders; the
   * middle of the box of its fleets and the box's cells across, east-west and north-south (PLAN
   * 4.12a: a battle at a carrier's reach has its sides hundreds of km apart, its place by one of
   * them); the middle of its nearest two fleets at war with each other and the cells between them,
   * east-west and north-south (PLAN 7.10b: the pair that fights; the box of seed 9043's first
   * battle was 24 cells across), two within reach of a ship's weapon of either, its middle on the
   * water (PLAN 7.19b); pw −1 where no two are (a carrier's wings alone reach). Then [tx, ty,
   * by] (PLAN 7.35a): where no two are, the fleet its carriers' wings strike (`strikeTarget`) and
   * the striker's nation; by 0 for none. Then [nx, ny, nw, nh] (PLAN 7.41a): the middle of its
   * nearest two fleets at war with each other whatever their distance and the cells between
   * them; nw −1 for none. A battle with neither a pair nor a strike has the row of its fleets
   * closing, which frames these two. Then [kx, ky, kw, kh] (PLAN 7.84a): where a strike is, the
   * middle of the carrier's fleet and the fleet it strikes and the cells between them, the frame
   * of its row; kw −1 for none.
   */
  seas: Float32Array;
  /**
   * A carrier's strikes out of a sea battle (PLAN 7.154a), RAID_STRIDE each (`worker/carrierRaids`): [kx, ky, tx,
   * ty, by, on, ashore, fleet, mx, my, mw, mh]: the carrier's fleet's place, its target's, the carrier's nation, the
   * target's, 1 when the target is on land, the fleet's id; the middle of the fleet and the target and the cells
   * between them, east-west and north-south (its row's frame).
   */
  raids: Float32Array;
  /**
   * The sorties in the air (PLAN 5.7a), SORTIE_STRIDE each: [bx, by, tx, ty, launch, kmh, km,
   * over, nation, aircraft, role]: a sortie as `shared/sorties` has it, its launch as hours from
   * the snapshot's tick (so that a float holds it to the second), its wing's nation and aircraft,
   * and its role (`SortieRole`). Where it is at a frame is `sortieAt`'s, at −1 + the frame's
   * share of the tick: the hour the snapshot ends.
   */
  sorties: Float32Array;
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
  /**
   * A command was not carried out; `reason` is a `Refusal` (shared/commands; PLAN 2.17a). `base`,
   * for an editor's wing with no airbase near (PLAN 7.24b): the nearest of its nation's with room
   * for it and its km from the click, null where it holds none.
   */
  | { type: 'refused'; reason: number; base?: RefusedBase | null | undefined }
  /**
   * What became of a player's order of a formation (PLAN 4.9c), at once: `refused` (`reason`, a
   * `RejectReason`), a landing thrown back (`repulsed`), or troops ashore away from the order's
   * target (`landedAway`: their transports broke off). (`x`, `y`): the formation's place then.
   */
  | { type: 'orderNews'; news: OrderNews }
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
  /** Fallout for its map mode (PLAN 6.3c): its cells, by ascending index, and each one's level × 255; sent when it changed. */
  | { type: 'fallout'; cells: Uint32Array; levels: Uint8Array }
  /** The bursts the sim remembers (PLAN 7.11b), [x, y, days since, class (PLAN 7.20: 1 fission, 2 thermonuclear)] each: a struck city's ruin. */
  | { type: 'ruins'; bursts: Float32Array }
  /** Sea control for its map mode (PLAN 4.7a): the holder of each zone (index 0 unused), and the zone of each cell when the zones are new to the client; sent when either changes. */
  | { type: 'airControl'; holder: Uint16Array; zones?: Uint16Array }
  | { type: 'seaControl'; holder: Uint16Array; zones?: Uint16Array; /** With `zones`: each zone's sea's name ('' for none), index 0 unused (PLAN 4.10c). */ names?: string[] }
  /** Nation label curves (PLAN 1.29; LABEL_STRIDE records) and per-label names (i18n key, or '=' + literal). */
  | { type: 'labels'; data: Float64Array; names: string[] }
  /** Per-nation panel data and active wars (PLAN 1.31), at most once a second while ticks advance; the ticker's rows (PLAN 3.12c), the kinds of every major event since the message before (`news`, PLAN 3.12Rh2: the ticker's rows are the last five), and the number of the worker's world, which a new game or a load changes (PLAN 3.12d). */
  | { type: 'nationStats'; tick: number; nations: NationStat[]; wars: WarStat[]; dead: { id: number; name: string; color: number }[]; lives: NationLife[]; aiEnabled: boolean; nukesEnabled: boolean; rules: WorldRules; player: number; edits: { undo: number; redo: number }; ticker: TickerRow[]; news: number[]; strikes: TickerRow[]; world: number; wings: PlayerWing[] };

/** A buildable land template for the production UI (PLAN 1.33b). */
export interface TemplateInfo {
  nameKey: string;
  gold: number;
  manpower: number;
  days: number;
  men: number;
  /** Marker symbol class from the template's elements (PLAN 2.1); a fleet's is `fleet` (PLAN 4.2b). */
  symbol: UnitSymbol;
  /** Of the land (0), a fleet (1) or an air wing (2): `Domain` of the sim. */
  domain: number;
  /** An air wing's aircraft (PLAN 5.8v4; 0 for the land's and the sea's): the room it takes at an airfield. */
  aircraft: number;
  /** The techs a nation must know to raise it, as bits (PLAN 3.1a; `NationStat.techs`). */
  techs: readonly [number, number];
  /**
   * Its elements by the atlas frame of their unit's class (`frameOf`), in its order: what a T1
   * marker's pips are laid out by (PLAN 7.21c2).
   */
  parts: readonly { frame: number; count: number }[];
}

/** A tech for the nation panel (PLAN 3.1e): its name and what its research costs. */
export interface TechInfo {
  nameKey: string;
  gold: number;
  days: number;
}

export type UnitSymbol = 'infantry' | 'armour' | 'motorised' | 'cavalry' | 'mountain' | 'garrison' | 'fleet';

/**
 * One nation's month in parts (PLAN 7.4f34, the critic's N14: the economy tab was six numbers),
 * gold a month: the steps of `monthlyAccounts` for that nation, taken in the same order, so that
 * `gross` and `expenses` are its to the bit (`economyBreakdown.test.ts`). Each loss is the gold
 * its step takes from what the steps before left. No side effects; not state.
 */
export interface EconomyBreakdown {
  /** From the land it owns and holds, and from land it occupies (at OCCUPIED_SHARE). */
  ownLand: number;
  occupiedLand: number;
  /** Taken by a blockade of its ports, by raids on its convoys, by bombs, by fallout. */
  blockade: number;
  convoys: number;
  bombs: number;
  fallout: number;
  /** × its income multiplier, bonus and buffs: what that adds (or takes). */
  bonuses: number;
  gross: number;
  /** Upkeep of its formations by domain, its administration (capped), its warheads. */
  army: number;
  navy: number;
  air: number;
  admin: number;
  warheads: number;
  expenses: number;
}

/**
 * A nation's life, living or dead (PLAN 7.4f28, `worker/lives.ts`): the ranking's lists of a life,
 * which name the dead too, as AoC's do.
 */
export interface NationLife {
  id: number;
  living: boolean;
  /** Years alive, every life summed. */
  age: number;
  /** Wars it declared or had declared on it. */
  wars: number;
  /** Nations that rose on its land. */
  revolts: number;
}

/** One living nation for the UI panels (PLAN 1.31). Names are i18n keys or '=' + literal. */
/** An air wing of the nation the player controls (PLAN 5.8v1): what its Actions tab lists and orders. */
export interface PlayerWing {
  id: number;
  /** Its template's index. */
  template: number;
  /** Of transports (it flies supply, PLAN 5.8u1). */
  transport: boolean;
  /** Based on a carrier (its fleet's), not an airbase. */
  carrier: boolean;
  /** Its mission, none for null. */
  mission: 'patrol' | 'strike' | 'supply' | null;
  /** In the air on a sortie now. */
  flying: boolean;
  /**
   * At sea on its way to a new base (the sea ferry, PLAN 7.142, ADR-723): the whole days, rounded
   * up, until it is there; 0 when it is not at sea.
   */
  ferryDays: number;
}

/** The airbase a refused wing of the editor could go to (PLAN 7.24b): its name and km from the click. */
export interface RefusedBase {
  name: string;
  km: number;
}

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
  /** Its air force (PLAN 5.11b): its wings' aircraft and how many wings; the aircraft it has lost, in the air and to flak; the men, guns and vehicles strikes took of it. */
  aircraft: number;
  wings: number;
  airLost: number;
  bombed: number;
  /** The nuclear age on its land (PLAN 7.12): the dead of bursts all told, and the cells under fallout. */
  nukeDead: number;
  fallout: number;
  efficiency: number;
  /** Whether its combat efficiency is held where God Mode set it (PLAN 7.4f17). */
  ceLocked: boolean;
  alliance: { id: number; name: string; leader: number; founder: number; unity: number; loyalty: number } | null;
  overlord: number;
  autonomy: number;
  loyalty: number;
  integration: number;
  puppets: number[];
  enemies: number[];
  aiOff: boolean;
  /** Whether God Mode has left it allowed nuclear weapons (PLAN 6.1a; the world's toggle apart). */
  nukesAllowed: boolean;
  /** Its warheads (PLAN 6.1b). */
  warheads: number;
  /**
   * Whether it can deliver them (PLAN 7.18b, `canDeliver`): nuclear weapons allowed it, a warhead,
   * and a strategic bomber group at an airbase or ballistic missiles.
   */
  canDeliver: boolean;
  /**
   * Its means of delivery (PLAN 7.37b2, `deliveryMeans`), for a nation that holds a warhead (else
   * null): its strategic bomber groups with a base, the name of the airbase of the one it keeps for
   * its warheads (null for none), and whether it knows ballistic missiles.
   */
  means: { bombers: number; base: string | null; missiles: boolean } | null;
  /**
   * Why it does not strike (PLAN 7.37f, the user's of 2026-10-20: restraint is believable, and the
   * game says why), for a holder of warheads at war (else null): `restraintOf`'s reason in its war
   * whose best place weighs most (the first in the list when none has a place), the enemy that
   * deters it (`by`, 0 for none) and that war's id.
   */
  restraint: { reason: RestraintWhy; by: number; war: number } | null;
  /** AI aggression 0..100 and income multiplier from traits (PLAN 1.39b1 options). */
  aggression: number;
  incomeMult: number;
  /** Formations in training: template index and the day (ticks / 24) they are ready. */
  queue: { template: number; readyDay: number }[];
  /** The techs it knows, as bits 0..31 and 32..63 (PLAN 3.1a). */
  techs: readonly [number, number];
  /** Whether it holds a port a ship reaches, where a fleet it orders is built (PLAN 4.2e–f, `shipyard`). */
  shipyard: boolean;
  /** The most room for aircraft at one of the airbases it holds, beside the wings there (PLAN 5.8v4): a wing of more is not built (`airfield`). */
  airRoom: number;
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
  /** Org 0..1 (PLAN 3.2c), and the fuel its template burns in an hour on the march (0 = none, or no template). */
  org: number;
  fuel: number;
  engaged: boolean;
  moving: boolean;
  /** Hours of its retreat left (PLAN 3.5a; 0 = none): it takes no order in them (PLAN 3.7m). */
  retreat: number;
  /** Where its block stands: as `SnapshotFormations.block` has it. */
  x: number;
  y: number;
  /**
   * Where it fights (PLAN 3.11b), null out of contact: the middle between its block and the
   * block of `enemy`, the nearest enemy formation it is in contact with and the one its block
   * faces (`contactsOf`), in cells; and how far apart the two blocks' middles stand, east-west
   * and north-south, in cells. A block a line or more behind its own side's front stands up to
   * a cell from that enemy's: the panel's way to the fight shows both (`MapView.showBattle`).
   * A fleet's (`sea`, PLAN 7.126): `enemy` is the nearest enemy fleet of its sea battle, and the
   * middle and the span are those of the box of the two fleets' ships (`MapView.showSeaBattle`).
   */
  fight: { x: number; y: number; enemy: number; span: [number, number]; sea: boolean } | null;
  /** Its elements by unit type, in the template's order: how many elements, their units now and when whole. */
  units: { nameKey: string; cls: string; elements: number; strength: number; size: number }[];
  /**
   * A fleet with carriers afloat (PLAN 7.151): how many, and the wings based on them by ascending id, each with its
   * aircraft's unit name, aircraft now, its mission's kind (null: none of its own, it strikes for its fleet in a sea
   * battle) and whether it is in the air. Null for any other formation.
   */
  deck: { carriers: number; wings: { id: number; nameKey: string; aircraft: number; mission: 'patrol' | 'strike' | 'supply' | null; flying: boolean }[] } | null;
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
  /**
   * How far apart the two blocks' middles stand, east-west and north-south, in cells (PLAN
   * 4.1d1): a kilometre for two front to front, up to the reach of a contact for two with
   * water between them, each on its shore. The camera's view holds both (`battleViewM`).
   */
  span: [number, number];
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
  settings: { winnerTakesAll: boolean; revoltMode: string; ceMode: string; aiEnabled: boolean; player: number; loopingMap: boolean; nukesEnabled: boolean };
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
  /** `wing`: an air wing (PLAN 5.8w3), which the view does not draw at its base (5.1d). */
  formations: { id: number; nation: number; strength: number; elementMen: number; elements: number; x: number; y: number; wing: boolean }[];
  /** Nations with a core or claim per province that has any (PLAN 1.36; `full` only, else empty). */
  cores: { province: number; nations: number[] }[];
}

/** An active war (PLAN 1.31): side leaders first; score > 0 favours the attackers. */
/** The world's rules God Mode sets in the game (PLAN 7.4f19): beside `aiEnabled` and `nukesEnabled`. */
export interface WorldRules {
  winnerTakesAll: boolean;
  revoltMode: 'province' | 'region';
  ceMode: 'dynamic' | 'progressive' | 'static' | 'locked' | 'random';
}

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
  /** Whether each side fights to the death (PLAN 7.4f15: God Mode's toggle shows it). */
  toDeath: [boolean, boolean];
}

/** What became of a player's order (PLAN 4.9c; `orderNews`). */
export interface OrderNews {
  kind: 'refused' | 'repulsed' | 'landedAway';
  id: number;
  nation: number;
  /** A `RejectReason` for `refused`, else 0. */
  reason: number;
  x: number;
  y: number;
  tick: number;
}

/** Numbers per sea battle in a snapshot's `seas` (PLAN 4.10b). */
export const SEA_STRIDE = 24;
/** Numbers per carrier strike out of a sea battle in a snapshot's `raids` (PLAN 7.154a). */
export const RAID_STRIDE = 12;
/** A sortie in a snapshot (PLAN 5.7a): [bx, by, tx, ty, launch, kmh, km, over, nation, aircraft, role]. */
export const SORTIE_STRIDE = 11;
/** A sortie's role, by its aircraft's class (PLAN 5.7a): what the page draws. */
export const SortieRole = { fighter: 0, closeSupport: 1, bomber: 2, heavyBomber: 3, navalBomber: 4, transport: 5 } as const;
