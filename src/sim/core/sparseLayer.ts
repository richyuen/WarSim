/**
 * A sparse layer over the grid's cells: per cell a value, 0 for none (PLAN 7.83c). It answers as a
 * `Map<number, number>` of the cells set does (`get`, `size`, iteration in the order set), from
 * an array by cell, so asking a cell costs an index and making the layer again costs a write a
 * cell. A value is 1–65535 (a nation's or a bloc's id; 0 is no entry).
 */
export class SparseLayer {
  private value = new Uint16Array(0);
  private cells: number[] = [];

  get size(): number {
    return this.cells.length;
  }

  /** The value at `cell`, 0 for none. */
  at(cell: number): number {
    return cell < this.value.length ? this.value[cell]! : 0;
  }

  /** As a map's: the value at `cell`, or undefined. */
  get(cell: number): number | undefined {
    const v = this.at(cell);
    return v === 0 ? undefined : v;
  }

  has(cell: number): boolean {
    return this.at(cell) !== 0;
  }

  /** Room for cells 0 to `n` − 1 without growing. */
  reserve(n: number): void {
    if (n <= this.value.length) return;
    const grown = new Uint16Array(n);
    grown.set(this.value);
    this.value = grown;
  }

  set(cell: number, v: number): this {
    if (v <= 0 || v > 0xffff || v !== Math.floor(v)) throw new Error(`SparseLayer: value ${v} not in 1–65535`);
    if (cell >= this.value.length) this.reserve(Math.max(cell + 1, this.value.length * 2));
    if (this.value[cell] === 0) this.cells.push(cell);
    this.value[cell] = v;
    return this;
  }

  clear(): void {
    for (const c of this.cells) this.value[c] = 0;
    this.cells.length = 0;
  }

  keys(): IterableIterator<number> {
    return this.cells.values();
  }

  *[Symbol.iterator](): IterableIterator<[number, number]> {
    for (const c of this.cells) yield [c, this.value[c]!];
  }
}
