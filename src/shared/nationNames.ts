import type { Admin1Meta } from './admin1';

/**
 * The names of nations that no scenario names (PLAN 2.15b): a nation founded by a revolt or a
 * Kill is called after the province of its capital, its origin.
 */

/**
 * What a province is called: its own name, else its country's. (Seven provinces of the earth
 * data, slivers Natural Earth left without a name, have only the country.)
 */
export function provinceLabel(m: Pick<Admin1Meta, 'name' | 'admin'>): string {
  return m.name.trim() || m.admin.trim();
}

/**
 * The literal name of founded nation `id` whose origin is province `origin` (1-based; 0: none).
 * `labels` are the provinces' labels by index. The number is the last resort, for a state that
 * has lost the origin (a save from before PLAN 2.12a): no nation founded now comes to it.
 */
export function foundedName(id: number, origin: number, labels: readonly string[] | null): string {
  const province = labels?.[origin - 1];
  return province ? `Free ${province}` : `Free state ${id}`;
}
