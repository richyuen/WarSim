import { describe, expect, it } from 'vitest';
import { hash32, hashString, hashToUnit, xxhash32, xxhash32View } from '../../src/sim/core/hash';
import { Pcg32, RngStreams, STREAM_NAMES, streamFor } from '../../src/sim/core/rng';

const M64 = (1n << 64n) - 1n;

/** Straight BigInt transcription of pcg32_random_r / pcg32_srandom_r (independent reference). */
function refPcg(initState: bigint, initSeq: bigint): () => number {
  let state = 0n;
  const inc = ((initSeq << 1n) | 1n) & M64;
  const step = (): void => {
    state = (state * 6364136223846793005n + inc) & M64;
  };
  step();
  state = (state + initState) & M64;
  step();
  return () => {
    const old = state;
    step();
    const xs = Number((((old >> 18n) ^ old) >> 27n) & 0xffffffffn);
    const rot = Number(old >> 59n);
    return ((xs >>> rot) | (xs << (-rot & 31))) >>> 0;
  };
}

const split = (v: bigint): [number, number] => [Number(v >> 32n), Number(v & 0xffffffffn)];

describe('PCG32', () => {
  it('matches the pcg32-demo known-answer vector (initstate 42, initseq 54)', () => {
    const r = new Pcg32(0, 42, 0, 54);
    const got = Array.from({ length: 6 }, () => r.nextU32());
    expect(got).toEqual([0xa15c02b7, 0x7b47f409, 0xba1d3330, 0x83d2f293, 0xbfa4784b, 0xcbed606e]);
  });

  it('matches a BigInt reference for 64-bit seeds over 2000 draws', () => {
    const seeds: [bigint, bigint][] = [
      [0n, 0n],
      [0xffffffffffffffffn, 0xffffffffffffffffn],
      [0x853c49e6748fea9bn, 0xda3e39cb94b95bdbn],
      [123456789012345678n, 987654321098765432n],
    ];
    for (const [s, q] of seeds) {
      const ref = refPcg(s, q);
      const r = new Pcg32(...split(s), ...split(q));
      for (let i = 0; i < 2000; i++) expect(r.nextU32()).toBe(ref());
    }
  });

  it('nextFloat is in [0,1), nextInt is in range and roughly uniform', () => {
    const r = new Pcg32(1, 2, 3, 4);
    const counts = new Array<number>(7).fill(0);
    for (let i = 0; i < 70_000; i++) {
      const f = r.nextFloat();
      expect(f >= 0 && f < 1).toBe(true);
      const k = r.nextInt(7);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(500);
    expect(() => r.nextInt(0)).toThrow(RangeError);
    for (let i = 0; i < 100; i++) {
      const v = r.range(-3, 3);
      expect(v >= -3 && v <= 3 && Number.isInteger(v)).toBe(true);
    }
  });

  it('nextNormal has mean ≈ 0 and variance ≈ 1', () => {
    const r = new Pcg32(9, 9, 9, 9);
    let s = 0;
    let s2 = 0;
    const n = 50_000;
    for (let i = 0; i < n; i++) {
      const v = r.nextNormal();
      s += v;
      s2 += v * v;
    }
    expect(Math.abs(s / n)).toBeLessThan(0.02);
    expect(Math.abs(s2 / n - 1)).toBeLessThan(0.03);
  });

  it('save/load state resumes the exact sequence', () => {
    const a = new Pcg32(5, 6, 7, 8);
    for (let i = 0; i < 17; i++) a.nextU32();
    const buf = new Uint32Array(4);
    a.saveState(buf, 0);
    const b = new Pcg32();
    b.loadState(buf, 0);
    for (let i = 0; i < 100; i++) expect(b.nextU32()).toBe(a.nextU32());
  });
});

describe('RNG streams', () => {
  it('are deterministic per (seed, name) and differ between names and seeds', () => {
    const first = (seed: number, name: string): number[] => {
      const r = streamFor(seed, name);
      return [r.nextU32(), r.nextU32(), r.nextU32()];
    };
    expect(first(7, 'combat')).toEqual(first(7, 'combat'));
    expect(first(7, 'combat')).not.toEqual(first(7, 'ai'));
    expect(first(7, 'combat')).not.toEqual(first(8, 'combat'));
  });

  it('adding a stream does not change the sequences of existing streams', () => {
    // RngStreams seeds each stream from (worldSeed, name) only, so a stream created by a
    // hypothetical future subsystem must not perturb any existing stream.
    const before = new RngStreams(42);
    const seqBefore = STREAM_NAMES.map((n) => Array.from({ length: 50 }, () => before.get(n).nextU32()));
    const after = new RngStreams(42);
    const extra = streamFor(42, 'futureSubsystem');
    for (let i = 0; i < 50; i++) extra.nextU32();
    const seqAfter = STREAM_NAMES.map((n) => Array.from({ length: 50 }, () => after.get(n).nextU32()));
    expect(seqAfter).toEqual(seqBefore);
  });

  it('drawing from one stream does not affect another', () => {
    const a = new RngStreams(1);
    const b = new RngStreams(1);
    for (let i = 0; i < 1000; i++) a.get('combat').nextU32();
    expect(a.get('ai').nextU32()).toBe(b.get('ai').nextU32());
  });

  it('save/load round trip of all streams', () => {
    const a = new RngStreams(99);
    a.get('naval').nextU32();
    a.get('air').nextFloat();
    const saved = a.save();
    const b = new RngStreams(0);
    b.load(saved);
    for (const n of STREAM_NAMES) expect(b.get(n).nextU32()).toBe(a.get(n).nextU32());
    expect(() => b.load(new Uint32Array(3))).toThrow();
  });
});

describe('xxHash32', () => {
  const enc = new TextEncoder();
  it('matches published known-answer vectors', () => {
    expect(xxhash32(new Uint8Array(0), 0)).toBe(0x02cc5d05);
    expect(xxhash32(enc.encode('a'), 0)).toBe(0x550d7456);
    expect(xxhash32(enc.encode('abc'), 0)).toBe(0x32d153ff);
    expect(xxhash32(enc.encode('Nobody inspects the spammish repetition'), 0)).toBe(0xe2293b2f);
    expect(hashString('abc')).toBe(0x32d153ff);
  });

  it('typed-array view hashing equals byte hashing (incl. offset views)', () => {
    const u = new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const bytes = new Uint8Array(u.buffer);
    expect(xxhash32View(u, 3)).toBe(xxhash32(bytes, 3));
    const sub = u.subarray(2, 7);
    expect(xxhash32View(sub, 0)).toBe(xxhash32(bytes.subarray(8, 28), 0));
  });

  it('hash32 equals xxhash32 of the little-endian words', () => {
    const cases: number[][] = [
      [0, 0, 0],
      [1, 2, 3],
      [0xffffffff, 0x80000000, 12345],
      [7, 8, 9, 10],
      [0, 0, 0, 0],
    ];
    for (const seed of [0, 1, 0xdeadbeef]) {
      for (const c of cases) {
        const ref = xxhash32View(new Uint32Array(c), seed);
        const [a = 0, b = 0, cc = 0, d] = c;
        expect(hash32(seed, a, b, cc, d)).toBe(ref);
      }
    }
  });

  it('hashToUnit maps into [0,1)', () => {
    expect(hashToUnit(0)).toBe(0);
    expect(hashToUnit(0xffffffff)).toBeLessThan(1);
  });

  it('single-bit input changes flip about half of the output bits (avalanche)', () => {
    let total = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const x = hash32(0, i, 0, 0) ^ hash32(0, i ^ 1, 0, 0);
      let bits = 0;
      for (let k = 0; k < 32; k++) bits += (x >>> k) & 1;
      total += bits;
    }
    expect(Math.abs(total / n - 16)).toBeLessThan(1);
  });
});
