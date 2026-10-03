import { describe, expect, it } from 'vitest';
import { judge, judgeSweep, ratio, type Verdict } from '../../tools/sweep/criteria';
import type { SeedResult, YearSample } from '../../tools/sweep/seed';

// PLAN 1.40: the SPEC §10 sweep criteria judge each seed's yearly samples. Rewritten with ADR-54
// (2026-10-03): five limits per seed; riser and faller per seed (by realm: a nation with its
// puppets), judged over the sweep by a quorum; churn and swing reported only.

const year = (y: number, over: Partial<YearSample> = {}): YearSample => ({ year: y, alive: 80, topLand: 0.2, topIncome: 0.25, topNation: 1, top10: y < 25 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1, 2, 3, 4, 5, 6, 7, 8, 11, 12], wars: 2, warDays: 300, changedKm2: 500_000, ...over });
/** A lively run: the leader's share moves between 20% and 24%. */
const lively = (): YearSample[] => Array.from({ length: 50 }, (_, i) => year(i + 1, { topLand: i % 2 === 0 ? 0.2 : 0.24 }));
/** Realms after year 1, M km²: ten large ones, two middling ones and a small one (100 M km² in all). */
const START: [number, number][] = [[1, 30.8], [2, 12], [3, 10], [4, 9], [5, 8], [6, 7], [7, 6], [8, 5], [9, 4.5], [10, 4], [11, 2], [12, 1.5], [13, 0.2]];
/** At the end: 11 has doubled and 12 tripled; 3 and 10 have lost half; nation 1 took the rest. */
const END: [number, number][] = [[1, 32.8], [2, 12], [3, 5], [4, 9], [5, 8], [6, 7], [7, 6], [8, 5], [9, 4.5], [10, 2], [11, 4], [12, 4.5], [13, 0.2]];
const km2 = (m: [number, number][]): [number, number][] => m.map(([n, v]) => [n, v * 1e6]);
const run = (samples: YearSample[], over: Partial<SeedResult> = {}): SeedResult => ({ seed: 1, years: samples.length, wallS: 1, landKm2: 100_000_000, realmStart: km2(START), realmEnd: km2(END), samples, ...over });
/** END with some nations' land replaced. */
const end = (changes: [number, number][]): [number, number][] => km2(END.map(([n, v]) => [n, changes.find((c) => c[0] === n)?.[1] ?? v]));

describe('sweep criteria (PLAN 1.40, ADR-54)', () => {
  it('a lively world passes every criterion', () => {
    const v = judge(run(lively()));
    expect(v.ok).toBe(true);
    expect(v.limits).toBe(true);
    expect(v.moving).toBeCloseTo(0.025, 9); // 5 × 500k of 100 M km² of land
    expect(v.riser).toEqual({ nation: 12, from: 1.5e6, to: 4.5e6 }); // × 3, ahead of nation 11 at × 2
    expect(v.faller).toEqual({ nation: 3, from: 10e6, to: 5e6 }); // kept half, as nation 10 did: the larger one is named
  });

  it('each limit fails on its own', () => {
    const base = lively();
    const frozen = base.map((y, i) => (i >= 45 ? { ...y, changedKm2: 100_000 } : y)); // 0.5% < 1%
    expect(judge(run(frozen)).pass.moving).toBe(false);
    const hegemon = base.map((y, i) => (i === 49 ? { ...y, topLand: 0.4 } : y));
    expect(judge(run(hegemon)).pass.land).toBe(false);
    const rich = base.map((y, i) => (i === 49 ? { ...y, topIncome: 0.45 } : y));
    expect(judge(run(rich)).pass.income).toBe(false);
    const fewDipOnce = base.map((y, i) => (i === 20 ? { ...y, alive: 19 } : y));
    expect(judge(run(fewDipOnce)).pass.alive).toBe(false);
    const peaceful = base.map((y, i) => (i % 4 === 0 ? { ...y, warDays: 0 } : y)); // 75% < 80%
    expect(judge(run(peaceful)).pass.war).toBe(false);
    for (const r of [frozen, hegemon, rich, fewDipOnce, peaceful]) {
      const v = judge(run(r));
      expect(v.limits).toBe(false);
      expect(v.ok).toBe(false);
    }
  });

  it('riser: a realm with at least 1% of the land at the end and 1.5 times its land of year 1', () => {
    // Nobody material grew by half: 11 and 12 end at × 1.4.
    const flat: [number, number][] = [[11, 2.8], [12, 2.1]];
    const none = judge(run(lively(), { realmEnd: end([...flat, [1, 36.4]]) }));
    expect(ratio(none.riser!)).toBeCloseTo(1.4, 9);
    expect(none.pass.riser).toBe(false);
    expect(none.limits).toBe(true);
    expect(none.ok).toBe(false);
    // Exactly × 1.5 is enough, and a large nation can be the riser.
    const large = judge(run(lively(), { realmEnd: end([...flat, [1, 30.4], [2, 18]]) }));
    expect(large.riser).toEqual({ nation: 2, from: 12e6, to: 18e6 });
    expect(large.pass.riser).toBe(true);
    // A small nation that triples is not a riser: it ends below 1% of the land.
    const small = judge(run(lively(), { realmEnd: end([...flat, [1, 36], [13, 0.6]]) }));
    expect(ratio(small.riser!)).toBeCloseTo(1.4, 9);
    expect(small.pass.riser).toBe(false);
    // A realm that did not exist after year 1 (a revolt, a released puppet) is not a riser.
    const fresh = judge(run(lively(), { realmEnd: [...end([...flat, [1, 33.4]]), [20, 3e6]] }));
    expect(fresh.riser!.nation).not.toBe(20);
    expect(ratio(fresh.riser!)).toBeCloseTo(1.4, 9);
    expect(fresh.pass.riser).toBe(false);
  });

  it('faller: one of the ten largest realms after year 1 ends with at most two thirds of that land', () => {
    // Nation 3 keeps 70%; nation 10 keeps half and is the faller.
    const ten = judge(run(lively(), { realmEnd: end([[3, 7], [1, 30.8]]) }));
    expect(ten.faller).toEqual({ nation: 10, from: 4e6, to: 2e6 });
    expect(ten.pass.faller).toBe(true);
    // Nobody among the ten lost a third: the worst keeps 70%.
    const kept = judge(run(lively(), { realmEnd: end([[3, 7], [10, 3], [1, 29.8]]) }));
    expect(kept.faller!.nation).toBe(3);
    expect(ratio(kept.faller!)).toBeCloseTo(0.7, 9);
    expect(kept.pass.faller).toBe(false);
    expect(kept.ok).toBe(false);
    // A nation outside the first ten does not count, however much it loses.
    const outsider = judge(run(lively(), { realmEnd: end([[3, 7], [10, 3], [11, 0.5], [1, 33.3]]) }));
    expect(outsider.pass.faller).toBe(false);
    // A dead one counts (so does one that is a puppet by the end: neither is in the list).
    const dead = judge(run(lively(), { realmEnd: end([[3, 7], [10, 3], [1, 34.3]]).filter(([n]) => n !== 9) }));
    expect(dead.faller).toEqual({ nation: 9, from: 4.5e6, to: 0 });
    expect(dead.pass.faller).toBe(true);
  });

  it('the faller is looked for among the ten largest realms of year 1, whatever the yearly lists of nations say', () => {
    const v = judge(run(lively().map((y) => ({ ...y, top10: [11, 12, 13] })), { realmEnd: end([[3, 7], [10, 3], [11, 0.5], [1, 33.3]]) }));
    expect(v.faller!.nation).toBe(3); // 11 lost three quarters but is the eleventh realm
    expect(v.pass.faller).toBe(false);
  });

  it('churn and swing are reported and decide nothing', () => {
    const base = lively();
    const sameTen = judge(run(base.map((y) => ({ ...y, top10: [1, 2, 3, 4, 5, 6, 7, 8, 9, 13] }))));
    expect(sameTen.churn).toBe(0);
    expect(sameTen.ok).toBe(true);
    const fixedLeader = judge(run(base.map((y) => ({ ...y, topLand: 0.27 }))));
    expect(fixedLeader.swing).toBe(0);
    expect(fixedLeader.ok).toBe(true);
    expect(judge(run(base)).churn).toBe(2);
    expect(judge(run(base)).swing).toBeCloseTo(0.04, 9);
  });
});

describe('sweep verdict (ADR-54)', () => {
  const good = judge(run(lively()));
  const noRiser: Verdict = { ...good, pass: { ...good.pass, riser: false }, ok: false };
  const noFaller: Verdict = { ...good, pass: { ...good.pass, faller: false }, ok: false };
  const broken: Verdict = { ...good, pass: { ...good.pass, land: false }, limits: false, ok: false };
  const of = (...parts: [Verdict, number][]): Verdict[] => parts.flatMap(([v, n]) => Array.from({ length: n }, () => v));

  it('riser and faller each need 8 of 10 seeds', () => {
    expect(judgeSweep(of([good, 10]), 50)).toEqual({ limits: true, judged: true, risers: 10, fallers: 10, needed: 8, ok: true });
    expect(judgeSweep(of([good, 6], [noRiser, 2], [noFaller, 2]), 50).ok).toBe(true); // 8 and 8
    expect(judgeSweep(of([good, 7], [noRiser, 3]), 50).ok).toBe(false);
    expect(judgeSweep(of([good, 7], [noFaller, 3]), 50).ok).toBe(false);
    expect(judgeSweep(of([good, 3]), 50).needed).toBe(3); // 80% of 3, rounded up
    expect(judgeSweep(of([good, 5]), 50).needed).toBe(4);
  });

  it('every seed must keep the limits', () => {
    const v = judgeSweep(of([good, 9], [broken, 1]), 50);
    expect(v.limits).toBe(false);
    expect(v.ok).toBe(false);
  });

  it('runs shorter than 50 years are judged by the limits alone', () => {
    const v = judgeSweep(of([noRiser, 5], [noFaller, 5]), 20);
    expect(v.judged).toBe(false);
    expect(v.ok).toBe(true);
    expect(judgeSweep(of([good, 9], [broken, 1]), 20).ok).toBe(false);
  });
});
