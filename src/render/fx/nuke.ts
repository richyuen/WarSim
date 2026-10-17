/**
 * A nuclear burst's effects (PLAN 6.6b, SPEC §6.4 "flash, shockwave ring and mushroom cloud at
 * every tier (scaled)"): from the snapshot's `NukeDetonated` events, on the render clock, nothing
 * of them sim state.
 *
 * - The flash (FLASH_MS): a white glow about the burst, and the whole view whitened a moment
 *   while the burst is on screen.
 * - The shockwave (SHOCK_MS): a ring running out to SHOCK_RADII blast radii, fading as it goes.
 * - The mushroom cloud (CLOUD_MS): a fireball that rises on a stem and spreads into a cap,
 *   orange to smoke, and drifts away at the end.
 *
 * Sizes follow the blast radius (sim's BLAST_KM × the yield's cube root; the equator's km per cell,
 * so a burst far from it is drawn smaller than it is: at 50° two-thirds) at the camera's scale, at
 * least MIN_PX: at T0 a burst is still a mark one sees. Every tier: the same picture, scaled.
 */
import { EVENT_STRIDE, EventKind } from '../../shared/events';
import { BLAST_KM } from '../../shared/nuclear';
import { worldToScreen, itemOffsets, type Camera, type MapGeometry } from '../camera';

export const FLASH_MS = 700;
export const SHOCK_MS = 2600;
export const CLOUD_MS = 9000;
/** The ring's reach in blast radii. */
const SHOCK_RADII = 4;
/** The least radius drawn, CSS px: a burst at T0 is seen. */
export const MIN_PX = 18;
/** Bursts held at once. */
const MAX_BURSTS = 16;

export interface Burst {
  /** Cells. */
  x: number;
  y: number;
  yieldN: number;
  born: number;
}

export class NukeFx {
  bursts: Burst[] = [];
  /** What the last `draw` put on screen (tests): flashes, rings, clouds. */
  shown = [0, 0, 0];
  until = -Infinity;
  /** Every burst drawn at this age, ms, whatever the clock (tests, screenshots); null: by the clock. */
  hold: number | null = null;

  /** Takes the bursts of a snapshot that arrived at `now`. */
  add(count: number, data: ArrayLike<number>, now: number): void {
    this.bursts = this.bursts.filter((b) => now < b.born + CLOUD_MS);
    for (let i = 0; i < count; i++) {
      const o = i * EVENT_STRIDE;
      if (data[o + 2] !== EventKind.NukeDetonated) continue;
      this.bursts.push({ x: data[o + 5]!, y: data[o + 6]!, yieldN: Math.max(1, data[o + 4]!), born: now });
      this.until = Math.max(this.until, now + CLOUD_MS);
    }
    if (this.bursts.length > MAX_BURSTS) this.bursts.splice(0, this.bursts.length - MAX_BURSTS);
  }

  clear(): void {
    this.bursts.length = 0;
    this.until = -Infinity;
  }

  animating(now: number): boolean {
    return this.hold === null && now < this.until;
  }

  /** The blast radius of `b` on screen, CSS px. */
  static radiusPx(b: Burst, cam: Camera, geo: MapGeometry): number {
    const kmPerCell = 40075 / geo.w;
    return Math.max(MIN_PX, ((BLAST_KM * Math.cbrt(b.yieldN)) / kmPerCell) * cam.scale);
  }

  draw(ctx: CanvasRenderingContext2D, cam: Camera, geo: MapGeometry, vw: number, vh: number, now: number): void {
    this.shown = [0, 0, 0];
    if (this.bursts.length === 0) return;
    const offs = itemOffsets(cam, geo, vw);
    ctx.save();
    for (const b of this.bursts) {
      const age = this.hold ?? now - b.born;
      if (age < 0 || age >= CLOUD_MS) continue;
      const r = NukeFx.radiusPx(b, cam, geo);
      for (const off of offs) {
        const [x, y] = worldToScreen(cam, b.x + off, b.y, vw, vh);
        const reach = r * (SHOCK_RADII + 1);
        if (x < -reach || y < -reach || x > vw + reach || y > vh + reach) continue;
        if (age < FLASH_MS) {
          flash(ctx, x, y, r, age / FLASH_MS, vw, vh);
          this.shown[0]!++;
        }
        if (age < SHOCK_MS) {
          ring(ctx, x, y, r, age / SHOCK_MS);
          this.shown[1]!++;
        }
        cloud(ctx, x, y, r, age / CLOUD_MS);
        this.shown[2]!++;
      }
    }
    ctx.restore();
  }
}

/** The flash at (x, y), t of its time: a white glow, the view whitened. */
function flash(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number, vw: number, vh: number): void {
  const a = 1 - t;
  ctx.globalAlpha = 0.45 * a * a;
  ctx.fillStyle = '#fffbe8';
  ctx.fillRect(0, 0, vw, vh);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,244,200,0.85)');
  g.addColorStop(1, 'rgba(255,220,150,0)');
  ctx.globalAlpha = a;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * 3, 0, Math.PI * 2);
  ctx.fill();
}

/** The shockwave, t of its time: a ring out to SHOCK_RADII radii, a bright front with a dark band of dust behind it (seen on any ground). */
function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  const e = 1 - (1 - t) * (1 - t);
  const rr = r * (0.3 + (SHOCK_RADII - 0.3) * e);
  const a = 1 - t * t;
  const band = Math.max(4, r * 0.45);
  ctx.globalAlpha = 0.55 * a;
  ctx.strokeStyle = '#5b4632';
  ctx.lineWidth = band;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, rr - band * 0.55), 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = a;
  ctx.strokeStyle = '#fff3cf';
  ctx.lineWidth = Math.max(2.5, r * 0.14);
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.stroke();
}

/** The mushroom cloud, t of its time: a fireball rising on its stem into a cap, orange to smoke. */
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
  const rise = Math.min(1, t / 0.35);
  const grow = 1 - (1 - rise) * (1 - rise);
  const fade = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25;
  // Fire's share of the colour: all at first, none by half its time.
  const fire = Math.max(0, 1 - t / 0.45);
  const top = y - r * (0.6 + 2.6 * grow);
  const capR = r * (0.55 + 0.95 * grow);
  const drift = r * 0.6 * Math.max(0, t - 0.6);
  // The stem: from the ground to under the cap, narrowing up.
  const sw = r * (0.22 + 0.12 * grow);
  ctx.globalAlpha = 0.85 * fade;
  const sg = ctx.createLinearGradient(0, y, 0, top);
  sg.addColorStop(0, mixColor('#6e5a48', '#ff8a2a', fire * 0.6));
  sg.addColorStop(1, mixColor('#8a7764', '#ffc15a', fire));
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.moveTo(x - sw, y);
  ctx.quadraticCurveTo(x - sw * 0.5, (y + top) / 2, x - sw * 0.6 + drift * 0.5, top + capR * 0.3);
  ctx.lineTo(x + sw * 0.6 + drift * 0.5, top + capR * 0.3);
  ctx.quadraticCurveTo(x + sw * 0.5, (y + top) / 2, x + sw, y);
  ctx.closePath();
  ctx.fill();
  // The skirt of dust at the foot.
  ctx.globalAlpha = 0.55 * fade;
  ctx.fillStyle = mixColor('#7d6b58', '#ff9a40', fire * 0.5);
  ctx.beginPath();
  ctx.ellipse(x, y, r * (0.5 + 0.9 * grow), r * (0.18 + 0.2 * grow), 0, 0, Math.PI * 2);
  ctx.fill();
  // The cap: billows about an ellipse, lit from below while it burns.
  const cx = x + drift;
  const lobes = 7;
  for (let k = 0; k < lobes; k++) {
    const a = Math.PI + (Math.PI * k) / (lobes - 1);
    const lx = cx + Math.cos(a) * capR * 0.75;
    const ly = top + Math.sin(a) * capR * 0.35;
    const lr = capR * (0.42 + 0.08 * Math.sin(k * 2.1));
    const g = ctx.createRadialGradient(lx, ly + lr * 0.4, lr * 0.1, lx, ly, lr);
    g.addColorStop(0, mixColor('#b3a089', '#fff0a8', fire));
    g.addColorStop(1, mixColor('#6f5f50', '#e8551c', fire));
    ctx.globalAlpha = 0.9 * fade;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(cx, top + capR * 0.15, capR * 0.1, cx, top, capR);
  g.addColorStop(0, mixColor('#a8957e', '#fff4c0', fire));
  g.addColorStop(1, mixColor('#5f5146', '#d9471a', fire));
  ctx.globalAlpha = 0.95 * fade;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(cx, top, capR, capR * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** `a` and `b` (#rrggbb) mixed, `t` of `b`. */
function mixColor(a: string, b: string, t: number): string {
  const p = (s: string, i: number): number => parseInt(s.slice(1 + 2 * i, 3 + 2 * i), 16);
  const c = [0, 1, 2].map((i) => Math.round(p(a, i) * (1 - t) + p(b, i) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
