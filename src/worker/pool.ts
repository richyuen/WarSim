/**
 * Recycled ArrayBuffer pool for transferable snapshots (ADR-6: no SharedArrayBuffer).
 * Buffers are bucketed by power-of-two size class; main transfers them back with each ack.
 */

const MIN_CLASS = 256;

function sizeClass(bytes: number): number {
  let c = MIN_CLASS;
  while (c < bytes) c *= 2;
  return c;
}

export class BufferPool {
  private readonly free = new Map<number, ArrayBuffer[]>();
  /** Buffers ever allocated (for leak checks). */
  allocated = 0;
  /** Buffers currently handed out and not yet returned. */
  outstanding = 0;

  acquire(bytes: number): ArrayBuffer {
    const cls = sizeClass(bytes);
    const list = this.free.get(cls);
    this.outstanding++;
    const buf = list?.pop();
    if (buf) return buf;
    this.allocated++;
    return new ArrayBuffer(cls);
  }

  release(buf: ArrayBuffer): void {
    // Detached or foreign buffers (wrong size class) are dropped, never pooled.
    if (buf.byteLength < MIN_CLASS || sizeClass(buf.byteLength) !== buf.byteLength) return;
    this.outstanding--;
    let list = this.free.get(buf.byteLength);
    if (!list) {
      list = [];
      this.free.set(buf.byteLength, list);
    }
    list.push(buf);
  }

  /** Buffers sitting in the pool. */
  get pooled(): number {
    let n = 0;
    for (const l of this.free.values()) n += l.length;
    return n;
  }
}
