/**
 * City dots and names (PLAN 1.5, SPEC §8): dots from T0, names fading in through T1
 * (300–2000 m/px), bigger cities and capitals first. Drawn on a Canvas2D overlay above the
 * WebGL map: point labels need crisp text in any script, and a few hundred visible labels cost
 * well under a millisecond. Curved nation names (MSDF) are a separate layer (PLAN 1.29).
 *
 * `layoutCityLabels` is pure (DOM-free, unit-tested): visibility by zoom, opacity fades, and
 * greedy collision in priority order (capitals, then size, then list order).
 */
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';

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
  dotAlpha: number;
  /** Name opacity (0 = dot only). */
  nameAlpha: number;
  fontPx: number;
  /** Name box (CSS px), when the name is shown. */
  box?: { x: number; y: number; w: number; h: number };
}

/** Metres per CSS px below which a city's dot / name appears (fully visible at 0.7×). */
export function dotMaxMPerPx(c: CityPoint): number {
  return c.capital ? Infinity : [0, 1500, 3000, 6000, 12000, Infinity][c.size]!;
}
export function nameMaxMPerPx(c: CityPoint): number {
  return c.capital ? 5000 : [0, 450, 800, 1400, 2000, 3500][c.size]!;
}

/** 0 when mPerPx ≥ limit, 1 when mPerPx ≤ 0.7·limit, smoothstep in between. */
export function fade(mPerPx: number, limit: number): number {
  if (limit === Infinity) return 1;
  const t = Math.min(1, Math.max(0, (limit - mPerPx) / (0.3 * limit)));
  return t * t * (3 - 2 * t);
}

export function fontPxFor(c: CityPoint): number {
  return 10 + c.size + (c.capital ? 2 : 0);
}

const PAD = 2;

export function layoutCityLabels(
  cities: readonly CityPoint[],
  order: readonly number[],
  cam: Camera,
  geo: MapGeometry,
  viewW: number,
  viewH: number,
  measure: (text: string, fontPx: number) => number,
): PlacedLabel[] {
  const mPerPx = (geo.kmPerCell * 1000) / cam.scale;
  const out: PlacedLabel[] = [];
  const boxes: { x: number; y: number; w: number; h: number }[] = [];
  const offsets = wrapOffsets(cam, geo, viewW);
  for (const i of order) {
    const c = cities[i]!;
    const dotAlpha = fade(mPerPx, dotMaxMPerPx(c));
    if (dotAlpha <= 0) continue;
    const nameA = fade(mPerPx, nameMaxMPerPx(c));
    const dotR = (c.capital ? 3 : 1.5 + 0.35 * c.size) * Math.min(1.6, Math.max(0.8, Math.sqrt(cam.scale / 8)));
    for (const off of offsets) {
      const [sx, sy] = worldToScreen(cam, c.x + off, c.y, viewW, viewH);
      if (sx < -200 || sx > viewW + 200 || sy < -40 || sy > viewH + 40) continue;
      const fontPx = fontPxFor(c);
      const placed: PlacedLabel = { index: i, sx, sy, dotR, dotAlpha, nameAlpha: 0, fontPx };
      if (nameA > 0) {
        const w = measure(c.name, fontPx);
        const box = { x: sx + dotR + 3, y: sy - fontPx * 0.6, w: w + PAD * 2, h: fontPx * 1.2 };
        if (!boxes.some((b) => b.x < box.x + box.w && box.x < b.x + b.w && b.y < box.y + box.h && box.y < b.y + b.h)) {
          boxes.push(box);
          placed.nameAlpha = nameA;
          placed.box = box;
        }
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
  /** Labels placed by the last draw (tests and stats). */
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

  draw(cam: Camera, dpr: number): void {
    const { canvas, ctx } = this;
    const viewW = canvas.clientWidth;
    const viewH = canvas.clientHeight;
    if (canvas.width !== Math.round(viewW * dpr) || canvas.height !== Math.round(viewH * dpr)) {
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    const placed = layoutCityLabels(this.cities, this.order, cam, this.geo, viewW, viewH, this.measure);
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const p of placed) {
      const c = this.cities[p.index]!;
      ctx.globalAlpha = p.dotAlpha;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.dotR, 0, Math.PI * 2);
      ctx.fillStyle = c.capital ? '#f4d35e' : '#f2f2f2';
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#1a1a1a';
      ctx.stroke();
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
