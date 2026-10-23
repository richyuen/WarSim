import { describe, expect, it } from 'vitest';
import { SparseLayer } from '../../src/sim/core/sparseLayer';

// PLAN 7.83c: the beach's supply layer answers as the Map it replaced, from an array by cell.
describe('SparseLayer', () => {
  it('answers as a Map of the cells set, through clears and growth', () => {
    const layer = new SparseLayer();
    const map = new Map<number, number>();
    let seed = 7;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return seed % n;
    };
    for (let round = 0; round < 5; round++) {
      if (round === 2) layer.reserve(5000);
      for (let k = 0; k < 400; k++) {
        const cell = next(round < 3 ? 3000 : 9000);
        const v = 1 + next(65535);
        layer.set(cell, v);
        map.set(cell, v);
      }
      expect(layer.size).toBe(map.size);
      expect([...layer]).toEqual([...map]);
      expect([...layer.keys()]).toEqual([...map.keys()]);
      for (let cell = 0; cell < 10000; cell += 7) {
        expect(layer.get(cell)).toBe(map.get(cell));
        expect(layer.at(cell)).toBe(map.get(cell) ?? 0);
        expect(layer.has(cell)).toBe(map.has(cell));
      }
      layer.clear();
      map.clear();
      expect(layer.size).toBe(0);
      expect(layer.at(next(3000))).toBe(0);
    }
  });

  it('refuses a value it cannot hold', () => {
    const layer = new SparseLayer();
    expect(() => layer.set(3, 0)).toThrow();
    expect(() => layer.set(3, 65536)).toThrow();
    expect(() => layer.set(3, 1.5)).toThrow();
    expect(layer.size).toBe(0);
  });
});
