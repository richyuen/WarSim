/**
 * T1 operational markers (SPEC §8, PLAN 2.1): per formation a box with its type symbol, a flag
 * chip, a strength bar (strength / full template strength) and the strength number; an order
 * arrow to its march target; a red outline while engaged; crossed swords at Major Battles.
 * Drawn on a Canvas2D overlay between 300 and 2000 m/px with a fade at both ends.
 *
 * One truth: the number is the formation's sim strength (men), which the sim keeps equal to the
 * sum over its elements.
 */
import type { UnitSymbol } from '../../shared/protocol';
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';

export interface MarkerInput {
  id: number;
  nation: number;
  x: number;
  y: number;
  strength: number;
  full: number;
  symbol: UnitSymbol;
  engaged: boolean;
  /** Order target in cells, or null. */
  target: [number, number] | null;
}

export interface PlacedMarker {
  id: number;
  nation: number;
  /** World position in cells. */
  wx: number;
  wy: number;
  alpha: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/** m/px where T1 markers are fully visible (between) and fade over FADE_FRACTION outside. */
export const T1_MIN_M = 300;
export const T1_MAX_M = 2000;
const FADE_FRACTION = 0.3;
const BOX_W = 26;
const BOX_H = 17;
const CHIP_W = 9;
const CHIP_H = 6;

/** Opacity of the T1 marker layer at `mPerPx` (smooth fade at both ends). */
export function markerAlpha(mPerPx: number): number {
  const s = (a: number, b: number, v: number): number => {
    const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  return s(T1_MIN_M * (1 - FADE_FRACTION), T1_MIN_M, mPerPx) * (1 - s(T1_MAX_M, T1_MAX_M * (1 + FADE_FRACTION), mPerPx));
}

/** Strength as shown: under 1,000 exact, else thousands with one decimal ("12.3k"). */
export function strengthText(men: number): string {
  const m = Math.round(men);
  return m < 1000 ? String(m) : `${(m / 1000).toFixed(1)}k`;
}

function symbolPath(ctx: CanvasRenderingContext2D, s: UnitSymbol, x: number, y: number, w: number, h: number): void {
  ctx.beginPath();
  switch (s) {
    case 'infantry': // NATO cross
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y);
      ctx.lineTo(x, y + h);
      break;
    case 'armour': // track oval
      ctx.ellipse(x + w / 2, y + h / 2, w * 0.36, h * 0.3, 0, 0, Math.PI * 2);
      break;
    case 'motorised': // cross + wheel line
      ctx.moveTo(x, y);
      ctx.lineTo(x + w, y + h);
      ctx.moveTo(x + w, y);
      ctx.lineTo(x, y + h);
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w / 2, y + h);
      break;
    case 'cavalry': // single slash
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y);
      break;
    case 'mountain': // peak
      ctx.moveTo(x + w * 0.25, y + h);
      ctx.lineTo(x + w / 2, y + h * 0.35);
      ctx.lineTo(x + w * 0.75, y + h);
      break;
    case 'garrison': // bar
      ctx.moveTo(x, y + h / 2);
      ctx.lineTo(x + w, y + h / 2);
      break;
  }
  ctx.stroke();
}

/**
 * Draws the markers (already in the CSS-px transform of `ctx`) and returns where they went.
 * `colorOf` gives a nation's CSS colour; `flagOf` its flag image (or null).
 */
export function drawMarkers(
  ctx: CanvasRenderingContext2D,
  markers: readonly MarkerInput[],
  majors: ArrayLike<number>,
  cam: Camera,
  geo: MapGeometry,
  vw: number,
  vh: number,
  alpha: number,
  colorOf: (nation: number) => string,
  flagOf: (nation: number) => CanvasImageSource | null,
  /** Unit-size setting (PLAN 1.39a): scales each marker about its position. */
  size = 1,
): PlacedMarker[] {
  const placed: PlacedMarker[] = [];
  if (alpha <= 0.01) return placed;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  const offs = wrapOffsets(cam, geo, vw);
  // Order arrows below the boxes.
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  for (const m of markers) {
    if (!m.target) continue;
    for (const off of offs) {
      const [ax, ay] = worldToScreen(cam, m.x + off, m.y, vw, vh);
      let tx = m.target[0];
      if (geo.wrapX && Math.abs(tx - m.x) > geo.w / 2) tx += tx < m.x ? geo.w : -geo.w;
      const [bx, by] = worldToScreen(cam, tx + off, m.target[1], vw, vh);
      if (Math.max(ax, bx) < 0 || Math.min(ax, bx) > vw || Math.max(ay, by) < 0 || Math.min(ay, by) > vh) continue;
      ctx.strokeStyle = 'rgba(255, 232, 150, 0.9)';
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      const ang = Math.atan2(by - ay, bx - ax);
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 7 * Math.cos(ang - 0.45), by - 7 * Math.sin(ang - 0.45));
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - 7 * Math.cos(ang + 0.45), by - 7 * Math.sin(ang + 0.45));
      ctx.stroke();
      ctx.setLineDash([4, 3]);
    }
  }
  ctx.setLineDash([]);
  // Boxes, back to front by y.
  const order = [...markers].sort((a, b) => a.y - b.y || a.id - b.id);
  ctx.font = '600 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const m of order) {
    for (const off of offs) {
      const [px, py] = worldToScreen(cam, m.x + off, m.y, vw, vh);
      const x = Math.round(px - BOX_W / 2);
      const y = Math.round(py - BOX_H / 2);
      if (px + BOX_W * size < 0 || py + BOX_H * size < 0 || px - BOX_W * size > vw || py - BOX_H * size > vh) continue;
      ctx.save();
      if (size !== 1) {
        ctx.translate(px, py);
        ctx.scale(size, size);
        ctx.translate(-px, -py);
      }
      ctx.fillStyle = 'rgba(16, 18, 24, 0.82)';
      ctx.fillRect(x - 1, y - 1, BOX_W + 2, BOX_H + 13);
      ctx.fillStyle = colorOf(m.nation);
      ctx.fillRect(x, y, BOX_W, BOX_H);
      ctx.strokeStyle = m.engaged ? '#ff4d3d' : 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = m.engaged ? 2 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, BOX_W - 1, BOX_H - 1);
      ctx.strokeStyle = 'rgba(10, 10, 14, 0.9)';
      ctx.lineWidth = 1.3;
      symbolPath(ctx, m.symbol, x + 4, y + 3, BOX_W - 8, BOX_H - 6);
      const flag = flagOf(m.nation);
      if (flag) ctx.drawImage(flag, x + 1, y + 1, CHIP_W, CHIP_H);
      // Strength bar and number under the box.
      const f = m.full > 0 ? Math.max(0, Math.min(1, m.strength / m.full)) : 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.fillRect(x, y + BOX_H + 1, BOX_W, 2);
      ctx.fillStyle = f > 0.5 ? '#8bd17c' : f > 0.25 ? '#f1c40f' : '#e74c3c';
      ctx.fillRect(x, y + BOX_H + 1, Math.round(BOX_W * f), 2);
      const text = strengthText(m.strength);
      ctx.fillStyle = '#ffe28a';
      ctx.fillText(text, x + BOX_W / 2, y + BOX_H + 3);
      ctx.restore();
      placed.push({ id: m.id, nation: m.nation, wx: m.x, wy: m.y, alpha, x: px - (BOX_W / 2) * size, y: py - (BOX_H / 2) * size, w: BOX_W * size, h: (BOX_H + 12) * size, text });
    }
  }
  // Major Battles: crossed swords.
  ctx.strokeStyle = '#ffe28a';
  ctx.lineWidth = 2.2;
  for (let i = 0; i + 1 < majors.length; i += 2) {
    for (const off of offs) {
      const [bx, by] = worldToScreen(cam, majors[i]! + off, majors[i + 1]!, vw, vh);
      if (bx < -20 || by < -20 || bx > vw + 20 || by > vh + 20) continue;
      ctx.fillStyle = 'rgba(140, 20, 10, 0.85)';
      ctx.beginPath();
      ctx.arc(bx, by, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - 6, by - 6);
      ctx.lineTo(bx + 6, by + 6);
      ctx.moveTo(bx + 6, by - 6);
      ctx.lineTo(bx - 6, by + 6);
      ctx.stroke();
    }
  }
  ctx.restore();
  return placed;
}
