/**
 * Admin-1 geometry asset codec (PLAN 0.19). Polygons are pre-projected (Miller, normalised
 * u, v ∈ [0, 1]) and quantised to integers q = round(u · Q). Neighbouring provinces share
 * identical source vertices, so they share identical quantised vertices: the rasterizer then
 * leaves no gaps or overlaps along shared borders.
 *
 * Layout (after gunzip): 'WAD1' u32 LE magic, u32 version, u32 Q, u32 province count, then a
 * varint stream; per province: polygonCount, per polygon: ringCount, per ring: vertexCount,
 * then zigzag delta varints (dx, dy) from the previous vertex (reset to 0, 0 at each ring).
 */

export const ADMIN1_MAGIC = 0x31444157; // 'WAD1'
export const ADMIN1_VERSION = 1;
/** Quantisation steps per unit (u or v): 2^20 ≈ 38 m per step at the equator. */
export const ADMIN1_Q = 1 << 20;

/** Quantised rings: flat [x0, y0, x1, y1, …] integers in [0, Q]. */
export type QRing = Int32Array;
export type QPolygon = QRing[];
export type QProvince = QPolygon[];

export class VarintWriter {
  private buf = new Uint8Array(1 << 16);
  length = 0;

  private ensure(n: number): void {
    if (this.length + n <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.length + n) cap *= 2;
    const b = new Uint8Array(cap);
    b.set(this.buf.subarray(0, this.length));
    this.buf = b;
  }

  /** Unsigned varint (values < 2^32). */
  u(v: number): void {
    this.ensure(5);
    let x = v >>> 0;
    while (x >= 0x80) {
      this.buf[this.length++] = (x & 0x7f) | 0x80;
      x >>>= 7;
    }
    this.buf[this.length++] = x;
  }

  /** Signed via zigzag. */
  s(v: number): void {
    this.u(((v << 1) ^ (v >> 31)) >>> 0);
  }

  bytes(): Uint8Array {
    return this.buf.slice(0, this.length);
  }
}

export function encodeAdmin1(provinces: readonly QProvince[]): Uint8Array {
  const w = new VarintWriter();
  for (const prov of provinces) {
    w.u(prov.length);
    for (const poly of prov) {
      w.u(poly.length);
      for (const ring of poly) {
        const n = ring.length >> 1;
        w.u(n);
        let px = 0;
        let py = 0;
        for (let i = 0; i < n; i++) {
          w.s(ring[2 * i]! - px);
          w.s(ring[2 * i + 1]! - py);
          px = ring[2 * i]!;
          py = ring[2 * i + 1]!;
        }
      }
    }
  }
  const body = w.bytes();
  const out = new Uint8Array(16 + body.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, ADMIN1_MAGIC, true);
  dv.setUint32(4, ADMIN1_VERSION, true);
  dv.setUint32(8, ADMIN1_Q, true);
  dv.setUint32(12, provinces.length, true);
  out.set(body, 16);
  return out;
}

export interface Admin1Geometry {
  q: number;
  provinces: QProvince[];
  vertexCount: number;
}

export function decodeAdmin1(bytes: Uint8Array): Admin1Geometry {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (dv.getUint32(0, true) !== ADMIN1_MAGIC) throw new Error('admin1: bad magic');
  if (dv.getUint32(4, true) !== ADMIN1_VERSION) throw new Error('admin1: unsupported version');
  const q = dv.getUint32(8, true);
  const count = dv.getUint32(12, true);
  let p = 16;
  const u = (): number => {
    let x = 0;
    let mul = 1;
    for (;;) {
      const b = bytes[p++]!;
      x += (b & 0x7f) * mul;
      if (b < 0x80) return x;
      mul *= 128;
    }
  };
  const s = (): number => {
    const z = u();
    return z % 2 === 0 ? z / 2 : -(z + 1) / 2;
  };
  const provinces: QProvince[] = [];
  let vertexCount = 0;
  for (let k = 0; k < count; k++) {
    const prov: QProvince = [];
    const np = u();
    for (let j = 0; j < np; j++) {
      const poly: QPolygon = [];
      const nr = u();
      for (let r = 0; r < nr; r++) {
        const n = u();
        const ring = new Int32Array(n * 2);
        let x = 0;
        let y = 0;
        for (let i = 0; i < n; i++) {
          x += s();
          y += s();
          ring[2 * i] = x;
          ring[2 * i + 1] = y;
        }
        vertexCount += n;
        poly.push(ring);
      }
      prov.push(poly);
    }
    provinces.push(prov);
  }
  if (p !== bytes.length) throw new Error('admin1: trailing bytes');
  return { q, provinces, vertexCount };
}

/** Per-province metadata shipped alongside the geometry (admin1-meta.json). */
export interface Admin1Meta {
  /** 1-based province id = index + 1 in the geometry stream. */
  id: number;
  adm1: string;
  name: string;
  adm0: string;
  admin: string;
  iso2: string;
  type: string;
  /** Label point (normalised Miller u, v). */
  u: number;
  v: number;
  areaKm2: number;
}
