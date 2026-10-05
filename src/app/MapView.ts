/**
 * The game map view: consumes sim snapshots (dirty tiles → id textures, nations → palette,
 * formations → instanced markers) and renders every animation frame with GPU interpolation
 * between the previous and current tick.
 */
import { CityLabelLayer, NAME_CLEAR_PX, type NameObstacle } from '../render/labels/cityLabels';
import { LABEL_STRIDE } from '../shared/nationLabels';
import { FlagStore } from './flagStore';
import { AT_REST, drawMarkers, MARKER_H, MARKER_W, markerMorph, MORPH_MS, strengthText, T1_MAX_M, T1_MIN_M, type MarkerInput, type MarkerMorph, type PlacedMarker } from '../render/units/markers';
import { drawTags, layoutTags, type PlacedTag, type TagInput } from '../render/units/tags';
import { MarkerStacks, type StackItem } from '../render/units/markerStacks';
import { CounterLayer, type CounterSource } from '../render/units/counters';
import { TierHandover } from '../render/units/handover';
import { spriteAlpha } from '../render/units/elementSprite';
import { figureCells, figureCount, figureOffsets, gridSide, T3_MAX_M } from '../render/units/individuals';
import { FireFx } from '../render/fx/fire';
import { WreckFx } from '../render/fx/wrecks';
import { FADE_MS, progress, running, smooth, SwitchBank, TimedSwitch, ZOOM_HYSTERESIS } from '../render/timing';
import { FormationFlag, marching, type SnapshotElements, type Subscription, type TemplateInfo } from '../shared/protocol';
import { viewSubscription } from './subscription';

/** Flags are drawn at capitals from this zoom (px per cell), at this size (PLAN 1.37b). */
const FLAG_MIN_SCALE = 3;
const FLAG_PX_W = 24;
const FLAG_PX_H = 16;
/** A flag that makes way for a counter stands this many px above it (frame included), and takes this long to move. */
const FLAG_CLEAR_PX = 3;
const FLAG_MOVE_MS = 150;
/** Further than this above its usual place a flag no longer reads as its capital's: it is left out. */
const FLAG_MAX_RISE = 40;
import { drawNationLabels, fadeNationLabels, layoutNationLabels, type Measure, type PlacedNationLabel } from '../render/labels/nationLabels';
import { t, type MessageKey } from '../ui/i18n';
import { Frame, shownFrame } from '../shared/unitLooks';
import { modeColor, type MapMode, type Relation } from '../shared/mapModes';
import { NATION_STRIDE, NationField, type Snapshot } from '../shared/protocol';
import { screenToWorld, worldToScreen, wrapOffsets, type Camera, type MapGeometry } from '../render/camera';
import { groundReach } from '../render/map/ground';
import { GROUND_CAP, GroundInstances } from '../render/map/GroundInstances';
import { MapRenderer } from '../render/map/MapRenderer';
import type { LandMask } from '../shared/landMask';
import { cityIndex, scatter, type Scatter, type ScatterWorld } from '../render/map/scatter';
import { drawUnitAtlas } from '../render/units/atlas';
import { PROXY_STRIDE, ProxyRenderer } from '../render/units/ProxyRenderer';
import { CameraController } from './input/CameraController';
import type { SimClient } from './simClient';

/**
 * A tool that paints on a primary-button drag (PLAN 1.44). Positions are world cells, fractional,
 * with x not wrapped. While `active()`, a press calls `start`, every further cell the pointer
 * enters `move`, and the release `end` (`cancel` when the drag is taken away: a second finger, a
 * lost pointer); the camera does not pan on that button meanwhile.
 */
/** A copy of a snapshot's element section that outlives the snapshot's buffers. */
function copyElements(e: SnapshotElements): SnapshotElements {
  const n = e.count;
  return {
    count: n,
    id: e.id.slice(0, n),
    formation: e.formation.slice(0, n),
    nation: e.nation.slice(0, n),
    frame: e.frame.slice(0, n),
    strength: e.strength.slice(0, n),
    size: e.size.slice(0, n),
    x: e.x.slice(0, n),
    y: e.y.slice(0, n),
    prevX: e.prevX.slice(0, n),
    prevY: e.prevY.slice(0, n),
    facing: e.facing.slice(0, n),
    flags: e.flags.slice(0, n),
    truncated: e.truncated,
  };
}

export interface PaintDrag {
  active(): boolean;
  start(x: number, y: number): void;
  move(x: number, y: number): void;
  end(x: number, y: number): void;
  cancel(): void;
}

/** Size in cells of a formation's stand-in sprite: drawn at T2 and T3 where no elements have arrived (`drawSprites`). */
const MARKER_CELLS = 0.9;
/**
 * And at most this many px (PLAN 2.7n3). A stand-in stands for a formation, as a marker does:
 * it does not grow with the zoom. At 0.9 cells it was 17,611 px wide at 1 m/px, and a formation
 * some kilometres from the view covered it in its nation's tint.
 */
const STAND_IN_MAX_PX = 48;
/** Element sprite size in cells: a little under the slot spacing (PLAN 2.3). */
const ELEMENT_CELLS = 0.026;
/**
 * Where the camera goes for a battle (`showBattle`, PLAN 2.14e): 20 m/px, the zoom at which two
 * divisions deployed against each other are whole in a view of 1400 × 800 (PLAN 2.14c1). A
 * smaller view keeps 28 km of ground across and 14 down at more metres a pixel, up to 250: under
 * T2's limit (T1_MIN_M less the hysteresis), so that elements are what is drawn.
 */
const BATTLE_VIEW_M = 20;
const BATTLE_VIEW_KM = 28;
const BATTLE_VIEW_MAX_M = 250;
/** T3 (PLAN 2.6): a figure is at least this many px, so that a block reads at 30 m/px. */
const FIGURE_MIN_PX = 2.5;
/** Below this many m/px the last element section is kept for building the figures (twice T3's limit: a wheel step away). */
const T3_KEEP_M = 60;
/** Figures in one build: six times the 10,000 proxies of the PLAN 2.3 bench. */
const MAX_INDIVIDUALS = 60_000;
/** A wreck is drawn the size of its element's sprite, at most this (CSS px): at T3 the sprite's size is not a size any more. */
const WRECK_MAX_PX = 30;

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
  /** The fine land mask the worker sent (PLAN 2.9b): the coast of T2 and T3, and where nothing of the scatter stands. */
  private fineMask: LandMask | null = null;
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
  /** The trees, rocks and buildings of T2 and T3 (PLAN 2.8c2): drawn over the map, under the units. */
  private readonly groundThings: GroundInstances;
  /** What the scatter needs of the world: set when the map layers come, kept up with the editor's terrain and cities. */
  private scatterWorld: ScatterWorld | null = null;
  /** The view the instances in hand were scattered for. */
  private scatterKey = '';
  /** The scatter of the last frame that drew instances (tests and stats); null: none were drawn. */
  groundScatter: Scatter | null = null;
  /** The share of the ground of T2 and T3, and of what stands on it, in the frame drawn last (tests). */
  groundShare = 0;
  /** Whether the instances are drawn (off: the ground without them; tests of the ground's texture). */
  instances = true;
  /** Whether the element sprites and figures are drawn (off: tests read the ground they stand on). */
  sprites = true;
  private snapArrival = 0;
  /** The length of the step the sprites are on, ms; 0: they stand where the tick has them. */
  private tickMs = 0;
  private lastFrame = -1;
  /** Something changed since the last draw (snapshot, resize, camera). */
  private dirty = true;
  private lastCam: Camera = { cx: NaN, cy: NaN, scale: NaN };
  private raf = 0;
  /** Frames rendered (test API / stats). */
  frames = 0;
  lastTick = -1;
  /** Snapshots applied (tests: one of a tick already in hand does not move `lastTick`). */
  snapshots = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    readonly geo: MapGeometry,
    private readonly sim: SimClient,
  ) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 is required');
    this.gl = gl;
    this.map = new MapRenderer(gl, geo.w, geo.h, { wrapX: geo.wrapX, cellM: geo.kmPerCell * 1000 });
    this.map.setColor(0, 0x1d3557);
    const atlas = drawUnitAtlas();
    this.proxies = new ProxyRenderer(gl, atlas);
    this.groundThings = new GroundInstances(gl);
    this.elementProxies = new ProxyRenderer(gl, atlas);
    this.individualProxies = new ProxyRenderer(gl, atlas);
    this.controller = new CameraController(canvas, geo, { cx: geo.w / 2, cy: geo.h / 2, scale: 0 });
    sim.onSnapshotReceived((s) => this.apply(s));
    this.controlGrid = new Uint16Array(geo.w * geo.h);
    // A paint tool takes the primary button (PLAN 1.44): the press starts a stroke that follows
    // the pointer from cell to cell until the release, and the camera leaves that button alone.
    // World x is not wrapped here, so a stroke crosses the map's seam.
    this.controller.leftPans = () => !this.paint?.active();
    const worldAt = (e: PointerEvent): [number, number] => {
      const r = canvas.getBoundingClientRect();
      return screenToWorld(this.controller.cam, e.clientX - r.left, e.clientY - r.top, canvas.clientWidth, canvas.clientHeight);
    };
    let stroke: { id: number; cx: number; cy: number } | null = null;
    window.addEventListener('pointermove', (e) => {
      if (!stroke || e.pointerId !== stroke.id) return;
      const [wx, wy] = worldAt(e);
      if (Math.floor(wx) === stroke.cx && Math.floor(wy) === stroke.cy) return;
      stroke.cx = Math.floor(wx);
      stroke.cy = Math.floor(wy);
      this.paint?.move(wx, wy);
    });
    window.addEventListener('pointerup', (e) => {
      if (!stroke || e.pointerId !== stroke.id) return;
      stroke = null;
      this.paint?.end(...worldAt(e));
    });
    window.addEventListener('pointercancel', (e) => {
      if (!stroke || e.pointerId !== stroke.id) return;
      stroke = null;
      this.paint?.cancel();
    });
    // Click (no drag) of the primary button selects the nation under the cursor.
    let down: [number, number] | null = null;
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      if (stroke) {
        // A second finger: the stroke stops where it is and the two fingers move the map.
        stroke = null;
        this.paint?.cancel();
        return;
      }
      if (this.paint?.active()) {
        const [wx, wy] = worldAt(e);
        stroke = { id: e.pointerId, cx: Math.floor(wx), cy: Math.floor(wy) };
        canvas.setPointerCapture?.(e.pointerId);
        this.paint.start(wx, wy);
        return;
      }
      down = [e.clientX, e.clientY];
    });
    canvas.addEventListener('pointerup', (e) => {
      if (e.button !== 0) return;
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
    // City dots and names (PLAN 1.5; review after 1.29: they had only been wired into the bench
    // view), on a canvas under the overlay. The nation names are drawn on it too, under them
    // (PLAN 2.7t).
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
      if (this.scatterWorld) this.scatterWorld.cities = cityIndex(cities, this.geo.w, this.geo.h, this.geo.kmPerCell);
      this.scatterKey = '';
      this.dirty = true;
    });
    sim.onTerrain((data, landChanged) => {
      if (!this.terrainColors) return;
      this.map.setTerrain(this.geo.w, this.geo.h, data, this.terrainColors);
      // Imported land/water: coasts follow the cells until it matches the start again.
      this.map.useLand(!landChanged);
      this.hasFineCoast = !landChanged;
      if (this.scatterWorld) {
        this.scatterWorld.terrain = data;
        this.scatterWorld.mask = landChanged ? null : this.fineMask;
      }
      this.scatterKey = '';
      this.dirty = true;
    });
    sim.onUnrest((u) => {
      this.map.setUnrest(u);
      this.dirty = true;
    });
    sim.onElevation((e) => {
      this.map.setElevation(e.w, e.h, e.data);
      this.dirty = true;
    });
    sim.onLandMask((mask) => {
      // The scatter's water, read on the CPU whatever the GPU takes, and the coast of T2 and T3
      // (PLAN 2.9b2). Where the texture does not fit, the drawn coast stays the coverage's.
      this.fineMask = mask;
      this.map.setLandMask(mask);
      if (this.scatterWorld) this.scatterWorld.mask = this.fineMask;
      this.scatterKey = '';
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
      this.scatterWorld = { w: this.geo.w, h: this.geo.h, wrapX: this.geo.wrapX, kmPerCell: this.geo.kmPerCell, terrain: m.terrain.data, mask: this.fineMask, cities: cityIndex(m.cities, this.geo.w, this.geo.h, this.geo.kmPerCell) };
      this.scatterKey = '';
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
    // What the view knows of each nation is what this snapshot says, and of no other nation: a
    // snapshot has a row for every nation of its world. A world loaded into a running game can
    // have fewer (PLAN 2.7q): the flag of a nation made by a revolt stayed over its capital after
    // a scenario without that nation was imported.
    this.ownColor.clear();
    this.allianceLeader.clear();
    this.overlordOf.clear();
    this.income.clear();
    this.capitals.clear();
    for (let i = 0; i < s.nations.count; i++) {
      const o = i * NATION_STRIDE;
      const id = s.nations.data[o + NationField.id]!;
      this.ownColor.set(id, s.nations.data[o + NationField.color]!);
      this.allianceLeader.set(id, s.nations.data[o + NationField.alliance]!);
      this.overlordOf.set(id, s.nations.data[o + NationField.overlord]!);
      this.income.set(id, s.nations.data[o + NationField.income]!);
      // A destroyed nation's row stays, with where its capital last was: it has no flag to fly.
      if (s.nations.data[o + NationField.living] === 1) this.capitals.set(id, [s.nations.data[o + NationField.capitalX]!, s.nations.data[o + NationField.capitalY]!]);
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
      p.data[o + 2] = this.unwrapped(f.x[i]!, f.prevX[i]!) - p.originX;
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
    const arrived = performance.now();
    // The sprites' clock starts with a new tick. A snapshot of the tick in hand (a new
    // subscription, a pause, another speed) brings the same step again: they go on from where
    // they are, at the new tick length (PLAN 2.7h).
    // A pause has no tick length. The sprites finish the step they are on at the length it had,
    // and then stand (PLAN 2.7y): put at the tick's end at once, every marching sprite jumped by
    // the rest of its step in the frame of the pause.
    if (s.tick !== this.lastTick) {
      this.snapArrival = arrived;
      this.tickMs = s.tickMs;
    } else if (s.tickMs > 0 && s.tickMs !== this.tickMs) {
      this.snapArrival = arrived - this.tickProgress(arrived) * s.tickMs;
      this.tickMs = s.tickMs;
    }
    this.fire.add(s.fires.count, s.fires.data, arrived, s.tickMs, this.geo);
    this.firesDropped = s.fires.dropped;
    this.wrecks.add(s.events.count, s.events.data, arrived);
    this.lastTick = s.tick;
    this.snapshots++;
  }

  /**
   * How far the sprites are on their way from the tick before to the tick in hand at `now`, 0–1.
   * A tick that came while the game was paused or at full speed has no length: they stand where
   * it has them. A pause in a tick with a length lets them finish the step (PLAN 2.7y).
   */
  tickProgress(now = performance.now()): number {
    return this.tickMs > 0 ? Math.max(0, Math.min(1, (now - this.snapArrival) / this.tickMs)) : 1;
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

  /** The tool that paints on a primary-button drag, if any (PLAN 1.44; the editor's brush and line). */
  paint: PaintDrag | null = null;

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
  /** The stacks of the T1 markers: which are in one, and the fade of a change (PLAN 2.7s1). */
  readonly markerStacks = new MarkerStacks();
  markerOpacity = 0;
  /** T0 counters (PLAN 2.2). */
  readonly counters = new CounterLayer();
  /**
   * Which of two unit layers shows at each tier boundary, and the cross-fade between them (PLAN
   * 1.45a, 2.7b): T0 counters ↔ T1 markers, T1 markers ↔ T2 element sprites, T2 sprites ↔ T3
   * individuals.
   */
  readonly handover = new TierHandover(T1_MAX_M);
  readonly tactical = new TierHandover(T1_MIN_M, MORPH_MS);
  readonly close = new TierHandover(T3_MAX_M);
  /** The nearer layer's share at each of them, in the frame being drawn (`tierShares`). */
  readonly shares = { markers: 0, elements: 0, individuals: 0 };
  /** The markers on their way into the sprites, in the frame being drawn (PLAN 2.7c). */
  morph: MarkerMorph = AT_REST;
  /** The fire of the elements in view at T2 (PLAN 2.4), and the worker's count of fires it dropped. */
  readonly fire = new FireFx();
  firesDropped = 0;
  /** The ends of elements at T2 and the wrecks they leave (PLAN 2.4b). */
  readonly wrecks = new WreckFx();

  /**
   * True while a unit layer still animates: a counter split, merge or fold, a handover between
   * two tiers, a capital flag making way for a counter, a shot on its way, or the burst of an
   * element's end. (A wreck then lies and smokes for seconds: `frame` keeps drawing for it,
   * but it is not a change to wait for.)
   */
  unitsAnimating(now = performance.now()): boolean {
    const handing = this.handover.animating(now) || this.tactical.animating(now) || this.close.animating(now) || this.flagsIn.animating(now) || this.cityLabels.animating(now) || this.nameStates.animating(now);
    return this.counters.animating(now) || this.markerStacks.animating(now) || handing || running(now, this.flagMoveStart, FLAG_MOVE_MS) || this.fire.animating(now) || this.wrecks.bursting(now);
  }

  /** Opacity of the element sprites, their figures and their fire in the frame being drawn: in as the T1 markers go out. */
  get elementOpacity(): number {
    return this.shares.elements;
  }

  /**
   * The layers' shares for a frame at `now`: each handover is asked once a frame. The figures
   * of T3 are built here, in the frame the close tier wants them, from the elements at hand: a
   * snapshot subscribed at T3 is a frame or two away, and the cross-fade needs both layers.
   */
  private tierShares(now: number): void {
    const m = this.metresPerPx;
    this.shares.markers = this.handover.share(m, now);
    // T1 ↔ T2 in two parts: the box and the sprites cross-fade first, then the bar goes.
    const change = markerMorph(this.tactical.linear(m, now));
    this.shares.elements = change.elements;
    this.morph = change.morph;
    const wanted = m <= (this.close.near ? T3_MAX_M * ZOOM_HYSTERESIS : T3_MAX_M);
    // The figures are drawn while the close tier is on and while it fades out: for as long,
    // they are of the snapshot in hand (PLAN 2.7j).
    if ((wanted || this.close.animating(now)) && !this.individualsBuilt && this.elementSection) this.buildIndividuals(this.elementSection);
    // Which of the two close layers shows is a matter of the zoom, with one exception: elements
    // whose figures cannot be drawn (their section not kept yet, or more figures than the cap)
    // keep their sprites. Where there are no elements at all there is nothing to keep, and the
    // close tier stays as the zoom has it (PLAN 2.7p). It went off there, and a pan onto a
    // formation turned it on again with its fade: 250 ms of element sprites at the zoom of figures.
    const figures = this.individualsBuilt && this.individualCount > 0;
    this.shares.individuals = this.close.share(figures || this.elementCount === 0 ? m : Infinity, now);
    this.individualsShown = this.close.near === true;
  }
  /** The last frame drawn left a unit animation unfinished (see `frameAt`). */
  private unitsAnimated = false;

  /** Element sprites (PLAN 2.3) from the snapshot's interest-managed elements section. */
  private readonly elementProxies: ProxyRenderer;
  /** Elements in the last snapshot (tests). */
  elementCount = 0;
  elementTruncated = false;
  elementId = new Uint32Array(0);
  elementFormation = new Uint32Array(0);
  elementX = new Float64Array(0);
  elementY = new Float64Array(0);
  elementStrength = new Uint16Array(0);
  /** The flags of each element's formation, as the snapshot carried them (`FormationFlag`; tests). */
  elementFlags = new Uint8Array(0);
  /** The units of each element when whole, as the snapshot carried them (tests). */
  elementSize = new Uint16Array(0);
  /** The opacity element sprite `i` was uploaded with: what is left of the element (tests). */
  elementAlpha(i: number): number {
    return this.elementProxies.data[i * PROXY_STRIDE + 7]!;
  }
  /** The facing element sprite `i` was uploaded with, radians (tests). */
  elementFacing(i: number): number {
    return this.elementProxies.data[i * PROXY_STRIDE + 4]!;
  }
  /** Whether element sprite `i` was uploaded as walking (tests). */
  elementWalks(i: number): boolean {
    return this.elementProxies.data[i * PROXY_STRIDE + 6]! % 1 > 0.25;
  }
  /** The atlas frame element sprite `i` and figure `j` were uploaded with (`Frame`; tests). */
  elementFrame(i: number): number {
    return Math.floor(this.elementProxies.data[i * PROXY_STRIDE + 6]!);
  }
  individualFrame(j: number): number {
    return Math.floor(this.individualProxies.data[j * PROXY_STRIDE + 6]!);
  }
  /** Whether figure `j` was uploaded as walking (tests). */
  individualWalks(j: number): boolean {
    return this.individualProxies.data[j * PROXY_STRIDE + 6]! % 1 > 0.25;
  }
  /** The tint of element sprite `i` as it was uploaded: [r, g, b] (tests). */
  elementTint(i: number): [number, number, number] {
    const c = this.elementProxies.colors;
    return [c[i * 4]!, c[i * 4 + 1]!, c[i * 4 + 2]!];
  }
  /** The last subscription sent (tests). */
  subscription: Subscription | null = null;
  private lastSub = '';
  private lastSubAt = -1;

  private uploadElements(e: SnapshotElements): void {
    const p = this.elementProxies;
    this.elementCount = e.count;
    this.elementTruncated = e.truncated;
    // Copies for tests (the snapshot buffers go back to the pool).
    this.elementId = e.id.slice(0, e.count);
    this.elementFormation = e.formation.slice(0, e.count);
    this.elementX = e.x.slice(0, e.count);
    this.elementY = e.y.slice(0, e.count);
    this.elementStrength = e.strength.slice(0, e.count);
    this.elementFlags = e.flags.slice(0, e.count);
    this.elementSize = e.size.slice(0, e.count);
    p.reserve(e.count);
    p.originX = Math.floor(this.geo.w / 2);
    p.originY = Math.floor(this.geo.h / 2);
    for (let i = 0; i < e.count; i++) {
      const o = i * PROXY_STRIDE;
      p.data[o] = e.prevX[i]! - p.originX;
      p.data[o + 1] = e.prevY[i]! - p.originY;
      p.data[o + 2] = this.unwrapped(e.x[i]!, e.prevX[i]!) - p.originX;
      p.data[o + 3] = e.y[i]! - p.originY;
      p.data[o + 4] = e.facing[i]!;
      p.data[o + 5] = ELEMENT_CELLS;
      // The walk is for a formation on the march: one that holds in contact stands (PLAN 2.11e).
      // Infantry in contact is down and firing (PLAN 2.14c2).
      p.data[o + 6] = shownFrame(e.frame[i]!, (e.flags[i]! & FormationFlag.engaged) !== 0) + (marching(e.flags[i]!) ? 0.5 : 0);
      // What is left of the element: its share of its size (PLAN 2.11g; an empty one is gone from the sim).
      p.data[o + 7] = spriteAlpha(e.strength[i]!, e.size[i]!);
      p.colors.set(this.spriteRgba(e.nation[i]!), i * 4);
    }
    p.upload(e.count);
    // Near T3 the section is kept, so that the figures can be built in the frame the close tier
    // comes in (`tierShares`); the snapshot's own arrays go back to the worker.
    this.elementsZoom = this.metresPerPx;
    this.elementSection = this.elementsZoom < T3_KEEP_M ? copyElements(e) : null;
    this.individualsBuilt = false;
  }

  /** The elements of the last snapshot, kept while the camera is near T3. */
  private elementSection: SnapshotElements | null = null;
  /** m/px of the camera when the last element section arrived (tests). */
  elementsZoom = Infinity;

  /** T3 individuals (PLAN 2.6): the elements of the last snapshot, each as its figures. */
  private readonly individualProxies: ProxyRenderer;
  /** Whether they stand for the elements now held: built from the last snapshot's section. */
  private individualsBuilt = false;
  /** Figures of the last build, each with its element's id and its place in cells (tests). */
  individualCount = 0;
  individualOwner = new Uint32Array(0);
  individualX = new Float64Array(0);
  individualY = new Float64Array(0);
  /** ms the last build took, and whether the close tier is the one shown or fading in (tests). */
  individualsBuildMs = 0;
  individualsShown = false;

  /**
   * Expands the elements into their figures (`render/units/individuals`). Previous and current
   * place get the same offset, so the GPU's interpolation carries a figure with its element.
   * The origin is the camera's cell: at 1 m/px an offset from the middle of the map would step
   * by 2.4 m in f32.
   */
  private buildIndividuals(e: SnapshotElements): void {
    const t0 = performance.now();
    let total = 0;
    for (let i = 0; i < e.count; i++) total += figureCount(e.strength[i]!, e.size[i]!);
    // More than the renderer is measured for: the element sprites stay (never at T3 in practice,
    // where a view holds a few formations).
    if (total > MAX_INDIVIDUALS) {
      this.individualCount = 0;
      this.individualsBuilt = true;
      return;
    }
    const p = this.individualProxies;
    p.reserve(total);
    p.originX = Math.floor(this.controller.cam.cx);
    p.originY = Math.floor(this.controller.cam.cy);
    const owner = new Uint32Array(total);
    const xs = new Float64Array(total);
    const ys = new Float64Array(total);
    let j = 0;
    for (let i = 0; i < e.count; i++) {
      const n = figureCount(e.strength[i]!, e.size[i]!);
      if (n === 0) continue;
      const frame = e.frame[i]!;
      // The grid of the whole element: what is left of it stands where it stood (PLAN 2.10b).
      const side = gridSide(frame, figureCount(e.size[i]!, e.size[i]!));
      const size = figureCells(side);
      // In contact the men of a battalion lie in a loose line at the front of its ground (PLAN 2.14c2).
      const inContact = (e.flags[i]! & FormationFlag.engaged) !== 0;
      const off = figureOffsets(e.id[i]!, side, n, e.facing[i]!, inContact && frame === Frame.infantry);
      const x = this.unwrapped(e.x[i]!, e.prevX[i]!);
      const moving = marching(e.flags[i]!) ? 0.5 : 0;
      const rgba = this.spriteRgba(e.nation[i]!);
      for (let k = 0; k < n; k++, j++) {
        const o = j * PROXY_STRIDE;
        const dx = off[k * 2]!;
        const dy = off[k * 2 + 1]!;
        p.data[o] = e.prevX[i]! + dx - p.originX;
        p.data[o + 1] = e.prevY[i]! + dy - p.originY;
        p.data[o + 2] = x + dx - p.originX;
        p.data[o + 3] = e.y[i]! + dy - p.originY;
        p.data[o + 4] = e.facing[i]!;
        p.data[o + 5] = size;
        p.data[o + 6] = shownFrame(frame, inContact) + moving;
        p.data[o + 7] = 1;
        p.colors.set(rgba, j * 4);
        owner[j] = e.id[i]!;
        xs[j] = e.x[i]! + dx;
        ys[j] = e.y[i]! + dy;
      }
    }
    p.upload(total);
    this.individualCount = total;
    this.individualOwner = owner;
    this.individualX = xs;
    this.individualY = ys;
    this.individualsBuilt = true;
    this.individualsBuildMs = performance.now() - t0;
  }

  /**
   * Interest management (SPEC §8): the view's subscription, sent at most 10 times a second and
   * only when its key has changed (`viewSubscription`).
   */
  private maybeSubscribe(now: number): void {
    if (now - this.lastSubAt < 100) return;
    const { sub, key } = viewSubscription(this.controller.cam, this.canvas.clientWidth, this.canvas.clientHeight, this.geo.kmPerCell);
    if (key === this.lastSub) return;
    this.lastSub = key;
    this.lastSubAt = now;
    this.subscription = sub;
    this.sim.subscribe(sub);
  }

  /**
   * Brings a battle at (x, y) into view (PLAN 2.14e): the camera jumps onto it at
   * BATTLE_VIEW_M per pixel, where the blocks of two divisions front to front are whole in the
   * view with their tags (PLAN 2.14c1). A small view shows the same ground at more metres a
   * pixel (BATTLE_VIEW_KM across and half of it down), but stays where elements are drawn.
   */
  showBattle(x: number, y: number): void {
    const el = this.canvas;
    const m = Math.min(BATTLE_VIEW_MAX_M, Math.max(BATTLE_VIEW_M, (BATTLE_VIEW_KM * 1000) / Math.max(1, el.clientWidth), (BATTLE_VIEW_KM * 500) / Math.max(1, el.clientHeight)));
    this.controller.set({ cx: x, cy: y, scale: (this.geo.kmPerCell * 1000) / m });
    this.dirty = true;
  }

  /** Metres per CSS pixel at the current zoom. */
  get metresPerPx(): number {
    return (this.geo.kmPerCell * 1000) / this.controller.cam.scale;
  }

  /**
   * Only the unit layers (T0 counters, T1 markers) at `now`, without the map: scripted zoom
   * recordings check their continuity without software-rendering the map (PLAN 2.2 AT).
   */
  drawUnitLayers(now: number, pixels = false): void {
    this.resize();
    const cam = this.controller.cam;
    this.tierShares(now);
    if (pixels) {
      // For a comparison of pixels (PLAN 2.7b AT): both canvases cleared, the sprite layers drawn
      // without the map. The next frame of the view's own loop draws everything again.
      const gl = this.gl;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.overlay.getContext('2d')!.clearRect(0, 0, this.canvas.clientWidth, this.canvas.clientHeight);
      this.drawSprites(cam, now);
      this.dirty = true;
    }
    this.drawUnitMarkers(cam, now);
    this.drawFormationTags(cam);
    this.drawFx(cam, now);
  }

  /**
   * The sprite layers (WebGL): at T2 the elements, at T3 their figures, cross-faded by the close
   * handover; formation sprites stand in where no elements arrived (element-less formations,
   * or before the first subscribed snapshot).
   */
  private drawSprites(cam: Camera, now: number): void {
    const unitsIn = this.shares.elements;
    if (unitsIn <= 0.01 || !this.sprites) return;
    const dpr = window.devicePixelRatio || 1;
    const t = this.tickProgress(now);
    const offs = wrapOffsets(cam, this.geo, this.canvas.clientWidth);
    const figures = this.shares.individuals;
    if (this.elementCount === 0) this.proxies.draw(cam, dpr, t, 8, offs, this.unitScale, now / 1000, unitsIn, STAND_IN_MAX_PX);
    else {
      if (figures < 0.99) this.elementProxies.draw(cam, dpr, t, 5, offs, this.unitScale, now / 1000, unitsIn * (1 - figures));
      if (figures > 0.01) this.individualProxies.draw(cam, dpr, t, FIGURE_MIN_PX, offs, this.unitScale, now / 1000, unitsIn * figures);
    }
  }

  /**
   * Only the nation names, the city labels and the capital flags at `now`, on cleared canvases: a
   * comparison of their pixels over the frames of a change (PLAN 2.7d and 2.7e AT). The next
   * frame of the view's own loop draws everything again.
   */
  drawLabelLayers(now: number): void {
    this.resize();
    const cam = this.controller.cam;
    // The counters first, for their boxes at this camera (the flags keep clear of them), then
    // the overlay is wiped and only the labels and the flags are left on it.
    this.tierShares(now);
    this.drawUnitMarkers(cam, now);
    const dpr = window.devicePixelRatio || 1;
    this.drawLabels(cam, dpr, now); // wipes the overlay first
    this.drawFlags(cam, now);
    this.drawCityLayer(cam, dpr, now);
    this.dirty = true;
  }

  /**
   * What a city's name keeps clear of in this frame (PLAN 2.7r): the T0 counters, by the rule
   * the flags have (at least half visible: one fading in is in the way, one fading out is not),
   * and the capital flags where they stand, with their frames. So the names are laid out after
   * both. They have a canvas of their own: when they are drawn does not change what is above what.
   */
  private nameObstacles(cam: Camera): NameObstacle[] {
    const out: NameObstacle[] = [];
    // Which unit layer the names keep clear of: the one that is shown or coming in, from the
    // first frame of a handover (PLAN 2.7u). Judged by the layer's opacity, the names changed
    // places in the middle of the handover, and were still fading when it was over.
    const markers = this.handover.near === true && this.tactical.near !== true;
    const counters = this.handover.near !== true;
    // A counter's box moves by a pixel with its number and with the camera: a name takes a place
    // only with room to spare beside one. A flag stands by its capital's dot, a pixel from the
    // place of the capital's name: no clearance, or no capital's name could stand there.
    if (counters) for (const b of this.counters.boxes) if (b.own >= 0.5) out.push({ x: b.x, y: b.y, w: b.w, h: b.h, clear: NAME_CLEAR_PX });
    if (markers) {
      // The T1 markers, which move with their armies every tick: the box with its backing (a
      // pixel around it, and the half pixel its corner is rounded by), the bar and the number
      // under it, and the tag of a stack. The Major Battles likewise. Not the order arrows: a
      // dashed line across a name leaves it to be read, and names that gave way to every arrow
      // would leave a front without names.
      const edge = 1.5 * this.unitScale;
      for (const m of this.markerRects) {
        if (m.own < 0.5) continue;
        out.push({ x: m.x - edge, y: m.y - edge, w: m.w + 2 * edge, h: m.h + 2 * edge, clear: NAME_CLEAR_PX });
        if (m.tag) out.push({ ...m.tag, clear: NAME_CLEAR_PX });
      }
      const vw = this.canvas.clientWidth;
      const vh = this.canvas.clientHeight;
      for (let i = 0; i + 1 < this.majors.length; i += 2) {
        for (const off of wrapOffsets(cam, this.geo, vw)) {
          const [bx, by] = worldToScreen(cam, this.majors[i]! + off, this.majors[i + 1]!, vw, vh);
          if (bx > -20 && by > -20 && bx < vw + 20 && by < vh + 20) out.push({ x: bx - 12, y: by - 12, w: 24, h: 24, clear: NAME_CLEAR_PX });
        }
      }
    }
    // At T2 and T3 the formations' tags (PLAN 2.14a), as they stood in the last frame: they are
    // laid out after the names of this one.
    if (this.tactical.near === true) for (const g of this.tagRects) out.push({ x: g.x, y: g.y, w: g.w, h: g.h, clear: NAME_CLEAR_PX });
    for (const f of this.flagRects) out.push({ x: f.x - 1, y: f.y - 1, w: f.w + 2, h: f.h + 2 });
    return out;
  }

  /**
   * Trees, rocks and buildings (PLAN 2.8c2): where the ground of T2 and T3 shows, by the same
   * share. They are scattered again only when the camera, the view's size or the world's
   * terrain or cities have changed.
   */
  private drawGroundThings(cam: Camera, dpr: number): void {
    const share = this.map.groundOn && this.instances ? this.groundShare : 0;
    const world = this.scatterWorld;
    if (share <= 0 || !world) {
      this.groundScatter = null;
      return;
    }
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    const key = `${cam.cx},${cam.cy},${cam.scale},${vw},${vh}`;
    if (key !== this.scatterKey || !this.groundScatter) {
      this.groundScatter = scatter(world, { cx: cam.cx, cy: cam.cy, halfW: vw / 2 / cam.scale, halfH: vh / 2 / cam.scale, pxPerCell: cam.scale }, GROUND_CAP, this.groundThings.data);
      this.groundThings.upload(this.groundScatter.count);
      this.scatterKey = key;
    }
    this.groundThings.draw(vw, vh, dpr, share);
  }

  /** The ground's relief at T2 and T3 (PLAN 2.8a). Off: the map of T0 and T1 at every zoom (tests compare the two). */
  get relief(): boolean {
    return this.map.relief;
  }
  set relief(on: boolean) {
    this.map.relief = on;
    this.dirty = true;
  }

  /** Side of an element sprite in CSS px (the shader's rule: ELEMENT_CELLS, at least 5 px, × the size setting). */
  get elementPx(): number {
    return Math.max(ELEMENT_CELLS * this.controller.cam.scale, 5) * this.unitScale;
  }

  /**
   * Over the element sprites (PLAN 2.4): the wrecks of the elements that died, then tracers,
   * muzzle flashes and impacts.
   */
  private drawFx(cam: Camera, now: number): void {
    const ctx = this.overlay.getContext('2d')!;
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    this.wrecks.draw(ctx, cam, this.geo, vw, vh, now, this.elementOpacity, Math.min(this.elementPx, WRECK_MAX_PX * this.unitScale));
    this.fire.draw(ctx, cam, this.geo, vw, vh, now, this.elementOpacity, this.unitScale);
  }

  /** T1 operational markers (PLAN 2.1) and T0 counters (PLAN 2.2) on the overlay. */
  private drawUnitMarkers(cam: Camera, now: number): void {
    // T0 counters, T1 markers or T2 sprites: timed handovers, so at rest only one layer is drawn
    // (PLAN 1.45a, 2.7b). The markers have what the counters and the sprites leave them.
    const share = this.shares.markers;
    const alpha = share * this.morph.box;
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
    this.counters.draw(ctx, src, cam, this.geo, vw, vh, 1 - share, now, hex, flagOf, this.unitScale);
    if (share * Math.max(this.morph.box, this.morph.bar) <= 0.01) {
      // No markers: the next ones take their places in their stacks at once.
      this.markerStacks.clear();
      return;
    }
    const w = this.geo.w;
    const markers: MarkerInput[] = [];
    // For the stacks (PLAN 2.7s1): each marker's centre in px, as cells × scale (panning does not reshuffle them).
    const items: StackItem[] = [];
    for (let i = 0; i < this.formIds.length; i++) {
      items.push({ id: this.formIds[i]!, nation: this.formNation[i]!, x: this.formX[i]! * cam.scale, y: this.formY[i]! * cam.scale, strength: this.formStrength[i]! });
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
    // (The boxes do not move while they shrink into the T2 sprites: ADR-72.)
    const stacks = this.markerStacks.frame(items, MARKER_W * this.unitScale, MARKER_H * this.unitScale, now, this.morph.scale < 1);
    this.markerRects = drawMarkers(ctx, markers, this.majors, cam, this.geo, vw, vh, share, hex, flagOf, this.unitScale, this.morph, stacks);
  }

  /** The tags of the formations in the view at T2 and T3, as they were drawn last (PLAN 2.14a; tests, and the names keep clear of them). */
  tagRects: PlacedTag[] = [];
  /** Tags that found no free place in the last frame (tests). */
  tagsLeft = 0;
  /** The opacity the tags were drawn with last (tests). */
  tagOpacity = 0;

  /** A formation's name as it is shown: its kind and its number ("Infantry division 658"). The flag beside it says whose. */
  formationName(id: number, template: number): string {
    const key = this.templates[template]?.nameKey;
    return t('formation.name', { kind: key ? t(key as MessageKey) : t('formation.kind.unknown'), n: id });
  }

  /**
   * The tags of T2 and T3 (PLAN 2.14a): flag, strength and name by every formation that has
   * elements in the view. They come in with the sprites, as the markers' boxes go.
   */
  private drawFormationTags(cam: Camera): void {
    const alpha = this.shares.elements;
    this.tagOpacity = alpha;
    this.tagRects = [];
    this.tagsLeft = 0;
    if (alpha <= 0.01) return;
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    const offs = wrapOffsets(cam, this.geo, vw);
    // The box of each formation's elements on the screen, per copy of a looping map.
    // Keyed by formation and copy: a number, for a section of up to 40,000 elements a frame.
    const copies = Math.max(1, offs.length);
    const boxes = new Map<number, [number, number, number, number]>();
    const grow = (key: number, px: number, py: number, r: number): void => {
      const b = boxes.get(key);
      if (!b) boxes.set(key, [px - r, py - r, px + r, py + r]);
      else {
        if (px - r < b[0]) b[0] = px - r;
        if (py - r < b[1]) b[1] = py - r;
        if (px + r > b[2]) b[2] = px + r;
        if (py + r > b[3]) b[3] = py + r;
      }
    };
    if (this.elementCount > 0) {
      // Half an element's sprite around its middle, as it is drawn.
      const r = Math.max(2.5 * this.unitScale, this.elementPx / 2);
      for (let i = 0; i < this.elementCount; i++) {
        for (let k = 0; k < offs.length; k++) {
          const [px, py] = worldToScreen(cam, this.elementX[i]! + offs[k]!, this.elementY[i]!, vw, vh);
          if (px < -vw || px > 2 * vw || py < -vh || py > 2 * vh) continue;
          grow(this.elementFormation[i]! * copies + k, px, py, r);
        }
      }
    } else {
      // No elements arrived: the stand-in sprites of the formations (`drawSprites`).
      const r = Math.min(STAND_IN_MAX_PX * this.unitScale, Math.max(8, MARKER_CELLS * cam.scale)) / 2;
      for (let i = 0; i < this.formIds.length; i++) {
        for (let k = 0; k < offs.length; k++) {
          const [px, py] = worldToScreen(cam, this.formX[i]! + offs[k]!, this.formY[i]!, vw, vh);
          if (px < -r || px > vw + r || py < -r || py > vh + r) continue;
          grow(this.formIds[i]! * copies + k, px, py, r);
        }
      }
    }
    if (boxes.size === 0) return;
    const index = new Map<number, number>();
    for (let i = 0; i < this.formIds.length; i++) index.set(this.formIds[i]!, i);
    const items: TagInput[] = [];
    for (const [key, b] of boxes) {
      const id = Math.floor(key / copies);
      const i = index.get(id);
      if (i === undefined) continue;
      items.push({
        id,
        nation: this.formNation[i]!,
        strength: this.formStrength[i]!,
        text: strengthText(this.formStrength[i]!),
        name: this.formationName(id, this.formTemplate[i]!),
        engaged: (this.formFlags[i]! & FormationFlag.engaged) !== 0,
        x0: b[0],
        y0: b[1],
        x1: b[2],
        y1: b[3],
      });
    }
    const ctx = this.overlay.getContext('2d')!;
    const measure = (text: string, font: string): number => {
      ctx.font = font;
      return ctx.measureText(text).width;
    };
    const { placed, left } = layoutTags(items, measure, vw, vh, this.unitScale);
    this.tagsLeft = left;
    this.tagRects = placed;
    const hex = (id: number): string => `#${(this.ownColor.get(id) ?? 0x888888).toString(16).padStart(6, '0')}`;
    drawTags(ctx, placed, alpha, (n) => this.flags.canvasOf(n), hex, this.unitScale);
  }

  /**
   * The formation under a CSS-px point, of any nation, or 0 (PLAN 2.14b): by what is drawn of it
   * at this zoom. Its tag (T2, T3), its marker (T1), else the nearest of its elements, or its
   * stand-in sprite where no elements arrived. At T0 the counters are nations', not formations'.
   */
  formationPick(sx: number, sy: number): number {
    const inside = (r: { x: number; y: number; w: number; h: number }): boolean => sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h;
    if (this.tagOpacity > 0.5) for (const g of this.tagRects) if (inside(g)) return g.id;
    if (this.markerOpacity > 0.5) for (let i = this.markerRects.length - 1; i >= 0; i--) if (inside(this.markerRects[i]!)) return this.markerRects[i]!.id;
    if (this.shares.elements <= 0.5) return 0;
    const cam = this.controller.cam;
    const vw = this.canvas.clientWidth;
    const vh = this.canvas.clientHeight;
    const offs = wrapOffsets(cam, this.geo, vw);
    let best = 0;
    if (this.elementCount > 0) {
      let bestD = Math.max(10, this.elementPx / 2 + 4);
      for (let i = 0; i < this.elementCount; i++) {
        for (const off of offs) {
          const [px, py] = worldToScreen(cam, this.elementX[i]! + off, this.elementY[i]!, vw, vh);
          const d = Math.hypot(px - sx, py - sy);
          if (d < bestD) {
            bestD = d;
            best = this.elementFormation[i]!;
          }
        }
      }
      return best;
    }
    let bestD = 14;
    for (let i = 0; i < this.formIds.length; i++) {
      for (const off of offs) {
        const [px, py] = worldToScreen(cam, this.formX[i]! + off, this.formY[i]!, vw, vh);
        const d = Math.hypot(px - sx, py - sy);
        if (d < bestD) {
          bestD = d;
          best = this.formIds[i]!;
        }
      }
    }
    return best;
  }

  /** What the panel of formation `id` is headed with, from the last snapshot: its name, its kind and its nation; null when it is not there. */
  formationTitle(id: number): { name: string; kind: string; nation: number } | null {
    const i = this.formIds.indexOf(id);
    if (i < 0) return null;
    const key = this.templates[this.formTemplate[i]!]?.nameKey;
    return { name: this.formationName(id, this.formTemplate[i]!), kind: key ? t(key as MessageKey) : t('formation.kind.unknown'), nation: this.formNation[i]! };
  }

  /** The formations of the last snapshot (tests). */
  formationIds(): number[] {
    return Array.from(this.formIds);
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
  flagRects: { id: number; x: number; y: number; w: number; h: number; alpha: number }[] = [];
  /** The capital flags as a layer: shown, or fading in (PLAN 2.7d). */
  private readonly flagsIn = new TimedSwitch(FADE_MS);

  /**
   * Where each flag stands relative to its usual place, to keep clear of the T0 counters (PLAN
   * 1.45c): per nation and map copy, a rise in px and an opacity, each easing to its new value
   * over FLAG_MOVE_MS. Opacity 0: no free place within FLAG_MAX_RISE, the flag is left out.
   */
  private readonly flagPlace = new Map<string, { rise: [number, number]; alpha: [number, number]; start: number }>();
  private flagMoveStart = -Infinity;

  /**
   * Flags above living nations' capitals once zoomed in (FLAG_MIN_SCALE px per cell). They are
   * drawn above the unit layers so that capitals stay readable (PLAN 2.1), and a flag that would
   * cover a T0 counter stands above that counter instead: a counter's number is never hidden.
   */
  private drawFlags(cam: Camera, now: number): void {
    this.flagRects = [];
    // The flags as a layer are a state (PLAN 2.7d): in at FLAG_MIN_SCALE, out below it by the
    // hysteresis, a fade in time. They used to appear in one frame.
    const want = this.capitals.size > 0 && cam.scale >= (this.flagsIn.on ? FLAG_MIN_SCALE / ZOOM_HYSTERESIS : FLAG_MIN_SCALE);
    const layer = this.flagsIn.value(want, now);
    if (layer <= 0.01) {
      this.flagPlace.clear();
      return;
    }
    const ctx = this.overlay.getContext('2d')!;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    // Counters at least half visible are in the way: one fading in is, one fading out is not.
    const boxes = this.counters.boxes.filter((b) => b.alpha >= 0.5);
    /** The counter boxes that a flag at (x, y), with its 1 px frame, would touch. */
    const under = (x: number, y: number): typeof boxes => boxes.filter((b) => x - 1 < b.x + b.w && b.x < x + FLAG_PX_W + 1 && y - 1 < b.y + b.h && b.y < y + FLAG_PX_H + 1);
    const seen = new Set<string>();
    let latest = -Infinity;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const [id, [cx, cy]] of this.capitals) {
      if (!this.ownColor.has(id)) continue;
      for (const off of wrapOffsets(cam, this.geo, w)) {
        const [px, py] = worldToScreen(cam, cx + off, cy, w, h);
        const x = Math.round(px - FLAG_PX_W / 2);
        const y0 = Math.round(py - FLAG_PX_H - 8);
        if (x < -FLAG_PX_W || y0 < -FLAG_PX_H || x > w || y0 > h) continue;
        // Up, above the highest counter in the way, and again if another stands there; a flag
        // that would have to go further than FLAG_MAX_RISE from its capital is left out.
        let rise: number | null = 0;
        while (rise !== null) {
          const hit = under(x, y0 - rise);
          if (hit.length === 0) break;
          const up: number = y0 - (Math.floor(Math.min(...hit.map((b) => b.y))) - FLAG_PX_H - FLAG_CLEAR_PX);
          rise = up <= FLAG_MAX_RISE ? up : null;
        }
        const key = `${id}:${off}`;
        seen.add(key);
        let st = this.flagPlace.get(key);
        const ease = (s: { start: number }, v: [number, number]): number => v[0] + (v[1] - v[0]) * smooth(progress(now, s.start, FLAG_MOVE_MS));
        if (!st) st = { rise: [rise ?? 0, rise ?? 0], alpha: [rise === null ? 0 : 1, rise === null ? 0 : 1], start: -Infinity };
        else if (st.alpha[1] !== (rise === null ? 0 : 1) || (rise !== null && st.rise[1] !== rise)) {
          const a = ease(st, st.alpha);
          // A flag left out stays where it was while it fades; one coming back appears in its new place.
          const r = rise === null ? ease(st, st.rise) : a < 0.01 ? rise : ease(st, st.rise);
          st = { rise: [r, rise ?? r], alpha: [a, rise === null ? 0 : 1], start: now };
        }
        this.flagPlace.set(key, st);
        if (st.start <= now && st.start > latest) latest = st.start;
        const alpha = ease(st, st.alpha);
        if (alpha < 0.01) continue;
        const y = Math.round(y0 - ease(st, st.rise));
        ctx.globalAlpha = alpha * layer;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(x - 1, y - 1, FLAG_PX_W + 2, FLAG_PX_H + 2);
        ctx.drawImage(this.flags.canvasOf(id), x, y, FLAG_PX_W, FLAG_PX_H);
        this.flagRects.push({ id, x, y, w: FLAG_PX_W, h: FLAG_PX_H, alpha: alpha * layer });
      }
    }
    ctx.restore();
    for (const key of this.flagPlace.keys()) if (!seen.has(key)) this.flagPlace.delete(key);
    this.flagMoveStart = latest;
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

  /**
   * Tint of an element sprite or a figure: the nation's sprite colour (`nationColor`), as its
   * stand-in sprite has it. Until PLAN 2.14a it was lifted a second time, 45% toward white: every
   * nation's tint then lay between 178 and 255 a channel, Germany's elements and Poland's were
   * two near-whites, and a close view did not say whose a battalion was. The dark outline of the
   * atlas, not the lift, is what sets a sprite off against its nation's fill.
   */
  private spriteRgba(id: number): [number, number, number, number] {
    const col = this.nationColor(id);
    return [(col >> 16) & 255, (col >> 8) & 255, col & 255, 255];
  }

  /** x on the side of prevX: across the seam of a looping map an interpolation must not sweep the whole map. */
  private unwrapped(x: number, prevX: number): number {
    return this.geo.wrapX && Math.abs(x - prevX) > this.geo.w / 2 ? x + (x < prevX ? this.geo.w : -this.geo.w) : x;
  }

  /**
   * The colour of a nation's sprites: its own colour in every map mode, as its T1 markers and T0
   * counters have it (the map's palette carries the mode's colours: PLAN 2.7i), lightened so that
   * they read against the fill.
   */
  private nationColor(id: number): number {
    const own = this.ownColor.get(id) ?? 0x888888;
    const lift = (v: number): number => Math.min(255, Math.round(v * 0.55 + 115));
    return (lift((own >> 16) & 255) << 16) | (lift((own >> 8) & 255) << 8) | lift(own & 255);
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
    this.frameAt(now);
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /**
   * One turn of the view's loop at `now`: the camera moves, and the view is drawn when something
   * can have changed. Returns whether it drew. (`frame` is this on the browser's clock; a test
   * gives the times.)
   */
  frameAt(now: number): boolean {
    const dt = this.lastFrame < 0 ? 0 : Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    this.controller.update(dt);
    this.maybeSubscribe(now);
    // Redraw only when something can have changed: a new snapshot, camera motion, a resize,
    // or units still interpolating toward the latest tick. An idle map costs nothing.
    const c = this.controller.cam;
    const camMoved = c.cx !== this.lastCam.cx || c.cy !== this.lastCam.cy || c.scale !== this.lastCam.scale;
    const animating = this.unitsAnimating(now) || this.wrecks.animating(now);
    const interpolating = (this.tickMs > 0 && now - this.snapArrival < this.tickMs * 1.5) || animating || this.unitsAnimated;
    if (!(this.resize() || this.dirty || camMoved || interpolating)) return false;
    this.draw(now);
    this.dirty = false;
    this.lastCam = { ...c };
    // A frame that leaves a unit animation unfinished is followed by another, however late that
    // one comes, so that the end of an animation is what stays on screen. The question is asked
    // after the draw, at the draw's own time (PLAN 2.7m): asked before it, the answer is "no"
    // for a change that this draw starts, and "no" again once the clock is past the change's
    // end. A camera step and then a gap of more than the 300 ms of a split left the counters on
    // their parents' centroids, with nothing to draw them on.
    this.unitsAnimated = this.unitsAnimating(now) || this.wrecks.animating(now);
    return true;
  }

  /** Renders one frame (also used by tests for deterministic screenshots). */
  draw(now = performance.now()): void {
    this.resize();
    const dpr = window.devicePixelRatio || 1;
    const cam = this.controller.cam;
    // T0 has counters (PLAN 2.2), T1 markers (PLAN 2.1), below them the sprites (PLAN 2.3, 2.6).
    this.tierShares(now);
    // The ground of T2 and T3 comes with the sprites, by their share of the handover (PLAN
    // 2.8a); and beyond T2 it goes with the zoom, whatever the handover's clock says (PLAN 2.11l).
    this.groundShare = this.shares.elements * groundReach(this.metresPerPx, T1_MIN_M * ZOOM_HYSTERESIS);
    this.map.draw(cam, dpr, this.groundShare);
    this.drawGroundThings(cam, dpr);
    this.drawSprites(cam, now);
    this.drawLabels(cam, dpr, now);
    // Unit markers below capital flags, so capitals stay readable (PLAN 2.1); the flags keep
    // clear of the T0 counters (PLAN 1.45c), and the city names of the flags and of the unit
    // layer that is shown, counters or markers (PLAN 2.7r, 2.7u).
    this.drawUnitMarkers(cam, now);
    this.drawFormationTags(cam);
    this.drawFx(cam, now);
    this.drawFlags(cam, now);
    this.drawCityLayer(cam, dpr, now);
    this.drawSelection(cam);
    this.frames++;
  }

  /** Wipes the overlay for the frame, and lays out the curved nation names (PLAN 1.29) for `drawCityLayer` to draw. */
  private drawLabels(cam: Camera, dpr: number, now: number): void {
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
      // A map mode without names: they go with the mode, at once, and come back the same way.
      this.nationLabels = [];
      this.nameStates.clear();
      return;
    }
    const measure: Measure = (text, px) => {
      ctx.font = `600 ${px.toFixed(1)}px ${LABEL_FONT}`;
      return ctx.measureText(text).width;
    };
    // Each name is a state (PLAN 2.7e): the layout is told what is on and what still fades out.
    const { data, names } = this.labelData;
    const labels = fadeNationLabels(this.nameStates, now, (state) => layoutNationLabels(data, names, cam, this.geo, w, h, measure, state));
    // Laid out here; drawn with the city layer, under its dots and names (`drawCityLayer`).
    this.nationLabels = labels;
  }

  /**
   * The canvas under the overlay: the nation names, and over them the city dots and names (PLAN
   * 2.7t). The nation names were drawn on the overlay, above the city names: a capital's name
   * stood under the letters of its own nation's. A small name over a large one reads; the other
   * way round it does not. The units and the flags, on the overlay, are above both as before.
   */
  private drawCityLayer(cam: Camera, dpr: number, now: number): void {
    this.cityLabels.draw(cam, dpr, now, this.nameObstacles(cam), (ctx) => drawNationLabels(ctx, this.nationLabels, LABEL_FONT));
  }

  /** Each nation name in view: on or off, and the fade of a change (PLAN 2.7e). */
  private readonly nameStates = new SwitchBank<number>();

  /** Stops the frame loop and the camera's listeners. The GL objects stay: a view that is stopped can still be drawn (tests stop it and draw one moment). */
  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.controller.dispose();
  }
}
