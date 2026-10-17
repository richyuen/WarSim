import { describe, expect, it } from 'vitest';
import { decodeSections, encodeSections, hashSections, RUNS_SHARE, type Section } from '../../src/sim/core/sections';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { assets1938 } from '../helpers/earth';

// PLAN 7.17 (critic run 7, stability 7: "a save is about 40 MB"; ADR-484): format version 2 writes a
// section of 1-, 2- or 4-byte elements as runs when they take at most RUNS_SHARE of it. Decoded, every
// section is the same array bit for bit; version 1 still loads.

const { w: W } = SIZE_1938;
const VERSION_AT = 4;

/** Version 1's bytes of `sections` (every section raw), as saves were written before. */
function version1(sections: readonly Section[]): Uint8Array {
  const enc = new TextEncoder();
  const a8 = (n: number): number => (n + 7) & ~7;
  const codes: Record<string, number> = { u8: 1, i8: 2, u16: 3, i16: 4, u32: 5, i32: 6, f32: 7, f64: 8 };
  let size = 12;
  for (const s of sections) size = a8(a8(size + 2 + enc.encode(s.name).length + 5) + s.data.byteLength);
  const out = new Uint8Array(size);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x43455357, true);
  dv.setUint32(4, 1, true);
  dv.setUint32(8, sections.length, true);
  let p = 12;
  for (const s of sections) {
    const nb = enc.encode(s.name);
    dv.setUint16(p, nb.length, true);
    out.set(nb, p + 2);
    p += 2 + nb.length;
    dv.setUint8(p, codes[s.dtype]!);
    dv.setUint32(p + 1, s.data.length, true);
    p = a8(p + 5);
    out.set(new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength), p);
    p = a8(p + s.data.byteLength);
  }
  return out;
}

describe('a save as runs (PLAN 7.17)', () => {
  it('sections of every kind come back bit for bit: runs, raw, NaN and -0, empty, odd lengths', () => {
    const runny = new Uint16Array(5000).fill(7);
    runny.fill(9, 1234, 4321);
    const floats = new Float32Array(3000).fill(1.5);
    floats.fill(NaN, 10, 900);
    floats.fill(-0, 900, 1000);
    const noisy = new Uint32Array(4000).map((_, i) => (i * 2654435761) >>> 0);
    const doubles = new Float64Array(2000).fill(3.25);
    const bytes = new Uint8Array(1001).fill(0);
    bytes[1000] = 1;
    const sections: Section[] = [
      { name: 'runny', dtype: 'u16', data: runny },
      { name: 'floats', dtype: 'f32', data: floats },
      { name: 'noisy', dtype: 'u32', data: noisy },
      { name: 'doubles', dtype: 'f64', data: doubles },
      { name: 'bytes', dtype: 'u8', data: bytes },
      { name: 'small', dtype: 'i32', data: Int32Array.from([1, 1, 1]) },
      { name: 'empty', dtype: 'i8', data: new Int8Array(0) },
    ];
    const enc = encodeSections(sections);
    expect(new DataView(enc.buffer).getUint32(VERSION_AT, true)).toBe(2);
    const back = decodeSections(enc);
    expect(back.map((s) => s.name)).toEqual(sections.map((s) => s.name));
    for (let i = 0; i < sections.length; i++) {
      expect(back[i]!.dtype).toBe(sections[i]!.dtype);
      expect(new Uint8Array(back[i]!.data.buffer)).toEqual(new Uint8Array(sections[i]!.data.buffer, sections[i]!.data.byteOffset, sections[i]!.data.byteLength));
    }
    expect(hashSections(back)).toBe(hashSections(sections));
    // Smaller than raw by the runny sections, and the noisy one raw.
    expect(enc.length).toBeLessThan(version1(sections).length - 9000);
    // Version 1 of the same sections loads to the same.
    expect(hashSections(decodeSections(version1(sections)))).toBe(hashSections(sections));
  });

  it('a damaged run is refused, not read past', () => {
    const enc = encodeSections([{ name: 'runny', dtype: 'u8', data: new Uint8Array(4096).fill(3) }]);
    // Its one run's length, the last u32 before the padding: made longer than the section.
    const dv = new DataView(enc.buffer);
    const lenAt = enc.length - 8;
    expect(dv.getUint32(lenAt, true)).toBe(4096);
    dv.setUint32(lenAt, 5000, true);
    expect(() => decodeSections(enc)).toThrow(/runs past the end/);
    dv.setUint32(lenAt, 100, true);
    expect(() => decodeSections(enc)).toThrow(/runs short/);
  });

  it(`a 1938 world a month on: the save under RUNS_SHARE (${RUNS_SHARE}) of version 1's, the same state after a load`, () => {
    const s = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    s.step(24 * 31);
    const v2 = s.save();
    const v1 = version1(decodeSections(v2));
    process.stderr.write(`1938, a month on: version 1 ${v1.length} bytes, version 2 ${v2.length} (${((100 * v2.length) / v1.length).toFixed(1)} %)\n`);
    expect(v2.length).toBeLessThanOrEqual(RUNS_SHARE * v1.length);
    const t = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    t.load(v2);
    expect(t.hash()).toBe(s.hash());
    const u = new Sim({ scenario: '1938', seed: 99, assets: assets1938(W) });
    u.load(v1);
    expect(u.hash()).toBe(s.hash());
    t.step(24);
    s.step(24);
    expect(t.hash()).toBe(s.hash());
  }, 300_000);
});
