/// <reference lib="webworker" />
/**
 * Sim worker entry (ADR-2): wires `SimServer` to postMessage and a timer. Messages are
 * handled one at a time in arrival order; the timer runs the scheduler while unpaused.
 */
import type { FromWorker, ToWorker } from '../shared/protocol';
import { SimServer } from './server';

declare const self: DedicatedWorkerGlobalScope;

/** Timer period while running at a fixed speed (ms). */
const PUMP_MS = 4;

const now = (): number => performance.now();
const server = new SimServer((msg: FromWorker, transfer: Transferable[]) => self.postMessage(msg, transfer));

let timer: ReturnType<typeof setTimeout> | null = null;

function schedule(): void {
  if (timer !== null || !server.running) return;
  // At 'max' yield to the message queue between slices (setTimeout 0); otherwise pace.
  timer = setTimeout(
    () => {
      timer = null;
      server.pump(now(), now);
      schedule();
    },
    server.speed === 'max' && server.ticking ? 0 : PUMP_MS,
  );
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  server.handle(e.data, now());
  schedule();
};
