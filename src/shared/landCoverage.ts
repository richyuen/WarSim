/**
 * Land coverage for the renderer's coastline (PLAN 1.28b): the 1-bit land mask
 * (LSB-first, row-major, `maskW × maskH`) reduced by `factor` in each axis to a byte per texel
 * holding the land fraction of its factor × factor block (0…255). Sampled bilinearly and
 * thresholded at 0.5, it yields a smooth coastline at sub-texel precision.
 */
export interface LandCoverage {
  w: number;
  h: number;
  data: Uint8Array;
}

export function buildLandCoverage(bits: Uint8Array, maskW: number, maskH: number, factor: number): LandCoverage {
  const w = Math.floor(maskW / factor);
  const h = Math.floor(maskH / factor);
  const data = new Uint8Array(w * h);
  const area = factor * factor;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * maskW;
        for (let dx = 0; dx < factor; dx++) {
          const i = row + x * factor + dx;
          n += (bits[i >> 3]! >> (i & 7)) & 1;
        }
      }
      data[y * w + x] = Math.round((n * 255) / area);
    }
  }
  return { w, h, data };
}
