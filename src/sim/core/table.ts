/**
 * Growable structure-of-arrays entity table (SPEC §2.6 "iteration is always in ascending id order").
 *
 * - Ids start at 1; 0 means "none" in every reference column.
 * - Freed ids go on a LIFO free list and are reused first. The free list is part of the
 *   serialized state, so allocation after save → load is identical to an uninterrupted run.
 * - Rows are zeroed on create and on remove, so dead slots never carry stale data and the
 *   serialized bytes are canonical.
 * - Only rows [0, highWater) are serialized; capacity is an implementation detail.
 */
import { makeArray, takeSection, type ArrayOf, type DType, type Section } from './sections';

export type Schema = Record<string, DType>;
export type Columns<S extends Schema> = { [K in keyof S]: ArrayOf<S[K]> };

export class Table<S extends Schema> {
  readonly name: string;
  readonly schema: S;
  /** Column names in schema order, cached (create/remove are hot paths). */
  private readonly keys: (keyof S & string)[];
  cols: Columns<S>;
  /** 1 = live row. */
  alive: Uint8Array;
  private free: Uint32Array;
  private freeLen = 0;
  /** One past the largest id ever allocated (row 0 is reserved). */
  highWater = 1;
  /** Live row count. */
  count = 0;

  constructor(name: string, schema: S, initialCapacity = 64) {
    this.name = name;
    this.schema = schema;
    this.keys = Object.keys(schema) as (keyof S & string)[];
    const cap = Math.max(2, initialCapacity);
    this.cols = Table.allocCols(schema, cap);
    this.alive = new Uint8Array(cap);
    this.free = new Uint32Array(16);
  }

  private static allocCols<S extends Schema>(schema: S, cap: number): Columns<S> {
    const cols = {} as Columns<S>;
    for (const key of Object.keys(schema) as (keyof S & string)[]) {
      cols[key] = makeArray(schema[key]!, cap) as Columns<S>[typeof key];
    }
    return cols;
  }

  get capacity(): number {
    return this.alive.length;
  }

  private grow(minCap: number): void {
    let cap = this.capacity;
    while (cap < minCap) cap *= 2;
    const cols = Table.allocCols(this.schema, cap);
    for (const key of this.keys) (cols[key] as ArrayOf<DType>).set(this.cols[key] as ArrayOf<DType>);
    this.cols = cols;
    const alive = new Uint8Array(cap);
    alive.set(this.alive);
    this.alive = alive;
  }

  /** Allocates a zeroed row and returns its id. */
  create(): number {
    let id: number;
    if (this.freeLen > 0) {
      id = this.free[--this.freeLen]!;
    } else {
      id = this.highWater++;
      if (id >= this.capacity) this.grow(id + 1);
    }
    this.alive[id] = 1;
    this.count++;
    this.zeroRow(id);
    return id;
  }

  remove(id: number): void {
    if (!this.has(id)) throw new Error(`${this.name}: remove of dead id ${id}`);
    this.alive[id] = 0;
    this.count--;
    this.zeroRow(id);
    if (this.freeLen === this.free.length) {
      const f = new Uint32Array(this.free.length * 2);
      f.set(this.free);
      this.free = f;
    }
    this.free[this.freeLen++] = id;
  }

  has(id: number): boolean {
    return id > 0 && id < this.highWater && this.alive[id] === 1;
  }

  private zeroRow(id: number): void {
    for (const key of this.keys) (this.cols[key] as ArrayOf<DType>)[id] = 0;
  }

  /** Calls fn for every live id in ascending order. Rows created during iteration beyond the
   *  starting highWater are not visited; removing the current or a later row is safe. */
  forEach(fn: (id: number) => void): void {
    const hw = this.highWater;
    const alive = this.alive;
    for (let id = 1; id < hw; id++) if (alive[id] === 1) fn(id);
  }

  /** Live ids in ascending order (allocates; prefer forEach in hot paths). */
  ids(): number[] {
    const out: number[] = [];
    this.forEach((id) => out.push(id));
    return out;
  }

  serialize(): Section[] {
    const hw = this.highWater;
    const meta = new Uint32Array([hw, this.count, this.freeLen]);
    const out: Section[] = [
      { name: `${this.name}.meta`, dtype: 'u32', data: meta },
      { name: `${this.name}.alive`, dtype: 'u8', data: this.alive.slice(0, hw) },
      { name: `${this.name}.free`, dtype: 'u32', data: this.free.slice(0, this.freeLen) },
    ];
    for (const key of Object.keys(this.schema).sort()) {
      const dtype = this.schema[key]!;
      out.push({ name: `${this.name}.${key}`, dtype, data: (this.cols[key] as ArrayOf<DType>).slice(0, hw) });
    }
    return out;
  }

  /** Replaces this table's contents from sections produced by `serialize`. */
  deserialize(sections: readonly Section[]): void {
    const meta = takeSection(sections, `${this.name}.meta`, 'u32');
    const [hw = 1, count = 0, freeLen = 0] = meta;
    const cap = Math.max(this.capacity, hw);
    const alive = new Uint8Array(cap);
    alive.set(takeSection(sections, `${this.name}.alive`, 'u8'));
    const cols = Table.allocCols(this.schema, cap);
    for (const key of this.keys) {
      const src = takeSection(sections, `${this.name}.${key}`, this.schema[key]!);
      if (src.length !== hw) throw new Error(`${this.name}.${key}: length ${src.length}, expected ${hw}`);
      (cols[key] as ArrayOf<DType>).set(src);
    }
    const free = takeSection(sections, `${this.name}.free`, 'u32');
    this.free = new Uint32Array(Math.max(16, freeLen));
    this.free.set(free);
    this.freeLen = freeLen;
    this.highWater = hw;
    this.count = count;
    this.alive = alive;
    this.cols = cols;
  }
}
