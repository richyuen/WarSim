/**
 * The end of an element at T2 (SPEC §8 "Effects", PLAN 2.4b): an ElementDestroyed event is a
 * burst where the element stood, in the frame its sprite leaves the snapshot, and a wreck that
 * stays there for a while: the fallen, a broken gun, a burnt-out vehicle (smoking); a ship that
 * goes down over SINK_MS, burning, and leaves an oil slick (PLAN 4.7c).
 *
 * Nothing here is sim state: wrecks live on the render clock, drawing changes nothing, and a
 * reload starts with none. A wreck stays where the element died; its formation moves on.
 */
import { EVENT_STRIDE, EventKind } from '../../shared/events';
import { Wreck } from '../../shared/unitLooks';
import { SEAM_MARGIN, worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../camera';
import { hash2 } from '../hash';
import { ANIM_TAIL_MS, smooth } from '../timing';

/** ms: the burst, the wreck coming in under it, its stay and its fading. */
export const BURST_MS = 400;
export const WRECK_IN_MS = 250;
export const WRECK_HOLD_MS = 12_000;
export const WRECK_OUT_MS = 3_000;
export const WRECK_LIFE_MS = WRECK_IN_MS + WRECK_HOLD_MS + WRECK_OUT_MS;
/** Wrecks held at once; beyond it the oldest go. */
export const MAX_WRECKS = 1500;
/** One turn of a wreck's smoke, ms, and its puffs. */
const SMOKE_MS = 1700;
const PUFFS = 3;
/** Opacity of a puff over the four quarters of its rise, and of a burst's ring over its life. */
const PUFF_ALPHA = [0.36, 0.26, 0.16, 0.07] as const;
const RING_ALPHA = [0.95, 0.7, 0.42, 0.18] as const;
const KINDS: readonly Wreck[] = [Wreck.men, Wreck.gun, Wreck.vehicle, Wreck.ship];
/** Fill of the wreck by kind: scorched ground, dark iron, a burnt hull. */
const FILL: Readonly<Record<Wreck, string>> = { [Wreck.men]: 'rgba(44, 32, 24, 0.78)', [Wreck.gun]: 'rgba(30, 28, 27, 0.9)', [Wreck.vehicle]: 'rgba(22, 20, 19, 0.95)', [Wreck.ship]: 'rgba(30, 32, 36, 0.95)' };
/** A ship goes down over SINK_MS (PLAN 4.7c): its hull shrinks into the sea, an oil slick spreads where it was. */
export const SINK_MS = 5000;
const SLICK = 'rgba(8, 10, 14, 0.42)';
/** A ship's wreck and slick by an element sprite's side: a ship is a sprite of its own, not a battalion's block. */
const SHIP_WRECK = 0.35;
/** A rust edge, so that a wreck reads on a dark nation colour too. */
const EDGE = 'rgba(206, 120, 62, 0.75)';
const TAU = Math.PI * 2;

export interface WreckMark {
  /** The element that died. */
  id: number;
  kind: Wreck;
  /** Cells: where it stood. */
  x: number;
  y: number;
  /** How the wreck lies (radians; presentation only). */
  angle: number;
  /** ms on the render clock. */
  born: number;
}

/** Opacity of a wreck at `now`: in under the burst, held, then out. 0 = gone. */
export function wreckOpacity(w: WreckMark, now: number): number {
  const age = Math.max(0, now - w.born);
  if (age >= WRECK_LIFE_MS) return 0;
  const out = age - WRECK_IN_MS - WRECK_HOLD_MS;
  return out > 0 ? 1 - smooth(out / WRECK_OUT_MS) : smooth(Math.min(1, age / WRECK_IN_MS));
}

/** Progress of a wreck's burst at `now`, 0–1; 1 = over. */
export function burstOf(w: WreckMark, now: number): number {
  return Math.min(1, Math.max(0, now - w.born) / BURST_MS);
}

/** An angle in [0, π) from an element id. */
function lie(id: number): number {
  return ((hash2(id, 0) >>> 16) / 65536) * Math.PI;
}

/** How far ship wreck `w` is gone down at `now`, 0–1 (PLAN 4.7c); 0 for a wreck of the land. */
export function sunkOf(w: WreckMark, now: number): number {
  return w.kind === Wreck.ship ? Math.min(1, Math.max(0, now - w.born) / SINK_MS) : 0;
}

/** Adds the outline of a wreck of `kind` at (x, y), `s` px across, lying at `angle`. */
function shape(p: Path2D, kind: Wreck, x: number, y: number, s: number, angle: number): void {
  if (kind === Wreck.men) {
    p.moveTo(x + 0.55 * s * Math.cos(angle), y + 0.55 * s * Math.sin(angle));
    p.ellipse(x, y, 0.55 * s, 0.36 * s, angle, 0, TAU);
    return;
  }
  // A gun is long and thin, a hull broad, a ship long and slim: a rectangle about the point, turned by the angle.
  const [hl, hw] = kind === Wreck.gun ? [0.6 * s, 0.17 * s] : kind === Wreck.ship ? [0.6 * s, 0.14 * s] : [0.55 * s, 0.34 * s];
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  p.moveTo(x + hl * c - hw * sn, y + hl * sn + hw * c);
  p.lineTo(x - hl * c - hw * sn, y - hl * sn + hw * c);
  p.lineTo(x - hl * c + hw * sn, y - hl * sn - hw * c);
  p.lineTo(x + hl * c + hw * sn, y + hl * sn - hw * c);
  p.closePath();
  if (kind === Wreck.gun) {
    // Its wheels, across the trail.
    const r = 0.2 * s;
    for (const side of [-1, 1]) {
      const wx = x - side * 0.34 * s * sn;
      const wy = y + side * 0.34 * s * c;
      p.moveTo(wx + r, wy);
      p.arc(wx, wy, r, 0, TAU);
    }
  }
}

export class WreckFx {
  wrecks: WreckMark[] = [];
  /** What the last `draw` put on screen (tests): the wrecks, and how many of them with a burst. */
  shown: WreckMark[] = [];
  bursts = 0;
  /** Render-clock time of the last element's end, and when the last wreck is gone. */
  last = -Infinity;
  until = -Infinity;

  /** Takes the ElementDestroyed events of a snapshot that arrived at `now` (they are copied). */
  add(count: number, data: ArrayLike<number>, now: number): void {
    // Wrecks that have faded leave here, and only here.
    let kept = 0;
    for (const w of this.wrecks) if (now < w.born + WRECK_LIFE_MS) this.wrecks[kept++] = w;
    this.wrecks.length = kept;
    for (let i = 0; i < count; i++) {
      const o = i * EVENT_STRIDE;
      if (data[o + 2] !== EventKind.ElementDestroyed) continue;
      const id = data[o + 3]!;
      this.wrecks.push({ id, kind: data[o + 4]! as Wreck, x: data[o + 5]!, y: data[o + 6]!, angle: lie(id), born: now });
      this.last = now;
      this.until = now + WRECK_LIFE_MS;
    }
    if (this.wrecks.length > MAX_WRECKS) this.wrecks.splice(0, this.wrecks.length - MAX_WRECKS);
  }

  /** Another game is shown from here on (a load): the wrecks of the one before are not its own. */
  clear(): void {
    this.wrecks.length = 0;
    this.last = -Infinity;
    this.until = -Infinity;
  }

  /**
   * Whether a wreck is still to be drawn at `now` (its smoke moves, and it fades at the end).
   * No lower bound on `now`, as for the fire: a frame's clock can be earlier than the arrival of
   * the snapshot it draws.
   */
  animating(now: number): boolean {
    return this.wrecks.length > 0 && now < this.until + ANIM_TAIL_MS;
  }

  /** Whether a burst is still running: the short part, which a test waits for. */
  bursting(now: number): boolean {
    return now < this.last + BURST_MS + ANIM_TAIL_MS;
  }

  /**
   * Draws the wrecks at `now` (already in the CSS-px transform of `ctx`): `alpha` is the
   * opacity of the element layer and `size` the side of an element sprite in CSS px. Pure: the
   * same `now` draws the same frame.
   */
  draw(ctx: CanvasRenderingContext2D, cam: Camera, geo: MapGeometry, vw: number, vh: number, now: number, alpha: number, size: number): void {
    this.shown.length = 0;
    this.bursts = 0;
    if (alpha <= 0.01 || this.wrecks.length === 0 || now >= this.until) return;
    const offs = wrapOffsets(cam, geo, vw, SEAM_MARGIN);
    const margin = 3 * size;
    const solid = KINDS.map(() => new Path2D());
    const fading: { path: Path2D; kind: Wreck; opacity: number }[] = [];
    const puffs = PUFF_ALPHA.map(() => new Path2D());
    const rings = RING_ALPHA.map(() => new Path2D());
    const flashes = new Path2D();
    const slicks: { x: number; y: number; r: number; opacity: number }[] = [];
    const disc = (p: Path2D, x: number, y: number, r: number): void => {
      p.moveTo(x + r, y);
      p.arc(x, y, r, 0, TAU);
    };
    for (const w of this.wrecks) {
      const opacity = wreckOpacity(w, now);
      if (opacity <= 0) continue;
      const burst = burstOf(w, now);
      let seen = false;
      for (const off of offs) {
        const [x, y] = worldToScreen(cam, w.x + off, w.y, vw, vh);
        if (x < -margin || x > vw + margin || y < -margin || y > vh + margin) continue;
        seen = true;
        // A ship goes down: its hull smaller as it sinks, gone at SINK_MS; its slick spreading (PLAN 4.7c).
        const sunk = sunkOf(w, now);
        // A ship is smaller than a land element's sprite (`size`): its wreck SHIP_WRECK of it.
        const own = w.kind === Wreck.ship ? size * SHIP_WRECK : size;
        if (w.kind === Wreck.ship) slicks.push({ x, y, r: own * (0.4 + 0.8 * sunk), opacity });
        const hull = own * (1 - sunk);
        if (hull > 0.5) {
          if (opacity >= 0.999) shape(solid[w.kind]!, w.kind, x, y, hull, w.angle);
          else {
            const path = new Path2D();
            shape(path, w.kind, x, y, hull, w.angle);
            fading.push({ path, kind: w.kind, opacity });
          }
        }
        // What burns goes on smoking (a ship while it is still above the water); the smoke thins as the wreck fades.
        if (w.kind !== Wreck.men && opacity > 0.5 && sunk < 0.9) {
          for (let k = 0; k < PUFFS; k++) {
            const t = ((now - w.born) / SMOKE_MS + k / PUFFS) % 1;
            const rise = t < 0 ? t + 1 : t;
            disc(puffs[Math.min(PUFF_ALPHA.length - 1, Math.floor(rise * PUFF_ALPHA.length))]!, x + 0.35 * size * rise, y - (0.2 + 1.7 * rise) * size, (0.2 + 0.42 * rise) * size);
          }
        }
        if (burst < 1) {
          disc(rings[Math.min(RING_ALPHA.length - 1, Math.floor(burst * RING_ALPHA.length))]!, x, y, size * (0.5 + 1.5 * burst));
          if (burst < 0.4) disc(flashes, x, y, size * 0.7 * (1 - burst));
          this.bursts++;
        }
      }
      if (seen) this.shown.push(w);
    }
    ctx.save();
    // The slicks first, under the hulls.
    ctx.fillStyle = SLICK;
    for (const sl of slicks) {
      ctx.globalAlpha = alpha * sl.opacity;
      ctx.beginPath();
      ctx.ellipse(sl.x, sl.y, sl.r, sl.r * 0.6, 0, 0, TAU);
      ctx.fill();
    }
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
    ctx.strokeStyle = EDGE;
    ctx.globalAlpha = alpha;
    for (const k of KINDS) {
      ctx.fillStyle = FILL[k];
      ctx.fill(solid[k]!);
      ctx.stroke(solid[k]!);
    }
    for (const f of fading) {
      ctx.globalAlpha = alpha * f.opacity;
      ctx.fillStyle = FILL[f.kind];
      ctx.fill(f.path);
      ctx.stroke(f.path);
    }
    for (let q = 0; q < PUFF_ALPHA.length; q++) {
      ctx.globalAlpha = alpha * PUFF_ALPHA[q]!;
      ctx.fillStyle = 'rgb(52, 48, 46)';
      ctx.fill(puffs[q]!);
    }
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgb(255, 224, 150)';
    for (let q = 0; q < RING_ALPHA.length; q++) {
      ctx.globalAlpha = alpha * RING_ALPHA[q]!;
      ctx.stroke(rings[q]!);
    }
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff4c2';
    ctx.fill(flashes);
    ctx.restore();
  }
}
