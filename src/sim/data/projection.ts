/**
 * Map projection (ADR-7): Miller cylindrical, cropped to 80°N … 64.165°S so the projected
 * extent is exactly 2:1 (width 2π, height π in Miller units). Every map size is W×H with
 * W = 2H and square cells in projected space.
 *
 * Uses dmath, so the offline data tools and the in-worker rasterizer produce identical bits.
 */
import { atan, cos, exp, log, PI, tan } from '../core/dmath';

const DEG = PI / 180;
const QUARTER_PI = PI / 4;

/** Miller y for latitude φ (radians). */
export function millerY(phi: number): number {
  return 1.25 * log(tan(QUARTER_PI + 0.4 * phi));
}

/** Latitude (radians) for Miller y. */
export function millerLat(y: number): number {
  return (atan(exp(y / 1.25)) - QUARTER_PI) / 0.4;
}

export const LAT_TOP_DEG = 80;
/** Miller y of the top edge. */
export const Y_TOP = millerY(LAT_TOP_DEG * DEG);
/** Miller y of the bottom edge (height π below the top). */
export const Y_BOTTOM = Y_TOP - PI;
/** ≈ −64.165°. */
export const LAT_BOTTOM_DEG = millerLat(Y_BOTTOM) / DEG;

/**
 * Projects lon/lat (degrees) to normalised map coordinates u ∈ [0, 1) (west → east from
 * −180°) and v ∈ [0, 1] (north → south). Multiply by W / H for cell units.
 */
export function project(lonDeg: number, latDeg: number): [number, number] {
  const u = (lonDeg + 180) / 360;
  const v = (Y_TOP - millerY(latDeg * DEG)) / PI;
  return [u, v];
}

/** Inverse of `project`: normalised (u, v) → [lonDeg, latDeg]. */
export function unproject(u: number, v: number): [number, number] {
  return [u * 360 - 180, millerLat(Y_TOP - v * PI) / DEG];
}

/** Equatorial km per cell for a map `w` cells wide. */
export function kmPerCell(w: number): number {
  return 40075.017 / w;
}

/**
 * Per-row true-scale factors (SPEC §3.1): true km per projected km. Miller stretches x by
 * sec φ and y by dY/dφ = 1 / cos(0.8φ), so kx = cos φ and ky = cos(0.8φ) at the row centre.
 */
export function rowScales(h: number): { kx: Float64Array; ky: Float64Array } {
  const kx = new Float64Array(h);
  const ky = new Float64Array(h);
  for (let r = 0; r < h; r++) {
    const v = (r + 0.5) / h;
    const phi = millerLat(Y_TOP - v * PI);
    kx[r] = cos(phi);
    ky[r] = cos(0.8 * phi);
  }
  return { kx, ky };
}
