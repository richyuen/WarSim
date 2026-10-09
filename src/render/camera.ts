/**
 * 2D map camera (SPEC §8). The centre is kept in f64 world units (cells); shaders receive the
 * integer centre cell + an f32 fraction, so precision is independent of map position.
 *
 * Zoom is continuous: `scale` is CSS px per cell, and z = log2(px per km) for LOD decisions.
 * Pure functions here are unit-tested; DOM input lives in app/input/CameraController.
 */
export interface Camera {
  /** Centre in cells (f64). */
  cx: number;
  cy: number;
  /** CSS px per cell. */
  scale: number;
}

export interface MapGeometry {
  /** Map size in cells. */
  w: number;
  h: number;
  /** Kilometres per cell at the equator. */
  kmPerCell: number;
  /** Looping map: x wraps. */
  wrapX: boolean;
}

/** Splits a centre coordinate into (integer cell, fraction in [0, 1)). */
export function splitCoord(v: number): [number, number] {
  const i = Math.floor(v);
  return [i, v - i];
}

/** Continuous zoom level z = log2(screen px per km). */
export function zoomLevel(cam: Camera, geo: MapGeometry): number {
  return Math.log2(cam.scale / geo.kmPerCell);
}

export function scaleForZoom(z: number, geo: MapGeometry): number {
  return Math.pow(2, z) * geo.kmPerCell;
}

/** Smallest scale: the whole map height (or width when not wrapping) fits the viewport. */
export function minScale(geo: MapGeometry, viewW: number, viewH: number): number {
  const fitH = viewH / geo.h;
  return geo.wrapX ? fitH * 0.9 : Math.min(viewW / geo.w, fitH) * 0.9;
}

/** Largest scale: 1 m per CSS px (close tier, SPEC §8). */
export function maxScale(geo: MapGeometry): number {
  return geo.kmPerCell * 1000;
}

/** Clamps zoom and the vertical/horizontal extent; wraps x into [0, w) on looping maps. */
export function normalize(cam: Camera, geo: MapGeometry, viewW: number, viewH: number): Camera {
  const scale = Math.min(maxScale(geo), Math.max(minScale(geo, viewW, viewH), cam.scale));
  let cx = cam.cx;
  if (geo.wrapX) cx = ((cx % geo.w) + geo.w) % geo.w;
  else cx = clampAxis(cx, geo.w, viewW / scale);
  const cy = clampAxis(cam.cy, geo.h, viewH / scale);
  return { cx, cy, scale };
}

/** Keeps a view of `span` cells inside [0, size]; centres it when the view is larger. */
function clampAxis(c: number, size: number, span: number): number {
  if (span >= size) return size / 2;
  return Math.min(size - span / 2, Math.max(span / 2, c));
}

/** World point (cells) under a screen point (CSS px, origin top-left). */
export function screenToWorld(cam: Camera, sx: number, sy: number, viewW: number, viewH: number): [number, number] {
  return [cam.cx + (sx - viewW / 2) / cam.scale, cam.cy + (sy - viewH / 2) / cam.scale];
}

/**
 * The cell of a world point, or null off the map: above or below it, and beside a map that does
 * not loop (the view is wider than such a map zoomed out; PLAN 3.12Rse2). x wraps on one that does.
 */
export function cellOfPoint(geo: MapGeometry, wx: number, wy: number): [number, number] | null {
  const x = Math.floor(wx);
  const y = Math.floor(wy);
  if (y < 0 || y >= geo.h) return null;
  if (!geo.wrapX && (x < 0 || x >= geo.w)) return null;
  return [((x % geo.w) + geo.w) % geo.w, y];
}

export function worldToScreen(cam: Camera, wx: number, wy: number, viewW: number, viewH: number): [number, number] {
  return [(wx - cam.cx) * cam.scale + viewW / 2, (wy - cam.cy) * cam.scale + viewH / 2];
}

/** Zooms by `factor` keeping the world point under (sx, sy) fixed on screen. */
export function zoomAt(cam: Camera, factor: number, sx: number, sy: number, viewW: number, viewH: number): Camera {
  const [wx, wy] = screenToWorld(cam, sx, sy, viewW, viewH);
  const scale = cam.scale * factor;
  return { scale, cx: wx - (sx - viewW / 2) / scale, cy: wy - (sy - viewH / 2) / scale };
}

/** Pans by a screen-space delta (CSS px): content follows the pointer. */
export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, cx: cam.cx - dx / cam.scale, cy: cam.cy - dy / cam.scale };
}

/**
 * The furthest beside a looping map a place of the sim stands with its x left unfolded, cells
 * (PLAN 3.12Rt): a block deployed over the seam and the slots of a block beside it keep the x
 * of their formation's side, under 0 or the width and over (`elementPlace`, `deployOf` in
 * sim/systems/elements.ts: `DEPLOY_REACH` and `BLOCK_REACH`, 1.5 and 0.5; tests/unit/seam.test.ts
 * holds the two together). What draws such a place, or finds it under the pointer, asks
 * `wrapOffsets` for the copies within this of the view.
 */
export const SEAM_MARGIN = 2;

/**
 * Horizontal copies of the world needed to cover the view on a looping map: offsets k·w such
 * that the shifted map, and `margin` cells either side of it, intersects the visible x-range.
 * Returns [0] when not wrapping. With no margin a view that ends short of the seam has the one
 * copy, and nothing of it is drawn that stands over the seam with its x unfolded (`SEAM_MARGIN`).
 */
export function wrapOffsets(cam: Camera, geo: MapGeometry, viewW: number, margin = 0): number[] {
  if (!geo.wrapX) return [0];
  const half = viewW / 2 / cam.scale + margin;
  const out: number[] = [];
  const kMin = Math.floor((cam.cx - half) / geo.w);
  const kMax = Math.floor((cam.cx + half) / geo.w);
  for (let k = kMin; k <= kMax; k++) out.push(k * geo.w);
  return out;
}

/** How strongly a flight zooms out to cross a distance (van Wijk and Nuij's ρ). */
const FLIGHT_RHO = Math.SQRT2;
/** Milliseconds per unit of a flight's path (a zoom by e^√2, about 4.1 times, is one unit of √2), and the limits of the whole. */
const FLIGHT_MS_PER_UNIT = 320;
const FLIGHT_MIN_MS = 250;
const FLIGHT_MAX_MS = 1600;

/** A camera path from one view to another: `at(0)` is the start, `at(1)` the end, exactly. */
export interface Flight {
  ms: number;
  /** The camera at `t` in [0, 1] of the way in time; eased at both ends. */
  at(t: number): Camera;
}

/**
 * The flight from `from` to `to` (PLAN 2.14f5b4): pan and zoom in one movement, on the path of
 * van Wijk and Nuij ("Smooth and efficient zooming and panning", 2003). Far apart at a close
 * zoom, it zooms out until both places are near in pixels, crosses, and zooms in; from the
 * world view to a place in it, it is a zoom towards the place. On a looping map it goes the
 * short way round. `from` and `to` are normalized cameras; a step of the path may not be (the
 * caller normalizes what it shows).
 */
export function flight(from: Camera, to: Camera, geo: MapGeometry, viewW: number): Flight {
  let dx = to.cx - from.cx;
  if (geo.wrapX) dx -= Math.round(dx / geo.w) * geo.w;
  const dy = to.cy - from.cy;
  const w0 = viewW / from.scale;
  const w1 = viewW / to.scale;
  const d1 = Math.hypot(dx, dy);
  const rho2 = FLIGHT_RHO * FLIGHT_RHO;
  // Under a thousandth of the narrower view apart: a zoom on the spot (the path's formulas divide by the distance).
  const still = d1 < Math.min(w0, w1) * 1e-3;
  const r0 = still ? 0 : -Math.asinh((w1 * w1 - w0 * w0 + rho2 * rho2 * d1 * d1) / (2 * w0 * rho2 * d1));
  const r1 = still ? 0 : -Math.asinh((w1 * w1 - w0 * w0 - rho2 * rho2 * d1 * d1) / (2 * w1 * rho2 * d1));
  const S = still ? Math.abs(Math.log(w1 / w0)) / FLIGHT_RHO : (r1 - r0) / FLIGHT_RHO;
  const ms = Math.min(FLIGHT_MAX_MS, Math.max(FLIGHT_MIN_MS, S * FLIGHT_RHO * FLIGHT_MS_PER_UNIT));
  const at = (t: number): Camera => {
    if (t <= 0) return from;
    if (t >= 1) return to;
    // Ease in and out (a cubic), so the flight neither starts nor lands at full speed.
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    if (still) return { cx: from.cx + dx * e, cy: from.cy + dy * e, scale: from.scale * Math.pow(to.scale / from.scale, e) };
    const s = e * S;
    // The share of the way crossed, and the width of the view, at `s` along the path.
    const u = (w0 / (rho2 * d1)) * (Math.cosh(r0) * Math.tanh(FLIGHT_RHO * s + r0) - Math.sinh(r0));
    const w = (w0 * Math.cosh(r0)) / Math.cosh(FLIGHT_RHO * s + r0);
    return { cx: from.cx + u * dx, cy: from.cy + u * dy, scale: viewW / w };
  };
  return { ms, at };
}
