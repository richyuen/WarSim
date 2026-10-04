/**
 * City dots and names (PLAN 1.5, SPEC §8): dots from T0, names coming in through T1
 * (300–2000 m/px), bigger cities and capitals first. Drawn on a Canvas2D overlay above the
 * WebGL map: point labels need crisp text in any script, and a few hundred visible labels cost
 * well under a millisecond. Curved nation names (MSDF) are a separate layer (PLAN 1.29).
 *
 * `layoutCityLabels` is pure (DOM-free, unit-tested): what is wanted at a zoom, and greedy
 * collision in priority order (capitals, then size, then list order).
 *
 * A dot or a name is a state, not a function of the zoom (PLAN 2.7d): it comes in when the zoom
 * reaches its limit, goes out above the limit × ZOOM_HYSTERESIS, and a change is a fade over
 * FADE_MS of real time, the same when a name appears because its neighbour made room. At rest
 * every dot and name is in full or absent. The layer holds the states.
 */
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { SwitchBank, ZOOM_HYSTERESIS, type SwitchState } from '../timing';

export interface CityPoint {
  name: string;
  /** Position in cells (fractional). */
  x: number;
  y: number;
  /** 1 (town) … 5 (metropolis). */
  size: number;
  capital: boolean;
}

export interface PlacedLabel {
  index: number;
  /** Dot centre, CSS px. */
  sx: number;
  sy: number;
  dotR: number;
  /** From the layout: 1 wanted, 0 not. From the layer (`lastPlaced`): the opacity drawn. */
  dotAlpha: number;
  /** The same for the name (0 = dot only). */
  nameAlpha: number;
  fontPx: number;
  /** Name box (CSS px), when the name is shown or still fading out. */
  box?: { x: number; y: number; w: number; h: number };
}

/**
 * Metres per CSS px at which a city's dot / name comes in; it goes out above this ×
 * ZOOM_HYSTERESIS. (It used to start a fade by zoom here that was complete at 0.7 × this.)
 */
export function dotMaxMPerPx(c: CityPoint): number {
  return c.capital ? Infinity : [0, 1500, 3000, 6000, 12000, Infinity][c.size]!;
}
export function nameMaxMPerPx(c: CityPoint): number {
  return c.capital ? 5000 : [0, 450, 800, 1400, 2000, 3500][c.size]!;
}

/** Whether a dot or a name with `limit` is wanted at `mPerPx`; `held`: it is on now. */
export function wanted(mPerPx: number, limit: number, held: boolean): boolean {
  return mPerPx < limit * (held ? ZOOM_HYSTERESIS : 1);
}

export function fontPxFor(c: CityPoint): number {
  return 10 + c.size + (c.capital ? 2 : 0);
}

const PAD = 2;

/** What the layer knows of each city's dot and name from the frames before (none: a layout at rest). */
export interface LabelState {
  dot: SwitchState<number>;
  name: SwitchState<number>;
}
const OFF: SwitchState<number> = { held: () => false, visible: () => false };
const AT_REST: LabelState = { dot: OFF, name: OFF };

export function layoutCityLabels(
  cities: readonly CityPoint[],
  order: readonly number[],
  cam: Camera,
  geo: MapGeometry,
  viewW: number,
  viewH: number,
  measure: (text: string, fontPx: number) => number,
  state: LabelState = AT_REST,
): PlacedLabel[] {
  const mPerPx = (geo.kmPerCell * 1000) / cam.scale;
  const out: PlacedLabel[] = [];
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const offsets = wrapOffsets(cam, geo, viewW);
  const inView = (sx: number, sy: number): boolean => sx >= -200 && sx <= viewW + 200 && sy >= -40 && sy <= viewH + 40;
  for (const i of order) {
    const c = cities[i]!;
    const dot = wanted(mPerPx, dotMaxMPerPx(c), state.dot.held(i));
    const lingers = state.dot.visible(i) || state.name.visible(i);
    if (!dot && !lingers) {
      if ((state.dot.hidden || state.name.hidden) && offsets.some((off) => inView(...worldToScreen(cam, c.x + off, c.y, viewW, viewH)))) {
        state.dot.hidden?.(i);
        state.name.hidden?.(i);
      }
      continue;
    }
    const name = dot && wanted(mPerPx, nameMaxMPerPx(c), state.name.held(i));
    const dotR = (c.capital ? 3 : 1.5 + 0.35 * c.size) * Math.min(1.6, Math.max(0.8, Math.sqrt(cam.scale / 8)));
    for (const off of offsets) {
      const [sx, sy] = worldToScreen(cam, c.x + off, c.y, viewW, viewH);
      if (!inView(sx, sy)) continue;
      const fontPx = fontPxFor(c);
      const placed: PlacedLabel = { index: i, sx, sy, dotR, dotAlpha: dot ? 1 : 0, nameAlpha: 0, fontPx };
      if (name || lingers) {
        const w = measure(c.name, fontPx);
        const box = { x: sx + dotR + 3, y: sy - fontPx * 0.6, w: w + PAD * 2, h: fontPx * 1.2 };
        if (name && !boxes.some((b) => b.x < box.x + box.w && box.x < b.x + b.w && b.y < box.y + box.h && box.y < b.y + b.h)) {
          boxes.push(box);
          placed.nameAlpha = 1;
          placed.box = box;
        } else if (lingers) placed.box = box; // where its name fades out
      }
      out.push(placed);
    }
  }
  return out;
}

/** Priority order: capitals first, then by size (desc), then list order. */
export function priorityOrder(cities: readonly CityPoint[]): number[] {
  return cities.map((_, i) => i).sort((a, b) => {
    const ca = cities[a]!;
    const cb = cities[b]!;
    return Number(cb.capital) - Number(ca.capital) || cb.size - ca.size || a - b;
  });
}

/** Draws the layout on a 2D canvas that overlays the map canvas. */
export class CityLabelLayer {
  private readonly ctx: CanvasRenderingContext2D;
  private cities: CityPoint[] = [];
  private order: number[] = [];
  private readonly widths = new Map<string, number>();
  /** Each city's dot and name: on or off, and the fade of a change. */
  private readonly dots = new SwitchBank<number>();
  private readonly names = new SwitchBank<number>();
  /** Labels placed by the last draw, with the opacities drawn (tests and stats). */
  lastPlaced: PlacedLabel[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly geo: MapGeometry,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  setCities(cities: CityPoint[]): void {
    this.cities = cities;
    this.order = priorityOrder(cities);
    this.dots.clear();
    this.names.clear();
  }

  /** True while a dot or a name fades (the view keeps redrawing). */
  animating(now: number): boolean {
    return this.dots.animating(now) || this.names.animating(now);
  }

  private measure = (text: string, fontPx: number): number => {
    const key = `${fontPx}|${text}`;
    let w = this.widths.get(key);
    if (w === undefined) {
      this.ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
      w = this.ctx.measureText(text).width;
      this.widths.set(key, w);
    }
    return w;
  };

  draw(cam: Camera, dpr: number, now = performance.now()): void {
    const { canvas, ctx } = this;
    const viewW = canvas.clientWidth;
    const viewH = canvas.clientHeight;
    if (canvas.width !== Math.round(viewW * dpr) || canvas.height !== Math.round(viewH * dpr)) {
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    const { dots, names } = this;
    const placed = layoutCityLabels(this.cities, this.order, cam, this.geo, viewW, viewH, this.measure, { dot: dots.frame(now), name: names.frame(now) });
    for (const p of placed) {
      p.dotAlpha = dots.value(p.index, p.dotAlpha > 0);
      p.nameAlpha = names.value(p.index, p.nameAlpha > 0);
    }
    dots.end();
    names.end();
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of placed) {
      const c = this.cities[p.index]!;
      if (p.dotAlpha > 0) {
        ctx.globalAlpha = p.dotAlpha;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, p.dotR, 0, Math.PI * 2);
        ctx.fillStyle = c.capital ? '#f4d35e' : '#f2f2f2';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1a1a1a';
        ctx.stroke();
      }
      if (p.box && p.nameAlpha > 0) {
        ctx.globalAlpha = p.nameAlpha;
        ctx.font = `600 ${p.fontPx}px system-ui, sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(15, 15, 20, 0.85)';
        ctx.strokeText(c.name, p.box.x + PAD, p.sy);
        ctx.fillStyle = c.capital ? '#fff4c2' : '#f5f5f5';
        ctx.fillText(c.name, p.box.x + PAD, p.sy);
      }
    }
    ctx.globalAlpha = 1;
    this.lastPlaced = placed;
  }
}
