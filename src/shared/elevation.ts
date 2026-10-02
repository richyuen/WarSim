/**
 * Elevation asset codec (PLAN 0.18, ADR-13). Int16 metres, row-major, stored as
 * byte-planes(row-delta(values)) before gzip: elevation is smooth along rows, so deltas are
 * small and the high-byte plane is nearly constant, which roughly halves the gzip size.
 * Ocean depths are quantised to 10 m by the encoder (bathymetry is only shaded coarsely).
 */

export const OCEAN_QUANTUM_M = 10;

/** Encodes int16 elevations (already quantised) into the pre-gzip byte stream. */
export function encodeElevation(values: Int16Array, w: number, h: number): Uint8Array {
  const n = w * h;
  const out = new Uint8Array(n * 2);
  for (let y = 0; y < h; y++) {
    let prev = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = (values[i]! - prev) & 0xffff;
      prev = values[i]!;
      out[i] = d & 0xff;
      out[n + i] = d >> 8;
    }
  }
  return out;
}

/** Inverse of `encodeElevation` (input is the gunzipped stream). */
export function decodeElevation(bytes: Uint8Array, w: number, h: number): Int16Array {
  const n = w * h;
  if (bytes.length !== n * 2) throw new Error(`elevation stream: ${bytes.length} bytes, expected ${n * 2}`);
  const out = new Int16Array(n);
  for (let y = 0; y < h; y++) {
    let prev = 0;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const d = bytes[i]! | (bytes[n + i]! << 8);
      prev = (prev + d) & 0xffff;
      out[i] = prev >= 0x8000 ? prev - 0x10000 : prev;
    }
  }
  return out;
}

/** Quantises ocean depths (negative values) to OCEAN_QUANTUM_M; land is exact. */
export function quantizeOcean(v: number): number {
  return v < 0 ? Math.round(v / OCEAN_QUANTUM_M) * OCEAN_QUANTUM_M : v;
}

/** Next pyramid level: 2×2 mean (rounded), ocean re-quantised. */
export function halveElevation(src: Int16Array, w: number, h: number): Int16Array {
  const hw = w / 2;
  const out = new Int16Array(hw * (h / 2));
  for (let y = 0; y < h / 2; y++) {
    for (let x = 0; x < hw; x++) {
      const i = 2 * y * w + 2 * x;
      out[y * hw + x] = quantizeOcean(Math.round((src[i]! + src[i + 1]! + src[i + w]! + src[i + w + 1]!) / 4));
    }
  }
  return out;
}
