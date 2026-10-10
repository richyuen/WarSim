import { describe, expect, it } from 'vitest';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { parseAffinity } from '../../tools/headless/affinity';
import { loadAssets1938 } from '../../tools/headless/assets';
import { runHeadless, TICKS_PER_YEAR } from '../../tools/headless/runner';

describe('headless runner (PLAN 0.20)', () => {
  it('--affinity takes a CPU mask in decimal or hex and nothing else', () => {
    expect(parseAffinity('0xFFFF')).toBe(65535);
    expect(parseAffinity('3')).toBe(3);
    for (const bad of ['', '0', '-1', 'pcores', '1.5']) expect(() => parseAffinity(bad)).toThrow(/CPU mask/);
  });

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

  it('--profile times every system by name and plays the same game (PLAN 3.10a)', () => {
    // A clock that moves 1 ms each time it is read: every call of a system takes 1 ms by it.
    let clock = 0;
    const r = runHeadless({ scenario: 'toy', seed: 3, years: 2, profile: true, now: () => clock++ });
    const plain = runHeadless({ scenario: 'toy', seed: 3, years: 2 });
    expect(r.finalHash).toBe(plain.finalHash);
    expect(plain.yearly[0]!.systems).toBeUndefined();
    expect(plain.yearly[0]!.living).toBe(2);
    for (const m of r.yearly) {
      expect(m.systems!.map((s) => s.name)).toEqual(['toyMovement', 'toyReinforce', 'toyCount']);
      // Each year's tallies are its own: 1 ms a tick, every call a slow one.
      for (const s of m.systems!) expect(s).toEqual({ name: s.name, ms: 1, max: 1, slow: TICKS_PER_YEAR, slowMs: 1 });
    }
  });

  it('the systems of the 1938 rules each have a name', () => {
    const sim = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
    const p = sim.profile(() => 0);
    sim.step(1);
    // 23 since PLAN 4.3a (the sea battles, after the land's), 24 since PLAN 4.4a (sea control).
    expect(p.names).toHaveLength(24);
    expect(new Set(p.names).size).toBe(24);
    expect(p.ms).toHaveLength(24);
    expect(p.names.every((n) => n.length > 0)).toBe(true);
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
