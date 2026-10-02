/**
 * PCG32 (O'Neill, pcg32_random_r / XSH-RR 64→32) with 64-bit state emulated in
 * u32 halves, plus named per-subsystem streams (SPEC §2.6, ADR-5).
 *
 * Stream `name` is seeded from `xxhash32(name, worldSeed)` only, so adding a stream
 * never perturbs the sequences of existing streams.
 */
import { hashString } from './hash';
import { log, sqrt, cos, TAU } from './dmath';

const MUL_HI = 0x5851f42d; // 6364136223846793005 = 0x5851F42D_4C957F2D
const MUL_LO = 0x4c957f2d;
const TWO32 = 4294967296;

// Scratch for the 64-bit multiply.
let mHi = 0;
let mLo = 0;

/** (aHi:aLo) · (bHi:bLo) mod 2^64 → (mHi:mLo). */
function mul64(aHi: number, aLo: number, bHi: number, bLo: number): void {
  const a0 = aLo & 0xffff;
  const a1 = aLo >>> 16;
  const b0 = bLo & 0xffff;
  const b1 = bLo >>> 16;
  const mid = a0 * b1 + a1 * b0; // < 2^33, exact in f64
  let lo = a0 * b0 + (mid % 65536) * 65536; // < 2^33
  const carry = Math.floor(lo / TWO32);
  lo -= carry * TWO32;
  const hiFromLo = a1 * b1 + Math.floor(mid / 65536) + carry; // < 2^32
  mLo = lo >>> 0;
  mHi = (hiFromLo + Math.imul(aHi, bLo) + Math.imul(aLo, bHi)) >>> 0;
}

export class Pcg32 {
  stateHi = 0;
  stateLo = 0;
  incHi = 0;
  incLo = 1;

  /** pcg32_srandom_r(initstate, initseq), both given as u32 (hi, lo) pairs. */
  constructor(initStateHi = 0, initStateLo = 0, initSeqHi = 0, initSeqLo = 0) {
    this.seed(initStateHi, initStateLo, initSeqHi, initSeqLo);
  }

  seed(initStateHi: number, initStateLo: number, initSeqHi: number, initSeqLo: number): void {
    // inc = (initseq << 1) | 1
    this.incHi = ((initSeqHi << 1) | (initSeqLo >>> 31)) >>> 0;
    this.incLo = ((initSeqLo << 1) | 1) >>> 0;
    this.stateHi = 0;
    this.stateLo = 0;
    this.step();
    const lo = this.stateLo + (initStateLo >>> 0);
    const carry = lo >= TWO32 ? 1 : 0;
    this.stateLo = lo >>> 0;
    this.stateHi = (this.stateHi + (initStateHi >>> 0) + carry) >>> 0;
    this.step();
  }

  private step(): void {
    mul64(this.stateHi, this.stateLo, MUL_HI, MUL_LO);
    const lo = mLo + this.incLo;
    const carry = lo >= TWO32 ? 1 : 0;
    this.stateLo = lo >>> 0;
    this.stateHi = (mHi + this.incHi + carry) >>> 0;
  }

  /** Next uniform u32. */
  nextU32(): number {
    const hi = this.stateHi;
    const lo = this.stateLo;
    this.step();
    // xorshifted = (uint32_t)(((old >> 18) ^ old) >> 27)
    const sLo = ((lo >>> 18) | (hi << 14)) >>> 0;
    const sHi = hi >>> 18;
    const xLo = (sLo ^ lo) >>> 0;
    const xHi = (sHi ^ hi) >>> 0;
    const xs = ((xLo >>> 27) | (xHi << 5)) >>> 0;
    const rot = hi >>> 27;
    return ((xs >>> rot) | (xs << (-rot & 31))) >>> 0;
  }

  /** Uniform float in [0, 1) with 53 random bits. */
  nextFloat(): number {
    const a = this.nextU32() >>> 5; // 27 bits
    const b = this.nextU32() >>> 6; // 26 bits
    return (a * 67108864 + b) / 9007199254740992;
  }

  /** Uniform integer in [0, n) without modulo bias (n ≤ 2^32). */
  nextInt(n: number): number {
    if (!(n >= 1) || n > TWO32) throw new RangeError(`nextInt: n out of range: ${n}`);
    const threshold = (TWO32 - n) % n; // = 2^32 mod n
    for (;;) {
      const r = this.nextU32();
      if (r >= threshold) return r % n;
    }
  }

  /** Uniform integer in [lo, hi] inclusive. */
  range(lo: number, hi: number): number {
    return lo + this.nextInt(hi - lo + 1);
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.nextFloat() < p;
  }

  /** Standard normal via Box–Muller using dmath (deterministic). */
  nextNormal(): number {
    let u = this.nextFloat();
    if (u === 0) u = 5e-324;
    return sqrt(-2 * log(u)) * cos(TAU * this.nextFloat());
  }

  /** Writes the 4 state words at `out[offset..offset+3]`. */
  saveState(out: Uint32Array, offset: number): void {
    out[offset] = this.stateHi;
    out[offset + 1] = this.stateLo;
    out[offset + 2] = this.incHi;
    out[offset + 3] = this.incLo;
  }

  loadState(src: Uint32Array, offset: number): void {
    this.stateHi = src[offset]!;
    this.stateLo = src[offset + 1]!;
    this.incHi = src[offset + 2]!;
    this.incLo = src[offset + 3]!;
  }
}

/** Subsystem streams (SPEC §2.6). Order here is only the save layout; seeding is by name. */
export const STREAM_NAMES = [
  'scenario', 'combat', 'ai', 'diplomacy', 'revolt', 'weather', 'nuclear', 'naval', 'air', 'toy',
] as const;
export type StreamName = (typeof STREAM_NAMES)[number];

/** Seed a generator for stream `name` from the world seed only. */
export function streamFor(worldSeed: number, name: string): Pcg32 {
  const s = worldSeed >>> 0;
  return new Pcg32(hashString(name, s), hashString(name, s ^ 0x9e3779b9), hashString(name, s ^ 0x7f4a7c15), hashString(name, s ^ 0x94d049bb));
}

export class RngStreams {
  readonly streams: Record<StreamName, Pcg32>;

  constructor(worldSeed: number) {
    const s = {} as Record<StreamName, Pcg32>;
    for (const name of STREAM_NAMES) s[name] = streamFor(worldSeed, name);
    this.streams = s;
  }

  get(name: StreamName): Pcg32 {
    return this.streams[name];
  }

  /** All stream states in STREAM_NAMES order (4 words each). */
  save(): Uint32Array {
    const out = new Uint32Array(STREAM_NAMES.length * 4);
    STREAM_NAMES.forEach((n, i) => this.streams[n].saveState(out, i * 4));
    return out;
  }

  load(src: Uint32Array): void {
    if (src.length !== STREAM_NAMES.length * 4) throw new Error(`RngStreams.load: expected ${STREAM_NAMES.length * 4} words, got ${src.length}`);
    STREAM_NAMES.forEach((n, i) => this.streams[n].loadState(src, i * 4));
  }
}
