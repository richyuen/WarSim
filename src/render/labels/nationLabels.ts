/**
 * Curved nation names (SPEC §8 Labels, PLAN 1.29) on a Canvas2D overlay: glyphs placed one by one
 * along the worker's label Bézier (ADR-40: Canvas2D instead of an MSDF atlas; crisp text in any
 * script, ~100 labels well under a millisecond).
 *
 * `layoutNationLabels` is pure (DOM-free apart from the injected text measurer): font size fits
 * the territory (≤ 2 × half-thickness, the text ≤ the curve length), labels below MIN_PX or
 * outside the view are dropped, and glyph circles collide greedily in area order (largest first).
 */
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { bezierAt, LABEL_STRIDE, LabelField } from '../../shared/nationLabels';

export const MIN_PX = 9;
export const MAX_PX = 64;
/** Average glyph advance as a share of the font size (initial fit before measuring). */
const ADVANCE = 0.62;

export interface PlacedGlyph {
  ch: string;
  x: number;
  y: number;
  angle: number;
}

export interface PlacedNationLabel {
  id: number;
  text: string;
  fontPx: number;
  area: number;
  glyphs: PlacedGlyph[];
  /** Whether the baseline bends (control point off the chord by > 3% of its length). */
  curved: boolean;
}

export type Measure = (text: string, fontPx: number) => number;

export function layoutNationLabels(
  data: Float64Array,
  names: readonly string[],
  cam: Camera,
  geo: MapGeometry,
  viewW: number,
  viewH: number,
  measure: Measure,
): PlacedNationLabel[] {
  const n = data.length / LABEL_STRIDE;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => data[b * LABEL_STRIDE + LabelField.area]! - data[a * LABEL_STRIDE + LabelField.area]! || a - b);
  const placed: PlacedNationLabel[] = [];
  const occupied: { x: number; y: number; r: number }[] = [];
  const offsets = wrapOffsets(cam, geo, viewW);
  for (const i of order) {
    const o = i * LABEL_STRIDE;
    const text = names[i] ?? '';
    if (!text) continue;
    const thick = data[o + LabelField.thickness]! * cam.scale;
    const len = data[o + LabelField.length]! * cam.scale;
    let fontPx = Math.min(MAX_PX, 2 * thick, len / (ADVANCE * text.length));
    if (fontPx < MIN_PX) continue;
    let width = measure(text, fontPx);
    if (width > len) {
      fontPx *= len / width;
      if (fontPx < MIN_PX) continue;
      width = measure(text, fontPx);
    }
    for (const off of offsets) {
      const pts: [number, number][] = [];
      for (const k of [LabelField.x0, LabelField.cx, LabelField.x2]) pts.push(worldToScreen(cam, data[o + k]! + off, data[o + k + 1]!, viewW, viewH));
      const [p0, c, p2] = pts as [[number, number], [number, number], [number, number]];
      // Arc-length table along the screen curve.
      const N = 48;
      const cum = new Float64Array(N + 1);
      const xs = new Float64Array(N + 1);
      const ys = new Float64Array(N + 1);
      for (let k = 0; k <= N; k++) {
        [xs[k], ys[k]] = bezierAt(p0[0], p0[1], c[0], c[1], p2[0], p2[1], k / N);
        if (k > 0) cum[k] = cum[k - 1]! + Math.hypot(xs[k]! - xs[k - 1]!, ys[k]! - ys[k - 1]!);
      }
      const total = cum[N]!;
      if (xs.every((x) => x < -fontPx || x > viewW + fontPx) || ys.every((y) => y < -fontPx || y > viewH + fontPx)) continue;
      const at = (s: number): [number, number, number] => {
        let k = 1;
        while (k < N && cum[k]! < s) k++;
        const f = (s - cum[k - 1]!) / Math.max(1e-9, cum[k]! - cum[k - 1]!);
        return [xs[k - 1]! + (xs[k]! - xs[k - 1]!) * f, ys[k - 1]! + (ys[k]! - ys[k - 1]!) * f, Math.atan2(ys[k]! - ys[k - 1]!, xs[k]! - xs[k - 1]!)];
      };
      const glyphs: PlacedGlyph[] = [];
      let s = (total - width) / 2;
      for (const ch of text) {
        const adv = measure(ch, fontPx);
        const [x, y, angle] = at(s + adv / 2);
        glyphs.push({ ch, x, y, angle });
        s += adv;
      }
      const r = fontPx * 0.5;
      if (glyphs.some((g) => occupied.some((q) => (q.x - g.x) * (q.x - g.x) + (q.y - g.y) * (q.y - g.y) < (q.r + r) * (q.r + r)))) continue;
      for (const g of glyphs) occupied.push({ x: g.x, y: g.y, r });
      const chordX = p2[0] - p0[0];
      const chordY = p2[1] - p0[1];
      const chord = Math.hypot(chordX, chordY);
      const off2 = Math.abs((c[0] - p0[0]) * chordY - (c[1] - p0[1]) * chordX) / Math.max(1e-9, chord);
      placed.push({ id: data[o + LabelField.id]!, text, fontPx, area: data[o + LabelField.area]!, glyphs, curved: off2 > 0.03 * chord });
    }
  }
  return placed;
}

/** Draws placed labels: dark glyphs with a light halo. */
export function drawNationLabels(ctx: CanvasRenderingContext2D, labels: readonly PlacedNationLabel[], font: string): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of labels) {
    ctx.font = `600 ${l.fontPx.toFixed(1)}px ${font}`;
    ctx.lineWidth = Math.max(2, l.fontPx * 0.14);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillStyle = 'rgba(20, 22, 30, 0.82)';
    for (const g of l.glyphs) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.strokeText(g.ch, 0, 0);
      ctx.fillText(g.ch, 0, 0);
      ctx.restore();
    }
  }
}
