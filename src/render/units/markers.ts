/**
 * T1 operational markers (SPEC §8, PLAN 2.1): per formation a box with its type symbol, a flag
 * chip, a strength bar (strength / full template strength) and the strength number; an order
 * arrow to its march target; a red outline while engaged; crossed swords at Major Battles.
 * Drawn on a Canvas2D overlay between 300 and 2000 m/px, with a timed handover toward the T0
 * counters and one toward the T2 sprites (`handover.ts`).
 *
 * One truth: the number is the formation's sim strength (men), which the sim keeps equal to the
 * sum over its elements.
 */
import type { UnitSymbol } from '../../shared/protocol';
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { smooth } from '../timing';
import { HANDOVER_MS } from './handover';

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

/**
 * How far the markers are on their way into the T2 sprites (PLAN 2.7c): the box fades and
 * shrinks into the group while the strength bar and the number stay, then those go. All 1 at T1.
 */
export interface MarkerMorph {
  /** Opacity of the box (frame, fill, symbol, flag chip) and of the order arrows. */
  box: number;
  /** Scale of the box about its centre. */
  scale: number;
  /** Opacity of the strength bar and the number. */
  bar: number;
}
export const AT_REST: MarkerMorph = { box: 1, scale: 1, bar: 1 };

/**
 * The T1 ↔ T2 change in two parts (PLAN 2.7c): for HANDOVER_MS the box fades and shrinks by
 * MARKER_SHRINK into the group while the sprites fade in; the strength bar and the number stay
 * for that time and go over BAR_LINGER_MS after it. Out of T2 the same, backwards.
 */
export const BAR_LINGER_MS = 220;
export const MORPH_MS = HANDOVER_MS + BAR_LINGER_MS;
/**
 * 0.13 and no more: at a corner of the box the motion of its two edges adds up (13 + 8.5 px from
 * the centre), and a white flag chip against the dark outline is nearly full contrast. At 0.2
 * that corner pixel changed by 67 of 255 in one frame; the limit for a change without popping
 * is 48 (ADR-71, ADR-72).
 */
export const MARKER_SHRINK = 0.13;

/**
 * The sprites' share and the markers' morph at progress `p` of the T1 ↔ T2 change (0 = T1,
 * 1 = T2, linear in time: `TierHandover.linear`). The shrink is linear in time: an edge at a
 * steady speed changes a pixel less than one that eases to one and a half times that speed.
 */
export function markerMorph(p: number): { elements: number; morph: MarkerMorph } {
  const first = HANDOVER_MS / MORPH_MS;
  const q = Math.max(0, Math.min(1, p / first));
  const late = Math.max(0, Math.min(1, (p - first) / (1 - first)));
  return { elements: smooth(q), morph: { box: 1 - smooth(q), scale: 1 - MARKER_SHRINK * q, bar: 1 - smooth(late) } };
}

export interface PlacedMarker {
  id: number;
  nation: number;
  /** World position in cells. */
  wx: number;
  wy: number;
  /** Opacity of the box; `bar` that of the strength bar and the number; `scale` of the box (PLAN 2.7c). */
  alpha: number;
  bar: number;
  scale: number;
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
}

/**
 * m/px where T1 markers are the unit layer: from T1_MIN_M down the T2 element sprites take over,
 * above T1_MAX_M the T0 counters (`handover.ts`: both are states, and a change takes time).
 */
export const T1_MIN_M = 300;
export const T1_MAX_M = 2000;
const BOX_W = 26;
const BOX_H = 17;
const CHIP_W = 9;
const CHIP_H = 6;

/**
 * Strength as shown: under 1,000 exact, then thousands with one decimal ("12.3k"), and from a
 * million on (the folded counters of PLAN 1.45b) millions with two ("1.48M").
 */
export function strengthText(men: number): string {
  const m = Math.round(men);
  if (m < 1000) return String(m);
  return m < 999_950 ? `${(m / 1000).toFixed(1)}k` : `${(m / 1e6).toFixed(2)}M`;
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

/** The box of a marker with its top-left corner at (x, y): backing, the nation's fill, outline, symbol, flag chip. */
function boxArt(ctx: CanvasRenderingContext2D, m: MarkerInput, x: number, y: number, colorOf: (nation: number) => string, flagOf: (nation: number) => CanvasImageSource | null): void {
  ctx.fillStyle = 'rgba(16, 18, 24, 0.82)';
  ctx.fillRect(x - 1, y - 1, BOX_W + 2, BOX_H + 1);
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
}

/** Room around the box in its picture, CSS px (the engaged outline reaches half a pixel out). */
const SPRITE_PAD = 2;

/** A picture of a marker's box at `dpr` device px per CSS px, as it is drawn at rest. */
function boxSprite(m: MarkerInput, colorOf: (nation: number) => string, flagOf: (nation: number) => CanvasImageSource | null, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.ceil((BOX_W + 2 * SPRITE_PAD) * dpr);
  c.height = Math.ceil((BOX_H + 2 * SPRITE_PAD) * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  g.imageSmoothingEnabled = false;
  boxArt(g, m, SPRITE_PAD, SPRITE_PAD, colorOf, flagOf);
  return c;
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
  morph: MarkerMorph = AT_REST,
): PlacedMarker[] {
  const placed: PlacedMarker[] = [];
  const boxAlpha = alpha * morph.box;
  const barAlpha = alpha * morph.bar;
  if (Math.max(boxAlpha, barAlpha) <= 0.01) return placed;
  ctx.save();
  ctx.globalAlpha = boxAlpha;
  ctx.imageSmoothingEnabled = false;
  const offs = wrapOffsets(cam, geo, vw);
  // Order arrows below the boxes.
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);
  for (const m of markers) {
    if (!m.target || boxAlpha <= 0.01) continue;
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
  // Pictures of the boxes, made when a morph needs them (one for each nation, symbol and state).
  const sprites = new Map<string, HTMLCanvasElement>();
  const dpr = Math.max(1, ctx.getTransform().a);
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
      // Strength bar and number under the box, on their dark backing. They have an opacity of
      // their own: on the way to T2 they stay while the box goes (PLAN 2.7c).
      const text = strengthText(m.strength);
      if (barAlpha > 0.01) {
        ctx.globalAlpha = barAlpha;
        ctx.fillStyle = 'rgba(16, 18, 24, 0.82)';
        ctx.fillRect(x - 1, y + BOX_H, BOX_W + 2, 12);
        const f = m.full > 0 ? Math.max(0, Math.min(1, m.strength / m.full)) : 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(x, y + BOX_H + 1, BOX_W, 2);
        ctx.fillStyle = f > 0.5 ? '#8bd17c' : f > 0.25 ? '#f1c40f' : '#e74c3c';
        ctx.fillRect(x, y + BOX_H + 1, Math.round(BOX_W * f), 2);
        ctx.fillStyle = '#ffe28a';
        ctx.fillText(text, x + BOX_W / 2, y + BOX_H + 3);
      }
      // The box, about its centre: at rest as it always was, on the way to T2 smaller and fainter.
      if (boxAlpha > 0.01) {
        ctx.globalAlpha = boxAlpha;
        if (morph.scale === 1) boxArt(ctx, m, x, y, colorOf, flagOf);
        else {
          // Shrinking, the box is a picture of itself, scaled smoothly. Scaling its parts would
          // make the pixels of the flag chip (drawn without smoothing) and of the hairlines snap
          // from one frame to the next: measured, a jump of 188 of 255.
          const key = `|${m.symbol}|${m.engaged ? 1 : 0}`;
          let sprite = sprites.get(key);
          if (!sprite) sprites.set(key, (sprite = boxSprite(m, colorOf, flagOf, dpr)));
          ctx.imageSmoothingEnabled = true;
          ctx.translate(x + BOX_W / 2, y + BOX_H / 2);
          ctx.scale(morph.scale, morph.scale);
          ctx.translate(-(x + BOX_W / 2), -(y + BOX_H / 2));
          ctx.drawImage(sprite, x - SPRITE_PAD, y - SPRITE_PAD, BOX_W + 2 * SPRITE_PAD, BOX_H + 2 * SPRITE_PAD);
          ctx.imageSmoothingEnabled = false;
        }
      }
      ctx.restore();
      placed.push({ id: m.id, nation: m.nation, wx: m.x, wy: m.y, alpha: boxAlpha, bar: barAlpha, scale: morph.scale, x: px - (BOX_W / 2) * size, y: py - (BOX_H / 2) * size, w: BOX_W * size, h: (BOX_H + 12) * size, text });
    }
  }
  // Major Battles: crossed swords.
  ctx.globalAlpha = boxAlpha;
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
