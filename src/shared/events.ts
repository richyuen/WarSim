/**
 * Sim events (SPEC §2.3/§2.4): emitted by systems, never part of authoritative state or the
 * hash. Packed as fixed-width f64 records so they travel in pooled transferable buffers.
 */

export const EventKind = {
  /** a = formation id, b = nation, (x, y) = position. */
  FormationSpawned: 1,
  /** a = formation id, b = nation, (x, y) = last position. */
  FormationDestroyed: 2,
  /** a = command seq, b = 0, x = y = NaN (global). */
  CommandApplied: 3,
  /** a = nation, b = 1 when it goes bankrupt / 0 when it recovers (global). */
  Bankruptcy: 4,
} as const;
export type EventKind = (typeof EventKind)[keyof typeof EventKind];

/** Record layout: [seq, tick, kind, a, b, x, y]. */
export const EVENT_STRIDE = 7;

export interface SimEvent {
  seq: number;
  tick: number;
  kind: EventKind;
  a: number;
  b: number;
  /** NaN for global (non-spatial) events, which are always delivered. */
  x: number;
  y: number;
}

export function readEvent(buf: Float64Array, i: number): SimEvent {
  const o = i * EVENT_STRIDE;
  return {
    seq: buf[o]!,
    tick: buf[o + 1]!,
    kind: buf[o + 2]! as EventKind,
    a: buf[o + 3]!,
    b: buf[o + 4]!,
    x: buf[o + 5]!,
    y: buf[o + 6]!,
  };
}
