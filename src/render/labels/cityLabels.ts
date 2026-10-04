/**
 * City dots and names (PLAN 1.5, SPEC §8): dots from T0, names coming in through T1
 * (300–2000 m/px), bigger cities and capitals first. Drawn on a Canvas2D overlay above the
 * WebGL map: point labels need crisp text in any script, and a few hundred visible labels cost
 * well under a millisecond. Curved nation names (MSDF) are a separate layer (PLAN 1.29).
 *
 * `layoutCityLabels` is pure (DOM-free, unit-tested): what is wanted at a zoom, and greedy
 * collision in priority order (capitals, then size, then list order).
 *
 * A name stands by its dot, at the first place where nothing is on it (PLAN 2.7r): no name
 * placed before it, and none of the frame's obstacles, the T0 counters and the capital flags.
 * With no place free it is left out.
 * - It keeps its place, to the pixel, as an offset from its dot, for as long as nothing stands
 *   on it: it does not follow a counter, and a place it would prefer coming free does not move
 *   it.
 * - A new place must be clear of an obstacle by that obstacle's clearance; a place held only
 *   has to be untouched. So a counter that moves by a pixel moves no name.
 * - When something does come to stand on it, it takes the first free place at once, and the
 *   layer cross-fades: what showed at the old place goes out there while the name comes in at
 *   the new one. A name never jumps.
 *
 * A dot or a name is a state, not a function of the zoom (PLAN 2.7d): it comes in when the zoom
 * reaches its limit, goes out above the limit × ZOOM_HYSTERESIS, and a change is a fade over
 * FADE_MS of real time, the same when a name appears because its neighbour made room. At rest
 * every dot and name is in full or absent. The layer holds the states.
 */
import { worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { FADE_MS, progress, running, smooth, SwitchBank, ZOOM_HYSTERESIS, type SwitchState } from '../timing';

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
  /** Name box (CSS px), when the name is shown or still fading out, and which of the places it is (`NAME_SIDES`). */
  box?: { x: number; y: number; w: number; h: number };
  side?: number;
  /** From the layer: this is what still shows of a name at the place it has left (no dot; `nameAlpha` on its way to 0). */
  ghost?: boolean;
}

/** Where a name stands: which of the places, and its box's corner as an offset from the dot, px. */
export interface NamePlace {
  side: number;
  dx: number;
  dy: number;
}

/**
 * The places around its dot a name can stand at, in the order they are tried:
 * - beside the dot: right (0), left (1), below right (2), below left (3), below (4);
 * - past what is in the way: to the right (8), to the left (9) or below (10) of the counter or
 *   flag that stands on the place beside the dot, as near as that leaves room, and no further
 *   from the dot than `NAME_REACH_PX`. A counter mostly stands on its nation's capital;
 * - above: right (5), left (6), centred (7). A capital's flag stands above its dot, so these
 *   come last.
 */
export const NAME_SIDES = [0, 1, 2, 3, 4, 8, 9, 10, 5, 6, 7] as const;
/** How far from its dot a name may stand when it is past something, to the side and below: beyond that it is no longer that dot's name. */
export const NAME_REACH_PX = { side: 40, below: 26 } as const;
/** The clearance the view gives the counters (`NameObstacle.clear`): a counter's box moves by a pixel with its number and with the camera. */
export const NAME_CLEAR_PX = 2;

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

/**
 * Where the letters of a name are, inside its box: the box has the padding and the line spacing
 * that keep two names apart; what stands on a name is judged by the letters (PLAN 2.7r).
 */
export function nameTextBox(box: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
  return { x: box.x + PAD, y: box.y + box.h / 6, w: box.w - PAD * 2, h: (box.h * 2) / 3 };
}

/** What the layer knows of each city's dot and name from the frames before (none: a layout at rest). */
export interface LabelState {
  dot: SwitchState<number>;
  name: SwitchState<number>;
  /** Where a city's name was last placed (asked for a name that is still on screen). */
  place?(index: number): NamePlace | undefined;
}

type Box = { x: number; y: number; w: number; h: number };
/**
 * What a name keeps clear of. `clear`: how far from it the letters of a name must be for the
 * name to take a place (a place held only has to be untouched): for a thing that moves by a
 * pixel now and then, so that it moves no name when it does.
 */
export type NameObstacle = Box & { clear?: number };
const touching = (a: Box, b: Box): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** The obstacle that the letters of a name in `box` touch, or (a place to be taken: `taking`) come nearer than its clearance. */
const near = (box: Box, obstacles: readonly NameObstacle[], taking: boolean): NameObstacle | undefined => {
  const t = nameTextBox(box);
  return obstacles.find((o) => {
    const m = taking ? (o.clear ?? 0) : 0;
    return touching({ x: t.x - m, y: t.y - m, w: t.w + m * 2, h: t.h + m * 2 }, o);
  });
};

/**
 * The box of a name `w` × `h` at place `side` of a dot of radius `dotR` at (`sx`, `sy`). The
 * places past what is in the way (8–10) depend on the `obstacles`: null when there is no room
 * within reach.
 */
function nameBox(side: number, sx: number, sy: number, dotR: number, w: number, h: number, obstacles: readonly NameObstacle[]): Box | null {
  const right = sx + dotR + 3;
  const left = sx - dotR - 3 - w;
  const below = sy + dotR + 2;
  const above = sy - dotR - 2 - h;
  if (side === 0) return { x: right, y: sy - h / 2, w, h };
  if (side === 1) return { x: left, y: sy - h / 2, w, h };
  if (side === 2) return { x: right - 3, y: below - 2, w, h };
  if (side === 3) return { x: left + 3, y: below - 2, w, h };
  if (side === 4) return { x: sx - w / 2, y: below, w, h };
  if (side === 5) return { x: right - 3, y: above + 2, w, h };
  if (side === 6) return { x: left + 3, y: above + 2, w, h };
  if (side === 7) return { x: sx - w / 2, y: above, w, h };
  // Past what stands on the place beside the dot: the letters begin a pixel more than its clearance after it.
  let box: Box = side === 8 ? { x: right, y: sy - h / 2, w, h } : side === 9 ? { x: left, y: sy - h / 2, w, h } : { x: sx - w / 2, y: below, w, h };
  for (let tries = 0; tries < 4; tries++) {
    const o = near(box, obstacles, true);
    if (!o) return box;
    const gap = (o.clear ?? 0) + 1;
    if (side === 8) box = { ...box, x: o.x + o.w + gap - PAD };
    else if (side === 9) box = { ...box, x: o.x - gap + PAD - w };
    else box = { ...box, y: o.y + o.h + gap - h / 6 };
    if (side === 8 ? box.x - right > NAME_REACH_PX.side : side === 9 ? left - box.x > NAME_REACH_PX.side : box.y - below > NAME_REACH_PX.below) return null;
  }
  return null;
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
  /** What a name must not stand under, CSS px: the T0 counters' boxes and the capital flags of this frame. */
  obstacles: readonly NameObstacle[] = [],
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
        const w = measure(c.name, fontPx) + PAD * 2;
        const h = fontPx * 1.2;
        // A name on screen has its place, and keeps it while nothing stands on it. Otherwise it
        // takes the first place that is clear.
        const kept = state.name.visible(i) ? state.place?.(i) : undefined;
        const at = (side: number): Box | null => nameBox(side, sx, sy, dotR, w, h, obstacles);
        const free = (box: Box | null, taking: boolean): box is Box => box !== null && !boxes.some((b) => touching(b, box)) && !near(box, obstacles, taking);
        const held: Box | null = kept ? { x: sx + kept.dx, y: sy + kept.dy, w, h } : null;
        let side: number | undefined;
        let box: Box | null = null;
        if (name && kept && free(held, false)) [side, box] = [kept.side, held];
        else if (name) {
          side = NAME_SIDES.find((k) => free(at(k), true));
          box = side === undefined ? null : at(side);
        }
        if (box && side !== undefined) {
          boxes.push(box);
          placed.nameAlpha = 1;
          placed.box = box;
          placed.side = side;
        } else if (lingers) {
          // Where its name fades out.
          placed.side = kept?.side ?? 0;
          placed.box = held ?? at(0)!;
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
  /** Each city's dot and name: on or off, and the fade of a change. */
  private readonly dots = new SwitchBank<number>();
  private readonly names = new SwitchBank<number>();
  /** Where each city's name was last placed. */
  private readonly places = new Map<number, NamePlace>();
  /** What still shows of names at places they have left: going out there, from the opacity they had. */
  private ghosts: { index: number; dx: number; dy: number; w: number; h: number; from: number; start: number }[] = [];
  /** Labels placed by the last draw, with the opacities drawn (tests and stats). */
  lastPlaced: PlacedLabel[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly geo: MapGeometry,
  ) {
    this.ctx = canvas.getContext('2d')!;
  }

  /** The city of a placed label's `index`. */
  city(index: number): CityPoint {
    return this.cities[index]!;
  }

  setCities(cities: CityPoint[]): void {
    this.cities = cities;
    this.order = priorityOrder(cities);
    this.dots.clear();
    this.names.clear();
    this.places.clear();
    this.ghosts = [];
  }

  /** True while a dot or a name fades (the view keeps redrawing). */
  animating(now: number): boolean {
    return this.dots.animating(now) || this.names.animating(now) || this.ghosts.some((g) => running(now, g.start, FADE_MS));
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

  /**
   * `obstacles`: what the names keep clear of in this frame (see `layoutCityLabels`).
   * `under`: draws what lies on this canvas below the dots and the names (the nation names:
   * PLAN 2.7t), in CSS px.
   */
  draw(cam: Camera, dpr: number, now = performance.now(), obstacles: readonly NameObstacle[] = [], under?: (ctx: CanvasRenderingContext2D) => void): void {
    const { canvas, ctx } = this;
    const viewW = canvas.clientWidth;
    const viewH = canvas.clientHeight;
    if (canvas.width !== Math.round(viewW * dpr) || canvas.height !== Math.round(viewH * dpr)) {
      canvas.width = Math.round(viewW * dpr);
      canvas.height = Math.round(viewH * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    if (under) {
      ctx.save();
      under(ctx);
      ctx.restore();
    }
    const { dots, names } = this;
    const nameState = names.frame(now);
    const placed = layoutCityLabels(this.cities, this.order, cam, this.geo, viewW, viewH, this.measure, { dot: dots.frame(now), name: nameState, place: (i) => this.places.get(i) }, obstacles);
    const moved = new Set<number>();
    const at = new Map<number, PlacedLabel>();
    for (const p of placed) {
      at.set(p.index, p);
      p.dotAlpha = dots.value(p.index, p.dotAlpha > 0);
      const want = p.nameAlpha > 0;
      if (want && p.box && p.side !== undefined) {
        const place = { side: p.side, dx: p.box.x - p.sx, dy: p.box.y - p.sy };
        const was = this.places.get(p.index);
        // The name has taken another place while it showed: it goes out where it stood and comes
        // in where it stands now. (Once a frame for a city: its copies either side of the seam of
        // a looping map share its switch.)
        if (was && nameState.visible(p.index) && !moved.has(p.index) && (Math.abs(was.dx - place.dx) > 0.01 || Math.abs(was.dy - place.dy) > 0.01)) {
          moved.add(p.index);
          this.ghosts.push({ index: p.index, dx: was.dx, dy: was.dy, w: p.box.w, h: p.box.h, from: names.value(p.index, true), start: now });
          names.restart(p.index);
        }
        this.places.set(p.index, place);
      }
      p.nameAlpha = names.value(p.index, want);
    }
    dots.end();
    names.end();
    // What still shows at the places names have left, as labels of their own: a name only.
    this.ghosts = this.ghosts.filter((g) => progress(now, g.start, FADE_MS) < 1 && at.has(g.index));
    for (const g of this.ghosts) {
      const p = at.get(g.index)!;
      placed.push({ index: g.index, sx: p.sx, sy: p.sy, dotR: 0, dotAlpha: 0, nameAlpha: g.from * (1 - smooth(progress(now, g.start, FADE_MS))), fontPx: p.fontPx, box: { x: p.sx + g.dx, y: p.sy + g.dy, w: g.w, h: g.h }, ghost: true });
    }
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
        const mid = p.box.y + p.box.h / 2;
        ctx.strokeText(c.name, p.box.x + PAD, mid);
        ctx.fillStyle = c.capital ? '#fff4c2' : '#f5f5f5';
        ctx.fillText(c.name, p.box.x + PAD, mid);
      }
    }
    ctx.globalAlpha = 1;
    this.lastPlaced = placed;
  }
}
