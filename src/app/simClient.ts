/**
 * Main-thread handle to the sim worker: request/reply over postMessage with promise results.
 */
import type { Command } from '../shared/commands';
import type { FromWorker, SimInit, SimStatus, ToWorker } from '../shared/protocol';

type Pending = { resolve: (r: { status: SimStatus; bytes?: Uint8Array }) => void; reject: (e: Error) => void };

/** Distributive Omit so each union member keeps its own fields. */
type WithoutReqId<T> = T extends unknown ? Omit<T, 'reqId'> : never;
type Request = WithoutReqId<Exclude<ToWorker, { type: 'cmd' }>>;

export class SimClient {
  private readonly worker: Worker;
  private nextReq = 1;
  private readonly pending = new Map<number, Pending>();

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

  private request(req: Request, transfer: Transferable[] = []): Promise<{ status: SimStatus; bytes?: Uint8Array }> {
    const reqId = this.nextReq++;
    return new Promise((resolve, reject) => {
      this.pending.set(reqId, { resolve, reject });
      this.worker.postMessage({ ...req, reqId } as ToWorker, transfer);
    });
  }

  async init(init: SimInit): Promise<SimStatus> {
    return (await this.request({ type: 'init', init })).status;
  }

  async step(n: number): Promise<SimStatus> {
    return (await this.request({ type: 'step', n })).status;
  }

  command(cmd: Command): void {
    this.worker.postMessage({ type: 'cmd', cmd } satisfies ToWorker);
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
