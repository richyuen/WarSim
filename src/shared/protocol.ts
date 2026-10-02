/**
 * Main ↔ worker messages (SPEC §2.3) and the snapshot layout (SPEC §2.4).
 *
 * Flow control: the worker sends at most one snapshot per ack. Main acks from
 * requestAnimationFrame and transfers the snapshot's buffers back for reuse. While main
 * is busy, ticks keep running: dirty tiles accumulate and events queue, so a later
 * snapshot carries everything that changed (coalescing) and no event is lost.
 */
import type { Command } from './commands';

export type ScenarioId = 'toy';

export interface SimInit {
  scenario: ScenarioId;
  seed: number;
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
  | { type: 'init'; reqId: number; init: SimInit }
  | { type: 'step'; reqId: number; n: number }
  | { type: 'cmd'; cmd: Command }
  | { type: 'hash'; reqId: number }
  | { type: 'save'; reqId: number }
  | { type: 'load'; reqId: number; bytes: Uint8Array }
  | { type: 'speed'; speed: Speed }
  | { type: 'pause'; paused: boolean }
  | { type: 'subscribe'; sub: Subscription }
  | { type: 'ack'; seq: number; buffers: ArrayBuffer[] }
  /** Builds the admin-1 province raster at w×h from the map assets under `assetBase`. */
  | { type: 'buildProvinces'; reqId: number; assetBase: string; w: number; h: number; withIds: boolean }
  /** Loads the w×h terrain raster from `assetBase` and applies the map's crossings (PLAN 1.2). */
  | { type: 'buildTerrain'; reqId: number; assetBase: string; w: number; h: number };

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
export const NationField = { id: 0, color: 1, cells: 2, capitalX: 3, capitalY: 4 } as const;
export const NATION_STRIDE = 5;

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
}

export interface SnapshotEvents {
  count: number;
  /** count·EVENT_STRIDE records [seq, tick, kind, a, b, x, y] (shared/events). */
  data: Float64Array;
  /** Events dropped from the queue because it hit its hard cap (should stay 0). */
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
  formations: SnapshotFormations;
  events: SnapshotEvents;
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

export type FromWorker =
  | { type: 'reply'; reqId: number; status: SimStatus; bytes?: Uint8Array }
  | { type: 'error'; reqId: number; message: string; stack: string }
  | { type: 'snapshot'; snap: Snapshot }
  | { type: 'provinces'; reqId: number; result: ProvinceBuildResult }
  | { type: 'terrain'; reqId: number; result: TerrainBuildResult };
