/**
 * Alliances and unions (SPEC §3.5, PLAN 1.17): one alliance per nation, a leader, unity 0..100
 * and per-member loyalty 0..100; guarantees (a guarantor joins wars against its target).
 * Saved as one JSON section; `allianceOf` is a derived lookup.
 */
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';

export interface Alliance {
  id: number;
  nameKey: string;
  leader: number;
  /** Members including the leader, in joining order. */
  members: number[];
  /** Loyalty per member (same order as `members`). */
  loyalty: number[];
  unity: number;
  /** Unity above UNION_AT makes the alliance a union (until it falls below UNION_LOST). */
  union: boolean;
}

export interface Guarantee {
  guarantor: number;
  target: number;
}

export class Alliances implements Stateful {
  list: Alliance[] = [];
  guarantees: Guarantee[] = [];
  nextId = 1;
  private byNation = new Map<number, Alliance>();

  /** Rebuilds the derived lookup; call after changing membership. */
  changed(): void {
    this.byNation.clear();
    for (const a of this.list) for (const m of a.members) this.byNation.set(m, a);
  }

  allianceOf(n: number): Alliance | undefined {
    return this.byNation.get(n);
  }

  allied(a: number, b: number): boolean {
    const x = this.byNation.get(a);
    return x !== undefined && a !== b && x === this.byNation.get(b);
  }

  create(leader: number, members: number[], nameKey: string, unity: number, loyalty = 60): Alliance | null {
    const all = [leader, ...members.filter((m) => m !== leader)];
    if (all.some((m) => this.byNation.has(m))) return null;
    const a: Alliance = { id: this.nextId++, nameKey, leader, members: all, loyalty: all.map(() => loyalty), unity, union: false };
    this.list.push(a);
    this.changed();
    return a;
  }

  join(n: number, a: Alliance, loyalty = 60): boolean {
    if (this.byNation.has(n)) return false;
    a.members.push(n);
    a.loyalty.push(loyalty);
    this.changed();
    return true;
  }

  /**
   * Removes `n` from its alliance. A leader leaving passes the lead to the next member; an
   * alliance left with fewer than two members dissolves. Returns 'left' | 'dissolved' | null.
   */
  leave(n: number): { alliance: Alliance; dissolved: boolean } | null {
    const a = this.byNation.get(n);
    if (!a) return null;
    const i = a.members.indexOf(n);
    a.members.splice(i, 1);
    a.loyalty.splice(i, 1);
    if (a.leader === n && a.members.length > 0) a.leader = a.members[0]!;
    const dissolved = a.members.length < 2;
    if (dissolved) this.list = this.list.filter((x) => x !== a);
    this.changed();
    return { alliance: a, dissolved };
  }

  /** Drops a nation from alliances and guarantees (elimination). */
  removeNation(n: number): void {
    this.leave(n);
    this.guarantees = this.guarantees.filter((g) => g.guarantor !== n && g.target !== n);
  }

  guarantorsOf(target: number): number[] {
    return this.guarantees.filter((g) => g.target === target).map((g) => g.guarantor);
  }

  serialize(): Section[] {
    const json = JSON.stringify({ list: this.list, guarantees: this.guarantees, nextId: this.nextId });
    return [{ name: 'alliances.json', dtype: 'u8', data: new TextEncoder().encode(json) }];
  }

  deserialize(sections: readonly Section[]): void {
    const p = JSON.parse(new TextDecoder().decode(takeSection(sections, 'alliances.json', 'u8'))) as { list: Alliance[]; guarantees: Guarantee[]; nextId: number };
    this.list = p.list;
    this.guarantees = p.guarantees;
    this.nextId = p.nextId;
    this.changed();
  }
}
