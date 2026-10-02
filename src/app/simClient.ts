/**
 * Main-thread handle to the sim worker: promise request/reply, and snapshot flow control.
 *
 * Snapshots are acked from requestAnimationFrame (SPEC §2.3): the worker sends the next one
 * only after main has had a frame to consume the previous one, and the snapshot's buffers
 * are transferred back for reuse.
 */
import type { Command } from '../shared/commands';
import type { FromWorker, SimInit, SimStatus, Snapshot, Speed, Subscription, ToWorker } from '../shared/protocol';

type Pending = { resolve: (r: { status: SimStatus; bytes?: Uint8Array }) => void; reject: (e: Error) => void };

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
    const p = this.pending.get(msg.reqId);
    if (!p) return;
    this.pending.delete(msg.reqId);
    if (msg.type === 'error') {
      const err = new Error(msg.message);
      err.stack = msg.stack;
      p.reject(err);
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
  onSnapshotReceived(l: SnapshotListener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private request(req: Request, transfer: Transferable[] = []): Promise<{ status: SimStatus; bytes?: Uint8Array }> {
    const reqId = this.nextReq++;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.worker.postMessage({ ...req, reqId } as ToWorker, transfer);
    });
  }

  private send(msg: Exclude<ToWorker, { reqId: number }>): void {
    this.worker.postMessage(msg);
  }

  async init(init: SimInit): Promise<SimStatus> {
    return (await this.request({ type: 'init', init })).status;
  }

  async step(n: number): Promise<SimStatus> {
    return (await this.request({ type: 'step', n })).status;
  }

  command(cmd: Command): void {
    this.send({ type: 'cmd', cmd });
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
    return (await this.request({ type: 'hash' })).status;
  }

  async save(): Promise<Uint8Array> {
    const r = await this.request({ type: 'save' });
    if (!r.bytes) throw new Error('save reply without bytes');
    return r.bytes;
  }

  async load(bytes: Uint8Array): Promise<SimStatus> {
    const copy = bytes.slice();
    return (await this.request({ type: 'load', bytes: copy }, [copy.buffer])).status;
  }

  terminate(): void {
    this.worker.terminate();
  }
}
