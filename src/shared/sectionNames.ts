/**
 * The sections of saved state bytes (unpacked) as "name:dtype", read from the section directory
 * alone, the data skipped (PLAN 7.168): what the title screen asks of a save or a scenario file,
 * which has no sim to decode it (SPEC §2.1: the app does not import the sim). The layout is
 * `sim/core/sections.ts`'s, versions 1 and 2; `tests/unit/sectionNames.test.ts` holds this to
 * `decodeSections` on saved worlds. Throws on bytes that are not sections.
 */
const MAGIC = 0x43455357; // 'WSEC'
const RUNS_FLAG = 0x80;
const DTYPES: readonly (readonly [string, number] | undefined)[] = [undefined, ['u8', 1], ['i8', 1], ['u16', 2], ['i16', 2], ['u32', 4], ['i32', 4], ['f32', 4], ['f64', 8]];
const align8 = (n: number): number => (n + 7) & ~7;

export function sectionNames(bytes: Uint8Array): string[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || dv.getUint32(0, true) !== MAGIC) throw new Error('not saved state: bad magic');
  const version = dv.getUint32(4, true);
  if (version !== 1 && version !== 2) throw new Error(`saved state of version ${version}`);
  const count = dv.getUint32(8, true);
  const dec = new TextDecoder();
  const out: string[] = [];
  let p = 12;
  for (let i = 0; i < count; i++) {
    if (p + 2 > bytes.byteLength) throw new Error('saved state truncated');
    const nlen = dv.getUint16(p, true);
    const name = dec.decode(bytes.subarray(p + 2, p + 2 + nlen));
    p += 2 + nlen;
    if (p + 5 > bytes.byteLength) throw new Error('saved state truncated');
    const code = dv.getUint8(p);
    const runs = version >= 2 && (code & RUNS_FLAG) !== 0;
    const dtype = DTYPES[code & ~RUNS_FLAG];
    if (dtype === undefined) throw new Error(`saved state: bad dtype in ${name}`);
    const length = dv.getUint32(p + 1, true);
    p = align8(p + 5);
    if (!runs) p = align8(p + length * dtype[1]);
    else {
      if (p + 4 > bytes.byteLength) throw new Error('saved state truncated');
      const r = dv.getUint32(p, true);
      p = align8(p + 4);
      p = align8(align8(p + r * dtype[1]) + r * 4);
    }
    if (p > bytes.byteLength) throw new Error(`saved state truncated in ${name}`);
    out.push(`${name}:${dtype[0]}`);
  }
  return out;
}
