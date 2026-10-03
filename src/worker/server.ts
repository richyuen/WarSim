/**
 * Worker-side sim host (SPEC §2.3/§2.4): scheduler (speed/pause), request handling and
 * rAF-acked snapshots with a recycled buffer pool. Environment-agnostic: the worker entry
 * supplies `post` and drives `pump(nowMs)` from a timer; tests drive it directly in Node.
 *
 * Subscriptions only change what is *sent*; the sim never sees them (invariant I4).
 */
import { LABEL_STRIDE } from '../shared/nationLabels';
import { NATIONS_1938 } from '../sim/scenario1938';
import { deriveNationLabels } from './deriveLabels';
import terrainJson from '../../data/terrain.json' with { type: 'json' };
import cities1938 from '../../data/scenarios/1938/cities.json' with { type: 'json' };
import { buildLandCoverage } from '../shared/landCoverage';
import { EVENT_STRIDE } from '../shared/events';
import {
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
import { Sim } from '../sim/sim';
import { AssetStore } from './assets';
import { TILE, type World } from '../sim/world';
import { BufferPool } from './pool';

export type Post = (msg: FromWorker, transfer: Transferable[]) => void;

/** Max wall-clock ms spent ticking per pump at 'max' speed, so messages stay responsive. */
const MAX_SLICE_MS = 12;
/** Hard cap on queued (unsent) events; beyond it the oldest are dropped and counted. */
const EVENT_QUEUE_CAP = 1 << 20;
/** Never schedule more than this many ticks in one pump at a fixed speed (avoid spirals). */
const MAX_TICKS_PER_PUMP = 2000;

const DEFAULT_SUB: Subscription = { bbox: [0, 0, Infinity, Infinity], z: 0, tier: 0, wantsElements: false };

/** Minimum wall time between label derivations (PLAN 1.29). */
const LABEL_INTERVAL_MS = 2000;
const STATS_INTERVAL_MS = 1000;

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

  private reply(reqId: number, bytes?: Uint8Array): void {
    const s = this.requireSim();
    const status: SimStatus = { tick: s.tick, hash: s.hash() };
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
      case 'cmd':
        this.requireSim().command(msg.cmd);
        break;
      case 'hash':
        this.reply(msg.reqId);
        break;
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
        this.inFlight = false;
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
      const cc = world.cities.cols;
      const cities: { name: string; x: number; y: number; size: number; capital: boolean }[] = [];
      world.cities.forEach((id) => {
        const def = cities1938.cities[cc.def[id]!];
        if (def) cities.push({ name: def.name, x: cc.x[id]!, y: cc.y[id]!, size: cc.size[id]!, capital: cc.capitalOf[id] !== 0 });
      });
      const province = world.cells.province.slice();
      this.post({ type: 'mapLayers', land, terrain, terrainColors, cities, province }, [land.data.buffer, terrain.data.buffer, province.buffer]);
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
    return sim.world.tick !== this.statsTick || sim.world.controlChanges !== this.labelVersion;
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
    const nc = world.nations.cols;
    const men = new Map<number, number>();
    const count = new Map<number, number>();
    const fc = world.formations.cols;
    world.formations.forEach((f) => {
      const n = fc.nation[f]!;
      men.set(n, (men.get(n) ?? 0) + fc.strength[f]!);
      count.set(n, (count.get(n) ?? 0) + 1);
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
    const nations: NationStat[] = [];
    world.nations.forEach((id) => {
      if (nc.living[id] !== 1) return;
      const al = world.alliances.allianceOf(id);
      const k = al ? al.members.indexOf(id) : -1;
      nations.push({
        id,
        name: this.nameOf(id),
        color: nc.color[id]!,
        cells: nc.cells[id]!,
        gold: nc.gold[id]!,
        income: nc.income[id]!,
        expenses: nc.expenses[id]!,
        incomeBonus: nc.incomeBonus[id]!,
        bankrupt: nc.bankrupt[id] === 1,
        manpower: nc.manpower[id]!,
        men: men.get(id) ?? 0,
        formations: count.get(id) ?? 0,
        efficiency: nc.efficiency[id]!,
        alliance: al ? { name: al.nameKey, leader: al.leader, unity: al.unity, loyalty: al.loyalty[k] ?? 0 } : null,
        overlord: nc.overlord[id]!,
        autonomy: nc.autonomy[id]!,
        loyalty: nc.loyalty[id]!,
        integration: nc.integration[id]!,
        puppets: puppets.get(id) ?? [],
        enemies: [...(enemies.get(id) ?? [])],
        aiOff: nc.aiOff[id] === 1,
      });
    });
    this.post({ type: 'nationStats', tick: world.tick, nations, wars }, []);
  }

  /**
   * Nation label curves (PLAN 1.29): re-derived when control changed, at most every
   * LABEL_INTERVAL_MS (a ~40 ms flood at M), and once after init or load. Real-map scenarios only.
   */
  private maybeLabels(nowMs: number): void {
    const sim = this.sim;
    if (!sim || !this.provinceNames) return;
    const world = sim.world;
    // Province unrest for the revolts map mode (cheap: a byte per province), when it changed.
    if (world.provinces.version !== this.unrestVersion && world.provinces.count > 0) {
      this.unrestVersion = world.provinces.version;
      const unrest = new Uint8Array(world.provinces.count);
      for (let p = 0; p < unrest.length; p++) unrest[p] = Math.round(world.provinces.unrest[p]!);
      this.post({ type: 'provinceStats', unrest }, [unrest.buffer]);
    }
    const changed = world.controlChanges !== this.labelVersion;
    if (!changed || (this.lastLabelMs >= 0 && nowMs - this.lastLabelMs < LABEL_INTERVAL_MS)) return;
    this.lastLabelMs = nowMs;
    this.labelVersion = world.controlChanges;
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

  /** i18n key of a scenario nation, or a literal ('=…') name for a spawned one. */
  private nameOf(id: number): string {
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
    world.out.fires.length = 0; // fire events reach the renderer with the tactical view (Phase 2)
    const over = this.eventQueue.length / EVENT_STRIDE - EVENT_QUEUE_CAP;
    if (over > 0) {
      this.eventQueue.splice(0, over * EVENT_STRIDE);
      this.droppedEvents += over;
    }
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

  private view<T extends Float64Array | Uint32Array | Uint16Array | Float32Array>(
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
      j++;
    });

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

    const snap: Snapshot = {
      seq: ++this.seq,
      tick: world.tick,
      speed: this.speed,
      paused: this.paused,
      tickMs: this.paused || this.speed === 'max' ? 0 : 1000 / this.speed,
      tiles: { size: TILE, tilesX: out.tilesX, tilesY: out.tilesY, count: tileCount, ids, owner, controller },
      nations: { count: n, data: nations },
      wars,
      formations: { count: fc, id: fid, nation: fnat, x: fx, y: fy, prevX: fpx, prevY: fpy, facing: ffacing, strength: fstr },
      events: { count: ec, data: events, dropped: this.droppedEvents },
      buffers,
    };
    return { snap, transfer: buffers };
  }
}
