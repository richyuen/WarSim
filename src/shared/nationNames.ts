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
export function foundedName(id: number, origin: number, labels: readonly string[] | null, nth = 1): string {
  const province = labels?.[origin - 1];
  if (!province) return `Free state ${id}`;
  return nth > 1 ? `Free ${province} ${roman(nth)}` : `Free ${province}`;
}

/**
 * Which of the nations called after one province founded nation `id` is, from 1 (PLAN 3.12Rh3):
 * a province can rise again while the nation it founded lives (as its holder's puppet, or on
 * other land), and the two were both "Free Damascus", at war with each other. `origins` is the
 * nations' origin column. Counted over every nation founded before it, the dead too, and by
 * the label (116 labels are of two provinces or more): a nation's row is never given to another
 * and an origin never changes, so the name is the nation's for good, in the log of a dead one too.
 */
export function foundedNth(id: number, origins: ArrayLike<number>, labels: readonly string[] | null): number {
  const label = labels?.[(origins[id] ?? 0) - 1];
  if (!label) return 1;
  let nth = 1;
  for (let n = 1; n < id; n++) {
    const o = origins[n]!;
    if (o !== 0 && labels![o - 1] === label) nth++;
  }
  return nth;
}

const ROMAN: readonly (readonly [number, string])[] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];

function roman(n: number): string {
  let s = '';
  for (const [v, r] of ROMAN) for (; n >= v; n -= v) s += r;
  return s;
}
