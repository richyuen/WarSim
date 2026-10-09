/**
 * Sound cues (PLAN 3.12d): which cue a major event asks for, which of a message's new events is
 * heard, and the notes of each cue. No audio here: `src/app/sound.ts` plays the notes, and a unit
 * test can ask this file what an event sounds like.
 */
import { EventKind } from './events';
import type { TickerRow } from './history';

/** The cues, the loudest news first: of several events in one message the first of these is heard. */
export const CUES = ['war', 'death', 'capital', 'return', 'peace'] as const;
export type Cue = (typeof CUES)[number];

const CUE_OF_KIND: Readonly<Record<number, Cue>> = {
  [EventKind.WarDeclared]: 'war',
  [EventKind.PeaceSigned]: 'peace',
  [EventKind.CapitalCaptured]: 'capital',
  [EventKind.NationEliminated]: 'death',
  [EventKind.NationCollapsed]: 'death',
  [EventKind.NationAnnexed]: 'death',
  [EventKind.NationRevived]: 'return',
};

/** The cue of an event kind (null: the event is silent). Every kind of the ticker has one. */
export function cueOfKind(kind: number): Cue | null {
  return CUE_OF_KIND[kind] ?? null;
}

/** What the listener has heard of: the worker's world (a new game or a load is a new one) and the last row of its log. */
export interface Heard {
  world: number;
  i: number;
}

/**
 * The cue of a statistics message's ticker rows, and what has now been heard. One cue a message
 * at most (at Max speed a message can bring five rows): the first of `CUES` among the rows that
 * are new. The first message of a world is its past and asks for nothing: a loaded game does
 * not sound its last month again.
 */
export function cueOfTicker(rows: readonly TickerRow[], world: number, heard: Heard | null): { cue: Cue | null; heard: Heard } {
  const last = rows.reduce((m, r) => Math.max(m, r.i), -1);
  if (!heard || heard.world !== world) return { cue: null, heard: { world, i: last } };
  let cue: Cue | null = null;
  for (const r of rows) {
    if (r.i <= heard.i) continue;
    const c = cueOfKind(r.kind);
    if (c && (cue === null || CUES.indexOf(c) < CUES.indexOf(cue))) cue = c;
  }
  return { cue, heard: { world, i: Math.max(heard.i, last) } };
}

/** A note of a cue: an oscillator of `wave` at `hz` (gliding to `to` when given), from `at` seconds for `dur` seconds, at `gain` of the volume. */
export interface Note {
  wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  hz: number;
  to?: number;
  at: number;
  dur: number;
  gain: number;
}

/**
 * The cues' notes, made in code (no sound file is loaded). War is a three-note call rising a
 * fourth and a fifth, as of a trumpet; a death two low falling tones; a capital taken two drum
 * strokes; a return a rising arpeggio; peace two soft bells.
 */
export const CUE_NOTES: Readonly<Record<Cue, readonly Note[]>> = {
  war: [
    { wave: 'sawtooth', hz: 392, at: 0, dur: 0.14, gain: 0.5 },
    { wave: 'sawtooth', hz: 523.25, at: 0.16, dur: 0.14, gain: 0.5 },
    { wave: 'sawtooth', hz: 783.99, at: 0.32, dur: 0.5, gain: 0.55 },
    { wave: 'square', hz: 392, at: 0.32, dur: 0.5, gain: 0.12 },
  ],
  death: [
    { wave: 'triangle', hz: 196, to: 174.61, at: 0, dur: 0.5, gain: 0.7 },
    { wave: 'triangle', hz: 130.81, to: 98, at: 0.45, dur: 0.8, gain: 0.8 },
  ],
  capital: [
    { wave: 'sine', hz: 150, to: 50, at: 0, dur: 0.22, gain: 1 },
    { wave: 'sine', hz: 150, to: 50, at: 0.26, dur: 0.3, gain: 1 },
    { wave: 'triangle', hz: 293.66, at: 0.26, dur: 0.35, gain: 0.25 },
  ],
  return: [
    { wave: 'triangle', hz: 261.63, at: 0, dur: 0.16, gain: 0.5 },
    { wave: 'triangle', hz: 329.63, at: 0.12, dur: 0.16, gain: 0.5 },
    { wave: 'triangle', hz: 392, at: 0.24, dur: 0.16, gain: 0.5 },
    { wave: 'triangle', hz: 523.25, at: 0.36, dur: 0.45, gain: 0.55 },
  ],
  peace: [
    { wave: 'sine', hz: 659.25, at: 0, dur: 0.6, gain: 0.45 },
    { wave: 'sine', hz: 880, at: 0.18, dur: 0.8, gain: 0.4 },
  ],
};

/** How long a cue lasts, in seconds. */
export function cueSeconds(cue: Cue): number {
  return CUE_NOTES[cue].reduce((m, n) => Math.max(m, n.at + n.dur), 0);
}
