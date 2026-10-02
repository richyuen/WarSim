/**
 * Shared unit-proxy scene for benchmark B (raw WebGL2) and BP (PixiJS): N proxies inside a
 * view rectangle walking with slowly turning headings, stepped at a fixed "tick" rate.
 * Identical inputs for both stacks so their numbers are comparable.
 */

export const TACTICAL_VIEW = { cx: 1100, cy: 330, scale: 24 };
/** Simulated snapshot rate (ticks per second) for the interpolation benchmark. */
export const TICK_HZ = 10;

export class ProxyScene {
  readonly n: number;
  prevX: Float64Array;
  prevY: Float64Array;
  x: Float64Array;
  y: Float64Array;
  heading: Float64Array;
  frame: Uint8Array;
  color: Uint32Array;
  size: Float32Array;
  private readonly x0: number;
  private readonly y0: number;
  private readonly x1: number;
  private readonly y1: number;
  private s = 12345;

  constructor(n: number, viewW: number, viewH: number, colors: number[]) {
    this.n = n;
    const halfW = viewW / TACTICAL_VIEW.scale / 2;
    const halfH = viewH / TACTICAL_VIEW.scale / 2;
    this.x0 = TACTICAL_VIEW.cx - halfW;
    this.x1 = TACTICAL_VIEW.cx + halfW;
    this.y0 = TACTICAL_VIEW.cy - halfH;
    this.y1 = TACTICAL_VIEW.cy + halfH;
    this.prevX = new Float64Array(n);
    this.prevY = new Float64Array(n);
    this.x = new Float64Array(n);
    this.y = new Float64Array(n);
    this.heading = new Float64Array(n);
    this.frame = new Uint8Array(n);
    this.color = new Uint32Array(n);
    this.size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      this.x[i] = this.x0 + this.rnd() * (this.x1 - this.x0);
      this.y[i] = this.y0 + this.rnd() * (this.y1 - this.y0);
      this.prevX[i] = this.x[i]!;
      this.prevY[i] = this.y[i]!;
      this.heading[i] = this.rnd() * Math.PI * 2;
      const f = this.rnd();
      this.frame[i] = f < 0.7 ? 0 : f < 0.9 ? 1 : f < 0.96 ? 2 : 3;
      this.size[i] = [0.35, 0.6, 0.9, 0.7][this.frame[i]!]!;
      this.color[i] = colors[1 + Math.floor(this.rnd() * (colors.length - 1))]!;
    }
  }

  private rnd(): number {
    this.s = (Math.imul(this.s, 1664525) + 1013904223) >>> 0;
    return this.s / 4294967296;
  }

  /** One simulated tick: prev ← cur, then move ~0.15 cell with a small random turn. */
  step(): void {
    for (let i = 0; i < this.n; i++) {
      this.prevX[i] = this.x[i]!;
      this.prevY[i] = this.y[i]!;
      let h = this.heading[i]! + (this.rnd() - 0.5) * 0.6;
      let nx = this.x[i]! + Math.cos(h) * 0.15;
      let ny = this.y[i]! + Math.sin(h) * 0.15;
      if (nx < this.x0 || nx > this.x1 || ny < this.y0 || ny > this.y1) {
        h += Math.PI;
        nx = this.x[i]!;
        ny = this.y[i]!;
      }
      this.heading[i] = h;
      this.x[i] = nx;
      this.y[i] = ny;
    }
  }
}
