/**
 * Per-province state (SPEC §4 Revolts, PLAN 1.19): unrest 0..100 and the rightful (core)
 * nation, indexed by admin-1 province id (`cells.province`). Saved. Sized at scenario creation;
 * an empty table (toy world) disables revolts.
 */
import { takeSection, type Section } from './core/sections';
import type { Stateful } from './core/state';

export class Provinces implements Stateful {
  unrest = new Float64Array(0);
  core = new Uint16Array(0);

  get count(): number {
    return this.core.length;
  }

  resize(n: number): void {
    this.unrest = new Float64Array(n);
    this.core = new Uint16Array(n);
  }

  serialize(): Section[] {
    return [
      { name: 'provinces.unrest', dtype: 'f64', data: this.unrest },
      { name: 'provinces.core', dtype: 'u16', data: this.core },
    ];
  }

  deserialize(sections: readonly Section[]): void {
    this.unrest = takeSection(sections, 'provinces.unrest', 'f64').slice();
    this.core = takeSection(sections, 'provinces.core', 'u16').slice();
  }
}
