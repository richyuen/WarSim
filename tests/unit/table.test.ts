import { describe, expect, it } from 'vitest';
import { Pcg32 } from '../../src/sim/core/rng';
import { decodeSections, encodeSections, hashSections, type Section } from '../../src/sim/core/sections';
import { loadBytes, saveBytes, stateHash, type Stateful } from '../../src/sim/core/state';
import { Table } from '../../src/sim/core/table';

const schema = { nation: 'u16', x: 'f64', y: 'f64', strength: 'u32', facing: 'f32', flags: 'u8', delta: 'i16' } as const;
type T = Table<typeof schema>;

/** Random create/remove/mutate churn driven by a seeded generator. */
function churn(t: T, seed: number, steps: number): void {
  const r = new Pcg32(0, seed, 0, 1);
  for (let i = 0; i < steps; i++) {
    const op = r.nextInt(10);
    if (op < 5 || t.count === 0) {
      const id = t.create();
      t.cols.nation[id] = r.nextInt(300);
      t.cols.x[id] = r.nextFloat() * 40000;
      t.cols.y[id] = r.nextFloat() * 20000 - 10000;
      t.cols.strength[id] = r.nextU32();
      t.cols.facing[id] = r.nextFloat() * 6;
      t.cols.flags[id] = r.nextInt(256);
      t.cols.delta[id] = r.nextInt(65536) - 32768;
    } else if (op < 8) {
      const ids = t.ids();
      t.remove(ids[r.nextInt(ids.length)]!);
    } else {
      const ids = t.ids();
      const id = ids[r.nextInt(ids.length)]!;
      t.cols.x[id] = t.cols.x[id]! + 1.5;
    }
  }
}

const wrap = (t: T): Stateful => t;

describe('Table', () => {
  it('allocates from 1, reuses freed ids LIFO, iterates in ascending id order', () => {
    const t = new Table('units', schema, 2);
    expect([t.create(), t.create(), t.create(), t.create()]).toEqual([1, 2, 3, 4]);
    expect(t.capacity).toBeGreaterThanOrEqual(5);
    t.remove(2);
    t.remove(4);
    expect(t.ids()).toEqual([1, 3]);
    expect(t.has(2)).toBe(false);
    expect(t.has(0)).toBe(false);
    expect(t.create()).toBe(4);
    expect(t.create()).toBe(2);
    expect(t.create()).toBe(5);
    expect(t.ids()).toEqual([1, 2, 3, 4, 5]);
    expect(t.count).toBe(5);
    expect(() => t.remove(99)).toThrow();
  });

  it('zeroes rows on create and remove', () => {
    const t = new Table('units', schema);
    const a = t.create();
    t.cols.x[a] = 7;
    t.remove(a);
    expect(t.cols.x[a]).toBe(0);
    const b = t.create();
    expect(b).toBe(a);
    expect(t.cols.x[b]).toBe(0);
  });

  it('keeps data across growth', () => {
    const t = new Table('units', schema, 2);
    for (let i = 0; i < 1000; i++) t.cols.strength[t.create()] = i * 3;
    expect(t.cols.strength[1000]).toBe(999 * 3);
    expect(t.count).toBe(1000);
  });

  it('serialize → bytes → deserialize → serialize yields identical bytes', () => {
    const t = new Table('units', schema, 4);
    churn(t, 1, 5000);
    const bytes = saveBytes([wrap(t)]);
    const u = new Table('units', schema, 4);
    loadBytes([wrap(u)], bytes);
    expect(saveBytes([wrap(u)])).toEqual(bytes);
    expect(stateHash([wrap(u)])).toBe(stateHash([wrap(t)]));
    expect(u.ids()).toEqual(t.ids());
  });

  it('continuing after a load is identical to an uninterrupted run (free list included)', () => {
    const a = new Table('units', schema);
    churn(a, 7, 3000);
    const b = new Table('units', schema);
    loadBytes([wrap(b)], saveBytes([wrap(a)]));
    churn(a, 8, 3000);
    churn(b, 8, 3000);
    expect(saveBytes([wrap(b)])).toEqual(saveBytes([wrap(a)]));
  });

  // PLAN 2.7x (ADR-74, third read, finding 2): `deserialize` made the columns and `alive` anew
  // at the loaded size and left `generation` as long as it was. For ids beyond it the count
  // read as undefined, and the increment in `create` wrote nowhere.
  it('a table loaded larger than it was counts its ids beyond the old size too', () => {
    const a = new Table('units', schema, 4);
    for (let i = 0; i < 40; i++) a.create();
    const b = new Table('units', schema, 4);
    b.create();
    loadBytes([wrap(b)], saveBytes([wrap(a)]));
    expect(b.highWater).toBe(41);
    expect(b.generation.length).toBe(b.capacity);
    // The counts of the process go on: id 1 was given out once here, the others not yet.
    expect(Array.from(b.generation.subarray(0, 41)).every((g) => Number.isInteger(g))).toBe(true);
    // An id beyond the old size, freed and given out again: another row, and its count says so.
    const before = b.generation[30]!;
    b.remove(30);
    expect(b.create()).toBe(30);
    expect(b.generation[30]).toBe(before + 1);
    // And one that the table grows for.
    const id = b.create();
    expect(id).toBe(41);
    expect(b.generation[id]).toBe(1);
  });

  it('state hash changes on any single-byte mutation of any column, alive map or free list', () => {
    const t = new Table('units', schema);
    churn(t, 3, 1000);
    const base = saveBytes([wrap(t)]);
    const baseHash = stateHash([wrap(t)]);
    const sections = decodeSections(base);
    let mutations = 0;
    for (const s of sections) {
      const bytes = new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength);
      for (let i = 0; i < bytes.length; i++) {
        const old = bytes[i]!;
        bytes[i] = old ^ (1 << (i % 8));
        expect(hashSections(sections), `${s.name} byte ${i}`).not.toBe(baseHash);
        bytes[i] = old;
        mutations++;
      }
    }
    expect(hashSections(sections)).toBe(baseHash);
    expect(mutations).toBeGreaterThan(2000);
  });

  it('hash is sensitive to section names and order', () => {
    const a: Section = { name: 'a', dtype: 'u8', data: new Uint8Array([1, 2]) };
    const b: Section = { name: 'b', dtype: 'u8', data: new Uint8Array([1, 2]) };
    expect(hashSections([a, b])).not.toBe(hashSections([b, a]));
    expect(hashSections([a])).not.toBe(hashSections([b]));
    expect(hashSections([a])).not.toBe(hashSections([{ ...a, dtype: 'i8', data: new Int8Array([1, 2]) }]));
  });
});

describe('section codec', () => {
  it('round-trips every dtype with alignment and rejects corrupt input', () => {
    const sections: Section[] = [
      { name: 'x', dtype: 'u8', data: new Uint8Array([1, 2, 3]) },
      { name: 'ünïcode', dtype: 'i8', data: new Int8Array([-1]) },
      { name: 'c', dtype: 'u16', data: new Uint16Array([65535]) },
      { name: 'd', dtype: 'i16', data: new Int16Array([-2]) },
      { name: 'e', dtype: 'u32', data: new Uint32Array([0xffffffff]) },
      { name: 'f', dtype: 'i32', data: new Int32Array([-3]) },
      { name: 'g', dtype: 'f32', data: new Float32Array([1.5]) },
      { name: 'h', dtype: 'f64', data: new Float64Array([Math.PI, -0, NaN]) },
      { name: 'empty', dtype: 'f64', data: new Float64Array(0) },
    ];
    const bytes = encodeSections(sections);
    expect(bytes.byteLength % 8).toBe(0);
    const back = decodeSections(bytes);
    expect(back.map((s) => s.name)).toEqual(sections.map((s) => s.name));
    expect(encodeSections(back)).toEqual(bytes);
    expect(Object.is(back[7]!.data[1], -0)).toBe(true);
    const bad = bytes.slice();
    bad[0] = 0;
    expect(() => decodeSections(bad)).toThrow(/magic/);
    expect(() => decodeSections(bytes.slice(0, bytes.length - 8))).toThrow();
  });
});

describe('Table.reserve', () => {
  it('pre-grows so cached columns stay valid through bulk creates', () => {
    const t = new Table('r', { v: 'u32' } as const, 2);
    t.reserve(100);
    const cols = t.cols;
    for (let i = 0; i < 100; i++) cols.v[t.create()] = i + 1;
    expect(t.cols).toBe(cols);
    expect(t.cols.v[100]).toBe(100);
  });
});
