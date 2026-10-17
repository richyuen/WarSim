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
import { NAME_WEIGHT } from './fonts';

export const MIN_PX = 9;
export const MAX_PX = 64;

/** Average advance of a capital as a share of the font size (initial fit before measuring). */
const ADVANCE = 0.7;

/**
 * Space added after each letter but the last, as a share of the font size (PLAN 7.4a, ADR-440):
 * AoC's names are capitals spaced apart, over the land as a mark of the land, not as a caption.
 */
export const TRACKING = 0.1;

/** The width of the edge drawn round a letter, as a share of the font size. */
export const EDGE = 0.09;

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
  caps: (text: string) => string = (text) => text.toLocaleUpperCase(),
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
    // Drawn in capitals, spaced: the label keeps the name (what a name is, for the view and the
    // tests), its glyphs are the capitals.
    const shown = caps(text);
    const letters = [...shown].length;
    const wide = (px: number): number => measure(shown, px) + TRACKING * px * (letters - 1);
    const id = data[o + LabelField.id]!;
    const thick = data[o + LabelField.thickness]! * cam.scale;
    const len = data[o + LabelField.length]! * cam.scale;
    let fontPx = Math.min(MAX_PX, 2 * thick, len / ((ADVANCE + TRACKING) * letters));
    let width = 0;
    if (fontPx >= MIN_PX / ZOOM_HYSTERESIS) {
      width = wide(fontPx);
      if (width > len) {
        fontPx *= len / width;
        width = wide(fontPx);
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
      const w = fits ? width : wide(px);
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
      for (const ch of shown) {
        const adv = measure(ch, px);
        const [x, y, angle] = at(s + adv / 2);
        glyphs.push({ ch, x, y, angle });
        s += adv + TRACKING * px;
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

/** Steps of the font sizes the names are drawn at: 8 an octave, 9 % apart. */
const LADDER_STEPS = 8;

/** The size of the ladder nearest `px`, in hundredths of a px (as the font is written). */
export function ladderPx(px: number): number {
  return Math.round(100 * 2 ** (Math.round(Math.log2(px) * LADDER_STEPS) / LADDER_STEPS)) / 100;
}

/** The colours a name is drawn in: its letters and their edge, as CSS colours. */
export interface NameInk {
  fill: string;
  edge: string;
}

/** Neither of a nation's colour: dark letters with a light edge. */
const PLAIN_INK: NameInk = { fill: 'rgba(20, 22, 30, 0.82)', edge: 'rgba(255, 255, 255, 0.55)' };

/** Under this luminance a nation's colour is dark, and its name a lighter shade of it. */
export const DARK_NATION = 0.16;

/**
 * A name's ink from its nation's colour (0xRRGGBB; PLAN 7.4a, ADR-440), as AoC draws its names: a
 * shade of the land's own colour, darker than the land, with a thin edge lighter than it. Over a
 * dark land (Germany's grey) the letters are the lighter shade and the edge the darker. The
 * nation's own colour in every map mode, as its markers have it (PLAN 2.7i).
 */
export function nameInk(rgb: number): NameInk {
  const c = [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255] as const;
  const lin = (v: number): number => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const dark = c.map((v) => Math.round(v * 0.42));
  const light = c.map((v) => Math.round(v + (255 - v) * 0.45));
  const css = (v: readonly number[], a: number): string => `rgba(${v[0]}, ${v[1]}, ${v[2]}, ${a})`;
  return lum < DARK_NATION ? { fill: css(light, 0.82), edge: css(dark, 0.6) } : { fill: css(dark, 0.82), edge: css(light, 0.6) };
}

/** The canvas the glyphs are drawn into once, and its 2D context. */
export interface SpriteCanvas {
  canvas: CanvasImageSource;
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}

/** A glyph drawn once: where it is in the atlas (device px); its middle is the box's. */
export interface Sprite {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The atlas's side, device px: a few ladder steps of the names of a view at a DPR of 2. */
export const ATLAS_PX = 2048;

/**
 * Each glyph of the names drawn once per letter, ladder size, ink and device scale into one
 * atlas, and then as a piece of it (PLAN 7.4f29). A glyph stroked and filled as text at its angle
 * each frame was outlined anew by the browser each frame (no cache holds a glyph at an angle):
 * in a zoom from the world to T1, 12 to 17 frames of some 215 missed the display's 60 Hz, none
 * with the names laid out and not drawn (PLAN 7.1l5, ADR-414 g). A canvas a glyph, tried first,
 * did as badly: a small canvas is kept off the GPU and sent to it at each draw. One canvas is
 * one texture, sent when a glyph is added. Shelves of glyphs, filled left to right; a glyph
 * that does not fit starts the atlas again.
 */
export class GlyphSprites {
  private readonly sprites = new Map<string, Sprite>();
  private atlas: SpriteCanvas | null | undefined;
  private shelfX = 0;
  private shelfY = 0;
  private shelfH = 0;
  /** Glyphs drawn into the atlas, and times it started again (tests). */
  made = 0;
  restarts = 0;

  constructor(private readonly make: (w: number, h: number) => SpriteCanvas | null = defaultSpriteCanvas) {}

  get size(): number {
    return this.sprites.size;
  }

  /** The atlas the sprites are in (none: no canvas here). */
  get canvas(): CanvasImageSource | null {
    return this.atlas?.canvas ?? null;
  }

  /** The glyph `ch` at `size` px (a ladder size) in `ink`, at `scale` device px a CSS px; null: no canvas here. */
  get(ch: string, size: number, font: string, ink: NameInk, scale: number): Sprite | null {
    const key = `${ch}|${size}|${ink.fill}|${ink.edge}|${scale}|${font}`;
    const had = this.sprites.get(key);
    if (had) return had;
    if (this.atlas === undefined) this.atlas = this.make(ATLAS_PX, ATLAS_PX);
    const a = this.atlas;
    if (!a) return null;
    const line = Math.max(1.5, size * EDGE);
    // A capital's box and the edge round it, with room: letters are about 0.6 to 1 em wide.
    const w = Math.ceil((size * 1.3 + line * 2) * scale) + 2;
    const h = Math.ceil((size * 1.5 + line * 2) * scale) + 2;
    if (w > ATLAS_PX || h > ATLAS_PX) return null;
    if (this.shelfX + w > ATLAS_PX) {
      this.shelfY += this.shelfH;
      this.shelfX = 0;
      this.shelfH = 0;
    }
    if (this.shelfY + h > ATLAS_PX) {
      // Full: everything goes, and the glyphs of this frame are drawn again as they come.
      this.sprites.clear();
      this.shelfX = this.shelfY = this.shelfH = 0;
      this.restarts++;
    }
    const sp = { x: this.shelfX, y: this.shelfY, w, h };
    this.shelfX += w;
    this.shelfH = Math.max(this.shelfH, h);
    const g = a.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(sp.x, sp.y, w, h);
    g.setTransform(scale, 0, 0, scale, sp.x + w / 2, sp.y + h / 2);
    g.font = `${NAME_WEIGHT} ${size}px ${font}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = line;
    g.strokeStyle = ink.edge;
    g.fillStyle = ink.fill;
    g.strokeText(ch, 0, 0);
    g.fillText(ch, 0, 0);
    this.sprites.set(key, sp);
    this.made++;
    return sp;
  }
}

/** A canvas element (on the GPU at this size), else an OffscreenCanvas, else none (node). */
function defaultSpriteCanvas(w: number, h: number): SpriteCanvas | null {
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    return ctx ? { canvas, ctx } : null;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    return ctx ? { canvas, ctx } : null;
  }
  return null;
}

/**
 * Draws placed labels at their opacity, each in its nation's ink (`colourOf` none: the plain ink).
 * With `sprites`, each glyph as its bitmap of the ladder size (PLAN 7.4f29); without, or where no
 * canvas can be made, as text.
 */
export function drawNationLabels(ctx: CanvasRenderingContext2D, labels: readonly PlacedNationLabel[], font: string, colourOf: (id: number) => number | undefined = () => undefined, sprites?: GlyphSprites): void {
  if (sprites && drawAsSprites(ctx, labels, font, colourOf, sprites)) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const l of labels) {
    if (l.alpha <= 0) continue;
    ctx.globalAlpha = l.alpha;
    // The font at a size of the ladder, the rest of the size by the transform: in a zoom each
    // frame's sizes are new, and the browser made each glyph's outline anew at each (frames of
    // 50 to 60 ms from the world to T1; PLAN 7.1l5). The glyphs are where and as large as before.
    const size = ladderPx(l.fontPx);
    const k = l.fontPx / size;
    ctx.font = `${NAME_WEIGHT} ${size}px ${font}`;
    ctx.lineWidth = Math.max(1.5, l.fontPx * EDGE) / k;
    const rgb = colourOf(l.id);
    const ink = rgb === undefined ? PLAIN_INK : nameInk(rgb);
    ctx.strokeStyle = ink.edge;
    ctx.fillStyle = ink.fill;
    for (const g of l.glyphs) {
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.scale(k, k);
      ctx.strokeText(g.ch, 0, 0);
      ctx.fillText(g.ch, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();
}

/** The labels drawn as glyph bitmaps; false (nothing drawn) where no bitmap can be made. */
function drawAsSprites(ctx: CanvasRenderingContext2D, labels: readonly PlacedNationLabel[], font: string, colourOf: (id: number) => number | undefined, sprites: GlyphSprites): boolean {
  const t = ctx.getTransform();
  // Device px a CSS px, to a hundredth: the bitmaps are drawn 1 : 1 at the ladder size.
  const scale = Math.round(Math.hypot(t.a, t.b) * 100) / 100 || 1;
  ctx.save();
  for (const l of labels) {
    if (l.alpha <= 0) continue;
    ctx.globalAlpha = l.alpha;
    const size = ladderPx(l.fontPx);
    const k = l.fontPx / size;
    const rgb = colourOf(l.id);
    const ink = rgb === undefined ? PLAIN_INK : nameInk(rgb);
    for (const g of l.glyphs) {
      const s = sprites.get(g.ch, size, font, ink, scale);
      if (!s) {
        ctx.restore();
        return false;
      }
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.rotate(g.angle);
      ctx.scale(k / scale, k / scale);
      ctx.drawImage(sprites.canvas!, s.x, s.y, s.w, s.h, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }
  }
  ctx.restore();
  return true;
}
