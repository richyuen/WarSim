import { describe, expect, it } from 'vitest';
import { mergeSeaRows } from '../../src/ui/seaRows';

// PLAN 7.167 (critic runs 20–21: three ticker rows of "Carrier strike ashore: United States on Greece").
describe("the ticker's sea rows", () => {
  it('N rows of one kind and the same words are one row with N, where the first stood, with its key', () => {
    const raid = (fleet: number) => ({ key: `cv-${fleet}`, kind: 'raid' as const, text: 'Carrier strike ashore: United States on Greece' });
    const rows = [{ key: 'b1', kind: 'pair' as const, text: 'France and Italy fought at sea' }, raid(7), raid(9), raid(12), { key: 'c1', kind: 'closing' as const, text: 'Fleets closing' }];
    const m = mergeSeaRows(rows);
    expect(m.map((r) => [r.key, r.count])).toEqual([
      ['b1', 1],
      ['cv-7', 3],
      ['c1', 1],
    ]);
    // No two rows left with the same words and kind.
    expect(new Set(m.map((r) => `${r.kind}|${r.text}`)).size).toBe(m.length);
  });

  it('the same words of another kind, or other words, stay rows of their own', () => {
    const m = mergeSeaRows([
      { key: 'a', kind: 'strike' as const, text: 'Carrier strike: A on B' },
      { key: 'b', kind: 'raid' as const, text: 'Carrier strike: A on B' },
      { key: 'c', kind: 'raid' as const, text: 'Carrier strike: A on C' },
    ]);
    expect(m.map((r) => r.count)).toEqual([1, 1, 1]);
  });
});
