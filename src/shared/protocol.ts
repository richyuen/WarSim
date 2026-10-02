/**
 * Main ↔ worker messages (SPEC §2.3). PLAN 0.12 covers lifecycle, stepping, commands,
 * hashing and save/load; PLAN 0.13 adds subscriptions and acked snapshots.
 */
import type { Command } from './commands';

export type ScenarioId = 'toy';

export interface SimInit {
  scenario: ScenarioId;
  seed: number;
}

/** Requests that expect a `reply` carry a caller-chosen `reqId`. */
export type ToWorker =
  | { type: 'init'; reqId: number; init: SimInit }
  | { type: 'step'; reqId: number; n: number }
  | { type: 'cmd'; cmd: Command }
  | { type: 'hash'; reqId: number }
  | { type: 'save'; reqId: number }
  | { type: 'load'; reqId: number; bytes: Uint8Array };

export interface SimStatus {
  tick: number;
  hash: number;
}

export type FromWorker =
  | { type: 'reply'; reqId: number; status: SimStatus; bytes?: Uint8Array }
  | { type: 'error'; reqId: number; message: string; stack: string };
