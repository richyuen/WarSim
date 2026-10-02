import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as dm from '../../src/sim/core/dmath';
import { DMATH_GOLDEN_FNS, evalGolden, type GoldenCase } from './dmath-golden';

/** Small deterministic sample generator (test-only; the sim uses sim/core/rng). */
function samples(n: number, lo: number, hi: number, seed: number): number[] {
  let s = seed >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const u = s / 4294967296;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const u2 = (u + s / 4294967296 / 4294967296) % 1;
    out.push(lo + (hi - lo) * u2);
  }
  return out;
}

const N = 100_000;

function maxErr(xs: number[], f: (x: number) => number, ref: (x: number) => number, relative: boolean): number {
  let worst = 0;
  for (const x of xs) {
    const a = f(x);
    const b = ref(x);
    const e = Math.abs(a - b) / (relative ? Math.max(1, Math.abs(b)) : 1);
    if (!(e <= worst)) worst = e; // NaN propagates as a failure
  }
  return worst;
}

describe('dmath accuracy vs Math (1e5 samples each)', () => {
  const cases: [string, (x: number) => number, (x: number) => number, number, number, boolean][] = [
    ['sin small', dm.sin, Math.sin, -10, 10, false],
    ['sin large', dm.sin, Math.sin, -1e6, 1e6, false],
    ['cos small', dm.cos, Math.cos, -10, 10, false],
    ['cos large', dm.cos, Math.cos, -1e6, 1e6, false],
    ['tan', dm.tan, Math.tan, -1.5, 1.5, true],
    ['atan', dm.atan, Math.atan, -1e3, 1e3, false],
    ['asin', dm.asin, Math.asin, -1, 1, false],
    ['acos', dm.acos, Math.acos, -1, 1, false],
    ['exp', dm.exp, Math.exp, -700, 700, true],
    ['exp unit', dm.exp, Math.exp, -2, 2, false],
    ['log', dm.log, Math.log, 1e-300, 1e300, false],
    ['log near 1', dm.log, Math.log, 0.5, 2, false],
    ['log small', dm.log, Math.log, 0, 1e-6, false],
    ['log10', dm.log10, Math.log10, 1e-5, 1e5, false],
    ['log2', dm.log2, Math.log2, 1e-5, 1e5, false],
  ];
  for (const [name, f, ref, lo, hi, rel] of cases) {
    it(`${name} on [${lo}, ${hi}]`, () => {
      expect(maxErr(samples(N, lo, hi, name.length * 7919), f, ref, rel)).toBeLessThan(1e-9);
    });
  }

  it('atan2 over all quadrants', () => {
    const ys = samples(N, -100, 100, 11);
    const xs = samples(N, -100, 100, 13);
    let worst = 0;
    for (let i = 0; i < N; i++) worst = Math.max(worst, Math.abs(dm.atan2(ys[i]!, xs[i]!) - Math.atan2(ys[i]!, xs[i]!)));
    expect(worst).toBeLessThan(1e-9);
  });

  it('pow (relative) for positive bases, real exponents and integer exponents', () => {
    const xs = samples(N, 1e-3, 1e3, 17);
    const ys = samples(N, -50, 50, 19);
    let worst = 0;
    for (let i = 0; i < N; i++) {
      const y = i % 4 === 0 ? Math.round(ys[i]!) : ys[i]!;
      const b = Math.pow(xs[i]!, y);
      worst = Math.max(worst, Math.abs(dm.pow(xs[i]!, y) - b) / Math.max(1, Math.abs(b)));
    }
    expect(worst).toBeLessThan(1e-9);
  });
});

describe('dmath special values', () => {
  it('sin/cos', () => {
    expect(Object.is(dm.sin(-0), -0)).toBe(true);
    expect(dm.cos(0)).toBe(1);
    expect(dm.sin(Infinity)).toBeNaN();
    expect(dm.cos(NaN)).toBeNaN();
  });
  it('atan2 edges match the ECMAScript table', () => {
    const pairs: [number, number][] = [
      [0, 0], [-0, 0], [0, -0], [-0, -0], [1, 0], [-1, 0], [0, -1], [-0, -1],
      [Infinity, Infinity], [-Infinity, Infinity], [Infinity, -Infinity], [-Infinity, -Infinity],
      [1, Infinity], [-1, Infinity], [1, -Infinity], [-1, -Infinity], [Infinity, 1], [-Infinity, 1],
      [1e300, 1e-300], [1e-300, -1e300], [-1e-300, -1e300],
    ];
    for (const [y, x] of pairs) {
      const a = dm.atan2(y, x);
      const b = Math.atan2(y, x);
      expect(Object.is(a, b) || Math.abs(a - b) < 1e-15, `atan2(${y}, ${x}) = ${a}, Math gives ${b}`).toBe(true);
    }
    expect(dm.atan2(NaN, 1)).toBeNaN();
  });
  it('exp/log', () => {
    expect(dm.exp(0)).toBe(1);
    expect(dm.exp(1000)).toBe(Infinity);
    expect(dm.exp(-1000)).toBe(0);
    expect(dm.exp(-740)).toBeGreaterThan(0); // subnormal result
    expect(dm.log(1)).toBe(0);
    expect(dm.log(0)).toBe(-Infinity);
    expect(dm.log(-1)).toBeNaN();
    expect(dm.log(Infinity)).toBe(Infinity);
    expect(Math.abs(dm.log(5e-324) - Math.log(5e-324))).toBeLessThan(1e-9);
  });
  it('pow', () => {
    expect(dm.pow(2, 10)).toBe(1024);
    expect(dm.pow(-2, 3)).toBe(-8);
    expect(dm.pow(-8, 1 / 3)).toBeNaN();
    expect(dm.pow(0, -1)).toBe(Infinity);
    expect(dm.pow(0, 2.5)).toBe(0);
    expect(dm.pow(5, 0)).toBe(1);
    expect(Math.abs(dm.pow(-3, 101) - Math.pow(-3, 101)) / Math.pow(3, 101)).toBeLessThan(1e-12);
  });
});

describe('dmath golden bit patterns', () => {
  const golden = JSON.parse(
    readFileSync(path.join(import.meta.dirname, 'dmath-golden.json'), 'utf8'),
  ) as GoldenCase[];

  it('covers every function with many inputs', () => {
    for (const fn of DMATH_GOLDEN_FNS) expect(golden.filter((g) => g.fn === fn).length).toBeGreaterThanOrEqual(8);
  });

  it('Node produces exactly the hard-coded bits', () => {
    const mismatches = golden.filter((g) => evalGolden(dm, g) !== g.bits);
    expect(mismatches).toEqual([]);
  });
});
