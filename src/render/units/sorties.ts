/**
 * Sorties in flight (PLAN 5.7a, SPEC §8: "sorties in flight"): each sortie of the snapshot drawn
 * as planes of its nation's colour where `sortieAt` has it at the frame's time, heading its way;
 * one over its target circles there (a patrol over its zone). The place is the sim's function of
 * the sortie's launch, so a frame between two ticks is where the sortie is then, not a guess. One
 * plane for a few aircraft, up to three in a vee; a bomber's larger than a fighter's. Every tier;
 * at T3 a plane is PLANE_MEN men's figures wide (PLAN 7.51a), and from HAND_FAR_MPP in it gives way
 * to the plane at its wingspan (PLAN 7.108a).
 */
import { SORTIE_STRIDE, SortieRole } from '../../shared/protocol';
import { Leg, sortieAt, type Sortie } from '../../shared/sorties';
import { worldToScreen, itemOffsets, type Camera, type MapGeometry } from '../camera';
import { sizeScale } from '../sizeScale';
import { LINE_CELLS } from './individuals';

/** A plane's span, CSS px (before the unit size), by role: a fighter's, a bomber's. */
export const PLANE_PX = [13, 14, 16, 19, 15, 16] as const;
/** The mean radius of a sortie's circle over its target (0.7 to 1.3 of it, by the sortie), cells, and the hours it takes to go round. */
export const ORBIT_CELLS = 0.6;
export const ORBIT_HOURS = 0.5;
/** The least mean radius of that circle on screen, CSS px (before the unit size): at T0 and T1 a cell is a few px. */
export const ORBIT_MIN_PX = 26;
/** The greatest mean radius of that circle on screen, a share of the view's smaller half side (PLAN 7.24c). */
export const ORBIT_VIEW = 0.6;
/** Planes are their full size from this zoom (px a cell, T1) in, and no less than `ZOOM_LEAST` of it further out. */
export const ZOOM_FULL = 6;
export const ZOOM_LEAST = 0.55;

/**
 * A fighter's span at T3 in figures of a man of a firing line (`LINE_CELLS`), a bomber's by its
 * PLANE_PX against a fighter's (PLAN 7.51a, ADR-609). The critic's run 11: at 10 m/px a plane was
 * its 13–19 px, three men's figures, "the size of a squad". Further out the PLANE_PX floor holds:
 * this is over it from about 18 m/px in, so T0 to T2 are as they were.
 */
export const PLANE_MEN = 5;

/** A plane's span, CSS px, of `role` at zoom `scale` (px a cell) and unit size `unit`: its PLANE_PX (`planeZoom` taken), and at T3 PLANE_MEN men's figures. */
export function planeSpan(role: number, scale: number, unit = 1): number {
  const px = PLANE_PX[role] ?? PLANE_PX[SortieRole.fighter];
  return Math.max(px * unit * planeZoom(scale), (PLANE_MEN * px * LINE_CELLS * sizeScale * scale * unit) / PLANE_PX[SortieRole.fighter]);
}

/**
 * A plane's wingspan, metres, by role (PLAN 7.108a): a Bf 109's, a Ju 87's, an He 111's, a B-17's,
 * a B5N's, a Ju 52's. At close zoom a plane is drawn at it: the symbol above, five men's figures
 * wide, was about 450 m across, "larger than a company" at 3 m/px (critic run 13).
 */
export const WINGSPAN_M = [9.9, 13.8, 22.6, 31.6, 15.5, 29.3] as const;
/** m/px where the handover from the symbol to the plane at its wingspan starts (none of it drawn) and ends (all of it). */
export const HAND_FAR_MPP = 8;
export const HAND_NEAR_MPP = 4;
/** A plane narrower than this, CSS px, is drawn without its edge and blur (`vee`). */
export const SMALL_PLANE_PX = 12;

/** The share of a plane drawn at its wingspan at `mpp` metres a px: 0 from HAND_FAR_MPP out, 1 from HAND_NEAR_MPP in, smooth in log m/px between. */
export function planeHandover(mpp: number): number {
  const f = Math.min(1, Math.max(0, Math.log(HAND_FAR_MPP / mpp) / Math.log(HAND_FAR_MPP / HAND_NEAR_MPP)));
  return f * f * (3 - 2 * f);
}

/** A plane's span at its wingspan, CSS px, of `role` at `mpp` metres a px and unit size `unit`. */
export const trueSpan = (role: number, mpp: number, unit = 1): number => ((WINGSPAN_M[role] ?? WINGSPAN_M[SortieRole.fighter]) * unit) / mpp;

/** The air's marks' size (`AirFx.draw`): a fighter's span against its PLANE_PX, so that a fight is the size of its planes. */
export const airFxSize = (scale: number, unit = 1): number => planeSpan(SortieRole.fighter, scale, unit) / PLANE_PX[SortieRole.fighter];

/** The planes' size at zoom `scale` (px a cell): 1 from `ZOOM_FULL` in, down to `ZOOM_LEAST` further out. */
export const planeZoom = (scale: number): number => Math.min(1, Math.max(ZOOM_LEAST, scale / ZOOM_FULL));

/** A placed sortie (for tests): its place on screen, its heading (rad, screen), its leg; each plane's middle and the span. */
export interface PlacedSortie {
  x: number;
  y: number;
  heading: number;
  leg: Leg;
  planes: number;
  nation: number;
  /** The span of the drawing that is most of it (the symbol's below a handover of 0.5, else the wingspan's); `at` its planes. */
  span: number;
  at: [number, number][];
  /** The share drawn at the wingspan (`planeHandover`), and that span, CSS px. */
  handover: number;
  trueSpan: number;
  /** Its role (`SortieRole`). */
  role: number;
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
    const r = ORBIT_CELLS * sizeScale * (0.7 + 0.6 * f);
    const a = out + phase + ((t - s.launch) / ORBIT_HOURS) * Math.PI * 2;
    return { x: p.x + r * Math.cos(a), y: p.y + r * Math.sin(a), heading: a + Math.PI / 2, leg: p.leg, orbit: { cx: p.x, cy: p.y, angle: a, share: 0.7 + 0.6 * f } };
  }
  return { x: p.x, y: p.y, heading: p.leg === Leg.Out ? out : out + Math.PI, leg: p.leg };
}

/** One plane: fuselage, wings and tail, its nose along `heading`; its edge under its fill, so a small plane is its colour (PLAN 7.51a: the edge over it made it white). */
function plane(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, span: number, edge = true): void {
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
  if (edge) ctx.stroke();
  ctx.fill();
  ctx.restore();
}

/**
 * Draws the sorties of `rows` (a snapshot's, SORTIE_STRIDE each) at `t` hours from its tick, at
 * `alpha`, each in its nation's colour (`colour`: its sprites' tint); returns them placed on
 * screen, for tests. `close`, the share of T3's figures: there a plane's edge is dark, as a
 * figure's, against the ground (PLAN 7.51a); further out light, against its nation's fill.
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
  close = 0,
): PlacedSortie[] {
  const unit = size;
  const out: PlacedSortie[] = [];
  if (alpha <= 0.01 || rows.length === 0) return out;
  const offs = itemOffsets(cam, geo, vw);
  // Smaller the further out: at T0 (a cell a px or two) a plane is half its T1 size.
  size *= planeZoom(cam.scale);
  // Close in, the symbol gives way to the plane at its wingspan (PLAN 7.108a), crossfaded.
  const mpp = (geo.kmPerCell * 1000) / cam.scale;
  const hand = planeHandover(mpp);
  ctx.save();
  // A light edge and a shadow: a plane is seen over its own nation's land, of its own colour.
  const edge = close >= 0.5 ? 'rgba(20, 20, 20, 0.9)' : 'rgba(255, 255, 255, 0.95)';
  ctx.strokeStyle = edge;
  for (let i = 0; i + SORTIE_STRIDE <= rows.length; i += SORTIE_STRIDE) {
    // The short way round only where the map loops.
    const at = sortiePlace(rows, i, t, geo.wrapX ? geo.w : 0);
    if (!at) continue;
    const role = rows[i + 10]!;
    const symbol = planeSpan(role, cam.scale, unit);
    const wing = trueSpan(role, mpp, unit);
    const span = Math.max(symbol, wing);
    const n = planesOf(rows[i + 9]!);
    for (const off of offs) {
      let [x, y] = worldToScreen(cam, at.x + off, at.y, vw, vh);
      if (at.orbit) {
        // Its circle no smaller on screen than ORBIT_MIN_PX × its share, and no larger than
        // ORBIT_VIEW of the view's half side (PLAN 7.24c): at T3 its 12 km went off the screen
        // over the fight it watches. The circle is the page's; the sim's place is its middle.
        const [ox, oy] = worldToScreen(cam, at.orbit.cx + off, at.orbit.cy, vw, vh);
        const r = Math.min(Math.max(ORBIT_CELLS * sizeScale * at.orbit.share * cam.scale, ORBIT_MIN_PX * at.orbit.share * size), (ORBIT_VIEW * at.orbit.share * Math.min(vw, vh)) / 2);
        [x, y] = [ox + r * Math.cos(at.orbit.angle), oy + r * Math.sin(at.orbit.angle)];
      }
      if (x < -3 * span || y < -3 * span || x > vw + 3 * span || y > vh + 3 * span) continue;
      const placed: PlacedSortie = { x, y, heading: at.heading, leg: at.leg, planes: n, nation: rows[i + 8]!, span: hand < 0.5 ? symbol : wing, at: [], handover: hand, trueSpan: wing, role };
      out.push(placed);
      ctx.fillStyle = colour(rows[i + 8]!);
      // The symbol, then the plane at its wingspan, each at its share of the handover.
      if (hand < 1) vee(ctx, x, y, at.heading, n, symbol, alpha * (1 - hand), hand < 0.5 ? placed.at : null);
      if (hand > 0) vee(ctx, x, y, at.heading, n, wing, alpha * hand, hand < 0.5 ? null : placed.at);
    }
  }
  ctx.restore();
  return out;
}

/** A wing's planes of `span` at `alpha` with a short trail: a vee, the leader, then one either side behind it; each plane's middle into `at`. */
function vee(ctx: CanvasRenderingContext2D, x: number, y: number, heading: number, n: number, span: number, alpha: number, at: [number, number][] | null): void {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  // A plane under SMALL_PLANE_PX (one at its wingspan, close in) has no edge and no blur, or they
  // are all of it: its fill alone, and its shadow cast to the side on the ground below.
  const small = span < SMALL_PLANE_PX;
  ctx.lineWidth = small ? Math.max(0.5, span * 0.3) : 1.25;
  ctx.shadowBlur = small ? 0 : 3;
  ctx.shadowOffsetX = small ? span * 0.5 : 0;
  ctx.shadowOffsetY = small ? span * 0.7 : 0;
  ctx.shadowColor = small ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.75)';
  const cos = Math.cos(heading);
  const sin = Math.sin(heading);
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - cos * span * 2.2, y - sin * span * 2.2);
  ctx.stroke();
  ctx.restore();
  const back = span * 0.9;
  const side = span * 0.8;
  for (let k = 0; k < n; k++) {
    const b = k === 0 ? 0 : back;
    const sgn = k === 1 ? -1 : k === 2 ? 1 : 0;
    const [px, py] = [x - cos * b - sin * side * sgn, y - sin * b + cos * side * sgn];
    at?.push([px, py]);
    plane(ctx, px, py, heading, span, !small);
  }
}
