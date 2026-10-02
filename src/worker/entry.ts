/// <reference lib="webworker" />
/**
 * Sim worker entry (ADR-2): hosts the same `Sim` facade that Node tests use.
 * Requests are processed strictly in arrival order (one message at a time).
 */
import type { FromWorker, SimStatus, ToWorker } from '../shared/protocol';
import { Sim } from '../sim/sim';

declare const self: DedicatedWorkerGlobalScope;

let sim: Sim | null = null;

function status(s: Sim): SimStatus {
  return { tick: s.tick, hash: s.hash() };
}

function requireSim(): Sim {
  if (!sim) throw new Error('sim not initialised');
  return sim;
}

function post(msg: FromWorker, transfer: Transferable[] = []): void {
  self.postMessage(msg, transfer);
}

function handle(msg: ToWorker): void {
  switch (msg.type) {
    case 'init':
      sim = new Sim(msg.init);
      post({ type: 'reply', reqId: msg.reqId, status: status(sim) });
      return;
    case 'step': {
      const s = requireSim();
      s.step(msg.n);
      post({ type: 'reply', reqId: msg.reqId, status: status(s) });
      return;
    }
    case 'cmd':
      requireSim().command(msg.cmd);
      return;
    case 'hash':
      post({ type: 'reply', reqId: msg.reqId, status: status(requireSim()) });
      return;
    case 'save': {
      const s = requireSim();
      const bytes = s.save();
      post({ type: 'reply', reqId: msg.reqId, status: status(s), bytes }, [bytes.buffer]);
      return;
    }
    case 'load': {
      const s = requireSim();
      s.load(msg.bytes);
      post({ type: 'reply', reqId: msg.reqId, status: status(s) });
      return;
    }
  }
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data;
  try {
    handle(msg);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    post({ type: 'error', reqId: 'reqId' in msg ? msg.reqId : -1, message: error.message, stack: error.stack ?? '' });
  }
};
