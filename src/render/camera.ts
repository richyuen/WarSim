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
 * Horizontal copies of the world needed to cover the view on a looping map: offsets k·w such
 * that the shifted map intersects the visible x-range. Returns [0] when not wrapping.
 */
export function wrapOffsets(cam: Camera, geo: MapGeometry, viewW: number): number[] {
  if (!geo.wrapX) return [0];
  const half = viewW / 2 / cam.scale;
  const out: number[] = [];
  const kMin = Math.floor((cam.cx - half) / geo.w);
  const kMax = Math.floor((cam.cx + half) / geo.w);
  for (let k = kMin; k <= kMax; k++) out.push(k * geo.w);
  return out;
}
