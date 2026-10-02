/**
 * Named typed-array sections: the unit of save files and of the state hash (SPEC §2.6, §2.7).
 *
 * Binary layout (all header fields little-endian):
 *   'WSEC' u32 magic · u32 version · u32 sectionCount
 *   per section: u16 nameBytes · name (UTF-8) · u8 dtype · u32 length (elements)
 *                · zero padding to an 8-byte boundary · data · zero padding to 8 bytes
 * Typed-array data is copied as raw memory, which is little-endian on every supported platform.
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
const VERSION = 1;

export function makeArray<D extends DType>(dtype: D, length: number): ArrayOf<D> {
  return new DTYPES[dtype](length) as ArrayOf<D>;
}

const align8 = (n: number): number => (n + 7) & ~7;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function encodeSections(sections: readonly Section[]): Uint8Array {
  const names = sections.map((s) => enc.encode(s.name));
  let size = 12;
  sections.forEach((s, i) => {
    size = align8(size + 2 + names[i]!.length + 1 + 4);
    size = align8(size + s.data.byteLength);
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
    dv.setUint8(p, DTYPE_CODES[s.dtype]);
    dv.setUint32(p + 1, s.data.length, true);
    p = align8(p + 5);
    out.set(new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength), p);
    p = align8(p + s.data.byteLength);
  });
  return out;
}

export function decodeSections(bytes: Uint8Array): Section[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || dv.getUint32(0, true) !== MAGIC) throw new Error('decodeSections: bad magic');
  const version = dv.getUint32(4, true);
  if (version !== VERSION) throw new Error(`decodeSections: unsupported version ${version}`);
  const count = dv.getUint32(8, true);
  const out: Section[] = [];
  let p = 12;
  for (let i = 0; i < count; i++) {
    const nlen = dv.getUint16(p, true);
    const name = dec.decode(bytes.subarray(p + 2, p + 2 + nlen));
    p += 2 + nlen;
    const dtype = CODE_DTYPES[dv.getUint8(p)];
    if (dtype === undefined) throw new Error(`decodeSections: bad dtype in ${name}`);
    const length = dv.getUint32(p + 1, true);
    p = align8(p + 5);
    const data = makeArray(dtype, length);
    const byteLen = data.byteLength;
    if (p + byteLen > bytes.byteLength) throw new Error(`decodeSections: truncated section ${name}`);
    new Uint8Array(data.buffer).set(bytes.subarray(p, p + byteLen));
    p = align8(p + byteLen);
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
