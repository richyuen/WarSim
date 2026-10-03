/**
 * Main-thread handle to the sim worker: promise request/reply, and snapshot flow control.
 *
 * Snapshots are acked from requestAnimationFrame (SPEC §2.3): the worker sends the next one
 * only after main has had a frame to consume the previous one, and the snapshot's buffers
 * are transferred back for reuse.
 */
import type { Command } from '../shared/commands';
import type { HistoryRow } from '../shared/history';
import type {
  FromWorker,
  Inspection,
  PoliticalBuildResult,
  ProvinceBuildResult,
  SimInit,
  SimStatus,
  Snapshot,
  Speed,
  Subscription,
  TerrainBuildResult,
  ToWorker,
} from '../shared/protocol';

/** Static map layers sent by the worker (PLAN 1.28b). */
export type NationStats = Extract<FromWorker, { type: 'nationStats' }>;
export type MapLayers = Extract<FromWorker, { type: 'mapLayers' }>;

type Reply =
  | { status: SimStatus; bytes?: Uint8Array }
  | { provinces: ProvinceBuildResult }
  | { terrain: TerrainBuildResult }
  | { political: PoliticalBuildResult };
type Pending = { resolve: (r: Reply) => void; reject: (e: Error) => void };

/** Distributive Omit so each union member keeps its own fields. */
type WithoutReqId<T> = T extends unknown ? Omit<T, 'reqId'> : never;
type Request = WithoutReqId<Extract<ToWorker, { reqId: number }>>;

export type SnapshotListener = (snap: Snapshot) => void;

export class SimClient {
  private readonly worker: Worker;
  private nextReq = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly listeners = new Set<SnapshotListener>();
  private latest: Snapshot | null = null;
  private ackScheduled = false;
  /** Snapshots received (stats/tests). */
  received = 0;

  constructor() {
    this.worker = new Worker(new URL('../worker/entry.ts', import.meta.url), { type: 'module', name: 'warsim-sim' });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.onMessage(e.data);
    this.worker.onerror = (e) => {
      const err = new Error(`sim worker error: ${e.message}`);
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    };
  }

  private onMessage(msg: FromWorker): void {
    if (msg.type === 'snapshot') {
      this.onSnapshot(msg.snap);
      return;
    }
    if (msg.type === 'provinceStats') {
      this.unrest = msg.unrest;
      for (const l of this.unrestListeners) l(msg.unrest);
      return;
    }
    if (msg.type === 'flags') {
      this.customFlags = msg.custom;
      for (const l of this.flagListeners) l(msg.custom);
      return;
    }
    if (msg.type === 'cityLayer') {
      for (const l of this.cityListeners) l(msg.cities);
      return;
    }
    if (msg.type === 'terrainLayer') {
      for (const l of this.terrainListeners) l(msg.data, msg.landChanged);
      return;
    }
    if (msg.type === 'nationStats') {
      this.stats = msg;
      for (const l of this.statsListeners) l(msg);
      return;
    }
    if (msg.type === 'labels') {
      this.labels = msg;
      for (const l of this.labelListeners) l(msg);
      return;
    }
    if (msg.type === 'mapLayers') {
      this.mapLayers = msg;
      for (const l of this.layerListeners) l(msg);
      return;
    }
    const p = this.pending.get(msg.reqId);
    if (!p) return;
    this.pending.delete(msg.reqId);
    if (msg.type === 'error') {
      const err = new Error(msg.message);
      err.stack = msg.stack;
      p.reject(err);
    } else if (msg.type === 'provinces') {
      p.resolve({ provinces: msg.result });
    } else if (msg.type === 'terrain') {
      p.resolve({ terrain: msg.result });
    } else if (msg.type === 'political') {
      p.resolve({ political: msg.result });
    } else {
      p.resolve(msg.bytes ? { status: msg.status, bytes: msg.bytes } : { status: msg.status });
    }
  }

  private onSnapshot(snap: Snapshot): void {
    this.received++;
    this.latest = snap;
    for (const l of this.listeners) l(snap);
    if (this.ackScheduled) return;
    this.ackScheduled = true;
    requestAnimationFrame(() => {
      this.ackScheduled = false;
      const s = this.latest;
      if (!s) return;
      this.latest = null;
      this.worker.postMessage({ type: 'ack', seq: s.seq, buffers: s.buffers } satisfies ToWorker, s.buffers);
    });
  }

  /** Listeners must copy what they need: the snapshot's arrays are returned to the worker on the next frame. */
  /** Province unrest from the worker (PLAN 1.30b); late listeners get the last values at once. */
  unrest: Uint8Array | null = null;
  private readonly unrestListeners = new Set<(u: Uint8Array) => void>();
  onUnrest(l: (u: Uint8Array) => void): () => void {
    this.unrestListeners.add(l);
    if (this.unrest) l(this.unrest);
    return () => this.unrestListeners.delete(l);
  }

  /** Custom pixel flags (PLAN 1.37b); late listeners get the last set at once. */
  customFlags: [number, number[]][] | null = null;
  private readonly flagListeners = new Set<(custom: [number, number[]][]) => void>();
  onFlags(l: (custom: [number, number[]][]) => void): () => void {
    this.flagListeners.add(l);
    if (this.customFlags) l(this.customFlags);
    return () => this.flagListeners.delete(l);
  }

  /** City dots and names after editor edits (PLAN 1.36). */
  private readonly cityListeners = new Set<(cities: MapLayers['cities']) => void>();
  onCities(l: (cities: MapLayers['cities']) => void): () => void {
    this.cityListeners.add(l);
    return () => this.cityListeners.delete(l);
  }

  /** Terrain layer after editor edits (PLAN 1.35). */
  private readonly terrainListeners = new Set<(data: Uint8Array, landChanged: boolean) => void>();
  onTerrain(l: (data: Uint8Array, landChanged: boolean) => void): () => void {
    this.terrainListeners.add(l);
    return () => this.terrainListeners.delete(l);
  }

  /** Nation panel / war banner data (PLAN 1.31); late listeners get the last ones at once. */
  stats: NationStats | null = null;
  private readonly statsListeners = new Set<(m: NationStats) => void>();
  onStats(l: (m: NationStats) => void): () => void {
    this.statsListeners.add(l);
    if (this.stats) l(this.stats);
    return () => this.statsListeners.delete(l);
  }

  /** Nation label curves from the worker (PLAN 1.29); late listeners get the last ones at once. */
  labels: Extract<FromWorker, { type: 'labels' }> | null = null;
  private readonly labelListeners = new Set<(m: Extract<FromWorker, { type: 'labels' }>) => void>();
  onLabels(l: (m: Extract<FromWorker, { type: 'labels' }>) => void): () => void {
    this.labelListeners.add(l);
    if (this.labels) l(this.labels);
    return () => this.labelListeners.delete(l);
  }

  /** Static map layers from the worker (PLAN 1.28b); late listeners get the last ones at once. */
  mapLayers: MapLayers | null = null;
  private readonly layerListeners = new Set<(m: MapLayers) => void>();
  onMapLayers(l: (m: MapLayers) => void): () => void {
    this.layerListeners.add(l);
    if (this.mapLayers) l(this.mapLayers);
    return () => this.layerListeners.delete(l);
  }

  onSnapshotReceived(l: SnapshotListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private request(req: Request, transfer: Transferable[] = []): Promise<Reply> {
    const reqId = this.nextReq++;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.worker.postMessage({ ...req, reqId } as ToWorker, transfer);
    });
  }

  private send(msg: Exclude<ToWorker, { reqId: number }>): void {
    this.worker.postMessage(msg);
  }

  private async status(req: Request, transfer: Transferable[] = []): Promise<{ status: SimStatus; bytes?: Uint8Array }> {
    const r = await this.request(req, transfer);
    if (!('status' in r)) throw new Error(`unexpected reply to ${req.type}`);
    return r;
  }

  /** Starts a sim; real-map scenarios load their assets in the worker from `data/earth/`. */
  async init(init: SimInit): Promise<SimStatus> {
    const assetBase = new URL('data/earth/', document.baseURI).href;
    return (await this.status({ type: 'init', init, assetBase })).status;
  }

  async step(n: number): Promise<SimStatus> {
    return (await this.status({ type: 'step', n })).status;
  }

  /** Builds the admin-1 province raster in the worker (PLAN 0.19). */
  async buildProvinces(w: number, h: number, withIds = false): Promise<ProvinceBuildResult> {
    const assetBase = new URL('data/earth/', document.baseURI).href;
    const r = await this.request({ type: 'buildProvinces', assetBase, w, h, withIds });
    if (!('provinces' in r)) throw new Error('unexpected reply to buildProvinces');
    return r.provinces;
  }

  /** Loads the terrain raster (with crossings) in the worker (PLAN 1.2). */
  async buildTerrain(w: number, h: number): Promise<TerrainBuildResult> {
    const assetBase = new URL('data/earth/', document.baseURI).href;
    const r = await this.request({ type: 'buildTerrain', assetBase, w, h });
    if (!('terrain' in r)) throw new Error('unexpected reply to buildTerrain');
    return r.terrain;
  }

  /** Builds the 1938 political map in the worker (PLAN 1.3). */
  async buildPolitical(w: number, h: number): Promise<PoliticalBuildResult> {
    const assetBase = new URL('data/earth/', document.baseURI).href;
    const r = await this.request({ type: 'buildPolitical', assetBase, w, h });
    if (!('political' in r)) throw new Error('unexpected reply to buildPolitical');
    return r.political;
  }

  /** Queues `cmd`; with `now` it is applied at once (between ticks; God Mode UI). */
  command(cmd: Command, now = false): void {
    this.send(now ? { type: 'cmd', cmd, now } : { type: 'cmd', cmd });
  }

  setSpeed(speed: Speed): void {
    this.send({ type: 'speed', speed });
  }

  setPaused(paused: boolean): void {
    this.send({ type: 'pause', paused });
  }

  subscribe(sub: Subscription): void {
    this.send({ type: 'subscribe', sub });
  }

  async hash(): Promise<SimStatus> {
    return (await this.status({ type: 'hash' })).status;
  }

  /** Statistics series (PLAN 1.34b): flat STAT_STRIDE f32 records. */
  async statSeries(): Promise<Float32Array> {
    const r = await this.status({ type: 'stats' });
    if (!r.bytes) throw new Error('stats reply without bytes');
    return new Float32Array(r.bytes.slice().buffer); // own, aligned copy
  }

  /** The history log (PLAN 1.34a). */
  async history(): Promise<HistoryRow[]> {
    const r = await this.status({ type: 'history' });
    if (!r.bytes) throw new Error('history reply without bytes');
    return JSON.parse(new TextDecoder().decode(r.bytes)) as HistoryRow[];
  }

  /** JSON summary of the world (PLAN 1.32; tests and the critic). */
  /** `full` adds cities, cores and unrest (bulky: ~600 KB on the 1938 map). */
  async inspect(full = false): Promise<Inspection> {
    const r = await this.status(full ? { type: 'inspect', full } : { type: 'inspect' });
    if (!r.bytes) throw new Error('inspect reply without bytes');
    return JSON.parse(new TextDecoder().decode(r.bytes)) as Inspection;
  }

  async save(): Promise<Uint8Array> {
    const r = await this.status({ type: 'save' });
    if (!r.bytes) throw new Error('save reply without bytes');
    return r.bytes;
  }

  /** Save bytes with the status at the same tick (the worker replies synchronously after saving). */
  async saveWithStatus(): Promise<{ bytes: Uint8Array; status: SimStatus }> {
    const r = await this.status({ type: 'save' });
    if (!r.bytes) throw new Error('save reply without bytes');
    return { bytes: r.bytes, status: r.status };
  }

  async load(bytes: Uint8Array): Promise<SimStatus> {
    const copy = bytes.slice();
    return (await this.status({ type: 'load', bytes: copy }, [copy.buffer])).status;
  }

  terminate(): void {
    this.worker.terminate();
  }
}
