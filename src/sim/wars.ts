/**
 * War records (SPEC §3.5, PLAN 1.16): sides, start tick, war score, exhaustion and fight-to-the-
 * death per side, plus truces. Saved as one JSON section. The pairwise `atWar` lookup (used in
 * every hot loop) is a derived key set rebuilt whenever the records change, and so is the set of
 * pairs fighting on the same side of a war (`sameSide`, PLAN 1.42b).
 */
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';

export const ATTACKERS = 0;
export const DEFENDERS = 1;

export interface War {
  id: number;
  /** Side members; index 0 is the side leader. */
  sides: [number[], number[]];
  startTick: number;
  /** −100..100, positive when the attackers are winning (updated daily). */
  score: number;
  /** Score points from capital captures (attackers' view). */
  capitalBonus: number;
  /** 0..100 per side (updated daily). */
  exhaustion: [number, number];
  fightToDeath: [boolean, boolean];
  /** Men in each side's formations when first assessed (exhaustion baseline; 0 = not yet). */
  startMen: [number, number];
}

export interface Truce {
  a: number;
  b: number;
  untilTick: number;
}

export class Wars implements Stateful {
  list: War[] = [];
  truces: Truce[] = [];
  nextId = 1;
  /** Bumped on every change (derived caches compare against it; not state). */
  version = 0;
  private keys = new Set<number>();
  private sideKeys = new Set<number>();

  private static key(a: number, b: number): number {
    return a < b ? a * 65536 + b : b * 65536 + a;
  }

  /** Rebuilds the derived pair set; call after any change to `list`. */
  changed(): void {
    this.keys.clear();
    for (const w of this.list) for (const a of w.sides[0]) for (const d of w.sides[1]) if (a !== d) this.keys.add(Wars.key(a, d));
    this.sideKeys.clear();
    for (const w of this.list) for (const side of w.sides) for (const a of side) for (const b of side) if (a < b) this.sideKeys.add(Wars.key(a, b));
    this.version++;
  }

  /** Whether a and b fight on the same side of a war (and are not at war with each other). */
  sameSide(a: number, b: number): boolean {
    if (a === b) return false;
    const k = Wars.key(a, b);
    return this.sideKeys.has(k) && !this.keys.has(k);
  }

  /**
   * Whether a fights enemy `d` together with b: both are at war with d and they share a side
   * (PLAN 1.42b). a's formations then count on b's front against d, and the other way round.
   */
  together(a: number, b: number, d: number): boolean {
    return this.sameSide(a, b) && this.atWar(a, d) && this.atWar(b, d);
  }

  atWar(a: number, b: number): boolean {
    return a !== b && this.keys.has(Wars.key(a, b));
  }

  /** Number of warring pairs. */
  get size(): number {
    return this.keys.size;
  }

  /** The war in which a and b are on opposite sides, and a's side, or null. */
  between(a: number, b: number): { war: War; side: number } | null {
    for (const w of this.list) {
      if (w.sides[0].includes(a) && w.sides[1].includes(b)) return { war: w, side: ATTACKERS };
      if (w.sides[1].includes(a) && w.sides[0].includes(b)) return { war: w, side: DEFENDERS };
    }
    return null;
  }

  inTruce(a: number, b: number, tick: number): boolean {
    return this.truces.some((t) => ((t.a === a && t.b === b) || (t.a === b && t.b === a)) && t.untilTick > tick);
  }

  /** Starts a war; returns it. Members must not already be at war with each other. */
  start(attackers: number[], defenders: number[], tick: number, fightToDeath: [boolean, boolean] = [false, false]): War {
    const war: War = { id: this.nextId++, sides: [[...attackers], [...defenders]], startTick: tick, score: 0, capitalBonus: 0, exhaustion: [0, 0], fightToDeath, startMen: [0, 0] };
    this.list.push(war);
    this.changed();
    return war;
  }

  end(war: War): void {
    this.list = this.list.filter((w) => w !== war);
    this.changed();
  }

  /**
   * Test/God convenience: `war` = true starts a one-on-one war (a attacks b) unless they are
   * already at war; false ends every war in which they are on opposite sides.
   */
  set(a: number, b: number, war: boolean): void {
    if (a === b) return;
    if (war) {
      if (!this.atWar(a, b)) this.start([a], [b], 0);
      return;
    }
    let w = this.between(a, b);
    while (w) {
      this.end(w.war);
      w = this.between(a, b);
    }
  }

  /** Removes nation `n` from every war; wars left with an empty side end. */
  endAllOf(n: number): void {
    for (const w of this.list) {
      w.sides[0] = w.sides[0].filter((m) => m !== n);
      w.sides[1] = w.sides[1].filter((m) => m !== n);
    }
    this.list = this.list.filter((w) => w.sides[0].length > 0 && w.sides[1].length > 0);
    this.truces = this.truces.filter((t) => t.a !== n && t.b !== n);
    this.changed();
  }

  /** Nations in at least one war. */
  nations(): Set<number> {
    const s = new Set<number>();
    for (const w of this.list) for (const side of w.sides) for (const m of side) s.add(m);
    return s;
  }

  serialize(): Section[] {
    const json = JSON.stringify({ list: this.list, truces: this.truces, nextId: this.nextId });
    return [{ name: 'wars.json', dtype: 'u8', data: new TextEncoder().encode(json) }];
  }

  deserialize(sections: readonly Section[]): void {
    const parsed = JSON.parse(new TextDecoder().decode(takeSection(sections, 'wars.json', 'u8'))) as { list: War[]; truces: Truce[]; nextId: number };
    this.list = parsed.list;
    this.truces = parsed.truces;
    this.nextId = parsed.nextId;
    this.changed();
  }
}
