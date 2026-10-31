/**
 * A countryball on a Canvas2D overlay (PLAN 7.174f, ADR-777): the T0 counters, the T1 markers and
 * the planes in flight in the ball look, drawn as the shader draws an element's ball
 * (`ballShader.ts`): its flag in a disc, darker to the rim, a dark outline, two white eyes on the
 * side it faces, and a prop for what it stands for (a helmet, treads, wheels, wings, a hull).
 */
import { BALL_R, EYE_GAP, EYE_RX, EYE_RY, EYES_ACROSS, EYES_UP, HELMET_RGB, HULL_RGB, OUTLINE_RGB, STEEL_RGB, TREAD_RGB, WING_RGB } from './ballShader';

/** A 2D ball's wings, ball units: deeper than the shader's, a plane's ball being a few px. */
export const WING_Y = 0.12;
export const WING_RX = 1.6;
export const WING_RY = 0.32;

/** What a 2D ball wears. */
export type Prop2d = 'none' | 'helmet' | 'treads' | 'wheels' | 'wings' | 'hull';

const css = (c: readonly number[]): string => `rgb(${c.map((v) => Math.round(v * 255)).join(', ')})`;
const OUTLINE = css(OUTLINE_RGB);
const HELMET = css(HELMET_RGB);
const TREAD = css(TREAD_RGB);
const STEEL = css(STEEL_RGB);
const WING = css(WING_RGB);
const HULL = css(HULL_RGB);

/** A ball's look on the overlay. */
export interface Ball2d {
  /** The flag, or null for a ball of its tint alone. */
  flag: CanvasImageSource | null;
  /** Its tint, a CSS colour, under the flag (seen where there is none). */
  tint: string;
  /** +1: its eyes to the right; -1: to the left. */
  look: 1 | -1;
  prop: Prop2d;
  /** A red ring about it: its formation in contact. */
  engaged?: boolean;
}

/**
 * Draws a ball of radius `r` CSS px about (x, y): the ball's own radius, BALL_R of half the side of
 * the shader's sprite. Below 3 px a flag dot with its outline; eyes from 4 px.
 */
export function drawBall2d(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, b: Ball2d): void {
  const u = r / BALL_R; // px a ball unit
  const lw = Math.max(1, 0.1 * r);
  ctx.save();
  ctx.lineJoin = 'round';
  // No shadow of the caller's (a plane's): one part's shadow fell on the next, the wings greyed.
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  // Behind the ball.
  if (b.prop === 'wings') {
    ctx.fillStyle = WING;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(x, y + WING_Y * u, WING_RX * u, WING_RY * u, 0, 0, Math.PI * 2);
    ctx.fill();
    // A small plane's wings are a px or two deep: their colour, not their edge.
    if (r >= 6) ctx.stroke();
  } else if (b.prop === 'treads') {
    ctx.fillStyle = TREAD;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    roundRect(ctx, x - 1.12 * u, y + 0.5 * u, 2.24 * u, 0.62 * u, 0.22 * u);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = STEEL;
    for (let k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.arc(x + k * 0.42 * u, y + 0.91 * u, 0.13 * u, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (b.prop === 'wheels') {
    ctx.fillStyle = TREAD;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    for (const k of [-0.55, 0.55]) {
      ctx.beginPath();
      ctx.arc(x + k * u, y + 0.82 * u, 0.3 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // The ball: the tint, the flag in a disc, shaded round.
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = b.tint;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  if (b.flag) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(b.flag, x - r, y - r, 2 * r, 2 * r);
  }
  const shade = ctx.createRadialGradient(x - 0.4 * r, y - 0.45 * r, 0, x, y, r);
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.16)');
  shade.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(0.75, 'rgba(0, 0, 0, 0.06)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.28)');
  ctx.fillStyle = shade;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
  ctx.strokeStyle = OUTLINE;
  ctx.lineWidth = r < 3 ? 0.75 : lw;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  // Its eyes.
  if (r >= 4) {
    const cx = x + EYES_ACROSS * b.look * u;
    const cy = y + EYES_UP * u;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.75, 0.07 * r);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * EYE_GAP * u, cy, EYE_RX * u, EYE_RY * u, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
  // In front of the ball.
  if (b.prop === 'helmet') {
    ctx.fillStyle = HELMET;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(x, y - 0.5 * u, 0.74 * u, 0.52 * u, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, x - 0.95 * u, y - 0.46 * u, 1.9 * u, 0.12 * u, 0.05 * u);
    ctx.fill();
    ctx.stroke();
  } else if (b.prop === 'hull') {
    ctx.fillStyle = HULL;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = lw;
    const s = b.look;
    ctx.beginPath();
    ctx.moveTo(x - 1.4 * u * s, y + 0.3 * u);
    ctx.lineTo(x + 1.7 * u * s, y + 0.3 * u);
    ctx.lineTo(x + 1.15 * u * s, y + 0.92 * u);
    ctx.lineTo(x - 1.2 * u * s, y + 0.92 * u);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (b.engaged) {
    ctx.strokeStyle = '#ff4d3d';
    ctx.lineWidth = Math.max(1.5, 0.14 * r);
    ctx.beginPath();
    ctx.arc(x, y, r + ctx.lineWidth, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
