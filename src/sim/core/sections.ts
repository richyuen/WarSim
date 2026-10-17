/**
 * Named typed-array sections: the unit of save files and of the state hash (SPEC §2.6, §2.7).
 *
 * Binary layout (all header fields little-endian):
 *   'WSEC' u32 magic · u32 version · u32 sectionCount
 *   per section: u16 nameBytes · name (UTF-8) · u8 dtype · u32 length (elements)
 *                · zero padding to an 8-byte boundary · data · zero padding to 8 bytes
 * Typed-array data is copied as raw memory, which is little-endian on every supported platform.
 *
 * Version 2 (PLAN 7.17, ADR-484; critic run 7: "a save is about 40 MB", 96 % of it the map's
 * per-cell layers): a section of elements of 1, 2 or 4 bytes whose runs of equal elements (equal
 * bits) take at most RUNS_SHARE of its raw size is written as runs, its dtype byte | RUNS_FLAG:
 *   u32 runs · padding to 8 · the runs' values (runs elements of its dtype) · padding to 8 ·
 *   the runs' lengths (runs u32) · padding to 8
 * Other sections are as in version 1. Decoded, a section is the same array element for element,
 * so the state hash (over the sections, not the bytes) is the same. Version 1 still loads.
 */
import { HashChain, hashString, xxhash32View } from './hash';

export const DTYPES = {
  u8: Uint8Array,
  i8: Int8Array,
  u16: Uint16Array,
  i16: Int16Array,
  u32: Uint32Array,
  i32: Int32Array,
  f32: Float32Array,
  f64: Float64Array,
} as const;

export type DType = keyof typeof DTYPES;
export type ArrayOf<D extends DType> = InstanceType<(typeof DTYPES)[D]>;
export type AnyTypedArray = ArrayOf<DType>;

const DTYPE_CODES: Record<DType, number> = { u8: 1, i8: 2, u16: 3, i16: 4, u32: 5, i32: 6, f32: 7, f64: 8 };
const CODE_DTYPES: readonly (DType | undefined)[] = [undefined, 'u8', 'i8', 'u16', 'i16', 'u32', 'i32', 'f32', 'f64'];

export interface Section {
  name: string;
  dtype: DType;
  data: AnyTypedArray;
}

const MAGIC = 0x43455357; // 'WSEC' little-endian
const VERSION = 2;
/** The dtype byte's flag of a section written as runs (version 2). */
const RUNS_FLAG = 0x80;
/** A section is written as runs when they take at most this share of its raw bytes. */
export const RUNS_SHARE = 0.5;
/** Nor is one of fewer elements than this (its header would be most of it). */
const RUNS_MIN = 64;

/** An unsigned view of `a`'s elements of 1, 2 or 4 bytes, compared by their bits; null for 8 bytes. */
function bitsOf(a: AnyTypedArray): Uint8Array | Uint16Array | Uint32Array | null {
  const n = a.length;
  switch (a.BYTES_PER_ELEMENT) {
    case 1:
      return new Uint8Array(a.buffer, a.byteOffset, n);
    case 2:
      return new Uint16Array(a.buffer, a.byteOffset, n);
    case 4:
      return new Uint32Array(a.buffer, a.byteOffset, n);
    default:
      return null;
  }
}

/** The runs of `bits`: their count, or -1 as soon as they take more than RUNS_SHARE of its bytes. */
function runCount(bits: Uint8Array | Uint16Array | Uint32Array, el: number): number {
  const most = (RUNS_SHARE * bits.length * el) / (el + 4);
  let runs = bits.length > 0 ? 1 : 0;
  for (let i = 1; i < bits.length; i++) {
    if (bits[i] !== bits[i - 1] && ++runs > most) return -1;
  }
  return runs;
}

/** Bytes of a section's data as runs (after its header). */
const runBytes = (runs: number, el: number): number => align8(4) + align8(runs * el) + align8(runs * 4);

export function makeArray<D extends DType>(dtype: D, length: number): ArrayOf<D> {
  return new DTYPES[dtype](length) as ArrayOf<D>;
}

const align8 = (n: number): number => (n + 7) & ~7;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeSections(sections: readonly Section[]): Uint8Array {
  const names = sections.map((s) => enc.encode(s.name));
  // Each section's runs, or -1 to write it raw.
  const runs = sections.map((s) => {
    const bits = s.data.length >= RUNS_MIN ? bitsOf(s.data) : null;
    return bits ? runCount(bits, s.data.BYTES_PER_ELEMENT) : -1;
  });
  let size = 12;
  sections.forEach((s, i) => {
    size = align8(size + 2 + names[i]!.length + 1 + 4);
    size = runs[i]! >= 0 ? size + runBytes(runs[i]!, s.data.BYTES_PER_ELEMENT) : align8(size + s.data.byteLength);
  });
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, VERSION, true);
  dv.setUint32(8, sections.length, true);
  let p = 12;
  sections.forEach((s, i) => {
    const nb = names[i]!;
    if (nb.length > 0xffff) throw new Error(`section name too long: ${s.name}`);
    dv.setUint16(p, nb.length, true);
    out.set(nb, p + 2);
    p += 2 + nb.length;
    const r = runs[i]!;
    dv.setUint8(p, DTYPE_CODES[s.dtype] | (r >= 0 ? RUNS_FLAG : 0));
    dv.setUint32(p + 1, s.data.length, true);
    p = align8(p + 5);
    if (r < 0) {
      out.set(new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength), p);
      p = align8(p + s.data.byteLength);
      return;
    }
    const el = s.data.BYTES_PER_ELEMENT;
    const bits = bitsOf(s.data)!;
    dv.setUint32(p, r, true);
    p = align8(p + 4);
    // Values and lengths written through views of `out` at 8-aligned offsets (little-endian, as raw data).
    const values = el === 1 ? new Uint8Array(out.buffer, p, r) : el === 2 ? new Uint16Array(out.buffer, p, r) : new Uint32Array(out.buffer, p, r);
    const lens = new Uint32Array(out.buffer, align8(p + r * el), r);
    let k = 0;
    let start = 0;
    for (let e = 1; e <= bits.length; e++) {
      if (e === bits.length || bits[e] !== bits[e - 1]) {
        values[k] = bits[start]!;
        lens[k] = e - start;
        k++;
        start = e;
      }
    }
    p = align8(align8(p + r * el) + r * 4);
  });
  return out;
}

export function decodeSections(bytes: Uint8Array): Section[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || dv.getUint32(0, true) !== MAGIC) throw new Error('decodeSections: bad magic');
  const version = dv.getUint32(4, true);
  if (version !== 1 && version !== VERSION) throw new Error(`decodeSections: unsupported version ${version}`);
  const count = dv.getUint32(8, true);
  const out: Section[] = [];
  let p = 12;
  for (let i = 0; i < count; i++) {
    const nlen = dv.getUint16(p, true);
    const name = dec.decode(bytes.subarray(p + 2, p + 2 + nlen));
    p += 2 + nlen;
    const code = dv.getUint8(p);
    const asRuns = version >= 2 && (code & RUNS_FLAG) !== 0;
    const dtype = CODE_DTYPES[code & ~RUNS_FLAG];
    if (dtype === undefined) throw new Error(`decodeSections: bad dtype in ${name}`);
    const length = dv.getUint32(p + 1, true);
    p = align8(p + 5);
    const data = makeArray(dtype, length);
    if (!asRuns) {
      const byteLen = data.byteLength;
      if (p + byteLen > bytes.byteLength) throw new Error(`decodeSections: truncated section ${name}`);
      new Uint8Array(data.buffer).set(bytes.subarray(p, p + byteLen));
      p = align8(p + byteLen);
    } else {
      const el = data.BYTES_PER_ELEMENT;
      const bits = bitsOf(data);
      if (!bits || p + 4 > bytes.byteLength) throw new Error(`decodeSections: bad runs in ${name}`);
      const r = dv.getUint32(p, true);
      p = align8(p + 4);
      const lensAt = align8(p + r * el);
      const end = align8(lensAt + r * 4);
      if (end > bytes.byteLength) throw new Error(`decodeSections: truncated section ${name}`);
      // Copied out of `bytes` first: its offset need not be aligned for a typed view.
      const raw = bytes.slice(p, lensAt);
      const values = el === 1 ? raw : el === 2 ? new Uint16Array(raw.buffer, 0, r) : new Uint32Array(raw.buffer, 0, r);
      const lens = new Uint32Array(bytes.slice(lensAt, lensAt + r * 4).buffer);
      let at = 0;
      for (let k = 0; k < r; k++) {
        const n = lens[k]!;
        if (at + n > length) throw new Error(`decodeSections: runs past the end of ${name}`);
        bits.fill(values[k]!, at, at + n);
        at += n;
      }
      if (at !== length) throw new Error(`decodeSections: runs short of ${name}`);
      p = end;
    }
    out.push({ name, dtype, data });
  }
  if (p !== bytes.byteLength) throw new Error('decodeSections: trailing bytes');
  return out;
}

/** Order-sensitive hash of sections: name, dtype, length and data of each, in order. */
export function hashSections(sections: readonly Section[], seed = 0): number {
  const chain = new HashChain();
  for (const s of sections) {
    chain.push(hashString(s.name)).push(DTYPE_CODES[s.dtype]).push(s.data.length).push(xxhash32View(s.data));
  }
  return chain.digest(seed);
}

/** Lookup helper for deserializers: the section must exist with the expected dtype. */
export function takeSection<D extends DType>(sections: readonly Section[], name: string, dtype: D): ArrayOf<D> {
  const s = sections.find((x) => x.name === name);
  if (!s) throw new Error(`missing section ${name}`);
  if (s.dtype !== dtype) throw new Error(`section ${name}: dtype ${s.dtype}, expected ${dtype}`);
  return s.data as ArrayOf<D>;
}
