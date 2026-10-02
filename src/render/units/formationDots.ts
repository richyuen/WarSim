/**
 * Formation dots (PLAN 1.7): one small nation-coloured square per formation, drawn on a Canvas2D
 * overlay. A stand-in for the T0/T1 counters of Phase 2 (SPEC §8), which aggregate and label them.
 */
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';

export interface FormationDot {
  x: number;
  y: number;
  nation: number;
}

export class FormationDotLayer {
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly geo: MapGeometry,
    /** CSS colour per nation id. */
    private readonly colors: readonly string[],
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  dots: FormationDot[] = [];

  draw(cam: Camera, dpr: number): number {
    const { canvas, ctx } = this;
    const vw = canvas.clientWidth;
    const vh = canvas.clientHeight;
    if (canvas.width !== Math.round(vw * dpr) || canvas.height !== Math.round(vh * dpr)) {
      canvas.width = Math.round(vw * dpr);
      canvas.height = Math.round(vh * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    const size = Math.min(9, Math.max(3, cam.scale * 0.45));
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#111';
    let drawn = 0;
    for (const off of wrapOffsets(cam, this.geo, vw)) {
      for (const d of this.dots) {
        const [sx, sy] = worldToScreen(cam, d.x + off, d.y, vw, vh);
        if (sx < -size || sx > vw + size || sy < -size || sy > vh + size) continue;
        ctx.fillStyle = this.colors[d.nation] ?? '#888';
        ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        ctx.strokeRect(sx - size / 2, sy - size / 2, size, size);
        drawn++;
      }
    }
    return drawn;
  }
}
