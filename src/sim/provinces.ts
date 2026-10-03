/**
 * Per-province state (SPEC §4 Revolts and Cores; PLAN 1.19–1.20): unrest 0..100, the rightful
 * (core) nation, and extra core claims (`extraCores` in the scenario: e.g. Soviet claims on
 * Bessarabia, dead Ethiopia on Italian East Africa). Indexed by admin-1 province id
 * (`cells.province`). Saved. An empty table (toy world) disables revolts and revival.
 */
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';

export class Provinces implements Stateful {
  unrest = new Float64Array(0);
  core = new Uint16Array(0);
  /** Who has held the province (owned and controlled its centre) since `heldSince` (PLAN 1.40 coring). */
  heldBy = new Uint16Array(0);
  heldSince = new Uint32Array(0);
  /** Extra claims as sorted [province, nation] pairs (unique). */
  claims: [number, number][] = [];
  private claimIndex = new Map<number, number[]>();
  /** Derived (not state): bumped when unrest may have changed (revolts map mode, PLAN 1.30b). */
  version = 0;

  get count(): number {
    return this.core.length;
  }

  resize(n: number): void {
    this.unrest = new Float64Array(n);
    this.core = new Uint16Array(n);
    this.heldBy = new Uint16Array(n);
    this.heldSince = new Uint32Array(n);
    this.claims = [];
    this.claimIndex.clear();
  }

  addClaim(p: number, n: number): void {
    if (this.core[p] === n || this.claims.some(([q, m]) => q === p && m === n)) return;
    this.claims.push([p, n]);
    this.claims.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    this.reindex();
  }

  removeClaim(p: number, n: number): void {
    const before = this.claims.length;
    this.claims = this.claims.filter(([q, m]) => !(q === p && m === n));
    if (this.claims.length !== before) this.reindex();
  }

  /** Nations with a core on province p: its core nation first, then claimants (ascending). */
  coresOf(p: number): number[] {
    const c = this.core[p] ?? 0;
    const extra = this.claimIndex.get(p) ?? [];
    return c !== 0 ? [c, ...extra.filter((n) => n !== c)] : extra;
  }

  /** Provinces on which nation n has a core (core or claim), ascending. */
  provincesOf(n: number): number[] {
    const out = new Set<number>();
    for (let p = 1; p < this.core.length; p++) if (this.core[p] === n) out.add(p);
    for (const [p, m] of this.claims) if (m === n) out.add(p);
    return [...out].sort((a, b) => a - b);
  }

  private reindex(): void {
    this.claimIndex.clear();
    for (const [p, n] of this.claims) {
      const l = this.claimIndex.get(p);
      if (l) l.push(n);
      else this.claimIndex.set(p, [n]);
    }
  }

  serialize(): Section[] {
    return [
      { name: 'provinces.unrest', dtype: 'f64', data: this.unrest },
      { name: 'provinces.core', dtype: 'u16', data: this.core },
      { name: 'provinces.claims', dtype: 'u32', data: Uint32Array.from(this.claims.flat()) },
      { name: 'provinces.heldBy', dtype: 'u16', data: this.heldBy },
      { name: 'provinces.heldSince', dtype: 'u32', data: this.heldSince },
    ];
  }

  deserialize(sections: readonly Section[]): void {
    this.unrest = takeSection(sections, 'provinces.unrest', 'f64').slice();
    this.version++;
    this.core = takeSection(sections, 'provinces.core', 'u16').slice();
    // Saves from before PLAN 1.40 have no holding record: it starts over (nobody holds yet).
    const by = sections.find((s) => s.name === 'provinces.heldBy');
    const since = sections.find((s) => s.name === 'provinces.heldSince');
    this.heldBy = by ? (by.data as Uint16Array).slice() : new Uint16Array(this.core.length);
    this.heldSince = since ? (since.data as Uint32Array).slice() : new Uint32Array(this.core.length);
    const flat = takeSection(sections, 'provinces.claims', 'u32');
    this.claims = [];
    for (let i = 0; i + 1 < flat.length; i += 2) this.claims.push([flat[i]!, flat[i + 1]!]);
    this.reindex();
  }
}
