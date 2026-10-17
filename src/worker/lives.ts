/**
 * Each nation's life from the history log (PLAN 7.4f28, the critic's N14: AoC's Statistics lists
 * the dead, marked, in lists of a life: age, wars, revolts). Derived, not state: the log is
 * (`World.history`), so a load gives the same lives. Read on from where the last call stopped.
 *
 * - A nation lives from tick 0 if the log has no birth of it before its first death (a nation of
 *   the scenario), else from its birth: `RevoltSpawned` (a = the new nation; a revolt, a Kill's
 *   split, God Mode's Spawn nation) or `NationRevived`. `NationEliminated` ends a life: every
 *   death goes through it (`capitals.ts`). A revived nation's age is the sum of its lives.
 *   Nation rows are never removed, so an id is one nation.
 * - Wars: the wars it declared or had declared on it (`WarDeclared`). Allies that join a war
 *   have no event of it, so a war joined is not counted.
 * - Revolts: the nations that rose on its land (`RevoltSpawned` b): a God Mode spawn and a Kill's
 *   split are counted as revolts, which the log does not tell apart.
 */
import { EventKind } from '../shared/events';
import { HISTORY_STRIDE } from '../sim/history';
import type { World } from '../sim/world';
import type { NationLife as Life } from '../shared/protocol';

/** Hours in a year of 365.2425 days: an age in years. */
const TICKS_A_YEAR = 24 * 365.2425;

interface Tally {
  /** The tick its open life began, or -1 while dead. */
  open: number;
  /** Ticks of its lives that have ended. */
  past: number;
  seen: boolean;
  wars: number;
  revolts: number;
}

export class Lives {
  private world: World | null = null;
  private from = 0;
  private readonly tallies = new Map<number, Tally>();

  private tally(id: number): Tally {
    let t = this.tallies.get(id);
    if (!t) this.tallies.set(id, (t = { open: 0, past: 0, seen: false, wars: 0, revolts: 0 }));
    return t;
  }

  private born(id: number, tick: number): void {
    const t = this.tally(id);
    if (!t.seen) t.open = tick;
    else if (t.open < 0) t.open = tick;
    t.seen = true;
  }

  private died(id: number, tick: number): void {
    const t = this.tally(id);
    t.seen = true;
    if (t.open >= 0) t.past += tick - t.open;
    t.open = -1;
  }

  /** The lives of every nation of `world` at its tick. */
  of(world: World): Life[] {
    const rows = world.history.rows;
    if (world !== this.world || rows.length < this.from) {
      this.world = world;
      this.from = 0;
      this.tallies.clear();
    }
    for (let i = this.from; i < rows.length; i += HISTORY_STRIDE) {
      const [tick, kind, a, b] = [rows[i]!, rows[i + 1]!, rows[i + 2]!, rows[i + 3]!];
      if (kind === EventKind.RevoltSpawned) {
        this.born(a, tick);
        this.tally(b).revolts++;
      } else if (kind === EventKind.NationRevived) this.born(a, tick);
      else if (kind === EventKind.NationEliminated) this.died(a, tick);
      else if (kind === EventKind.WarDeclared) {
        this.tally(a).wars++;
        this.tally(b).wars++;
      }
    }
    this.from = rows.length;
    const out: Life[] = [];
    const nc = world.nations.cols;
    world.nations.forEach((id) => {
      const t = this.tallies.get(id);
      const ticks = (t?.past ?? 0) + (t && t.open < 0 ? 0 : world.tick - (t?.open ?? 0));
      out.push({ id, living: nc.living[id] === 1, age: ticks / TICKS_A_YEAR, wars: t?.wars ?? 0, revolts: t?.revolts ?? 0 });
    });
    return out;
  }
}
