/**
 * Tanks burn where they are lost (SPEC §8 "Effects", PLAN 3.6d, ADR-162). An element of tanks is
 * its tanks at T3, one figure each, and a loss takes the last figure of its order away
 * (`render/units/individuals`). The tank that leaves an element between two snapshots leaves a
 * hull on its place. Lost in an hour in which its element was fired at, it burns: flame for a
 * while, smoke after, then gone. Lost otherwise (broken down on a march without supply, PLAN
 * 3.2d, or to attrition) it was left behind: a hull that stands for as long and does not burn.
 *
 * From two snapshots of the same element, on the render clock: nothing here is sim state,
 * drawing changes nothing, and a reload starts with none.
 * - Only for an element that both snapshots hold. One first seen (the camera came, or it did)
 *   has lost nothing the view saw. One that is gone has left the view's box or is destroyed, and
 *   a destroyed element leaves its wreck (`WreckFx`), not its last tanks.
 * - A snapshot of the same tick (a pause, a new subscription) has the same strengths: no hull.
 */
import { Frame, turretOf } from '../../shared/unitLooks';
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { hash2, pair } from '../hash';
import { ANIM_TAIL_MS, smooth } from '../timing';
import { figureCells, figureCount, figureOffsets, gridSide } from '../units/individuals';

/** ms: a hull burns, then smokes, then fades. */
export const FLAME_MS = 6_000;
export const SMOKE_MS = 9_000;
export const HULL_OUT_MS = 2_500;
export const HULL_LIFE_MS = FLAME_MS + SMOKE_MS + HULL_OUT_MS;
/** The flame dies down over the last of its time. */
const FLAME_END_MS = 1_500;
/** Hulls held at once; beyond it the oldest go. */
export const MAX_HULLS = 2000;
/** One rise of a puff of smoke, ms, and the puffs of a hull. */
const PUFF_MS = 1900;
const PUFFS = 3;
/** Opacity of a puff over the four quarters of its rise. */
const PUFF_ALPHA = [0.5, 0.38, 0.24, 0.1] as const;
/** The tongues of a hull's flame, and one flicker of a tongue, ms. */
const TONGUES = 3;
const FLICKER_MS = 230;
/** Length × width of a burnt hull by its frame's place among the hulls (light, medium, heavy), shares of the figure's side. */
const HULL_SHAPE: readonly (readonly [number, number])[] = [[0.62, 0.4], [0.78, 0.5], [0.88, 0.62]];
const TAU = Math.PI * 2;

/** The part of a snapshot's elements a loss is read from. */
export interface HullElements {
  count: number;
  id: ArrayLike<number>;
  formation: ArrayLike<number>;
  frame: ArrayLike<number>;
  strength: ArrayLike<number>;
  size: ArrayLike<number>;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  facing: ArrayLike<number>;
  /** 1 where the element was fired at since the snapshot before (`SnapshotElements.hit`). */
  hit: ArrayLike<number>;
}

export interface BurningHull {
  /** The element that lost it, and which of its figures it was. */
  element: number;
  figure: number;
  /** Cells: where the figure stood. */
  x: number;
  y: number;
  /** The hull's facing, radians, and how far its turret was thrown round (presentation only). */
  facing: number;
  askew: number;
  /** The hull's frame, and the side of its figure in cells. */
  frame: number;
  cells: number;
  /** Whether it was lost under fire: it burns. False: it was left behind. */
  burns: boolean;
  /** ms on the render clock. */
  born: number;
}

/**
 * The tanks the elements of `after` have lost since `before`: for each element of tanks in
 * both, the figures it had and has no more, where they stood in `before`. `after.hit` says
 * whether an element was fired at between the two.
 */
export function tanksLost(before: HullElements, after: HullElements, now: number): BurningHull[] {
  const out: BurningHull[] = [];
  if (before.count === 0 || after.count === 0) return out;
  const index = new Map<number, number>();
  for (let i = 0; i < before.count; i++) if (turretOf(before.frame[i]!) >= 0) index.set(before.id[i]!, i);
  if (index.size === 0) return out;
  for (let j = 0; j < after.count; j++) {
    const id = after.id[j]!;
    const i = index.get(id);
    // The same element: an id is another element's after a load.
    if (i === undefined || after.frame[j] !== before.frame[i] || after.formation[j] !== before.formation[i] || after.size[j] !== before.size[i]) continue;
    const size = before.size[i]!;
    const had = figureCount(before.strength[i]!, size);
    const has = figureCount(after.strength[j]!, size);
    if (has >= had) continue;
    const frame = before.frame[i]!;
    const side = gridSide(frame, figureCount(size, size));
    const facing = before.facing[i]!;
    const off = figureOffsets(id, side, had, facing);
    const burns = after.hit[j] === 1;
    for (let k = has; k < had; k++) {
      // A turret is thrown round by what set its tank on fire; a tank left behind has its own in line.
      const [turn] = pair(hash2(hash2(id, k), 0x68756c));
      out.push({ element: id, figure: k, x: before.x[i]! + off[k * 2]!, y: before.y[i]! + off[k * 2 + 1]!, facing, askew: burns ? turn * 1.2 : 0, frame, cells: figureCells(side), burns, born: now });
    }
  }
  return out;
}

/** How bright a hull's flame is at `now`, 0–1: full, then down over the last of its time. 0 = out, or none. */
export function flameOf(h: BurningHull, now: number): number {
  const age = Math.max(0, now - h.born);
  if (!h.burns || age >= FLAME_MS) return 0;
  return age < FLAME_MS - FLAME_END_MS ? 1 : 1 - smooth((age - (FLAME_MS - FLAME_END_MS)) / FLAME_END_MS);
}

/** Opacity of a hull at `now`: there at once (its tank stood there the frame before), out at the end. 0 = gone. */
export function hullOpacity(h: BurningHull, now: number): number {
  const age = Math.max(0, now - h.born);
  if (age >= HULL_LIFE_MS) return 0;
  const out = age - FLAME_MS - SMOKE_MS;
  return out > 0 ? 1 - smooth(out / HULL_OUT_MS) : 1;
}

export class HullFx {
  hulls: BurningHull[] = [];
  /** What the last `draw` put on screen (tests): the hulls, and how many of them with a flame. */
  shown: BurningHull[] = [];
  flames = 0;
  /** When the last hull is gone. */
  until = -Infinity;

  /**
   * Takes the elements of a snapshot that arrived at `now` and those of the snapshot before it
   * (null: there was none, or the camera was too far out to keep it). Returns the hulls it made.
   */
  add(before: HullElements | null, after: HullElements, now: number): number {
    // Hulls that have faded leave here, and only here.
    let kept = 0;
    for (const h of this.hulls) if (now < h.born + HULL_LIFE_MS) this.hulls[kept++] = h;
    this.hulls.length = kept;
    if (!before) return 0;
    const lost = tanksLost(before, after, now);
    if (lost.length === 0) return 0;
    this.hulls.push(...lost);
    this.until = now + HULL_LIFE_MS;
    if (this.hulls.length > MAX_HULLS) this.hulls.splice(0, this.hulls.length - MAX_HULLS);
    return lost.length;
  }

  /** Another game is shown from here on (a load): the hulls of the one before are not its own. */
  clear(): void {
    this.hulls.length = 0;
    this.until = -Infinity;
  }

  /** Whether a hull is still to be drawn at `now`. No lower bound on `now`, as for the wrecks. */
  animating(now: number): boolean {
    return this.hulls.length > 0 && now < this.until + ANIM_TAIL_MS;
  }

  /**
   * Draws the hulls at `now` (already in the CSS-px transform of `ctx`): `alpha` is the opacity
   * of the figures, a figure is at least `minPx` CSS px, and `size` is the unit-size setting.
   * Pure: the same `now` draws the same frame.
   */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, geo: MapGeometry, vw: number, vh: number, now: number, alpha: number, minPx: number, size = 1): void {
    this.shown.length = 0;
    this.flames = 0;
    if (alpha <= 0.01 || this.hulls.length === 0 || now >= this.until) return;
    const offs = wrapOffsets(cam, geo, vw);
    // Burnt hulls and those left behind: [hulls, turrets] of each.
    const solid = [[new Path2D(), new Path2D()], [new Path2D(), new Path2D()]] as const;
    const fading: { hull: Path2D; turret: Path2D; burnt: boolean; opacity: number }[] = [];
    const puffs = PUFF_ALPHA.map(() => new Path2D());
    const glow = new Path2D();
    const fire = new Path2D();
    const core = new Path2D();
    const disc = (p: Path2D, x: number, y: number, r: number): void => {
      p.moveTo(x + r, y);
      p.arc(x, y, r, 0, TAU);
    };
    for (const h of this.hulls) {
      const opacity = hullOpacity(h, now);
      if (opacity <= 0) continue;
      // The side of the figure's sprite in CSS px: the shader's rule.
      const s = Math.max(h.cells * cam.scale, minPx) * size;
      const margin = 4 * s;
      const flame = flameOf(h, now);
      const age = now - h.born;
      let seen = false;
      for (const off of offs) {
        const [x, y] = worldToScreen(cam, h.x + off, h.y, vw, vh);
        if (x < -margin || x > vw + margin || y < -margin || y > vh + margin) continue;
        seen = true;
        const whole = opacity >= 0.999;
        const hull = whole ? solid[h.burns ? 0 : 1][0] : new Path2D();
        const turret = whole ? solid[h.burns ? 0 : 1][1] : new Path2D();
        outline(hull, turret, h, x, y, s);
        if (!whole) fading.push({ hull, turret, burnt: h.burns, opacity });
        // Smoke for as long as a burnt hull is whole: thick over the flame, thinner after.
        if (h.burns && opacity > 0.5) {
          for (let k = 0; k < PUFFS; k++) {
            const t = (age / PUFF_MS + k / PUFFS + (hash2(h.element, h.figure) & 255) / 256) % 1;
            const rise = t < 0 ? t + 1 : t;
            const thick = flame > 0 ? 1 : 0.7;
            disc(puffs[Math.min(PUFF_ALPHA.length - 1, Math.floor(rise * PUFF_ALPHA.length))]!, x + 0.5 * s * rise, y - (0.15 + 1.5 * rise) * s, (0.16 + 0.34 * rise) * s * thick);
          }
        }
        if (flame > 0) {
          const c = Math.cos(h.facing);
          const sn = Math.sin(h.facing);
          disc(glow, x, y, 0.42 * s * flame);
          for (let k = 0; k < TONGUES; k++) {
            // Each tongue at a place of its own along the hull, flickering at its own beat.
            const [px, ph] = pair(hash2(hash2(h.element, h.figure), 0x666c + k));
            const beat = 0.5 + 0.5 * Math.sin((age / (FLICKER_MS * (1 + 0.25 * k)) + ph) * TAU);
            const r = s * (0.1 + 0.09 * beat) * flame;
            const along = px * 0.2 * s;
            const fx = x + c * along;
            const fy = y + sn * along - r * 0.6;
            disc(fire, fx, fy, r);
            disc(core, fx, fy + r * 0.25, r * 0.5);
          }
          this.flames++;
        }
      }
      if (seen) this.shown.push(h);
    }
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
    // Burnt: black iron with a rust edge. Left behind: the grey of bare steel, a dark edge.
    const paint = (hull: Path2D, turret: Path2D, burnt: boolean): void => {
      ctx.fillStyle = burnt ? 'rgba(24, 21, 19, 0.96)' : 'rgba(104, 106, 100, 0.96)';
      ctx.strokeStyle = burnt ? 'rgba(150, 84, 44, 0.8)' : 'rgba(26, 26, 28, 0.9)';
      ctx.fill(hull);
      ctx.stroke(hull);
      ctx.fillStyle = burnt ? 'rgba(52, 44, 38, 0.96)' : 'rgba(132, 134, 126, 0.96)';
      ctx.fill(turret);
      ctx.stroke(turret);
    };
    ctx.globalAlpha = alpha;
    paint(solid[0][0], solid[0][1], true);
    paint(solid[1][0], solid[1][1], false);
    for (const f of fading) {
      ctx.globalAlpha = alpha * f.opacity;
      paint(f.hull, f.turret, f.burnt);
    }
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = 'rgb(255, 120, 20)';
    ctx.fill(glow);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgb(255, 150, 30)';
    ctx.fill(fire);
    ctx.fillStyle = 'rgb(255, 236, 150)';
    ctx.fill(core);
    for (let q = 0; q < PUFF_ALPHA.length; q++) {
      ctx.globalAlpha = alpha * PUFF_ALPHA[q]!;
      ctx.fillStyle = 'rgb(38, 35, 34)';
      ctx.fill(puffs[q]!);
    }
    ctx.restore();
  }
}

/** Adds a burnt hull of `h` at (x, y), its figure `s` px across, to `hull`, and its turret, thrown round, to `turret`. */
function outline(hull: Path2D, turret: Path2D, h: BurningHull, x: number, y: number, s: number): void {
  const [len, wid] = HULL_SHAPE[weightOf(h.frame)]!;
  const hl = (len * s) / 2;
  const hw = (wid * s) / 2;
  const c = Math.cos(h.facing);
  const sn = Math.sin(h.facing);
  hull.moveTo(x + hl * c - hw * sn, y + hl * sn + hw * c);
  hull.lineTo(x - hl * c - hw * sn, y - hl * sn + hw * c);
  hull.lineTo(x - hl * c + hw * sn, y - hl * sn - hw * c);
  hull.lineTo(x + hl * c + hw * sn, y + hl * sn - hw * c);
  hull.closePath();
  // The turret: its ring and its gun, off the hull's line.
  const a = h.facing + h.askew;
  const r = hw * 0.62;
  turret.moveTo(x + r, y);
  turret.arc(x, y, r, 0, TAU);
  const gc = Math.cos(a);
  const gs = Math.sin(a);
  const g0 = r * 0.9;
  const g1 = hl * 1.05;
  const gw = Math.max(0.5, hw * 0.16);
  turret.moveTo(x + gc * g0 - gs * gw, y + gs * g0 + gc * gw);
  turret.lineTo(x + gc * g1 - gs * gw, y + gs * g1 + gc * gw);
  turret.lineTo(x + gc * g1 + gs * gw, y + gs * g1 - gc * gw);
  turret.lineTo(x + gc * g0 + gs * gw, y + gs * g0 - gc * gw);
  turret.closePath();
}

/** 0, 1, 2 for a light, a medium and a heavy tank's hull. */
function weightOf(frame: number): number {
  return frame === Frame.tankHeavy ? 2 : frame === Frame.tankMedium ? 1 : 0;
}
