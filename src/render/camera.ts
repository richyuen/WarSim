/**
 * 2D map camera (SPEC §8 "Precision"): the centre is kept in f64 world units (cells);
 * shaders receive the integer centre cell + an f32 fraction, so precision is independent
 * of where on the map the camera is.
 */
export interface Camera {
  /** Centre in cells (f64). */
  cx: number;
  cy: number;
  /** Screen px per cell. */
  scale: number;
}

/** Splits a centre coordinate into (integer cell, fraction in [0, 1)). */
export function splitCoord(v: number): [number, number] {
  const i = Math.floor(v);
  return [i, v - i];
}
