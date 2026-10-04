/**
 * Worker-side sim host (SPEC §2.3/§2.4): scheduler (speed/pause), request handling and
 * rAF-acked snapshots with a recycled buffer pool. Environment-agnostic: the worker entry
 * supplies `post` and drives `pump(nowMs)` from a timer; tests drive it directly in Node.
 *
 * Subscriptions only change what is *sent*; the sim never sees them (invariant I4).
 */
import { LABEL_STRIDE } from '../shared/nationLabels';
import { ECONOMY_TABLES_1938, NATIONS_1938, TEMPLATES_LAND } from '../sim/scenario1938';
import { deriveNationLabels } from './deriveLabels';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import { buildLandCoverage } from '../shared/landCoverage';
import { EVENT_STRIDE, FIRE_STRIDE, FireField, weaponOf } from '../shared/events';
import { Terrain, TERRAIN_IDS } from '../shared/terrain';
import { encodeRuns } from '../shared/mapImport';
import { HISTORY_ROLES, type HistoryRole, type HistoryRow } from '../shared/history';
import { HISTORY_STRIDE } from '../sim/history';
import {
  FormationFlag,
  MAX_SNAPSHOT_ELEMENTS,
  type SnapshotElements,
  NATION_STRIDE,
  NationField,
  type FromWorker,
  type SimStatus,
  type Snapshot,
  type Speed,
  type Subscription,
  type SimInit,
  type ToWorker,
  type NationStat,
  type UnitSymbol,
  type Inspection,
  type WarStat,
} from '../shared/protocol';
import { SCENARIO_GEOMETRY } from '../shared/scenarios';
import { decodeAdmin1, type Admin1Meta } from '../shared/admin1';
import { xxhash32View } from '../sim/core/hash';
import { buildProvinceRaster } from '../sim/data/provinces';
import { loadTerrain, type StraitDef } from '../sim/data/terrain';
import earthStraits from '../../data/maps/earth/straits.json' with { type: 'json' };
import { buildPoliticalMap } from '../sim/data/politicalMap';
import { politicalMapInput1938, TAGS_1938 } from '../sim/scenario1938';
import { landStandings } from '../sim/landArea';
import { Sim } from '../sim/sim';
import { elementIndex } from '../sim/systems/elements';
import { slotPose } from '../sim/core/pose';
import { SLOT_SPACING } from '../sim/systems/combat';
import { AssetStore } from './assets';
import { TILE, type World } from '../sim/world';
import { BufferPool } from './pool';

export type Post = (msg: FromWorker, transfer: Transferable[]) => void;

/** Max wall-clock ms spent ticking per pump at 'max' speed, so messages stay responsive. */
const MAX_SLICE_MS = 12;
/** Hard cap on queued (unsent) events; beyond it the oldest are dropped and counted. */
const EVENT_QUEUE_CAP = 1 << 20;
/** Hard cap on queued (unsent) fire events in view; beyond it the oldest are dropped and counted. */
export const FIRE_QUEUE_CAP = 1 << 13;
const NO_FIRES = new Float64Array(0);
/** Never schedule more than this many ticks in one pump at a fixed speed (avoid spirals). */
const MAX_TICKS_PER_PUMP = 2000;

const DEFAULT_SUB: Subscription = { bbox: [0, 0, Infinity, Infinity], z: 0, tier: 0, wantsElements: false };

/** Minimum wall time between label derivations (PLAN 1.29). */
const LABEL_INTERVAL_MS = 2000;
const STATS_INTERVAL_MS = 1000;

const EMPTY_ELEMENTS: SnapshotElements = {
  count: 0,
  id: new Uint32Array(0),
  formation: new Uint32Array(0),
  nation: new Uint16Array(0),
  frame: new Uint8Array(0),
  strength: new Uint16Array(0),
  x: new Float64Array(0),
  y: new Float64Array(0),
  prevX: new Float64Array(0),
  prevY: new Float64Array(0),
  facing: new Float32Array(0),
  flags: new Uint8Array(0),
  truncated: false,
};

/** Atlas frame of a unit class (PLAN 2.3): 1 for vehicles and guns on wheels/tracks, else 0. */
function frameOf(cls: string): number {
  if (cls.startsWith('armor') || cls === 'mech') return 1;
  if (['dd', 'cl', 'ca', 'bb', 'cv', 'ss', 'tp'].includes(cls)) return 2;
  if (['fighter', 'bomber_tac', 'bomber_str', 'cas', 'naval_bomber', 'transport_air'].includes(cls)) return 3;
  return 0;
}

/** Marker symbol of a template (PLAN 2.1): by its dominant element type. */
function symbolOf(t: { id: string; elements: readonly { type: string; count: number }[] }): UnitSymbol {
  if (t.id.startsWith('garrison')) return 'garrison';
  if (t.id.startsWith('mountain')) return 'mountain';
  let tanks = 0;
  let motor = 0;
  let horse = 0;
  let all = 0;
  for (const e of t.elements) {
    all += e.count;
    if (e.type.startsWith('tank')) tanks += e.count;
    else if (e.type.endsWith('motorised')) motor += e.count;
    else if (e.type === 'cavalry') horse += e.count;
  }
  if (tanks * 2 >= all) return 'armour';
  if (horse * 2 >= all) return 'cavalry';
  if ((tanks + motor) * 2 >= all) return 'motorised';
  return 'infantry';
}

export class SimServer {
  sim: Sim | null = null;
  readonly pool = new BufferPool();
  speed: Speed = 24;
  paused = true;
  sub: Subscription = DEFAULT_SUB;

  /** Snapshot sequence of the last snapshot sent; awaiting its ack while `inFlight`. */
  private seq = 0;
  private inFlight = false;
  /** Tick of the last snapshot sent (a new snapshot is due when the tick moves on). */
  private sentTick = -1;
  private forceSend = true;
  /** Unsent events, flat [seq, tick, kind, a, b, x, y]. */
  private eventQueue: number[] = [];
  private nextEventSeq = 1;
  private droppedEvents = 0;
  /** Unsent fire events of the subscribed bbox, flat FIRE_STRIDE records (PLAN 2.4). */
  private fireQueue: number[] = [];
  private droppedFires = 0;
  /** Positions one tick before the current tick, indexed by formation id. */
  private prevX = new Float64Array(0);
  private prevY = new Float64Array(0);
  private prevAlive = new Uint8Array(0);
  /** Fractional ticks owed at fixed speed. */
  private owed = 0;
  private lastPump = -1;

  constructor(private readonly post: Post) {}

  /** Label derivation state (PLAN 1.29; not sim state). */
  private provinceNames: string[] | null = null;
  private labelVersion = -1;
  private lastLabelMs = -1;
  private unrestVersion = -1;
  private labelNames = -1;
  private terrainSent = -1;
  private citiesSent = -1;
  private flagsSent = -1;
  /** Land (1) / water (0) per cell at init, for `terrainLayer.landChanged`. */
  private startLand: Uint8Array | null = null;
  private statsTick = -1;
  private lastStatsMs = -1;

  handle(msg: ToWorker, nowMs: number): void {
    try {
      this.handleInner(msg, nowMs);
      this.maybeLabels(nowMs);
      this.maybeStats(nowMs);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.post({ type: 'error', reqId: 'reqId' in msg ? msg.reqId : -1, message: error.message, stack: error.stack ?? '' }, []);
    }
  }

  private requireSim(): Sim {
    if (!this.sim) throw new Error('sim not initialised');
    return this.sim;
  }

  /**
   * Replies with the status. `withHash` false (read-only queries: inspect, history, stats) skips
   * the 12 ms state hash on the 1938 map and reports NaN (review after PLAN 1.39a).
   */
  private reply(reqId: number, bytes?: Uint8Array, withHash = true): void {
    const s = this.requireSim();
    const status: SimStatus = { tick: s.tick, hash: withHash ? s.hash() : NaN };
    if (bytes) this.post({ type: 'reply', reqId, status, bytes }, [bytes.buffer]);
    else this.post({ type: 'reply', reqId, status }, []);
  }

  private handleInner(msg: ToWorker, nowMs: number): void {
    switch (msg.type) {
      case 'init':
        if (msg.init.scenario !== 'toy' && !msg.init.assets) {
          void this.initWithAssets(msg);
          break;
        }
        this.startSim(msg.init, msg.reqId);
        break;
      case 'step':
        this.advance(msg.n);
        this.reply(msg.reqId);
        break;
      case 'cmd': {
        const sim = this.requireSim();
        sim.command(msg.cmd);
        // `now` (God Mode UI): apply at once, between ticks, with the tick stamp the next step
        // would give (PLAN 1.32b); the snapshot and stats follow. Plain commands stay pending.
        if (msg.now) {
          sim.applyNow((w) => this.drainEvents(w));
          this.forceSend = true;
          // God actions skip the (cheap) stats throttle, so panels update on the click. Labels
          // keep theirs (~40 ms a derivation; brush strokes come in bursts) and follow within
          // LABEL_INTERVAL_MS through the paused flush pump.
          this.statsTick = -1;
          this.lastStatsMs = -1;
          this.maybeSend();
        }
        break;
      }
      case 'hash':
        this.reply(msg.reqId);
        break;
      case 'inspect':
        this.reply(msg.reqId, this.inspect(msg.full === true), false);
        break;
      case 'history':
        this.reply(msg.reqId, this.historyRows(), false);
        break;
      case 'stats': {
        const rows = Float32Array.from(this.requireSim().world.stats.rows);
        this.reply(msg.reqId, new Uint8Array(rows.buffer), false);
        break;
      }
      case 'exportScenario': {
        const sim = this.requireSim();
        const { bytes, hash } = sim.exportScenario();
        this.post({ type: 'reply', reqId: msg.reqId, status: { tick: sim.tick, hash: sim.hash() }, bytes, scenarioHash: hash }, [bytes.buffer]);
        break;
      }
      case 'save':
        this.reply(msg.reqId, this.requireSim().save());
        break;
      case 'load':
        this.requireSim().load(msg.bytes);
        this.labelVersion = -1; // the controller layer was replaced wholesale
        this.unrestVersion = -1;
        this.statsTick = -1;
        this.lastStatsMs = -1;
        this.resetStreams();
        this.reply(msg.reqId);
        break;
      case 'speed':
        this.speed = msg.speed;
        this.owed = 0;
        this.lastPump = nowMs;
        this.forceSend = true;
        break;
      case 'pause':
        this.paused = msg.paused;
        this.owed = 0;
        this.lastPump = nowMs;
        this.forceSend = true;
        break;
      case 'subscribe':
        this.sub = msg.sub;
        this.forceSend = true;
        break;
      case 'ack':
        if (msg.seq !== this.seq) throw new Error(`ack for snapshot ${msg.seq}, expected ${this.seq}`);
        for (const b of msg.buffers) this.pool.release(b);
        this.inFlight = false; // an owed snapshot goes at the end of handleInner
        break;
      case 'buildProvinces':
        void this.buildProvinces(msg);
        break;
      case 'buildTerrain':
        void this.buildTerrain(msg);
        break;
      case 'buildPolitical':
        void this.buildPolitical(msg);
        break;
    }
    this.maybeSend();
  }

  private async buildProvinces(msg: Extract<ToWorker, { type: 'buildProvinces' }>): Promise<void> {
    try {
      const t0 = performance.now();
      const store = new AssetStore(msg.assetBase);
      const geoAsset = await store.load('admin1-geometry');
      const metaAsset = await store.load('admin1-meta');
      const t1 = performance.now();
      const geo = decodeAdmin1(geoAsset.bytes);
      const meta = JSON.parse(new TextDecoder().decode(metaAsset.bytes)) as Admin1Meta[];
      const t2 = performance.now();
      const r = buildProvinceRaster(geo, meta, msg.w, msg.h);
      const t3 = performance.now();
      let present = 0;
      for (let i = 1; i < r.cells.length; i++) if (r.cells[i]! > 0) present++;
      const result = {
        w: msg.w,
        h: msg.h,
        provinces: meta.length,
        present,
        forced: r.forced.length,
        missing: r.missing.length,
        landCells: msg.w * msg.h - r.cells[0]!,
        hash: xxhash32View(r.ids),
        ms: { fetch: geoAsset.fetchMs + metaAsset.fetchMs, decode: t2 - t1 + geoAsset.decodeMs + metaAsset.decodeMs, raster: t3 - t2, total: t3 - t0 },
        ...(msg.withIds ? { ids: r.ids } : {}),
      };
      this.post({ type: 'provinces', reqId: msg.reqId, result }, msg.withIds ? [r.ids.buffer] : []);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.post({ type: 'error', reqId: msg.reqId, message: error.message, stack: error.stack ?? '' }, []);
    }
  }

  /** A fresh sim always starts paused; the host unpauses explicitly. */
  private startSim(init: SimInit, reqId: number): void {
    this.sim = new Sim(init);
    // Real-map scenarios get nation labels; province names name spawned nations.
    this.provinceNames = init.assets ? (JSON.parse(new TextDecoder().decode(init.assets.admin1Meta)) as { name: string }[]).map((m) => m.name) : null;
    this.labelVersion = -1;
    this.lastLabelMs = -1;
    this.unrestVersion = -1;
    this.statsTick = -1;
    this.lastStatsMs = -1;
    this.flagsSent = -1;
    this.citiesSent = -1;
    this.terrainSent = -1;
    this.paused = true;
    this.owed = 0;
    this.resetStreams();
    this.reply(reqId);
  }

  /** Real-map scenarios: fetch and verify the map assets, then build the world (PLAN 1.9a). */
  private async initWithAssets(msg: Extract<ToWorker, { type: 'init' }>): Promise<void> {
    try {
      if (!msg.assetBase) throw new Error(`scenario '${msg.init.scenario}' needs assetBase`);
      const store = new AssetStore(msg.assetBase);
      const { w } = SCENARIO_GEOMETRY[msg.init.scenario];
      const [geo, meta, terrain] = await Promise.all([store.load('admin1-geometry'), store.load('admin1-meta'), store.load('terrain', w)]);
      this.startSim({ ...msg.init, assets: { admin1Geometry: geo.bytes, admin1Meta: meta.bytes, terrain: terrain.bytes } }, msg.reqId);
      void this.sendMapLayers(store);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.post({ type: 'error', reqId: msg.reqId, message: error.message, stack: error.stack ?? '' }, []);
    }
  }

  /** Builds and sends the renderer's static layers (fine land coverage, terrain) once. */
  private async sendMapLayers(store: AssetStore): Promise<void> {
    try {
      const mask = await store.load('landmask');
      const world = this.requireSim().world;
      const factor = Math.max(1, Math.round(mask.asset.width / (2 * world.cells.w)));
      const land = buildLandCoverage(mask.bytes, mask.asset.width, mask.asset.height ?? mask.asset.width / 2, factor);
      const terrain = { w: world.cells.w, h: world.cells.h, data: world.cells.terrain.slice() };
      const terrainColors = terrainJson.terrain.map((t) => parseInt(t.color.slice(1), 16));
      const cities = this.cityList(world).map((c) => ({ id: c.id, name: c.name, x: c.x, y: c.y, size: c.size, capital: c.capitalOf !== 0 }));
      this.citiesSent = world.citiesVersion;
      this.startLand = Uint8Array.from(world.cells.terrain, (t) => (t >= Terrain.Plains ? 1 : 0));
      const province = world.cells.province.slice();
      const rules = world.rules?.templates ?? [];
      const templates = TEMPLATES_LAND.slice(0, rules.length).map((t, i) => ({ nameKey: `template.${t.id}`, gold: rules[i]!.gold, manpower: rules[i]!.manpower, days: rules[i]!.days, men: ECONOMY_TABLES_1938.templateStrength[i] ?? 0, symbol: symbolOf(t) }));
      this.post({ type: 'mapLayers', land, terrain, terrainColors, cities, province, templates }, [land.data.buffer, terrain.data.buffer, province.buffer]);
    } catch {
      /* the cell-resolution coast stays: no fine layers */
    }
  }

  private async buildTerrain(msg: Extract<ToWorker, { type: 'buildTerrain' }>): Promise<void> {
    try {
      const t0 = performance.now();
      const asset = await new AssetStore(msg.assetBase).load('terrain', msg.w);
      const { terrain, crossings } = loadTerrain(asset.bytes, msg.w, msg.h, earthStraits.straits as unknown as StraitDef[]);
      const counts: number[] = [];
      for (const v of terrain) counts[v] = (counts[v] ?? 0) + 1;
      for (let k = 0; k < counts.length; k++) counts[k] ??= 0;
      const result = {
        w: msg.w,
        h: msg.h,
        counts,
        crossings,
        hash: xxhash32View(terrain),
        ms: { fetch: asset.fetchMs, decode: asset.decodeMs, total: performance.now() - t0 },
        terrain,
      };
      this.post({ type: 'terrain', reqId: msg.reqId, result }, [terrain.buffer]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.post({ type: 'error', reqId: msg.reqId, message: error.message, stack: error.stack ?? '' }, []);
    }
  }

  private async buildPolitical(msg: Extract<ToWorker, { type: 'buildPolitical' }>): Promise<void> {
    try {
      const t0 = performance.now();
      const store = new AssetStore(msg.assetBase);
      const [geoAsset, metaAsset, terrainAsset] = await Promise.all([store.load('admin1-geometry'), store.load('admin1-meta'), store.load('terrain', msg.w)]);
      const tags = TAGS_1938;
      const r = buildPoliticalMap(
        politicalMapInput1938({ admin1Geometry: geoAsset.bytes, admin1Meta: metaAsset.bytes, terrain: terrainAsset.bytes }, msg.w, msg.h),
      );
      const cells = new Array<number>(tags.length + 1).fill(0);
      for (const v of r.owner) cells[v]!++;
      const cities = r.cities.map((c) => ({
        name: c.name,
        x: c.x,
        y: c.y,
        size: c.size,
        owner: c.owner,
        capitalOf: c.capitalOf,
      }));
      const result = {
        w: msg.w,
        h: msg.h,
        cells,
        ownerHash: xxhash32View(r.owner),
        controllerHash: xxhash32View(r.controller),
        ms: { total: performance.now() - t0 },
        owner: r.owner,
        controller: r.controller,
        cities,
        formations: r.formations.map((f) => ({ x: f.x, y: f.y, nation: f.nation, template: f.template })),
      };
      this.post({ type: 'political', reqId: msg.reqId, result }, [r.owner.buffer, r.controller.buffer]);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.post({ type: 'error', reqId: msg.reqId, message: error.message, stack: error.stack ?? '' }, []);
    }
  }

  /** New sim state: drop queued events, resend every tile. */
  private resetStreams(): void {
    this.eventQueue = [];
    this.fireQueue = [];
    this.sim!.world.out.markAllDirty();
    this.sim!.world.out.events.length = 0;
    this.sim!.world.out.fires.length = 0;
    this.snapshotPrev(this.sim!.world);
    this.forceSend = true;
  }

  /** Whether the scheduler wants `pump` to be called again soon. */
  get running(): boolean {
    return this.sim !== null && (!this.paused || this.derivedPending);
  }

  /** Whether ticks are advancing (not just flushing derived messages). */
  get ticking(): boolean {
    return this.sim !== null && !this.paused;
  }

  /**
   * A throttled derived message (labels, stats) still owes the UI an update: while paused the
   * host keeps pumping until it is sent (e.g. after a single step), without advancing ticks.
   */
  private get derivedPending(): boolean {
    const sim = this.sim;
    if (!sim || !this.provinceNames) return false;
    return sim.world.tick !== this.statsTick || sim.world.controlChanges !== this.labelVersion || sim.world.namesVersion !== this.labelNames;
  }

  /**
   * Called by the host timer: runs the ticks owed since the last pump, then maybe sends.
   * `clock` is read during 'max' speed to bound the slice to MAX_SLICE_MS of wall time.
   */
  pump(nowMs: number, clock: () => number): void {
    if (!this.running) {
      this.lastPump = nowMs;
      return;
    }
    if (this.paused) {
      // Only flushing derived messages (see derivedPending).
      this.lastPump = nowMs;
      this.maybeLabels(nowMs);
      this.maybeStats(nowMs);
      return;
    }
    if (this.lastPump < 0) this.lastPump = nowMs;
    if (this.speed === 'max') {
      const start = clock();
      do this.advance(1);
      while (clock() - start < MAX_SLICE_MS);
    } else {
      this.owed += ((nowMs - this.lastPump) * this.speed) / 1000;
      const n = Math.min(MAX_TICKS_PER_PUMP, Math.floor(this.owed));
      this.owed -= n;
      if (n > 0) this.advance(n);
    }
    this.lastPump = nowMs;
    this.maybeSend();
    this.maybeLabels(nowMs);
    this.maybeStats(nowMs);
  }

  /**
   * Nation panel and war banner data (PLAN 1.31): when the tick moved (or after init/load), at
   * most every STATS_INTERVAL_MS. Real-map scenarios only (names come from the 1938 table).
   */
  private maybeStats(nowMs: number): void {
    const sim = this.sim;
    if (!sim || !this.provinceNames) return;
    const world = sim.world;
    if (world.tick === this.statsTick || (this.lastStatsMs >= 0 && nowMs - this.lastStatsMs < STATS_INTERVAL_MS)) return;
    this.statsTick = world.tick;
    this.lastStatsMs = nowMs;
    const { nations, wars } = this.buildStats(world, false);
    const dead: { id: number; name: string; color: number }[] = [];
    world.nations.forEach((id) => {
      if (world.nations.cols.living[id] !== 1) dead.push({ id, name: this.nameOf(id), color: world.nations.cols.color[id]! });
    });
    this.post({ type: 'nationStats', tick: world.tick, nations, wars, dead, aiEnabled: world.settings.aiEnabled, player: world.settings.player, edits: { undo: world.edits.undo.length, redo: world.edits.redo.length } }, []);
  }

  /**
   * Nation label curves (PLAN 1.29): re-derived when control changed, at most every
   * LABEL_INTERVAL_MS (a ~40 ms flood at M), and once after init or load. Real-map scenarios only.
   */
  private maybeLabels(nowMs: number): void {
    const sim = this.sim;
    if (!sim || !this.provinceNames) return;
    const world = sim.world;
    // Custom flags (PLAN 1.37b), after init/load and when changed.
    if (world.flagsVersion !== this.flagsSent) {
      this.flagsSent = world.flagsVersion;
      const custom = [...world.flags].sort((x, y) => x[0] - y[0]).map(([n, px]) => [n, encodeRuns(px)] as [number, number[]]);
      this.post({ type: 'flags', custom }, []);
    }
    // Cities after editor edits (PLAN 1.36): dots and names follow.
    if (this.citiesSent >= 0 && world.citiesVersion !== this.citiesSent) {
      this.citiesSent = world.citiesVersion;
      const cities = this.cityList(world).map((c) => ({ id: c.id, name: c.name, x: c.x, y: c.y, size: c.size, capital: c.capitalOf !== 0 }));
      this.post({ type: 'cityLayer', cities }, []);
    }
    // Terrain after editor edits (PLAN 1.35): the renderer's terrain layer follows.
    if (world.terrainVersion !== this.terrainSent) {
      if (this.terrainSent >= 0) {
        const data = world.cells.terrain.slice();
        // The fine coastline comes from the original land mask: once land and water differ
        // from the start (map import, PLAN 1.37a) the renderer falls back to cell coasts.
        let landChanged = false;
        const start = this.startLand;
        if (start) for (let c = 0; c < data.length && !landChanged; c++) if ((data[c]! >= Terrain.Plains ? 1 : 0) !== start[c]) landChanged = true;
        this.post({ type: 'terrainLayer', data, landChanged }, [data.buffer]);
      }
      this.terrainSent = world.terrainVersion;
    }
    // Province unrest for the revolts map mode (cheap: a byte per province), when it changed.
    if (world.provinces.version !== this.unrestVersion && world.provinces.count > 0) {
      this.unrestVersion = world.provinces.version;
      const unrest = new Uint8Array(world.provinces.count);
      for (let p = 0; p < unrest.length; p++) unrest[p] = Math.round(world.provinces.unrest[p]!);
      this.post({ type: 'provinceStats', unrest }, [unrest.buffer]);
    }
    const changed = world.controlChanges !== this.labelVersion || world.namesVersion !== this.labelNames;
    if (!changed || (this.lastLabelMs >= 0 && nowMs - this.lastLabelMs < LABEL_INTERVAL_MS)) return;
    this.lastLabelMs = nowMs;
    this.labelVersion = world.controlChanges;
    this.labelNames = world.namesVersion;
    const capitals = new Map<number, number>();
    const nc = world.nations.cols;
    world.nations.forEach((id) => {
      if (nc.living[id] === 1) capitals.set(id, Math.floor(nc.capitalY[id]!) * world.cells.w + Math.floor(nc.capitalX[id]!));
    });
    const data = deriveNationLabels(world.cells.controller, world.cells.w, world.cells.h, true, capitals);
    const names: string[] = [];
    for (let i = 0; i < data.length; i += LABEL_STRIDE) names.push(this.nameOf(data[i]!));
    this.post({ type: 'labels', data, names }, [data.buffer]);
  }

  /** Per-nation panel data and active wars (PLAN 1.31); `withDead` adds dead nations (inspect). */
  private buildStats(world: World, withDead: boolean): { nations: (NationStat & { living: boolean })[]; wars: WarStat[] } {
    const nc = world.nations.cols;
    const men = new Map<number, number>();
    const count = new Map<number, number>();
    const fc = world.formations.cols;
    world.formations.forEach((f) => {
      const n = fc.nation[f]!;
      men.set(n, (men.get(n) ?? 0) + fc.strength[f]!);
      count.set(n, (count.get(n) ?? 0) + 1);
    });
    const queues = new Map<number, { template: number; readyDay: number }[]>();
    const pc = world.production.cols;
    world.production.forEach((p) => {
      const n = pc.nation[p]!;
      const q = queues.get(n) ?? [];
      q.push({ template: pc.template[p]!, readyDay: pc.readyDay[p]! });
      queues.set(n, q);
    });
    const puppets = new Map<number, number[]>();
    const enemies = new Map<number, Set<number>>();
    const wars: WarStat[] = [];
    for (const war of world.wars.list) {
      wars.push({ id: war.id, attackers: [...war.sides[0]], defenders: [...war.sides[1]], score: war.score, startTick: war.startTick });
      for (const [a, b] of [[war.sides[0], war.sides[1]], [war.sides[1], war.sides[0]]] as const) {
        for (const x of a) {
          const set = enemies.get(x) ?? new Set<number>();
          for (const y of b) set.add(y);
          enemies.set(x, set);
        }
      }
    }
    world.nations.forEach((id) => {
      const o = nc.overlord[id]!;
      if (nc.living[id] === 1 && o !== 0) puppets.set(o, [...(puppets.get(o) ?? []), id]);
    });
    const land = landStandings(world);
    const nations: (NationStat & { living: boolean })[] = [];
    world.nations.forEach((id) => {
      if (!withDead && nc.living[id] !== 1) return;
      const al = world.alliances.allianceOf(id);
      const k = al ? al.members.indexOf(id) : -1;
      nations.push({
        id,
        name: this.nameOf(id),
        color: nc.color[id]!,
        cells: nc.cells[id]!,
        area: land.area[id]!,
        landShare: nc.living[id] === 1 && land.owned > 0 ? land.area[id]! / land.owned : 0,
        gold: nc.gold[id]!,
        income: nc.income[id]!,
        expenses: nc.expenses[id]!,
        incomeBonus: nc.incomeBonus[id]!,
        bankrupt: nc.bankrupt[id] === 1,
        manpower: nc.manpower[id]!,
        men: men.get(id) ?? 0,
        formations: count.get(id) ?? 0,
        efficiency: nc.efficiency[id]!,
        alliance: al ? { id: al.id, name: al.nameKey, leader: al.leader, unity: al.unity, loyalty: al.loyalty[k] ?? 0 } : null,
        overlord: nc.overlord[id]!,
        autonomy: nc.autonomy[id]!,
        loyalty: nc.loyalty[id]!,
        integration: nc.integration[id]!,
        puppets: puppets.get(id) ?? [],
        enemies: [...(enemies.get(id) ?? [])],
        aiOff: nc.aiOff[id] === 1,
        aggression: nc.aggression[id]!,
        incomeMult: nc.incomeMult[id]!,
        living: nc.living[id] === 1,
        queue: (queues.get(id) ?? []).sort((x, y) => x.readyDay - y.readyDay),
      });
    });
    return { nations, wars };
  }

  private terrainCounts(world: World): number[] {
    const counts = new Array<number>(TERRAIN_IDS.length).fill(0);
    const t = world.cells.terrain;
    for (let c = 0; c < t.length; c++) counts[t[c]!]!++;
    return counts;
  }

  /** Per formation: its strength and the men summed directly over its elements (PLAN 2.1 AT). */
  private formationMen(world: World): Inspection['formations'] {
    const men = new Map<number, number>();
    const count = new Map<number, number>();
    const ec = world.elements.cols;
    const units = world.rules?.units ?? [];
    world.elements.forEach((e) => count.set(ec.formation[e]!, (count.get(ec.formation[e]!) ?? 0) + 1));
    world.elements.forEach((e) => men.set(ec.formation[e]!, (men.get(ec.formation[e]!) ?? 0) + ec.strength[e]! * (units[ec.unit[e]!]?.menPerUnit ?? 0)));
    const out: Inspection['formations'] = [];
    const fc = world.formations.cols;
    world.formations.forEach((f) => out.push({ id: f, nation: fc.nation[f]!, strength: fc.strength[f]!, elementMen: Math.round(men.get(f) ?? 0), elements: count.get(f) ?? 0, x: fc.x[f]!, y: fc.y[f]! }));
    return out;
  }

  /** Every city with its display name: the scenario's, or the editor's (PLAN 1.36). */
  private cityList(world: World): { id: number; name: string; x: number; y: number; size: number; capitalOf: number }[] {
    const cc = world.cities.cols;
    const out: { id: number; name: string; x: number; y: number; size: number; capitalOf: number }[] = [];
    world.cities.forEach((id) => {
      const name = cities1938.cities[cc.def[id]!]?.name ?? world.cityNames.get(id);
      if (name !== undefined) out.push({ id, name, x: cc.x[id]!, y: cc.y[id]!, size: cc.size[id]!, capitalOf: cc.capitalOf[id]! });
    });
    return out;
  }

  /** The history log with a/b names resolved (PLAN 1.34a), as JSON `HistoryRow[]`. */
  private historyRows(): Uint8Array {
    const world = this.requireSim().world;
    const rows = world.history.rows;
    const alliances = new Map(world.alliances.list.map((a) => [a.id, a.nameKey]));
    const cc = world.cities.cols;
    const name = (role: HistoryRole, v: number): string => {
      if (role === 'nation') return v !== 0 && world.nations.has(v) ? this.nameOf(v) : '';
      if (role === 'alliance') return alliances.get(v) ?? `=#${v}`;
      if (role === 'city') return v !== 0 && world.cities.has(v) ? `=${cities1938.cities[cc.def[v]!]?.name ?? world.cityNames.get(v) ?? ''}` : '';
      return '';
    };
    const out: HistoryRow[] = [];
    for (let i = 0; i < rows.length; i += HISTORY_STRIDE) {
      const [tick, kind, a, b, x, y] = [rows[i]!, rows[i + 1]!, rows[i + 2]!, rows[i + 3]!, rows[i + 4]!, rows[i + 5]!];
      const [ra, rb] = HISTORY_ROLES[kind] ?? ['number', 'number'];
      out.push({ tick, kind, a, b, x: Number.isNaN(x) ? null : x, y: Number.isNaN(y) ? null : y, an: name(ra, a), bn: name(rb, b) });
    }
    return new TextEncoder().encode(JSON.stringify(out));
  }

  /** JSON summary of the world for tests and the critic (PLAN 1.32). */
  /** `full` adds the bulky parts (cities, cores, unrest: ~600 KB on the 1938 map). */
  private inspect(full = false): Uint8Array {
    const world = this.requireSim().world;
    const { nations, wars } = this.buildStats(world, true);
    const out: Inspection = {
      tick: world.tick,
      seed: world.seed,
      settings: { ...world.settings },
      nations,
      wars,
      alliances: world.alliances.list.map((a) => ({ id: a.id, name: a.nameKey, leader: a.leader, members: [...a.members], unity: a.unity })),
      buffs: world.buffs.list.map((b) => ({ id: b.id, kind: b.kind, targetKind: b.targetKind, target: b.target, magnitude: b.magnitude, until: b.expiresTick })),
      majors: world.battles.majors.map((m) => ({ id: m.id, camps: [[...m.camps[0]], [...m.camps[1]]] })),
      corridors: world.battles.corridors.length,
      unrest: full ? Array.from(world.provinces.unrest, (u) => Math.round(u * 100) / 100) : [],
      terrainCounts: this.terrainCounts(world),
      rasters: { owner: xxhash32View(world.cells.owner), controller: xxhash32View(world.cells.controller), terrain: xxhash32View(world.cells.terrain) },
      edits: { undo: world.edits.undo.length, redo: world.edits.redo.length },
      cities: full ? this.cityList(world) : [],
      formations: full ? this.formationMen(world) : [],
      cores: !full ? [] : Array.from({ length: Math.max(0, world.provinces.count - 1) }, (_, i) => ({ province: i + 1, nations: world.provinces.coresOf(i + 1) })).filter((c) => c.nations.length > 0),
    };
    return new TextEncoder().encode(JSON.stringify(out));
  }

  /** i18n key of a scenario nation, or a literal ('=…') name for a spawned one. */
  private nameOf(id: number): string {
    const custom = this.sim?.world.names.get(id);
    if (custom !== undefined) return `=${custom}`; // God Mode rename (PLAN 1.32)
    const def = NATIONS_1938[id - 1];
    if (def) return def.nameKey;
    const origin = this.requireSim().world.nations.cols.origin[id] ?? 0;
    const province = this.provinceNames?.[origin - 1];
    return province ? `=Free ${province}` : `=Free state ${id}`;
  }

  private advance(n: number): void {
    const sim = this.requireSim();
    for (let i = 0; i < n; i++) {
      this.snapshotPrev(sim.world);
      sim.step(1, (w) => this.drainEvents(w));
    }
  }

  private snapshotPrev(world: World): void {
    const f = world.formations;
    if (this.prevX.length < f.capacity) {
      this.prevX = new Float64Array(f.capacity);
      this.prevY = new Float64Array(f.capacity);
      this.prevAlive = new Uint8Array(f.capacity);
    }
    this.prevX.set(f.cols.x.subarray(0, f.highWater));
    this.prevY.set(f.cols.y.subarray(0, f.highWater));
    this.prevAlive.set(f.alive.subarray(0, f.highWater));
  }

  private drainEvents(world: World): void {
    const ev = world.out.events;
    for (let i = 0; i < ev.length; i += 6) {
      this.eventQueue.push(this.nextEventSeq++, ev[i]!, ev[i + 1]!, ev[i + 2]!, ev[i + 3]!, ev[i + 4]!, ev[i + 5]!);
    }
    ev.length = 0;
    this.drainFires(world);
    const over = this.eventQueue.length / EVENT_STRIDE - EVENT_QUEUE_CAP;
    if (over > 0) {
      this.eventQueue.splice(0, over * EVENT_STRIDE);
      this.droppedEvents += over;
    }
  }

  /** Whether the subscription draws elements, and with them their fire (PLAN 2.3, 2.4). */
  private wantsElements(): boolean {
    return this.sub.wantsElements && this.sub.tier >= 1.5;
  }

  /**
   * Fire events (PLAN 2.4) for a view that draws elements: those with an end inside the
   * subscribed bbox when they happen, the shooter's weapon in place of its unit. Any other view
   * gets none and none are kept, so a strategic zoom pays nothing. Read-only on the sim (I4).
   */
  private drainFires(world: World): void {
    const fires = world.out.fires;
    const units = world.rules?.units;
    if (units && this.wantsElements()) {
      const q = this.fireQueue;
      for (let i = 0; i < fires.length; i += FIRE_STRIDE) {
        const from = this.inBbox(fires[i + FireField.x0]!, fires[i + FireField.y0]!, world);
        if (!from && !this.inBbox(fires[i + FireField.x1]!, fires[i + FireField.y1]!, world)) continue;
        for (let c = 0; c < FIRE_STRIDE; c++) q.push(c === FireField.weapon ? weaponOf(units[fires[i + c]!]?.cls ?? 'inf') : fires[i + c]!);
      }
      const over = q.length / FIRE_STRIDE - FIRE_QUEUE_CAP;
      if (over > 0) {
        q.splice(0, over * FIRE_STRIDE);
        this.droppedFires += over;
      }
    }
    fires.length = 0;
  }

  /**
   * Elements of formations inside the subscribed bbox (PLAN 2.3): only when the subscription
   * wants them at tier ≥ 1.5. Read-only: never touches sim state (I4).
   */
  private elementSection(world: World, buffers: ArrayBuffer[]): SnapshotElements {
    const ft = world.formations;
    const picked: number[] = [];
    let total = 0;
    let truncated = false;
    const idx = this.wantsElements() && world.rules ? elementIndex(world) : null;
    if (idx) {
      ft.forEach((f) => {
        if (truncated) return;
        const list = idx.get(f);
        if (!list || !this.inBbox(ft.cols.x[f]!, ft.cols.y[f]!, world)) return;
        if (total + list.length > MAX_SNAPSHOT_ELEMENTS) {
          truncated = true;
          return;
        }
        picked.push(f);
        total += list.length;
      });
    }
    // Nothing to send (T0/T1, or no formations in view): empty arrays, no pooled buffers.
    if (total === 0) return { ...EMPTY_ELEMENTS, truncated };
    const id = this.view(Uint32Array, total, buffers);
    const formation = this.view(Uint32Array, total, buffers);
    const nation = this.view(Uint16Array, total, buffers);
    const frame = this.view(Uint8Array, total, buffers);
    const strength = this.view(Uint16Array, total, buffers);
    const x = this.view(Float64Array, total, buffers);
    const y = this.view(Float64Array, total, buffers);
    const prevX = this.view(Float64Array, total, buffers);
    const prevY = this.view(Float64Array, total, buffers);
    const facing = this.view(Float32Array, total, buffers);
    const flags = this.view(Uint8Array, total, buffers);
    const ec = world.elements.cols;
    const units = world.rules?.units ?? [];
    let j = 0;
    for (const f of picked) {
      const list = idx!.get(f)!;
      const fx = ft.cols.x[f]!;
      const fy = ft.cols.y[f]!;
      const born = f >= this.prevAlive.length || this.prevAlive[f] !== 1;
      const px = born ? fx : this.prevX[f]!;
      const py = born ? fy : this.prevY[f]!;
      const fa = ft.cols.facing[f]!;
      const fl = (ft.cols.moving[f] === 1 ? FormationFlag.moving : 0) | (ft.cols.engaged[f] === 1 ? FormationFlag.engaged : 0);
      for (const e of list) {
        const slot = ec.slot[e]!;
        const [cx, cy] = slotPose(fx, fy, fa, slot, list.length, SLOT_SPACING);
        const [qx, qy] = slotPose(px, py, fa, slot, list.length, SLOT_SPACING);
        id[j] = e;
        formation[j] = f;
        nation[j] = ft.cols.nation[f]!;
        frame[j] = frameOf(units[ec.unit[e]!]?.cls ?? 'inf');
        strength[j] = ec.strength[e]!;
        x[j] = cx;
        y[j] = cy;
        prevX[j] = qx;
        prevY[j] = qy;
        facing[j] = fa;
        flags[j] = fl;
        j++;
      }
    }
    return { count: total, id, formation, nation, frame, strength, x, y, prevX, prevY, facing, flags, truncated };
  }

  private inBbox(x: number, y: number, world: World): boolean {
    const [x0, y0, x1, y1] = this.sub.bbox;
    if (y < y0 || y > y1) return false;
    const w = world.cells.w;
    if (x1 - x0 >= w) return true;
    const dx = (((x - x0) % w) + w) % w;
    return dx <= x1 - x0;
  }

  private maybeSend(): void {
    if (!this.sim || this.inFlight) return;
    const world = this.sim.world;
    const due = this.forceSend || world.tick !== this.sentTick || this.eventQueue.length > 0;
    if (!due) return;
    const { snap, transfer } = this.build(world);
    this.inFlight = true;
    this.forceSend = false;
    this.sentTick = world.tick;
    this.post({ type: 'snapshot', snap }, transfer);
  }

  private view<T extends Float64Array | Uint32Array | Uint16Array | Float32Array | Uint8Array>(
    ctor: { new (buf: ArrayBuffer, off: number, len: number): T; BYTES_PER_ELEMENT: number },
    length: number,
    buffers: ArrayBuffer[],
  ): T {
    const buf = this.pool.acquire(Math.max(1, length) * ctor.BYTES_PER_ELEMENT);
    buffers.push(buf);
    return new ctor(buf, 0, length);
  }

  private build(world: World): { snap: Snapshot; transfer: ArrayBuffer[] } {
    const buffers: ArrayBuffer[] = [];
    const out = world.out;
    const { w, h } = world.cells;

    // Dirty tiles (coalesced since the last snapshot).
    let tileCount = 0;
    for (let i = 0; i < out.dirtyTiles.length; i++) if (out.dirtyTiles[i] === 1) tileCount++;
    const ids = this.view(Uint32Array, tileCount, buffers);
    const owner = this.view(Uint16Array, tileCount * TILE * TILE, buffers);
    const controller = this.view(Uint16Array, tileCount * TILE * TILE, buffers);
    owner.fill(0);
    controller.fill(0);
    let k = 0;
    for (let t = 0; t < out.dirtyTiles.length; t++) {
      if (out.dirtyTiles[t] !== 1) continue;
      out.dirtyTiles[t] = 0;
      ids[k] = t;
      const tx = t % out.tilesX;
      const ty = (t - tx) / out.tilesX;
      const x0 = tx * TILE;
      const rowLen = Math.min(TILE, w - x0);
      for (let r = 0; r < TILE; r++) {
        const y = ty * TILE + r;
        if (y >= h) break;
        const src = y * w + x0;
        const dst = (k * TILE + r) * TILE;
        owner.set(world.cells.owner.subarray(src, src + rowLen), dst);
        controller.set(world.cells.controller.subarray(src, src + rowLen), dst);
      }
      k++;
    }

    // Nations.
    const nt = world.nations;
    const nations = this.view(Float64Array, nt.count * NATION_STRIDE, buffers);
    let n = 0;
    nt.forEach((id) => {
      const o = n * NATION_STRIDE;
      nations[o + NationField.id] = id;
      nations[o + NationField.color] = nt.cols.color[id]!;
      nations[o + NationField.cells] = nt.cols.cells[id]!;
      nations[o + NationField.capitalX] = nt.cols.capitalX[id]!;
      nations[o + NationField.capitalY] = nt.cols.capitalY[id]!;
      nations[o + NationField.alliance] = world.alliances.allianceOf(id)?.leader ?? 0;
      nations[o + NationField.overlord] = nt.cols.living[id] === 1 ? nt.cols.overlord[id]! : 0;
      nations[o + NationField.income] = nt.cols.income[id]!;
      n++;
    });
    const warPairs: number[] = [];
    for (const war of world.wars.list) for (const a of war.sides[0]) for (const b of war.sides[1]) warPairs.push(a, b);
    const wars = Uint16Array.from(warPairs);

    // Formations (all; elements arrive with Phase 2 when the subscription asks for them).
    const ft = world.formations;
    const fc = ft.count;
    const fid = this.view(Uint32Array, fc, buffers);
    const fnat = this.view(Uint16Array, fc, buffers);
    const fx = this.view(Float64Array, fc, buffers);
    const fy = this.view(Float64Array, fc, buffers);
    const fpx = this.view(Float64Array, fc, buffers);
    const fpy = this.view(Float64Array, fc, buffers);
    const ffacing = this.view(Float32Array, fc, buffers);
    const fstr = this.view(Uint32Array, fc, buffers);
    const ftpl = this.view(Uint16Array, fc, buffers);
    const fflags = this.view(Uint8Array, fc, buffers);
    const ftarget = this.view(Uint32Array, fc, buffers);
    let j = 0;
    ft.forEach((id) => {
      fid[j] = id;
      fnat[j] = ft.cols.nation[id]!;
      fx[j] = ft.cols.x[id]!;
      fy[j] = ft.cols.y[id]!;
      // A formation created during the last tick has no previous position: use the current one.
      const born = id >= this.prevAlive.length || this.prevAlive[id] !== 1;
      fpx[j] = born ? fx[j]! : this.prevX[id]!;
      fpy[j] = born ? fy[j]! : this.prevY[id]!;
      ffacing[j] = ft.cols.facing[id]!;
      fstr[j] = ft.cols.strength[id]!;
      ftpl[j] = ft.cols.template[id]!;
      const moving = ft.cols.moving[id] === 1;
      fflags[j] = (moving ? FormationFlag.moving : 0) | (ft.cols.engaged[id] === 1 ? FormationFlag.engaged : 0);
      ftarget[j] = moving ? ft.cols.targetCell[id]! : 0;
      j++;
    });
    const majors = Float32Array.from(world.battles.majors.flatMap((m) => [m.x, m.y]));
    const elements = this.elementSection(world, buffers);

    // Events: global ones always, spatial ones only inside the subscribed bbox.
    const q = this.eventQueue;
    let ec = 0;
    for (let i = 0; i < q.length; i += EVENT_STRIDE) {
      const x = q[i + 5]!;
      if (x !== x || this.inBbox(x, q[i + 6]!, world)) ec++;
    }
    const events = this.view(Float64Array, ec * EVENT_STRIDE, buffers);
    let e = 0;
    for (let i = 0; i < q.length; i += EVENT_STRIDE) {
      const x = q[i + 5]!;
      if (x !== x || this.inBbox(x, q[i + 6]!, world)) {
        for (let c = 0; c < EVENT_STRIDE; c++) events[e * EVENT_STRIDE + c] = q[i + c]!;
        e++;
      }
    }
    this.eventQueue = [];

    // Fires: what was queued while the view drew elements; a view that left that tier gets none.
    const fq = this.wantsElements() ? this.fireQueue : [];
    const fires = fq.length > 0 ? this.view(Float64Array, fq.length, buffers) : NO_FIRES;
    fires.set(fq);
    this.fireQueue = [];

    const snap: Snapshot = {
      seq: ++this.seq,
      tick: world.tick,
      speed: this.speed,
      paused: this.paused,
      tickMs: this.paused || this.speed === 'max' ? 0 : 1000 / this.speed,
      tiles: { size: TILE, tilesX: out.tilesX, tilesY: out.tilesY, count: tileCount, ids, owner, controller },
      nations: { count: n, data: nations },
      wars,
      formations: { count: fc, id: fid, nation: fnat, x: fx, y: fy, prevX: fpx, prevY: fpy, facing: ffacing, strength: fstr, template: ftpl, flags: fflags, target: ftarget },
      majors,
      elements,
      events: { count: ec, data: events, dropped: this.droppedEvents },
      fires: { count: fq.length / FIRE_STRIDE, data: fires, dropped: this.droppedFires },
      buffers,
    };
    return { snap, transfer: buffers };
  }
}
