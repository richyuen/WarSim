/**
 * A countryball destroyed (PLAN 7.174e, ADR-777): where an element ends (an ElementDestroyed
 * event), its ball with crossed eyes, in over DEAD_IN_MS, held DEAD_HOLD_MS, faded over
 * DEAD_OUT_MS, sinking a little as it goes; drawn over its wreck (`fx/wrecks.ts`) on the Canvas2D
 * overlay, in the ball look only. Its nation is the element's in the snapshot before (the event
 * does not carry it); one the view did not hold is none.
 *
 * Nothing here is sim state: the balls live on the render clock, and a reload starts with none.
 */
import { EVENT_STRIDE, EventKind } from '../../shared/events';
import { SEAM_MARGIN, worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { BALL_R, eyeCentres, OUTLINE_RGB } from './ballShader';

export const DEAD_IN_MS = 150;
export const DEAD_HOLD_MS = 1200;
export const DEAD_OUT_MS = 1500;
export const DEAD_LIFE_MS = DEAD_IN_MS + DEAD_HOLD_MS + DEAD_OUT_MS;
/** How far it sinks over its life, in ball radii. */
export const DEAD_SINK = 0.25;
/** At most this many at once: a battle's end does not keep thousands on screen. */
export const MAX_DEAD_BALLS = 400;

/** A dead ball's opacity at `age` ms: in, held, out; 0 before and after. */
export function deadOpacity(age: number): number {
  if (age < 0 || age >= DEAD_LIFE_MS) return 0;
  if (age < DEAD_IN_MS) return age / DEAD_IN_MS;
  if (age < DEAD_IN_MS + DEAD_HOLD_MS) return 1;
  return 1 - (age - DEAD_IN_MS - DEAD_HOLD_MS) / DEAD_OUT_MS;
}

interface DeadBall {
  nation: number;
  x: number;
  y: number;
  born: number;
}

const OUTLINE = `rgb(${OUTLINE_RGB.map((c) => Math.round(c * 255)).join(', ')})`;

export class DeadBalls {
  balls: DeadBall[] = [];
  /** How many the last `draw` put on screen (tests). */
  shown = 0;
  private until = -Infinity;

  /** Takes the ElementDestroyed events of a snapshot that arrived at `now`; `nationOf` an element id's nation, or -1. */
  add(count: number, data: ArrayLike<number>, now: number, nationOf: (id: number) => number): void {
    this.balls = this.balls.filter((b) => now - b.born < DEAD_LIFE_MS);
    for (let i = 0; i < count; i++) {
      const o = i * EVENT_STRIDE;
      if (data[o + 2] !== EventKind.ElementDestroyed) continue;
      const nation = nationOf(data[o + 3]!);
      if (nation < 0) continue;
      this.balls.push({ nation, x: data[o + 5]!, y: data[o + 6]!, born: now });
      this.until = now + DEAD_LIFE_MS;
    }
    if (this.balls.length > MAX_DEAD_BALLS) this.balls.splice(0, this.balls.length - MAX_DEAD_BALLS);
  }

  clear(): void {
    this.balls.length = 0;
    this.until = -Infinity;
  }

  animating(now: number): boolean {
    return this.balls.length > 0 && now < this.until;
  }

  /** Draws them at `now` (in the CSS-px transform of `ctx`): `size` a ball's side in CSS px, `flagOf` a nation's flag. */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, geo: MapGeometry, vw: number, vh: number, now: number, alpha: number, size: number, flagOf: (nation: number) => CanvasImageSource): void {
    this.shown = 0;
    if (alpha <= 0.01 || this.balls.length === 0) return;
    const r = (size / 2) * BALL_R;
    const offs = wrapOffsets(cam, geo, vw, SEAM_MARGIN);
    ctx.save();
    ctx.lineCap = 'round';
    for (const b of this.balls) {
      const age = now - b.born;
      const opacity = deadOpacity(age) * alpha;
      if (opacity <= 0) continue;
      for (const off of offs) {
        const [sx, y0] = worldToScreen(cam, b.x + off, b.y, vw, vh);
        const sy = y0 + DEAD_SINK * r * Math.min(1, age / DEAD_LIFE_MS);
        if (sx < -size || sx > vw + size || sy < -size || sy > vh + size) continue;
        this.shown++;
        ctx.globalAlpha = opacity;
        ctx.save();
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(flagOf(b.nation), sx - r, sy - r, 2 * r, 2 * r);
        ctx.restore();
        ctx.strokeStyle = OUTLINE;
        ctx.lineWidth = Math.max(1, 0.08 * r);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.stroke();
        // Crossed eyes where the eyes were, facing nowhere.
        ctx.lineWidth = Math.max(1, 0.12 * r);
        const e = 0.13 * size;
        for (const [ex, ey] of eyeCentres(0).map(([x, y]) => [x - 0.3, y] as const)) {
          const cx = sx + (ex * size) / 2;
          const cy = sy + (ey * size) / 2;
          ctx.beginPath();
          ctx.moveTo(cx - e / 2, cy - e / 2);
          ctx.lineTo(cx + e / 2, cy + e / 2);
          ctx.moveTo(cx + e / 2, cy - e / 2);
          ctx.lineTo(cx - e / 2, cy + e / 2);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
}
