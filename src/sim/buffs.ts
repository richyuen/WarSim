/**
 * Timed buffs and debuffs (SPEC §3.5, PLAN 1.21): {id, target (nation | formation | province),
 * kind, magnitude, expiresTick}. A buff is active on ticks [grant tick, expiresTick): the expiry
 * system runs first in every tick, so on its expiry tick no other system sees it. Saved as JSON;
 * the per-(kind, target) sums are a derived cache rebuilt on change.
 *
 * Kinds and where they apply (magnitude m is a fraction, e.g. 0.25 = +25%, negative = debuff):
 *   income    gross income × (1 + m)            (economy, nation)
 *   manpower  manpower growth × (1 + m)         (economy, nation)
 *   attack    damage dealt × (1 + m)            (combat, nation or formation)
 *   defense   damage taken ÷ (1 + m)            (combat, nation or formation)
 *   speed     march speed × (1 + m)             (movement, nation or formation)
 *   unrest    + m × 10 unrest per month         (revolts, nation or province)
 */
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';

export const BUFF_KINDS = ['income', 'manpower', 'attack', 'defense', 'speed', 'unrest'] as const;
export type BuffKind = (typeof BUFF_KINDS)[number];
export type BuffTarget = 'nation' | 'formation' | 'province';

export interface Buff {
  id: number;
  targetKind: BuffTarget;
  target: number;
  kind: BuffKind;
  magnitude: number;
  expiresTick: number;
  /** i18n key of the buff's name (e.g. buff.harsh_winter). */
  nameKey: string;
}

export class Buffs implements Stateful {
  list: Buff[] = [];
  nextId = 1;
  private sums = new Map<string, number>();

  private changed(): void {
    this.sums.clear();
    for (const b of this.list) {
      const k = `${b.kind}:${b.targetKind}:${b.target}`;
      this.sums.set(k, (this.sums.get(k) ?? 0) + b.magnitude);
    }
  }

  add(b: Omit<Buff, 'id'>): Buff {
    const buff = { ...b, id: this.nextId++ };
    this.list.push(buff);
    this.changed();
    return buff;
  }

  remove(id: number): Buff | undefined {
    const b = this.list.find((x) => x.id === id);
    if (!b) return undefined;
    this.list = this.list.filter((x) => x !== b);
    this.changed();
    return b;
  }

  /** Removes and returns the buffs whose expiresTick ≤ tick (ascending id). */
  expire(tick: number): Buff[] {
    const gone = this.list.filter((b) => b.expiresTick <= tick);
    if (gone.length === 0) return gone;
    this.list = this.list.filter((b) => b.expiresTick > tick);
    this.changed();
    return gone;
  }

  /** Sum of active magnitudes of `kind` on one target (0 when none). */
  sum(kind: BuffKind, targetKind: BuffTarget, target: number): number {
    return this.list.length === 0 ? 0 : (this.sums.get(`${kind}:${targetKind}:${target}`) ?? 0);
  }

  serialize(): Section[] {
    const json = JSON.stringify({ list: this.list, nextId: this.nextId });
    return [{ name: 'buffs.json', dtype: 'u8', data: new TextEncoder().encode(json) }];
  }

  deserialize(sections: readonly Section[]): void {
    const p = JSON.parse(new TextDecoder().decode(takeSection(sections, 'buffs.json', 'u8'))) as { list: Buff[]; nextId: number };
    this.list = p.list;
    this.nextId = p.nextId;
    this.changed();
  }
}
