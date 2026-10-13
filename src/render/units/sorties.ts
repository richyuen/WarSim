/**
 * Sorties in flight (PLAN 5.7a, SPEC §8: "sorties in flight"): each sortie of the snapshot drawn
 * as planes of its nation's colour where `sortieAt` has it at the frame's time, heading its way;
 * one over its target circles there (a patrol over its zone). The place is the sim's function of
 * the sortie's launch, so a frame between two ticks is where the sortie is then, not a guess. One
 * plane for a few aircraft, up to three in a vee; a bomber's larger than a fighter's. T0 to T2.
 */
import { SORTIE_STRIDE, SortieRole } from '../../shared/protocol';
import { Leg, sortieAt, type Sortie } from '../../shared/sorties';
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';

/** A plane's span, CSS px (before the unit size), by role: a fighter's, a bomber's. */
export const PLANE_PX = [13, 14, 16, 19, 15, 16] as const;
/** The mean radius of a sortie's circle over its target (0.7 to 1.3 of it, by the sortie), cells, and the hours it takes to go round. */
export const ORBIT_CELLS = 0.6;
export const ORBIT_HOURS = 0.5;
/** The least mean radius of that circle on screen, CSS px (before the unit size): at T0 and T1 a cell is a few px. */
export const ORBIT_MIN_PX = 26;
/** Planes are their full size from this zoom (px a cell, T1) in, and no less than `ZOOM_LEAST` of it further out. */
export const ZOOM_FULL = 6;
export const ZOOM_LEAST = 0.55;

/** The planes' size at zoom `scale` (px a cell): 1 from `ZOOM_FULL` in, down to `ZOOM_LEAST` further out. */
export const planeZoom = (scale: number): number => Math.min(1, Math.max(ZOOM_LEAST, scale / ZOOM_FULL));

/** A placed sortie (for tests): its place on screen, its heading (rad, screen), its leg. */
export interface PlacedSortie {
  x: number;
  y: number;
  heading: number;
  leg: Leg;
  planes: number;
}

/** Planes drawn for a wing of `aircraft`: one, two or three. */
export const planesOf = (aircraft: number): number => (aircraft >= 24 ? 3 : aircraft >= 10 ? 2 : 1);

/**
 * Where sortie row `i` of `rows` is at `t` (hours from the snapshot's tick) on a map `w` cells
 * round: its place (cells) and heading (rad, east 0, south π/2); null when it is home.
 */
export function sortiePlace(rows: ArrayLike<number>, i: number, t: number, w: number): { x: number; y: number; heading: number; leg: Leg; orbit?: { cx: number; cy: number; angle: number; share: number } } | null {
  const s: Sortie = { bx: rows[i]!, by: rows[i + 1]!, tx: rows[i + 2]!, ty: rows[i + 3]!, launch: rows[i + 4]!, kmh: rows[i + 5]!, km: rows[i + 6]!, over: rows[i + 7]! };
  const p = sortieAt(s, t, w);
  if (p.leg === Leg.Home) return null;
  let dx = s.tx - s.bx;
  if (dx > w / 2) dx -= w;
  else if (dx < -w / 2) dx += w;
  const out = Math.atan2(s.ty - s.by, dx);
  if (p.leg === Leg.Over) {
    // Round its target: where on the circle by the time it has been there, from a phase and a
    // radius of its own (by its base and launch), so that sorties over one target spread round it.
    const own = s.bx * 12.9898 + s.by * 78.233 + s.launch * 3.7;
    const phase = (own - Math.floor(own)) * Math.PI * 2;
    const f = (((own * 7.31) % 1) + 1) % 1;
    const r = ORBIT_CELLS * (0.7 + 0.6 * f);
    const a = out + phase + ((t - s.launch) / ORBIT_HOURS) * Math.PI * 2;
    return { x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a), heading: a + Math.PI / 2, leg: p.leg, orbit: { cx: p.x, cy: p.y, angle: a, share: 0.7 + 0.6 * f } };
  }
  return { x: p.x, y: p.y, heading: p.leg === Leg.Out ? out : out + Math.PI, leg: p.leg };
}

/** One plane: fuselage, wings and tail, its nose along `heading`. */
function plane(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, span: number): void {
  const h = span / 2;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.beginPath();
  ctx.moveTo(h, 0); // nose
  ctx.lineTo(h * 0.2, -h * 0.12);
  ctx.lineTo(0, -h); // wing tip
  ctx.lineTo(-h * 0.2, -h * 0.12);
  ctx.lineTo(-h * 0.7, -h * 0.1);
  ctx.lineTo(-h * 0.9, -h * 0.45); // tail
  ctx.lineTo(-h, 0);
  ctx.lineTo(-h * 0.9, h * 0.45);
  ctx.lineTo(-h * 0.7, h * 0.1);
  ctx.lineTo(-h * 0.2, h * 0.12);
  ctx.lineTo(0, h);
  ctx.lineTo(h * 0.2, h * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws the sorties of `rows` (a snapshot's, SORTIE_STRIDE each) at `t` hours from its tick, at
 * `alpha`, each in its nation's colour (`colour`); returns them placed on screen, for tests.
 */
export function drawSorties(
  ctx: CanvasRenderingContext2D,
  rows: ArrayLike<number>,
  t: number,
  cam: Camera,
  geo: MapGeometry,
  vw: number,
  vh: number,
  alpha: number,
  colour: (nation: number) => string,
  size = 1,
): PlacedSortie[] {
  const out: PlacedSortie[] = [];
  if (alpha <= 0.01 || rows.length === 0) return out;
  const offs = wrapOffsets(cam, geo, vw);
  // Smaller the further out: at T0 (a cell a px or two) a plane is half its T1 size.
  size *= planeZoom(cam.scale);
  ctx.save();
  ctx.globalAlpha = alpha;
  // A light edge and a shadow: a plane is seen over its own nation's land, of its own colour.
  ctx.lineWidth = 1.25;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 3;
  for (let i = 0; i + SORTIE_STRIDE <= rows.length; i += SORTIE_STRIDE) {
    const at = sortiePlace(rows, i, t, geo.w);
    if (!at) continue;
    const role = rows[i + 10]!;
    const span = (PLANE_PX[role] ?? PLANE_PX[SortieRole.fighter]) * size;
    const n = planesOf(rows[i + 9]!);
    for (const off of offs) {
      let [x, y] = worldToScreen(cam, at.x + off, at.y, vw, vh);
      if (at.orbit) {
        // Its circle no smaller on screen than ORBIT_MIN_PX × its share.
        const [ox, oy] = worldToScreen(cam, at.orbit.cx + off, at.orbit.cy, vw, vh);
        const r = Math.max(ORBIT_CELLS * at.orbit.share * cam.scale, ORBIT_MIN_PX * at.orbit.share * size);
        [x, y] = [ox + r * Math.cos(at.orbit.angle), oy + r * Math.sin(at.orbit.angle)];
      }
      if (x < -3 * span || y < -3 * span || x > vw + 3 * span || y > vh + 3 * span) continue;
      out.push({ x, y, heading: at.heading, leg: at.leg, planes: n });
      // A short trail behind it.
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - Math.cos(at.heading) * span * 2.2, y - Math.sin(at.heading) * span * 2.2);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = colour(rows[i + 8]!);
      // A vee: the leader, then one either side behind it.
      const back = span * 0.9;
      const side = span * 0.8;
      const cos = Math.cos(at.heading);
      const sin = Math.sin(at.heading);
      for (let k = 0; k < n; k++) {
        const b = k === 0 ? 0 : back;
        const sgn = k === 1 ? -1 : k === 2 ? 1 : 0;
        plane(ctx, x - cos * b - sin * side * sgn, y - sin * b + cos * side * sgn, at.heading, span);
      }
    }
  }
  ctx.restore();
  return out;
}
