/**
 * The game map view: consumes sim snapshots (dirty tiles → id textures, nations → palette,
 * formations → instanced markers) and renders every animation frame with GPU interpolation
 * between the previous and current tick.
 */
import { CityLabelLayer } from '../render/labels/cityLabels';
import { LABEL_STRIDE } from '../shared/nationLabels';
import { drawNationLabels, layoutNationLabels, type Measure, type PlacedNationLabel } from '../render/labels/nationLabels';
import { t, type MessageKey } from '../ui/i18n';
import { modeColor, type MapMode, type Relation } from '../shared/mapModes';
import { NATION_STRIDE, NationField, type Snapshot } from '../shared/protocol';
import { screenToWorld, wrapOffsets, type Camera, type MapGeometry } from '../render/camera';
import { MapRenderer } from '../render/map/MapRenderer';
import { drawUnitAtlas } from '../render/units/atlas';
import { PROXY_STRIDE, ProxyRenderer } from '../render/units/ProxyRenderer';
import { CameraController } from './input/CameraController';
import type { SimClient } from './simClient';

/** Formation marker size in cells (T0/T1 placeholder until the Phase 2 LOD markers). */
const MARKER_CELLS = 0.9;

/** Label typeface (system UI stack: every script renders). */
const LABEL_FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

export class MapView {
  readonly gl: WebGL2RenderingContext;
  readonly controller: CameraController;
  /** Current map mode and the nation data it is derived from (latest snapshot). */
  mapMode: MapMode = 'political';
  /** Label overlay (PLAN 1.29) and the last layout (tests read it). */
  private readonly overlay: HTMLCanvasElement;
  private labelData: { data: Float64Array; names: string[] } | null = null;
  nationLabels: PlacedNationLabel[] = [];
  readonly cityLabels: CityLabelLayer;
  /** True once the worker's fine coast and terrain layers arrived (PLAN 1.28b). */
  hasFineCoast = false;
  private readonly ownColor = new Map<number, number>();
  private readonly allianceLeader = new Map<number, number>();
  private readonly overlordOf = new Map<number, number>();
  private readonly income = new Map<number, number>();
  private readonly atWar = new Set<number>();
  private readonly warPairs = new Set<number>();
  private readonly controlGrid: Uint16Array;
  /** Selected nation (0 = none; PLAN 1.30) and the hook the app uses to show it. */
  selected = 0;
  onSelect: (id: number) => void = () => {};
  private readonly map: MapRenderer;
  private readonly proxies: ProxyRenderer;
  private snapArrival = 0;
  private tickMs = 0;
  private lastFrame = -1;
  /** Something changed since the last draw (snapshot, resize, camera). */
  private dirty = true;
  private lastCam: Camera = { cx: NaN, cy: NaN, scale: NaN };
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
    this.controlGrid = new Uint16Array(geo.w * geo.h);
    // Click (no drag) selects the nation under the cursor.
    let down: [number, number] | null = null;
    canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    canvas.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) {
        const r = canvas.getBoundingClientRect();
        this.select(this.nationAt(e.clientX - r.left, e.clientY - r.top));
      }
      down = null;
    });
    this.overlay = document.createElement('canvas');
    this.overlay.className = 'map-labels map-nations';
    canvas.insertAdjacentElement('afterend', this.overlay);
    // City dots and names (PLAN 1.5) under the nation names (review after 1.29: they had only
    // been wired into the bench view).
    const cityCanvas = document.createElement('canvas');
    cityCanvas.className = 'map-labels map-cities';
    canvas.insertAdjacentElement('afterend', cityCanvas);
    this.cityLabels = new CityLabelLayer(cityCanvas, geo);
    sim.onLabels((m) => {
      this.labelData = { data: m.data, names: m.names.map((k) => (k.startsWith('=') ? k.slice(1) : t(k as MessageKey))) };
      this.dirty = true;
    });
    sim.onUnrest((u) => {
      this.map.setUnrest(u);
      this.dirty = true;
    });
    sim.onMapLayers((m) => {
      this.map.setLand(m.land.w, m.land.h, m.land.data);
      this.map.setTerrain(m.terrain.w, m.terrain.h, m.terrain.data, m.terrainColors);
      this.cityLabels.setCities(m.cities);
      this.map.setProvinces(this.geo.w, this.geo.h, m.province);
      this.hasFineCoast = true;
      this.dirty = true;
    });
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
      // CPU copy of control for picking (click → nation).
      for (let r = 0; r < T; r++) {
        const y = ty * T + r;
        if (y >= this.geo.h) break;
        const x0 = tx * T;
        const n = Math.min(T, this.geo.w - x0);
        this.controlGrid.set(s.tiles.controller.subarray(k * T * T + r * T, k * T * T + r * T + n), y * this.geo.w + x0);
      }
    }
    this.atWar.clear();
    this.warPairs.clear();
    for (let i = 0; i + 1 < s.wars.length; i += 2) {
      const a = s.wars[i]!;
      const b = s.wars[i + 1]!;
      this.atWar.add(a);
      this.atWar.add(b);
      this.warPairs.add(a < b ? a * 65536 + b : b * 65536 + a);
    }
    for (let i = 0; i < s.nations.count; i++) {
      const o = i * NATION_STRIDE;
      const id = s.nations.data[o + NationField.id]!;
      this.ownColor.set(id, s.nations.data[o + NationField.color]!);
      this.allianceLeader.set(id, s.nations.data[o + NationField.alliance]!);
      this.overlordOf.set(id, s.nations.data[o + NationField.overlord]!);
      this.income.set(id, s.nations.data[o + NationField.income]!);
    }
    this.applyPalette();
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
    this.dirty = true;
    this.snapArrival = performance.now();
    this.tickMs = s.tickMs;
    this.lastTick = s.tick;
  }

  /** Switches the map mode (a palette swap: no id texture is re-uploaded). */
  setMapMode(mode: MapMode): void {
    if (mode === this.mapMode) return;
    this.mapMode = mode;
    this.map.fillMode = mode === 'terrain' ? 1 : mode === 'revolts' ? 2 : 0;
    this.applyPalette();
    this.dirty = true;
  }

  private applyPalette(): void {
    const overlords = new Set(this.overlordOf.values());
    const colorOf = (id: number): number | null => (id !== 0 ? (this.ownColor.get(id) ?? null) : null);
    let maxIncome = 0;
    for (const v of this.income.values()) maxIncome = Math.max(maxIncome, v);
    const sel = this.selected;
    for (const [id, own] of this.ownColor) {
      const n = {
        own,
        allianceLeader: colorOf(this.allianceLeader.get(id) ?? 0),
        overlord: colorOf(this.overlordOf.get(id) ?? 0),
        hasPuppets: overlords.has(id),
        atWar: this.atWar.has(id),
        relation: this.relationTo(sel, id),
        incomeT: maxIncome > 0 ? Math.log1p(Math.max(0, this.income.get(id) ?? 0)) / Math.log1p(maxIncome) : 0,
      };
      this.map.setColor(id, modeColor(this.mapMode, n));
    }
  }

  /** Relation of `id` to the selected nation `sel` (diplomacy mode, PLAN 1.30). */
  private relationTo(sel: number, id: number): Relation {
    if (sel === 0) return 'none';
    if (id === sel) return 'self';
    if (this.warPairs.has(sel < id ? sel * 65536 + id : id * 65536 + sel)) return 'enemy';
    const al = this.allianceLeader.get(sel) ?? 0;
    if (al !== 0 && this.allianceLeader.get(id) === al) return 'ally';
    if (this.overlordOf.get(id) === sel || this.overlordOf.get(sel) === id) return 'subject';
    return 'neutral';
  }

  /** Display name of nation `id` from the label data (null if it has no label). */
  nationName(id: number): string | null {
    const d = this.labelData;
    if (!d) return null;
    for (let i = 0; i < d.names.length; i++) if (d.data[i * LABEL_STRIDE] === id) return d.names[i]!;
    return null;
  }

  /** Selects a nation (0 = none): diplomacy mode colours relations to it. */
  select(id: number): void {
    if (id === this.selected) return;
    this.selected = id;
    this.onSelect(id);
    this.applyPalette();
    this.dirty = true;
  }

  /** The nation controlling the cell under a CSS-px point, 0 for none. */
  nationAt(sx: number, sy: number): number {
    const [wx, wy] = screenToWorld(this.controller.cam, sx, sy, this.canvas.clientWidth, this.canvas.clientHeight);
    const y = Math.floor(wy);
    if (y < 0 || y >= this.geo.h) return 0;
    const x = ((Math.floor(wx) % this.geo.w) + this.geo.w) % this.geo.w;
    return this.controlGrid[y * this.geo.w + x] ?? 0;
  }

  private nationColor(id: number): number {
    const o = id * 4;
    const pal = this.map.palette;
    // Markers use a lighter tint of the nation colour so they read against the fill.
    const lift = (v: number): number => Math.min(255, Math.round(v * 0.55 + 115));
    return (lift(pal[o]!) << 16) | (lift(pal[o + 1]!) << 8) | lift(pal[o + 2]!);
  }

  /** Matches the backing store to the CSS size; returns true when it changed. */
  private resize(): boolean {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width === w && this.canvas.height === h) return false;
    this.canvas.width = w;
    this.canvas.height = h;
    return true;
  }

  private frame(now: number): void {
    const dt = this.lastFrame < 0 ? 0 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.controller.update(dt);
    // Redraw only when something can have changed: a new snapshot, camera motion, a resize,
    // or units still interpolating toward the latest tick. An idle map costs nothing.
    const c = this.controller.cam;
    const camMoved = c.cx !== this.lastCam.cx || c.cy !== this.lastCam.cy || c.scale !== this.lastCam.scale;
    const interpolating = this.tickMs > 0 && now - this.snapArrival < this.tickMs * 1.5;
    if (this.resize() || this.dirty || camMoved || interpolating) {
      this.draw(now);
      this.dirty = false;
      this.lastCam = { ...c };
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Renders one frame (also used by tests for deterministic screenshots). */
  draw(now = performance.now()): void {
    this.resize();
    const dpr = window.devicePixelRatio || 1;
    const cam = this.controller.cam;
    const t = this.tickMs > 0 ? (now - this.snapArrival) / this.tickMs : 1;
    this.map.draw(cam, dpr);
    this.proxies.draw(cam, dpr, t, 8, wrapOffsets(cam, this.geo, this.canvas.clientWidth));
    this.cityLabels.draw(cam, dpr);
    this.drawLabels(cam, dpr);
    this.frames++;
  }

  /** Curved nation names on the overlay canvas (PLAN 1.29); redrawn with the map. */
  private drawLabels(cam: Camera, dpr: number): void {
    const o = this.overlay;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (o.width !== Math.round(w * dpr) || o.height !== Math.round(h * dpr)) {
      o.width = Math.round(w * dpr);
      o.height = Math.round(h * dpr);
    }
    const ctx = o.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!this.labelData || this.mapMode === 'terrain' || this.mapMode === 'revolts') {
      this.nationLabels = [];
      return;
    }
    const measure: Measure = (text, px) => {
      ctx.font = `600 ${px.toFixed(1)}px ${LABEL_FONT}`;
      return ctx.measureText(text).width;
    };
    this.nationLabels = layoutNationLabels(this.labelData.data, this.labelData.names, cam, this.geo, w, h, measure);
    drawNationLabels(ctx, this.nationLabels, LABEL_FONT);
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.controller.dispose();
  }
}
