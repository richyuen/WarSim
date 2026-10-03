import { describe, expect, it } from 'vitest';
import { Sim } from '../../src/sim/sim';
import { runHeadless, TICKS_PER_YEAR } from '../../tools/headless/runner';

describe('headless runner (PLAN 0.20)', () => {
  it('records per-year metrics and matches a plain Sim run', () => {
    const years: number[] = [];
    const r = runHeadless({ scenario: 'toy', seed: 3, years: 2, onYear: (m) => years.push(m.year) });
    expect(years).toEqual([1, 2]);
    expect(r.yearly).toHaveLength(2);
    expect(r.map).toEqual([256, 128]);
    for (const m of r.yearly) {
      expect(m.tick).toBe(m.year * TICKS_PER_YEAR);
      expect(m.nations).toHaveLength(2);
      expect(m.nations.reduce((a, n) => a + n.controlled, 0)).toBeGreaterThan(0);
      expect(m.cellsFlipped).toBeGreaterThan(0);
      expect(m.events['FormationDestroyed']).toBeGreaterThan(0);
      expect(m.tickMs.mean).toBeGreaterThan(0);
      expect(m.tickMs.p95).toBeGreaterThanOrEqual(0);
      expect(m.tickMs.max).toBeGreaterThanOrEqual(m.tickMs.p95);
    }
    expect(r.meanTickMs).toBeGreaterThan(0);

    const plain = new Sim({ scenario: 'toy', seed: 3 });
    plain.step(2 * TICKS_PER_YEAR);
    expect(r.finalHash).toBe(plain.hash());
    expect(r.yearly[1]!.hash).toBe(r.finalHash);
  });

  it('a checkpoint continues the run: year 1 saved, then loaded for year 2, equals two years straight', () => {
    let checkpoint: Uint8Array | undefined;
    runHeadless({ scenario: 'toy', seed: 3, years: 1, onSave: (bytes) => (checkpoint = bytes) });
    expect(checkpoint).toBeDefined();
    const years: number[] = [];
    const resumed = runHeadless({ scenario: 'toy', seed: 3, years: 1, load: checkpoint!, onYear: (m) => years.push(m.year) });
    expect(years).toEqual([2]); // years stay absolute
    const straight = runHeadless({ scenario: 'toy', seed: 3, years: 2 });
    expect(resumed.finalHash).toBe(straight.finalHash);
    expect(resumed.yearly[0]!.tick).toBe(2 * TICKS_PER_YEAR);
  });
});
