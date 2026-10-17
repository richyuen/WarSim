/**
 * The sea battles' marks (PLAN 4.10b): a battle at sea lasts some hours of the game, a few
 * seconds at ×1, and its shots are small and brief; the mark stands at its place for every hour
 * it goes on, at T0 to T2: a navy-blue disc with crossed guns over a wave, a ring as wide as the
 * water its fleets are on (at least the disc).
 */
import { SEA_STRIDE } from '../../shared/protocol';
import { worldToScreen, itemOffsets, type Camera, type MapGeometry } from '../camera';

/** The disc's radius, CSS px (before the unit size). */
export const SEA_MARK_PX = 11;

/** Draws the marks of `seas` (a snapshot's, SEA_STRIDE each) at `alpha`; their places on screen, for tests. */
export function drawSeaBattles(ctx: CanvasRenderingContext2D, seas: ArrayLike<number>, cam: Camera, geo: MapGeometry, vw: number, vh: number, alpha: number, size = 1): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (alpha <= 0.01 || seas.length === 0) return out;
  const offs = itemOffsets(cam, geo, vw);
  const rad = SEA_MARK_PX * size;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i + SEA_STRIDE <= seas.length; i += SEA_STRIDE) {
    const ring = Math.max(rad + 3, seas[i + 2]! * cam.scale);
    for (const off of offs) {
      const [x, y] = worldToScreen(cam, seas[i]! + off, seas[i + 1]!, vw, vh);
      if (x < -ring || y < -ring || x > vw + ring || y > vh + ring) continue;
      out.push({ x, y });
      ctx.strokeStyle = 'rgba(142, 197, 255, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(x, y, ring, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(14, 44, 92, 0.92)';
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#d6ecff';
      ctx.lineWidth = 2 * size;
      ctx.beginPath();
      // Crossed guns.
      ctx.moveTo(x - 6 * size, y - 5 * size);
      ctx.lineTo(x + 5 * size, y + 2 * size);
      ctx.moveTo(x + 6 * size, y - 5 * size);
      ctx.lineTo(x - 5 * size, y + 2 * size);
      ctx.stroke();
      // A wave under them.
      ctx.lineWidth = 1.5 * size;
      ctx.beginPath();
      ctx.moveTo(x - 7 * size, y + 6 * size);
      ctx.quadraticCurveTo(x - 3.5 * size, y + 3 * size, x, y + 6 * size);
      ctx.quadraticCurveTo(x + 3.5 * size, y + 9 * size, x + 7 * size, y + 6 * size);
      ctx.stroke();
    }
  }
  ctx.restore();
  return out;
}
