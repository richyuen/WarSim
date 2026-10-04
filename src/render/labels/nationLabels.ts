/**
 * Curved nation names (SPEC §8 Labels, PLAN 1.29) on a Canvas2D overlay: glyphs placed one by one
 * along the worker's label Bézier (ADR-40: Canvas2D instead of an MSDF atlas; crisp text in any
 * script, ~100 labels well under a millisecond).
 *
 * `layoutNationLabels` is pure (DOM-free apart from the injected text measurer): font size fits
 * the territory (≤ 2 × half-thickness, the text ≤ the curve length), labels below MIN_PX or
 * outside the view are dropped, and glyph circles collide greedily in area order (largest first).
 *
 * A name is a state, not a function of the zoom (PLAN 2.7e): it comes in when its size reaches
 * MIN_PX and no larger name is in its way, goes out below MIN_PX ÷ ZOOM_HYSTERESIS or when one
 * is, and a change is a fade in time. The view holds the states and tells the layout what is on.
 *
 * A nation's name is one thing (PLAN 2.7k): the copies of it that a looping map shows near its
 * seam share one state, by the nation. (By nation and wrap offset, the state was lost where the
 * camera's x wraps: a name held on by the hysteresis went out in one frame at the date line.)
 */
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { bezierAt, LABEL_STRIDE, LabelField } from '../../shared/nationLabels';
import { ZOOM_HYSTERESIS, type SwitchBank, type SwitchState } from '../timing';

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
  /** The nation. A looping map can show two copies of a name near its seam: two labels of one id. */
  id: number;
  text: string;
  fontPx: number;
  area: number;
  glyphs: PlacedGlyph[];
  /** Whether the baseline bends (control point off the chord by > 3% of its length). */
  curved: boolean;
  /** From the layout: 1 wanted, 0 not (it is placed because it still fades out). From the view: the opacity drawn. */
  alpha: number;
}

export type Measure = (text: string, fontPx: number) => number;

/** What the view knows of each name, by its nation, from the frames before (none: a layout at rest). */
export type NameState = SwitchState<number>;
const AT_REST: NameState = { held: () => false, visible: () => false };

export function layoutNationLabels(
  data: Float64Array,
  names: readonly string[],
  cam: Camera,
  geo: MapGeometry,
  viewW: number,
  viewH: number,
  measure: Measure,
  state: NameState = AT_REST,
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
    const id = data[o + LabelField.id]!;
    const thick = data[o + LabelField.thickness]! * cam.scale;
    const len = data[o + LabelField.length]! * cam.scale;
    let fontPx = Math.min(MAX_PX, 2 * thick, len / (ADVANCE * text.length));
    let width = 0;
    if (fontPx >= MIN_PX / ZOOM_HYSTERESIS) {
      width = measure(text, fontPx);
      if (width > len) {
        fontPx *= len / width;
        width = measure(text, fontPx);
      }
    }
    const fits = fontPx >= (state.held(id) ? MIN_PX / ZOOM_HYSTERESIS : MIN_PX);
    const lingers = state.visible(id);
    for (const off of offsets) {
      const pts: [number, number][] = [];
      for (const k of [LabelField.x0, LabelField.cx, LabelField.x2]) pts.push(worldToScreen(cam, data[o + k]! + off, data[o + k + 1]!, viewW, viewH));
      const [p0, c, p2] = pts as [[number, number], [number, number], [number, number]];
      if (!fits && !lingers) {
        // Too small to show, and nothing of it on screen. In view, the view is told: such a name
        // fades in when the zoom brings it, where one that a pan brings is there at once.
        if (state.hidden && pts.some(([x, y]) => x >= 0 && x <= viewW && y >= 0 && y <= viewH)) state.hidden(id);
        continue;
      }
      // A name that only fades out is drawn at the size it has, however small.
      const px = Math.max(fontPx, 2);
      const w = fits ? width : measure(text, px);
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
      if (xs.every((x) => x < -px || x > viewW + px) || ys.every((y) => y < -px || y > viewH + px)) continue;
      const at = (s: number): [number, number, number] => {
        let k = 1;
        while (k < N && cum[k]! < s) k++;
        const f = (s - cum[k - 1]!) / Math.max(1e-9, cum[k]! - cum[k - 1]!);
        return [xs[k - 1]! + (xs[k]! - xs[k - 1]!) * f, ys[k - 1]! + (ys[k]! - ys[k - 1]!) * f, Math.atan2(ys[k]! - ys[k - 1]!, xs[k]! - xs[k - 1]!)];
      };
      const glyphs: PlacedGlyph[] = [];
      let s = (total - w) / 2;
      for (const ch of text) {
        const adv = measure(ch, px);
        const [x, y, angle] = at(s + adv / 2);
        glyphs.push({ ch, x, y, angle });
        s += adv;
      }
      const r = px * 0.5;
      const free = !glyphs.some((g) => occupied.some((q) => (q.x - g.x) * (q.x - g.x) + (q.y - g.y) * (q.y - g.y) < (q.r + r) * (q.r + r)));
      const want = fits && free;
      if (!want && !lingers) {
        if (state.hidden) state.hidden(id); // in view, in the way of a larger name
        continue;
      }
      if (want) for (const g of glyphs) occupied.push({ x: g.x, y: g.y, r });
      const chordX = p2[0] - p0[0];
      const chordY = p2[1] - p0[1];
      const chord = Math.hypot(chordX, chordY);
      const off2 = Math.abs((c[0] - p0[0]) * chordY - (c[1] - p0[1]) * chordX) / Math.max(1e-9, chord);
      placed.push({ id, text, fontPx: px, area: data[o + LabelField.area]!, glyphs, curved: off2 > 0.03 * chord, alpha: want ? 1 : 0 });
    }
  }
  return placed;
}

/**
 * The names of a frame at `now` with the opacity of each: the layout is told what the bank
 * holds, and the bank what the layout wants.
 * - One answer a nation: its name is on when any copy of it is wanted.
 * - A copy that alone is in a larger name's way, while the other copy is wanted, is not drawn.
 *   (With one switch for both, each asking for its own answer, the switch would turn twice a
 *   frame and never rest.)
 */
export function fadeNationLabels(bank: SwitchBank<number>, now: number, layout: (state: NameState) => PlacedNationLabel[]): PlacedNationLabel[] {
  const held = bank.frame(now);
  const hidden = new Set<number>();
  const labels = layout({ held: held.held, visible: held.visible, hidden: (id) => void hidden.add(id) });
  const wanted = new Map<number, boolean>();
  for (const l of labels) wanted.set(l.id, (wanted.get(l.id) ?? false) || l.alpha > 0);
  // In view with nothing to show, in no copy: off, so that it fades in when the zoom brings it.
  for (const id of hidden) if (!wanted.has(id)) bank.value(id, false);
  const opacity = new Map<number, number>();
  for (const [id, want] of wanted) opacity.set(id, bank.value(id, want));
  for (const l of labels) l.alpha = l.alpha > 0 || !wanted.get(l.id) ? opacity.get(l.id)! : 0;
  bank.end();
  return labels;
}

/** Draws placed labels at their opacity: dark glyphs with a light halo. */
export function drawNationLabels(ctx: CanvasRenderingContext2D, labels: readonly PlacedNationLabel[], font: string): void {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of labels) {
    if (l.alpha <= 0) continue;
    ctx.globalAlpha = l.alpha;
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
  ctx.restore();
}
