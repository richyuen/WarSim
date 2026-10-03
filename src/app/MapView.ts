/**
 * The game map view: consumes sim snapshots (dirty tiles → id textures, nations → palette,
 * formations → instanced markers) and renders every animation frame with GPU interpolation
 * between the previous and current tick.
 */
import { CityLabelLayer } from '../render/labels/cityLabels';
import { LABEL_STRIDE } from '../shared/nationLabels';
import { FlagStore } from './flagStore';
import { drawMarkers, markerAlpha, T1_MIN_M, type MarkerInput, type PlacedMarker } from '../render/units/markers';
import { CounterLayer, counterAlpha, type CounterSource } from '../render/units/counters';
import { FormationFlag, tierOf, type SnapshotElements, type Subscription, type TemplateInfo } from '../shared/protocol';

/** Flags are drawn at capitals from this zoom (px per cell), at this size (PLAN 1.37b). */
const FLAG_MIN_SCALE = 3;
const FLAG_PX_W = 24;
const FLAG_PX_H = 16;
import { drawNationLabels, layoutNationLabels, type Measure, type PlacedNationLabel } from '../render/labels/nationLabels';
import { t, type MessageKey } from '../ui/i18n';
import { modeColor, type MapMode, type Relation } from '../shared/mapModes';
import { NATION_STRIDE, NationField, type Snapshot } from '../shared/protocol';
import { screenToWorld, worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../render/camera';
import { MapRenderer } from '../render/map/MapRenderer';
import { drawUnitAtlas } from '../render/units/atlas';
import { PROXY_STRIDE, ProxyRenderer } from '../render/units/ProxyRenderer';
import { CameraController } from './input/CameraController';
import type { SimClient } from './simClient';

/** Formation marker size in cells (T0/T1 placeholder until the Phase 2 LOD markers). */
const MARKER_CELLS = 0.9;
/** Element sprite size in cells: a little under the slot spacing (PLAN 2.3). */
const ELEMENT_CELLS = 0.026;

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
  private provinceGrid: Uint16Array | null = null;
  private terrainColors: number[] | null = null;
  private cities: { id: number; x: number; y: number }[] = [];

  /** The city row nearest cell (x, y) within `reach` cells, or 0 (editor tools, PLAN 1.36). */
  cityNear(x: number, y: number, reach = 2): number {
    let best = 0;
    let bestD = reach;
    for (const c of this.cities) {
      let dx = Math.abs(c.x - (x + 0.5));
      if (this.geo.wrapX) dx = Math.min(dx, this.geo.w - dx);
      const d = Math.hypot(dx, c.y - (y + 0.5));
      if (d <= bestD) {
        bestD = d;
        best = c.id;
      }
    }
    return best;
  }
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
    private readonly sim: SimClient,
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is required');
    this.gl = gl;
    this.map = new MapRenderer(gl, geo.w, geo.h, { wrapX: geo.wrapX });
    this.map.setColor(0, 0x1d3557);
    const atlas = drawUnitAtlas();
    this.proxies = new ProxyRenderer(gl, atlas);
    this.elementProxies = new ProxyRenderer(gl, atlas);
    this.controller = new CameraController(canvas, geo, { cx: geo.w / 2, cy: geo.h / 2, scale: 0 });
    sim.onSnapshotReceived((s) => this.apply(s));
    this.controlGrid = new Uint16Array(geo.w * geo.h);
    // Click (no drag) selects the nation under the cursor.
    let down: [number, number] | null = null;
    canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    canvas.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) {
        const r = canvas.getBoundingClientRect();
        const sx = e.clientX - r.left;
        const sy = e.clientY - r.top;
        const cell = this.cellAt(sx, sy);
        // A God Mode map tool or a player order consumes the click (PLAN 1.32b/1.33a); otherwise
        // it selects the nation.
        if (!(this.onPick && cell && this.onPick(cell[0], cell[1], sx, sy, e.shiftKey))) this.select(this.nationAt(sx, sy));
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
    sim.onFlags((custom) => {
      this.flags.setCustom(custom);
      this.dirty = true;
    });
    sim.onCities((cities) => {
      this.cityLabels.setCities(cities);
      this.cities = cities;
      this.dirty = true;
    });
    sim.onTerrain((data, landChanged) => {
      if (!this.terrainColors) return;
      this.map.setTerrain(this.geo.w, this.geo.h, data, this.terrainColors);
      // Imported land/water: coasts follow the cells until it matches the start again.
      this.map.useLand(!landChanged);
      this.hasFineCoast = !landChanged;
      this.dirty = true;
    });
    sim.onUnrest((u) => {
      this.map.setUnrest(u);
      this.dirty = true;
    });
    sim.onMapLayers((m) => {
      this.map.setLand(m.land.w, m.land.h, m.land.data);
      this.map.setTerrain(m.terrain.w, m.terrain.h, m.terrain.data, m.terrainColors);
      this.terrainColors = m.terrainColors;
      this.cityLabels.setCities(m.cities);
      this.cities = m.cities;
      this.templates = m.templates;
      this.map.setProvinces(this.geo.w, this.geo.h, m.province);
      this.provinceGrid = m.province;
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
      this.capitals.set(id, [s.nations.data[o + NationField.capitalX]!, s.nations.data[o + NationField.capitalY]!]);
    }
    this.applyPalette();
    const f = s.formations;
    // Copies for picking and selection rings (the snapshot buffers go back to the pool).
    this.formIds = f.id.slice(0, f.count);
    this.formNation = f.nation.slice(0, f.count);
    this.formX = f.x.slice(0, f.count);
    this.formY = f.y.slice(0, f.count);
    this.formStrength = f.strength.slice(0, f.count);
    this.formTemplate = f.template.slice(0, f.count);
    this.formFlags = f.flags.slice(0, f.count);
    this.formTarget = f.target.slice(0, f.count);
    this.majors = s.majors.slice();
    for (const id of this.selectedFormations) if (!this.formIds.includes(id)) this.selectedFormations.delete(id);
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
    this.uploadElements(s.elements);
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
  /**
   * Map click hook (God tools PLAN 1.32b, player orders PLAN 1.33a): the clicked cell, the CSS-px
   * point and Shift; returns true to consume the click.
   */
  onPick: ((x: number, y: number, sx: number, sy: number, shift: boolean) => boolean) | null = null;

  /** Whether the map renders east–west wrap copies (looping map; PLAN 1.39b1 option). */
  get wrapsX(): boolean {
    return this.geo.wrapX;
  }

  /** Unit-size setting (PLAN 1.39a): multiplies formation marker sizes. */
  unitScale = 1;

  /** Asks for a redraw on the next frame. */
  requestDraw(): void {
    this.dirty = true;
  }

  /** Player-selected formations (PLAN 1.33a), ringed on the overlay. */
  readonly selectedFormations = new Set<number>();
  private formIds = new Uint32Array(0);
  private formNation = new Uint16Array(0);
  private formX = new Float64Array(0);
  private formY = new Float64Array(0);
  private formStrength = new Uint32Array(0);
  private formTemplate = new Uint16Array(0);
  private formFlags = new Uint8Array(0);
  private formTarget = new Uint32Array(0);
  private majors = new Float32Array(0);
  private templates: TemplateInfo[] = [];
  /** T1 markers drawn last frame, CSS px (tests), and the layer's opacity (PLAN 2.1). */
  markerRects: PlacedMarker[] = [];
  markerOpacity = 0;
  /** T0 counters (PLAN 2.2). */
  readonly counters = new CounterLayer();

  /** Element sprites (PLAN 2.3) from the snapshot's interest-managed elements section. */
  private readonly elementProxies: ProxyRenderer;
  /** Elements in the last snapshot (tests). */
  elementCount = 0;
  elementTruncated = false;
  elementFormation = new Uint32Array(0);
  elementX = new Float64Array(0);
  elementY = new Float64Array(0);
  elementStrength = new Uint16Array(0);
  /** The last subscription sent (tests). */
  subscription: Subscription | null = null;
  private lastSub = '';
  private lastSubAt = -1;

  private uploadElements(e: SnapshotElements): void {
    const p = this.elementProxies;
    this.elementCount = e.count;
    this.elementTruncated = e.truncated;
    // Copies for tests (the snapshot buffers go back to the pool).
    this.elementFormation = e.formation.slice(0, e.count);
    this.elementX = e.x.slice(0, e.count);
    this.elementY = e.y.slice(0, e.count);
    this.elementStrength = e.strength.slice(0, e.count);
    p.reserve(e.count);
    p.originX = Math.floor(this.geo.w / 2);
    p.originY = Math.floor(this.geo.h / 2);
    for (let i = 0; i < e.count; i++) {
      const o = i * PROXY_STRIDE;
      p.data[o] = e.prevX[i]! - p.originX;
      p.data[o + 1] = e.prevY[i]! - p.originY;
      let x = e.x[i]!;
      if (this.geo.wrapX && Math.abs(x - e.prevX[i]!) > this.geo.w / 2) x += x < e.prevX[i]! ? this.geo.w : -this.geo.w;
      p.data[o + 2] = x - p.originX;
      p.data[o + 3] = e.y[i]! - p.originY;
      p.data[o + 4] = e.facing[i]!;
      p.data[o + 5] = ELEMENT_CELLS;
      p.data[o + 6] = e.frame[i]! + ((e.flags[i]! & FormationFlag.moving) !== 0 ? 0.5 : 0);
      // Depleted elements fade a little (an empty one is gone from the sim).
      p.data[o + 7] = 0.55 + 0.45 * Math.min(1, e.strength[i]! / 8);
      // Lightened toward white so a sprite stands out on its own nation's fill.
      const col = this.nationColor(e.nation[i]!);
      const lift = (v: number): number => Math.round(v + (255 - v) * 0.45);
      p.colors[i * 4] = lift((col >> 16) & 255);
      p.colors[i * 4 + 1] = lift((col >> 8) & 255);
      p.colors[i * 4 + 2] = lift(col & 255);
      p.colors[i * 4 + 3] = 255;
    }
    p.upload(e.count);
  }

  /**
   * Interest management (SPEC §8): the camera's bbox padded by 25%, tier and whether elements
   * are wanted, sent at most 10 times a second and only when it changed.
   */
  private maybeSubscribe(now: number): void {
    if (now - this.lastSubAt < 100) return;
    const cam = this.controller.cam;
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    const hw = (vw / 2 / cam.scale) * 1.25;
    const hh = (vh / 2 / cam.scale) * 1.25;
    const tier = tierOf(this.metresPerPx);
    const sub: Subscription = { bbox: [cam.cx - hw, cam.cy - hh, cam.cx + hw, cam.cy + hh], z: Math.log2(cam.scale), tier, wantsElements: tier >= 1.5 };
    // Quantise so tiny camera motion does not resend.
    const key = `${tier}|${sub.bbox.map((v) => Math.round(v * 4)).join(',')}`;
    if (key === this.lastSub) return;
    this.lastSub = key;
    this.lastSubAt = now;
    this.subscription = sub;
    this.sim.subscribe(sub);
  }

  /** Metres per CSS pixel at the current zoom. */
  get metresPerPx(): number {
    return (this.geo.kmPerCell * 1000) / this.controller.cam.scale;
  }

  /**
   * Only the unit layers (T0 counters, T1 markers) at `now`, without the map: scripted zoom
   * recordings check their continuity without software-rendering the map (PLAN 2.2 AT).
   */
  drawUnitLayers(now: number): void {
    this.resize();
    this.drawUnitMarkers(this.controller.cam, now);
  }

  /** T1 operational markers (PLAN 2.1) and T0 counters (PLAN 2.2) on the overlay. */
  private drawUnitMarkers(cam: Camera, now: number): void {
    const alpha = markerAlpha(this.metresPerPx);
    this.markerOpacity = alpha;
    this.markerRects = [];
    const ctx = this.overlay.getContext('2d')!;
    // The nation's own colour in every map mode (the palette carries the mode's colours).
    const hex = (id: number): string => `#${(this.ownColor.get(id) ?? 0x888888).toString(16).padStart(6, '0')}`;
    const flagOf = (n: number): CanvasImageSource | null => this.flags.canvasOf(n);
    const src: CounterSource[] = [];
    for (let i = 0; i < this.formIds.length; i++) src.push({ x: this.formX[i]!, y: this.formY[i]!, nation: this.formNation[i]!, strength: this.formStrength[i]! });
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    this.counters.draw(ctx, src, cam, this.geo, vw, vh, counterAlpha(this.metresPerPx, alpha), now, hex, flagOf, this.unitScale);
    if (alpha <= 0.01) return;
    const w = this.geo.w;
    const markers: MarkerInput[] = [];
    for (let i = 0; i < this.formIds.length; i++) {
      const t = this.templates[this.formTemplate[i]!];
      const moving = (this.formFlags[i]! & FormationFlag.moving) !== 0;
      const target = this.formTarget[i]!;
      markers.push({
        id: this.formIds[i]!,
        nation: this.formNation[i]!,
        x: this.formX[i]!,
        y: this.formY[i]!,
        strength: this.formStrength[i]!,
        full: t?.men ?? 0,
        symbol: t?.symbol ?? 'infantry',
        engaged: (this.formFlags[i]! & FormationFlag.engaged) !== 0,
        target: moving ? [(target % w) + 0.5, Math.floor(target / w) + 0.5] : null,
      });
    }
    this.markerRects = drawMarkers(ctx, markers, this.majors, cam, this.geo, vw, vh, alpha, hex, flagOf, this.unitScale);
  }

  /** Position of formation `id` from the last snapshot, or null. */
  formationPos(id: number): [number, number] | null {
    const i = this.formIds.indexOf(id);
    return i < 0 ? null : [this.formX[i]!, this.formY[i]!];
  }

  /** Formations of `nation` in the last snapshot. */
  formationsOf(nation: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.formIds.length; i++) if (this.formNation[i] === nation) out.push(this.formIds[i]!);
    return out;
  }

  /** The formation of `nation` nearest a CSS-px point within `radius` px, or 0. */
  formationAt(sx: number, sy: number, nation: number, radius = 14): number {
    const cam = this.controller.cam;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    let best = 0;
    let bestD = radius;
    for (let i = 0; i < this.formIds.length; i++) {
      if (this.formNation[i] !== nation) continue;
      for (const off of wrapOffsets(cam, this.geo, w)) {
        const [px, py] = worldToScreen(cam, this.formX[i]! + off, this.formY[i]!, w, h);
        const d = Math.hypot(px - sx, py - sy);
        if (d < bestD) {
          bestD = d;
          best = this.formIds[i]!;
        }
      }
    }
    return best;
  }

  /** Nation flags (PLAN 1.37b): custom pixel flags, else the scenario's, else plain colour. */
  readonly flags = new FlagStore((id) => this.ownColor.get(id));
  private readonly capitals = new Map<number, [number, number]>();
  /** Where flags were drawn last frame, CSS px (tests). */
  flagRects: { id: number; x: number; y: number; w: number; h: number }[] = [];

  /** Flags above living nations' capitals once zoomed in (FLAG_MIN_SCALE px per cell). */
  private drawFlags(cam: Camera): void {
    this.flagRects = [];
    if (cam.scale < FLAG_MIN_SCALE || this.capitals.size === 0) return;
    const ctx = this.overlay.getContext('2d')!;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const [id, [cx, cy]] of this.capitals) {
      if (!this.ownColor.has(id)) continue;
      for (const off of wrapOffsets(cam, this.geo, w)) {
        const [px, py] = worldToScreen(cam, cx + off, cy, w, h);
        const x = Math.round(px - FLAG_PX_W / 2);
        const y = Math.round(py - FLAG_PX_H - 8);
        if (x < -FLAG_PX_W || y < -FLAG_PX_H || x > w || y > h) continue;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x - 1, y - 1, FLAG_PX_W + 2, FLAG_PX_H + 2);
        ctx.drawImage(this.flags.canvasOf(id), x, y, FLAG_PX_W, FLAG_PX_H);
        this.flagRects.push({ id, x, y, w: FLAG_PX_W, h: FLAG_PX_H });
      }
    }
    ctx.restore();
  }

  /** Rings around the selected formations (PLAN 1.33a). */
  private drawSelection(cam: Camera): void {
    if (this.selectedFormations.size === 0) return;
    const ctx = this.overlay.getContext('2d')!;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffe28a';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    for (let i = 0; i < this.formIds.length; i++) {
      if (!this.selectedFormations.has(this.formIds[i]!)) continue;
      for (const off of wrapOffsets(cam, this.geo, w)) {
        const [px, py] = worldToScreen(cam, this.formX[i]! + off, this.formY[i]!, w, h);
        if (px < -20 || py < -20 || px > w + 20 || py > h + 20) continue;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /** The cell under a CSS-px point (x wrapped), or null off the map. */
  cellAt(sx: number, sy: number): [number, number] | null {
    const [wx, wy] = screenToWorld(this.controller.cam, sx, sy, this.canvas.clientWidth, this.canvas.clientHeight);
    const y = Math.floor(wy);
    if (y < 0 || y >= this.geo.h) return null;
    return [((Math.floor(wx) % this.geo.w) + this.geo.w) % this.geo.w, y];
  }

  /** Admin-1 province of a cell (0 = none or not yet known). */
  provinceAt(x: number, y: number): number {
    return this.provinceGrid?.[y * this.geo.w + x] ?? 0;
  }

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
    this.maybeSubscribe(now);
    // Redraw only when something can have changed: a new snapshot, camera motion, a resize,
    // or units still interpolating toward the latest tick. An idle map costs nothing.
    const c = this.controller.cam;
    const camMoved = c.cx !== this.lastCam.cx || c.cy !== this.lastCam.cy || c.scale !== this.lastCam.scale;
    const interpolating = (this.tickMs > 0 && now - this.snapArrival < this.tickMs * 1.5) || this.counters.animating(now);
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
    // Below T1: element sprites (PLAN 2.3) fading in as the markers fade out; formation sprites
    // only stand in where no elements arrived yet (element-less formations, before the first
    // subscribed snapshot). T0 has counters (PLAN 2.2) and T1 markers (PLAN 2.1).
    const unitsIn = this.metresPerPx < T1_MIN_M ? 1 - markerAlpha(this.metresPerPx) : 0;
    if (unitsIn > 0.01) {
      const offs = wrapOffsets(cam, this.geo, this.canvas.clientWidth);
      if (this.elementCount > 0) this.elementProxies.draw(cam, dpr, t, 5, offs, this.unitScale, now / 1000, unitsIn);
      else this.proxies.draw(cam, dpr, t, 8, offs, this.unitScale, now / 1000, unitsIn);
    }
    this.cityLabels.draw(cam, dpr);
    this.drawLabels(cam, dpr);
    // Unit markers below capital flags, so capitals stay readable (PLAN 2.1).
    this.drawUnitMarkers(cam, now);
    this.drawFlags(cam);
    this.drawSelection(cam);
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
