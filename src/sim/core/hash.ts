/**
 * xxHash32 (Yann Collet, BSD-2-Clause algorithm) over bytes, plus word-oriented helpers.
 * Used for the state hash (SPEC §2.6), RNG stream seeding and order-independent draws.
 * All arithmetic is 32-bit (`Math.imul`, `>>> 0`), so results are identical everywhere.
 */

const P1 = 2654435761;
const P2 = 2246822519;
const P3 = 3266489917;
const P4 = 668265263;
const P5 = 374761393;

function rotl(x: number, r: number): number {
  return (x << r) | (x >>> (32 - r));
}

function round(acc: number, lane: number): number {
  acc = (acc + Math.imul(lane, P2)) | 0;
  acc = rotl(acc, 13);
  return Math.imul(acc, P1);
}

function avalanche(h: number): number {
  h ^= h >>> 15;
  h = Math.imul(h, P2);
  h ^= h >>> 13;
  h = Math.imul(h, P3);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Little-endian u32 at byte offset `i`. */
function readU32(b: Uint8Array, i: number): number {
  return (b[i]! | (b[i + 1]! << 8) | (b[i + 2]! << 16) | (b[i + 3]! << 24)) >>> 0;
}

/** Incremental-free xxHash32 of `bytes` with `seed` (u32). */
export function xxhash32(bytes: Uint8Array, seed = 0): number {
  const len = bytes.length;
  let i = 0;
  let h: number;
  if (len >= 16) {
    let v1 = (seed + P1 + P2) | 0;
    let v2 = (seed + P2) | 0;
    let v3 = seed | 0;
    let v4 = (seed - P1) | 0;
    const limit = len - 16;
    while (i <= limit) {
      v1 = round(v1, readU32(bytes, i));
      v2 = round(v2, readU32(bytes, i + 4));
      v3 = round(v3, readU32(bytes, i + 8));
      v4 = round(v4, readU32(bytes, i + 12));
      i += 16;
    }
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18)) | 0;
  } else {
    h = (seed + P5) | 0;
  }
  h = (h + len) | 0;
  while (i + 4 <= len) {
    h = (h + Math.imul(readU32(bytes, i), P3)) | 0;
    h = Math.imul(rotl(h, 17), P4);
    i += 4;
  }
  while (i < len) {
    h = (h + Math.imul(bytes[i]!, P5)) | 0;
    h = Math.imul(rotl(h, 11), P1);
    i++;
  }
  return avalanche(h);
}

/** xxHash32 of a typed array's bytes (platform byte order is little-endian on all supported targets). */
export function xxhash32View(view: ArrayBufferView, seed = 0): number {
  return xxhash32(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), seed);
}

const enc = new TextEncoder();

/** xxHash32 of a string's UTF-8 bytes. */
export function hashString(s: string, seed = 0): number {
  return xxhash32(enc.encode(s), seed);
}

/**
 * xxHash32 of up to four u32 words, identical to `xxhash32` of their little-endian bytes
 * but allocation-free. Use for order-independent draws: `hash32(seed, tick, entityId, salt)`.
 */
export function hash32(seed: number, a: number, b = 0, c = 0, d?: number): number {
  let h: number;
  if (d === undefined) {
    // 12 bytes: short-input path.
    h = (seed + P5 + 12) | 0;
    h = Math.imul(rotl((h + Math.imul(a >>> 0, P3)) | 0, 17), P4);
    h = Math.imul(rotl((h + Math.imul(b >>> 0, P3)) | 0, 17), P4);
    h = Math.imul(rotl((h + Math.imul(c >>> 0, P3)) | 0, 17), P4);
  } else {
    // 16 bytes: exactly one stripe.
    const v1 = round((seed + P1 + P2) | 0, a >>> 0);
    const v2 = round((seed + P2) | 0, b >>> 0);
    const v3 = round(seed | 0, c >>> 0);
    const v4 = round((seed - P1) | 0, d >>> 0);
    h = (rotl(v1, 1) + rotl(v2, 7) + rotl(v3, 12) + rotl(v4, 18) + 16) | 0;
  }
  return avalanche(h);
}

/** Uniform float in [0, 1) from a hash value. */
export function hashToUnit(h: number): number {
  return (h >>> 0) / 4294967296;
}

/** Combine section hashes in order (each one is fed as a word into a running xxHash32). */
export class HashChain {
  private words: number[] = [];
  push(h: number): this {
    this.words.push(h >>> 0);
    return this;
  }
  digest(seed = 0): number {
    const u = new Uint32Array(this.words);
    return xxhash32View(u, seed);
  }
}
