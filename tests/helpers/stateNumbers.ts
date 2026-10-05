import type { World } from '../../src/sim/world';

/**
 * The sections of the state that hold a NaN they should not (PLAN 2.12): any NaN outside the
 * history's rows, and in those rows any NaN but the one the language writes for the word (an
 * event without a place). A NaN that comes out of arithmetic has bits of its own; they are in
 * the save and in the hash, and they need not be the same in two engines: the worker's hash
 * left Node's with the first formation that stood at (NaN, NaN).
 */
export function strayNaN(world: World): string[] {
  const written = new Uint8Array(new Float64Array([NaN]).buffer);
  const out: string[] = [];
  for (const part of world.parts()) {
    for (const s of part.serialize()) {
      if (s.dtype !== 'f32' && s.dtype !== 'f64') continue;
      const data = s.data as Float32Array | Float64Array;
      const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      let nan = 0;
      let other = 0;
      for (let i = 0; i < data.length; i++) {
        if (!Number.isNaN(data[i]!)) continue;
        nan++;
        if (s.dtype !== 'f64' || written.some((b, k) => bytes[i * 8 + k] !== b)) other++;
      }
      if (s.name !== 'history.rows' && nan > 0) out.push(`${s.name}: ${nan} NaN`);
      else if (other > 0) out.push(`${s.name}: ${other} NaN that are not the written one`);
    }
  }
  return out;
}
