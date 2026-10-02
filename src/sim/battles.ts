/**
 * Major Battles, breakthrough corridors and the history log (SPEC §5.4, §9; PLAN 1.23).
 * Saved as JSON. Ordinary battles stay derived per tick (combat.ts); a battle whose committed
 * strength reaches MAJOR_MEN becomes a persistent Major Battle record, matched to the derived
 * group each tick by location.
 */
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';

export interface MajorBattle {
  id: number;
  /** Nearest city row (its name labels the battle), 0 if none. */
  city: number;
  x: number;
  y: number;
  startTick: number;
  lastTick: number;
  /** The two camps (nations) and their men and centroids at the last observation. */
  camps: [number[], number[]];
  men: [number, number];
  centroid: [[number, number], [number, number]];
}

/** A winner's breakthrough corridor: a strip from (x, y) along (dx, dy) (unit), until untilTick. */
export interface Corridor {
  nation: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  untilTick: number;
}

export interface HistoryEntry {
  tick: number;
  /** An EventKind (MajorBattleStarted, MajorBattleEnded, …). */
  kind: number;
  a: number;
  b: number;
  x: number;
  y: number;
}

export class Battles implements Stateful {
  majors: MajorBattle[] = [];
  corridors: Corridor[] = [];
  history: HistoryEntry[] = [];
  nextId = 1;

  serialize(): Section[] {
    const json = JSON.stringify({ majors: this.majors, corridors: this.corridors, history: this.history, nextId: this.nextId });
    return [{ name: 'battles.json', dtype: 'u8', data: new TextEncoder().encode(json) }];
  }

  deserialize(sections: readonly Section[]): void {
    const p = JSON.parse(new TextDecoder().decode(takeSection(sections, 'battles.json', 'u8'))) as {
      majors: MajorBattle[];
      corridors: Corridor[];
      history: HistoryEntry[];
      nextId: number;
    };
    this.majors = p.majors;
    this.corridors = p.corridors;
    this.history = p.history;
    this.nextId = p.nextId;
  }
}
