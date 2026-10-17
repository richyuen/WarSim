/**
 * The air war's effects (PLAN 5.7b, SPEC §6.3 "dogfight tracers, bomb impacts, flak"): from the
 * snapshot's events, on the render clock, nothing of them sim state.
 *
 * - An hour's air fight in a zone (`AirBattle`, at a sortie's place in it): tracers crossing
 *   about the place for `DOGFIGHT_MS`, flak puffs among them, and a smoke trail falling for each
 *   aircraft lost (up to six).
 * - A strike at its target (`AirStrike`): bombs bursting about the target one after another
 *   over `BOMBS_MS`, each a flash and its smoke.
 * - A sortie fired on by AA (`FlakFired`): dark puffs bursting about it for `FLAK_MS`.
 * - A strike's bombs on a formation (`StrikeHit`, PLAN 5.9): at T3, where the figures are, its
 *   bombs burst over the men of the formation hit, as drawn; the strike's bombs about its target
 *   (`AirStrike`) are of T0 to T2 and fade with them.
 *
 * Every tier, as the sorties (PLAN 5.9: none at T3 before); sized as they are (smaller further out).
 */
import { EVENT_STRIDE, EventKind } from '../../shared/events';
import { worldToScreen, itemOffsets, type Camera, type MapGeometry } from '../camera';
import { hash2 } from '../hash';

export const DOGFIGHT_MS = 3500;
export const BOMBS_MS = 2200;
export const FLAK_MS = 2000;
/** Bombs drawn for a strike, tracers for a fight, puffs for flak. */
const BOMBS = 6;
const TRACERS = 10;
const PUFFS = 5;
/** Marks held at once; beyond it the oldest go. */
export const MAX_AIR_MARKS = 600;
const TAU = Math.PI * 2;

export const AirMark = { fight: 0, bombs: 1, flak: 2, hit: 3 } as const;
export type AirMark = (typeof AirMark)[keyof typeof AirMark];

export interface AirMarkOf {
  kind: AirMark;
  /** Cells. */
  x: number;
  y: number;
  /** A seed for its picture, and what it tells: the aircraft lost in a fight; the formation a strike hit. */
  seed: number;
  lost: number;
  born: number;
  formation?: number;
}

const lifeOf = (kind: AirMark): number => (kind === AirMark.fight ? DOGFIGHT_MS : kind === AirMark.bombs || kind === AirMark.hit ? BOMBS_MS : FLAK_MS);
/** A number in [0, 1) from a seed and an index. */
const u = (seed: number, k: number): number => (hash2(seed, k) >>> 8) / 16777216;

export class AirFx {
  marks: AirMarkOf[] = [];
  /** What the last `draw` put on screen (tests): by kind. */
  shown = [0, 0, 0, 0];
  until = -Infinity;

  /** Takes the air's events of a snapshot that arrived at `now`. */
  add(count: number, data: ArrayLike<number>, now: number): void {
    let kept = 0;
    for (const m of this.marks) if (now < m.born + lifeOf(m.kind)) this.marks[kept++] = m;
    this.marks.length = kept;
    for (let i = 0; i < count; i++) {
      const o = i * EVENT_STRIDE;
      const k = data[o + 2];
      const kind = k === EventKind.AirBattle ? AirMark.fight : k === EventKind.AirStrike ? AirMark.bombs : k === EventKind.FlakFired ? AirMark.flak : k === EventKind.StrikeHit ? AirMark.hit : -1;
      if (kind < 0) continue;
      const x = data[o + 5]!;
      const y = data[o + 6]!;
      const mark: AirMarkOf = { kind: kind as AirMark, x, y, seed: hash2(data[o + 3]! | 0, Math.floor(x * 64) ^ Math.floor(y * 64)), lost: kind === AirMark.fight ? data[o + 4]! : 0, born: now };
      if (kind === AirMark.hit) mark.formation = data[o + 3]!;
      this.marks.push(mark);
      this.until = Math.max(this.until, now + lifeOf(kind as AirMark));
    }
    if (this.marks.length > MAX_AIR_MARKS) this.marks.splice(0, this.marks.length - MAX_AIR_MARKS);
  }

  clear(): void {
    this.marks.length = 0;
    this.until = -Infinity;
  }

  animating(now: number): boolean {
    return now < this.until;
  }

  /**
   * Draws the marks alive at `now`, `size` the planes' (their zoom factor taken). `close` is the
   * share of T3 (the figures'): a strike's bombs about its target fade with it, its bombs on the
   * men hit come with it, at the places `placesOf` gives for a formation (its drawn elements,
   * cells; none: not drawn).
   */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, geo: MapGeometry, vw: number, vh: number, now: number, size: number, close = 0, placesOf: (formation: number) => readonly (readonly [number, number])[] = () => []): void {
    this.shown = [0, 0, 0, 0];
    if (this.marks.length === 0) return;
    const offs = itemOffsets(cam, geo, vw);
    ctx.save();
    for (const m of this.marks) {
      const t = (now - m.born) / lifeOf(m.kind);
      if (t < 0 || t >= 1) continue;
      const alpha = m.kind === AirMark.bombs ? 1 - close : m.kind === AirMark.hit ? close : 1;
      if (alpha <= 0.01) continue;
      if (m.kind === AirMark.hit) {
        const places = placesOf(m.formation ?? 0);
        if (places.length === 0) continue;
        for (const off of offs) if (bombsOn(ctx, m, places, off, cam, vw, vh, t, alpha, size)) this.shown[m.kind]!++;
        continue;
      }
      for (const off of offs) {
        const [x, y] = worldToScreen(cam, m.x + off, m.y, vw, vh);
        const reach = 40 * size;
        if (x < -reach || y < -reach || x > vw + reach || y > vh + reach) continue;
        this.shown[m.kind]!++;
        if (m.kind === AirMark.fight) fight(ctx, m, x, y, t, alpha, size);
        else if (m.kind === AirMark.bombs) bombs(ctx, m, x, y, t, alpha, size);
        else flak(ctx, m, x, y, t, alpha, size, PUFFS);
      }
    }
    ctx.restore();
  }
}

/** Tracers crossing about (x, y): each a short bright dash along its line, on and off; flak among them; a smoke trail falling for each aircraft lost. */
function fight(ctx: CanvasRenderingContext2D, m: AirMarkOf, x: number, y: number, t: number, alpha: number, size: number): void {
  const r = 30 * size;
  const fade = alpha * (t < 0.85 ? 1 : (1 - t) / 0.15);
  ctx.lineCap = 'round';
  for (let k = 0; k < TRACERS; k++) {
    // Each tracer a burst in its own part of the fight's time.
    const start = u(m.seed, k) * 0.7;
    const s = (t - start) / 0.25;
    if (s < 0 || s > 1) continue;
    const a = u(m.seed, k + 50) * TAU;
    const cx = x + (u(m.seed, k + 100) - 0.5) * r;
    const cy = y + (u(m.seed, k + 150) - 0.5) * r;
    const len = r * 0.9;
    const p = -0.5 + s;
    const hx = cx + Math.cos(a) * len * p;
    const hy = cy + Math.sin(a) * len * p;
    ctx.globalAlpha = fade * (1 - s * 0.5);
    ctx.strokeStyle = k % 2 ? '#ffe28a' : '#ff9f5a';
    ctx.lineWidth = 1.6 * size;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx - Math.cos(a) * len * 0.3, hy - Math.sin(a) * len * 0.3);
    ctx.stroke();
  }
  // The aircraft lost: a smoke trail falling from where it was hit.
  const lost = Math.min(6, Math.round(m.lost));
  for (let k = 0; k < lost; k++) {
    const start = u(m.seed, k + 300) * 0.5;
    const s = (t - start) / 0.45;
    if (s < 0 || s > 1) continue;
    const sx = x + (u(m.seed, k + 350) - 0.5) * r;
    const sy = y + (u(m.seed, k + 400) - 0.5) * r * 0.6;
    const drop = s * r * 0.9;
    ctx.globalAlpha = fade * (1 - s) * 0.8;
    ctx.strokeStyle = 'rgba(40, 36, 34, 1)';
    ctx.lineWidth = 2.2 * size;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + drop * 0.2, sy + drop * 0.4, sx + drop * 0.3, sy + drop);
    ctx.stroke();
    ctx.fillStyle = '#ff7a2e';
    ctx.beginPath();
    ctx.arc(sx + drop * 0.3, sy + drop, 2 * size, 0, TAU);
    ctx.fill();
  }
  flak(ctx, m, x, y, t, alpha * 0.6, size, 3);
}

/** Bombs bursting about (x, y) one after another: a flash ring, then its smoke. */
function bombs(ctx: CanvasRenderingContext2D, m: AirMarkOf, x: number, y: number, t: number, alpha: number, size: number): void {
  const r = 22 * size;
  for (let k = 0; k < BOMBS; k++) {
    const s = (t - bombStart(m, k)) / 0.4;
    if (s < 0 || s > 1) continue;
    burst(ctx, x + (u(m.seed, k + 20) - 0.5) * r * 1.6, y + (u(m.seed, k + 40) - 0.5) * r, s, alpha, size);
  }
}

/** When bomb `k` of a strike bursts, a share of its time. */
const bombStart = (m: AirMarkOf, k: number): number => (k / BOMBS) * 0.55 + u(m.seed, k) * 0.08;

/**
 * Bombs bursting one after another over the men hit (PLAN 5.9): each on one of `places` (cells,
 * the formation's drawn elements), by the strike's seed; whether any is on screen.
 */
function bombsOn(ctx: CanvasRenderingContext2D, m: AirMarkOf, places: readonly (readonly [number, number])[], off: number, cam: Camera, vw: number, vh: number, t: number, alpha: number, size: number): boolean {
  let on = false;
  for (let k = 0; k < BOMBS; k++) {
    const s = (t - bombStart(m, k)) / 0.4;
    if (s < 0 || s > 1) continue;
    const p = places[Math.floor(u(m.seed, k + 60) * places.length)]!;
    const [x, y] = worldToScreen(cam, p[0] + off, p[1], vw, vh);
    if (x < -20 || y < -20 || x > vw + 20 || y > vh + 20) continue;
    on = true;
    burst(ctx, x, y, s, alpha, size);
  }
  return on;
}

/** One bomb at (bx, by), `s` of its time: the flash, then smoke rising. */
function burst(ctx: CanvasRenderingContext2D, bx: number, by: number, s: number, alpha: number, size: number): void {
  // The flash, then smoke rising.
  if (s < 0.3) {
    const f = s / 0.3;
    ctx.globalAlpha = alpha * (1 - f);
    ctx.fillStyle = '#fff1b8';
    ctx.beginPath();
    ctx.arc(bx, by, (3 + 7 * f) * size, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha * (1 - f) * 0.9;
    ctx.strokeStyle = '#ff8a2a';
    ctx.lineWidth = 2 * size;
    ctx.beginPath();
    ctx.arc(bx, by, (4 + 10 * f) * size, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = alpha * 0.55 * (1 - s);
  ctx.fillStyle = 'rgb(58, 52, 48)';
  ctx.beginPath();
  ctx.arc(bx, by - s * 8 * size, (3 + 6 * s) * size, 0, TAU);
  ctx.fill();
}

/** Flak: dark puffs bursting about (x, y), each with a brief flash. */
function flak(ctx: CanvasRenderingContext2D, m: AirMarkOf, x: number, y: number, t: number, alpha: number, size: number, n: number): void {
  const r = 20 * size;
  for (let k = 0; k < n; k++) {
    const start = u(m.seed, k + 500) * 0.6;
    const s = (t - start) / 0.4;
    if (s < 0 || s > 1) continue;
    const px = x + (u(m.seed, k + 520) - 0.5) * r * 2;
    const py = y + (u(m.seed, k + 540) - 0.5) * r * 2;
    if (s < 0.15) {
      ctx.globalAlpha = alpha * (1 - s / 0.15);
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(px, py, 2.5 * size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = alpha * 0.75 * (1 - s);
    ctx.fillStyle = 'rgb(34, 32, 32)';
    ctx.beginPath();
    ctx.arc(px, py, (2 + 3.5 * s) * size, 0, TAU);
    ctx.fill();
  }
}
