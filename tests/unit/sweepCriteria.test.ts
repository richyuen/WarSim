import { describe, expect, it } from 'vitest';
import { judge } from '../../tools/sweep/criteria';
import type { SeedResult, YearSample } from '../../tools/sweep/seed';

// PLAN 1.40: the SPEC §10 sweep criteria judge each seed's yearly samples.

const year = (y: number, over: Partial<YearSample> = {}): YearSample => ({ year: y, alive: 80, topLand: 0.2, topIncome: 0.25, topNation: 1, wars: 2, warDays: 300, changed: 500, ...over });
const run = (samples: YearSample[]): SeedResult => ({ seed: 1, years: samples.length, wallS: 1, landCells: 100_000, samples });

describe('sweep criteria (PLAN 1.40)', () => {
  it('a lively world passes every criterion', () => {
    const v = judge(run(Array.from({ length: 50 }, (_, i) => year(i + 1))));
    expect(v.ok).toBe(true);
    expect(v.moving).toBeCloseTo(0.025, 9); // 5 × 500 of 100k land cells
  });

  it('each criterion fails on its own', () => {
    const base = Array.from({ length: 50 }, (_, i) => year(i + 1));
    const frozen = base.map((y, i) => (i >= 45 ? { ...y, changed: 100 } : y)); // 0.5% < 1%
    expect(judge(run(frozen)).pass.moving).toBe(false);
    const hegemon = base.map((y, i) => (i === 49 ? { ...y, topLand: 0.4 } : y));
    expect(judge(run(hegemon)).pass.land).toBe(false);
    const rich = base.map((y, i) => (i === 49 ? { ...y, topIncome: 0.45 } : y));
    expect(judge(run(rich)).pass.income).toBe(false);
    const fewDipOnce = base.map((y, i) => (i === 20 ? { ...y, alive: 19 } : y));
    expect(judge(run(fewDipOnce)).pass.alive).toBe(false);
    const peaceful = base.map((y, i) => (i % 4 === 0 ? { ...y, warDays: 0 } : y)); // 75% < 80%
    expect(judge(run(peaceful)).pass.war).toBe(false);
    for (const r of [frozen, hegemon, rich, fewDipOnce, peaceful]) expect(judge(run(r)).ok).toBe(false);
  });
});
