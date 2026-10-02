/**
 * The game map view: consumes sim snapshots (dirty tiles → id textures, nations → palette,
 * formations → instanced markers) and renders every animation frame with GPU interpolation
 * between the previous and current tick.
 */
import { NATION_STRIDE, NationField, type Snapshot } from '../shared/protocol';
import { wrapOffsets, type Camera, type MapGeometry } from '../render/camera';
import { MapRenderer } from '../render/map/MapRenderer';
import { drawUnitAtlas } from '../render/units/atlas';
import { PROXY_STRIDE, ProxyRenderer } from '../render/units/ProxyRenderer';
import { CameraController } from './input/CameraController';
import type { SimClient } from './simClient';

/** Formation marker size in cells (T0/T1 placeholder until the Phase 2 LOD markers). */
const MARKER_CELLS = 0.9;

export class MapView {
  readonly gl: WebGL2RenderingContext;
  readonly controller: CameraController;
  private readonly map: MapRenderer;
  private readonly proxies: ProxyRenderer;
  private snapArrival = 0;
  private tickMs = 0;
  private lastFrame = -1;
  private raf = 0;
  /** Frames rendered (test API / stats). */
  frames = 0;
  lastTick = -1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly geo: MapGeometry,
    sim: SimClient,
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is required');
    this.gl = gl;
    this.map = new MapRenderer(gl, geo.w, geo.h, { wrapX: geo.wrapX });
    this.map.setColor(0, 0x1d3557);
    this.proxies = new ProxyRenderer(gl, drawUnitAtlas());
    this.controller = new CameraController(canvas, geo, { cx: geo.w / 2, cy: geo.h / 2, scale: 0 });
    sim.onSnapshotReceived((s) => this.apply(s));
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  get camera(): Camera {
    return this.controller.cam;
  }

  /** Copies what the view needs; the snapshot's buffers go back to the worker next frame. */
  private apply(s: Snapshot): void {
    const T = s.tiles.size;
    for (let k = 0; k < s.tiles.count; k++) {
      const t = s.tiles.ids[k]!;
      const tx = t % s.tiles.tilesX;
      const ty = (t - tx) / s.tiles.tilesX;
      this.map.updateTile(tx, ty, T, s.tiles.owner, s.tiles.controller, k * T * T);
    }
    for (let i = 0; i < s.nations.count; i++) {
      const o = i * NATION_STRIDE;
      this.map.setColor(s.nations.data[o + NationField.id]!, s.nations.data[o + NationField.color]!);
    }
    const f = s.formations;
    const p = this.proxies;
    p.reserve(f.count);
    p.originX = Math.floor(this.geo.w / 2);
    p.originY = Math.floor(this.geo.h / 2);
    for (let i = 0; i < f.count; i++) {
      const o = i * PROXY_STRIDE;
      p.data[o] = f.prevX[i]! - p.originX;
      p.data[o + 1] = f.prevY[i]! - p.originY;
      // Unwrap across the seam so interpolation never sweeps the whole map.
      let x = f.x[i]!;
      if (this.geo.wrapX && Math.abs(x - f.prevX[i]!) > this.geo.w / 2) x += x < f.prevX[i]! ? this.geo.w : -this.geo.w;
      p.data[o + 2] = x - p.originX;
      p.data[o + 3] = f.y[i]! - p.originY;
      p.data[o + 4] = f.facing[i]!;
      p.data[o + 5] = MARKER_CELLS;
      p.data[o + 6] = 0;
      p.data[o + 7] = 1;
      const col = this.nationColor(f.nation[i]!);
      p.colors[i * 4] = (col >> 16) & 255;
      p.colors[i * 4 + 1] = (col >> 8) & 255;
      p.colors[i * 4 + 2] = col & 255;
      p.colors[i * 4 + 3] = 255;
    }
    p.upload(f.count);
    this.snapArrival = performance.now();
    this.tickMs = s.tickMs;
    this.lastTick = s.tick;
  }

  private nationColor(id: number): number {
    const o = id * 4;
    const pal = this.map.palette;
    // Markers use a lighter tint of the nation colour so they read against the fill.
    const lift = (v: number): number => Math.min(255, Math.round(v * 0.55 + 115));
    return (lift(pal[o]!) << 16) | (lift(pal[o + 1]!) << 8) | lift(pal[o + 2]!);
  }

  private resize(): number {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    return dpr;
  }

  private frame(now: number): void {
    const dt = this.lastFrame < 0 ? 0 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.controller.update(dt);
    this.draw(now);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Renders one frame (also used by tests for deterministic screenshots). */
  draw(now = performance.now()): void {
    const dpr = this.resize();
    const cam = this.controller.cam;
    const t = this.tickMs > 0 ? (now - this.snapArrival) / this.tickMs : 1;
    this.map.draw(cam, dpr);
    this.proxies.draw(cam, dpr, t, 8, wrapOffsets(cam, this.geo, this.canvas.clientWidth));
    this.frames++;
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.controller.dispose();
  }
}
