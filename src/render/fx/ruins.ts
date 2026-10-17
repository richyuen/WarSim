/**
 * A struck city shows it (PLAN 7.11b, critic run 7: "a city that lost 1,025,202 people looks the
 * same at 150 m/px ten days later: no scorch or ruin"; "a struck city must show it"). The bursts
 * the sim remembers (`world.nukeBursts`, a year since PLAN 7.6e) come to the page with their age
 * in days (`ruins` message). Where the blast's radius is large on the screen (T2, T3) a burst is a
 * scorched disc of that radius, darkest at its middle, with rubble strewn over its inner part; where
 * it is small (T0, T1) a mark of MARK_PX: a dark disc with an ember ring. Both fade with the
 * burst's age, to RUIN_AGED of themselves at a year. Pure functions of the bursts and the camera.
 */
import { BLAST_KM } from '../../shared/nuclear';
import { worldToScreen, wrapOffsets, SEAM_MARGIN, type Camera, type MapGeometry } from '../camera';
import { hash2 } from '../hash';

/** A burst's radius on the screen under which it is a mark, CSS px, and the mark's radius. */
export const MARK_UNDER_PX = 14;
export const MARK_PX = 7;
/** What is left of a ruin's darkness at a year (the sim forgets a burst then). */
export const RUIN_AGED = 0.35;
/** The scorch's darkness at the middle of a fresh burst. */
export const SCORCH_ALPHA = 0.62;
/** Rubble: how many bits a ruin has, over the inner share of its radius, from a radius of this on the screen. */
export const RUBBLE = 140;
export const RUBBLE_INNER = 0.7;
export const RUBBLE_FROM_PX = 60;
const TAU = Math.PI * 2;

export interface Ruin {
  x: number;
  y: number;
  /** Days since the burst. */
  age: number;
}

/** A ruin's darkness at `age` days, 0–1 of itself: 1 fresh, RUIN_AGED at a year. */
export function ruinShare(age: number): number {
  return 1 - (1 - RUIN_AGED) * Math.min(1, Math.max(0, age) / 365);
}

/** Draws `ruins` (already in the CSS-px transform of `ctx`); returns how many were drawn, as scorch and as marks (tests). */
export function drawRuins(ctx: CanvasRenderingContext2D, ruins: readonly Ruin[], cam: Camera, geo: MapGeometry, vw: number, vh: number): { scorched: number; marked: number } {
  const out = { scorched: 0, marked: 0 };
  if (ruins.length === 0) return out;
  const r = (BLAST_KM / geo.kmPerCell) * cam.scale;
  ctx.save();
  for (const off of wrapOffsets(cam, geo, vw, SEAM_MARGIN)) {
    for (let k = 0; k < ruins.length; k++) {
      const ruin = ruins[k]!;
      const [x, y] = worldToScreen(cam, ruin.x + off, ruin.y, vw, vh);
      const reach = Math.max(r, MARK_PX + 2);
      if (x < -reach || y < -reach || x > vw + reach || y > vh + reach) continue;
      const share = ruinShare(ruin.age);
      if (r < MARK_UNDER_PX) {
        // A mark: a dark disc, an ember ring.
        ctx.globalAlpha = share;
        ctx.fillStyle = 'rgba(28, 20, 14, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, MARK_PX, 0, TAU);
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(240, 120, 40, 0.95)';
        ctx.stroke();
        out.marked++;
        continue;
      }
      // The scorch: darkest at the middle, gone at the radius.
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(22, 16, 11, ${SCORCH_ALPHA * share})`);
      g.addColorStop(0.55, `rgba(38, 28, 20, ${0.75 * SCORCH_ALPHA * share})`);
      g.addColorStop(1, 'rgba(50, 38, 28, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      // Rubble over its inner part, where it is large enough to see: the same bits every frame.
      if (r >= RUBBLE_FROM_PX) {
        const bit = Math.max(1.5, r / 70);
        ctx.globalAlpha = 0.8 * share;
        for (let i = 0; i < RUBBLE; i++) {
          const h = hash2(hash2(Math.round(ruin.x * 1000), Math.round(ruin.y * 1000)), i);
          const a = ((h & 0xffff) / 0x10000) * TAU;
          const d = Math.sqrt(((h >>> 16) & 0xffff) / 0x10000) * RUBBLE_INNER * r;
          ctx.fillStyle = (h & 3) === 0 ? 'rgb(120, 104, 92)' : 'rgb(70, 60, 52)';
          ctx.fillRect(x + Math.cos(a) * d - bit / 2, y + Math.sin(a) * d - bit / 2, bit * (1 + ((h >>> 8) & 1)), bit);
        }
      }
      out.scorched++;
    }
  }
  ctx.restore();
  return out;
}
