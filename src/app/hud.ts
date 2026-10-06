/**
 * HUD state (PLAN 1.8): the date, speed level and pause shown by the bottom bar, kept in
 * signals fed by snapshots. Speed level and pause persist in localStorage (AoC persists speed)
 * and are applied to the sim worker on start. Keyboard: Space toggles pause, `,` / `.` change speed
 * (+/− already zoom the camera).
 */
import { signal } from '@preact/signals';
import { dateOfTick } from '../shared/calendar';
import { MAP_MODES, type MapMode } from '../shared/mapModes';
import { clampSpeedLevel, DEFAULT_SPEED_LEVEL, speedOfLevel } from '../shared/speed';
import type { Command } from '../shared/commands';
import type { NationStats, SimClient } from './simClient';
import type { FormationDetail, TemplateInfo } from '../shared/protocol';
import type { EditorState } from '../shared/editorState';
import { RANK_METRICS, type RankMetric } from '../shared/ranking';

const KEY_LEVEL = 'warsim.speedLevel';
const KEY_PAUSED = 'warsim.paused';
const KEY_MAP_MODE = 'warsim.mapMode';
/** God territory brush radius in cells. */
const BRUSH_RADIUS = 5;

export type GodTool = 'revolt' | 'battle' | 'brush';
const KEY_SHOW_STATS = 'warsim.showStats';
const KEY_RANK_METRIC = 'warsim.rankMetric';

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage unavailable (private mode)
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the setting just does not persist */
  }
}

export class Hud {
  readonly tick = signal(0);
  readonly speedLevel = signal(DEFAULT_SPEED_LEVEL);
  readonly paused = signal(true);
  /** Map mode (PLAN 1.17), persisted; `onMapMode` applies it to the map view. */
  readonly mapMode = signal<MapMode>('political');
  onMapMode: (mode: MapMode) => void = () => {};
  /** Selected nation id (0 = none; PLAN 1.30), set by map clicks. */
  readonly selected = signal(0);
  /** Selects a nation from the UI (panel chips); main wires it to the map view. */
  onSelectNation: (id: number) => void = (id) => (this.selected.value = id);
  /** Brings a place into view at a zoom that shows a battle (PLAN 2.14e); main wires it to the map view. */
  onShowBattle: (x: number, y: number) => void = () => {};

  /** To the largest battle of war `war` (a click on its banner, PLAN 2.14e). A war with no formations in contact leaves the camera where it is. */
  toBattle(war: number): void {
    void this.sim
      .warBattle(war)
      .then((b) => {
        if (b) this.onShowBattle(b.x, b.y);
      })
      .catch(() => {
        /* the worker is gone or busy with a load: the camera stays */
      });
  }

  /** The formation whose panel is open (0 = none; PLAN 2.14b), set by map clicks, and what the sim says of it. */
  readonly formation = signal(0);
  readonly formationInfo = signal<FormationDetail | null>(null);
  private formationAsked = false;
  /**
   * Which formation of that id (PLAN 2.16Ri): the id's count in the first answer. A freed id is
   * given to the next formation made, and the panel is not that one's.
   */
  private formationGeneration: number | undefined;

  /** Opens the panel of formation `id`; 0 closes it. */
  selectFormation(id: number): void {
    if (id === this.formation.value) return;
    this.formation.value = id;
    this.formationInfo.value = null;
    this.formationGeneration = undefined;
    this.refreshFormation();
  }

  /** Asks the sim for the open formation again (one request at a time). A formation that is gone closes its panel, whether or not another has its id. */
  refreshFormation(): void {
    const id = this.formation.value;
    if (id === 0 || this.formationAsked) return;
    this.formationAsked = true;
    const generation = this.formationGeneration;
    // Whether the answer was for a panel that is no longer the open one.
    let stale = false;
    void this.sim
      .formation(id, generation)
      .then((info) => {
        // Closed, or closed and opened again on the same id, while this was asked.
        stale = this.formation.value !== id || this.formationGeneration !== generation;
        if (stale) return;
        if (info === null) this.formation.value = 0;
        else this.formationGeneration = info.generation;
        this.formationInfo.value = info;
      })
      .catch(() => {
        /* the worker is gone or busy with a load: the panel keeps what it has */
      })
      .finally(() => {
        this.formationAsked = false;
        // Another formation was picked while this one was asked for.
        if (this.formation.value !== 0 && (this.formation.value !== id || stale)) this.refreshFormation();
      });
  }
  /** Statistics ranking (PLAN 1.31b): shown and metric, both persisted. */
  readonly showStats = signal(true);
  readonly rankMetric = signal<RankMetric>('land');
  /** Buildable templates of the scenario (PLAN 1.33b), from the worker's map layers. */
  readonly templates = signal<TemplateInfo[]>([]);
  /** Nation panel / war banner data from the worker (PLAN 1.31). */
  readonly stats = signal<NationStats | null>(null);
  /** Speed and pause as last reported by the worker (snapshots), for tests and diagnostics. */
  readonly worker = signal<{ speed: number | 'max'; paused: boolean } | null>(null);

  constructor(
    readonly sim: SimClient,
    readonly startDay: number,
  ) {
    const lvl = load(KEY_LEVEL);
    this.speedLevel.value = lvl === null ? DEFAULT_SPEED_LEVEL : clampSpeedLevel(Number(lvl));
    this.paused.value = load(KEY_PAUSED) === '1';
    const mode = load(KEY_MAP_MODE);
    this.mapMode.value = (MAP_MODES as readonly string[]).includes(mode ?? '') ? (mode as MapMode) : 'political';
    sim.onStats((m) => (this.stats.value = m));
    sim.onRefused((reason) => (this.refusal.value = reason));
    sim.onMapLayers((m) => (this.templates.value = m.templates));
    this.showStats.value = load(KEY_SHOW_STATS) !== '0';
    const metric = load(KEY_RANK_METRIC);
    if ((RANK_METRICS as readonly string[]).includes(metric ?? '')) this.rankMetric.value = metric as RankMetric;
    // A loaded world's formations are others, whatever their ids and counts (a load does not raise the counts).
    sim.onLoad(() => this.selectFormation(0));
    sim.onSnapshotReceived((s) => {
      this.tick.value = s.tick;
      // The open formation panel follows the game.
      if (this.formation.value !== 0 && this.formationInfo.value?.tick !== s.tick) this.refreshFormation();
      this.worker.value = { speed: s.speed, paused: s.paused };
    });
  }

  date() {
    return dateOfTick(this.startDay, this.tick.value);
  }

  /** Sends the persisted speed and pause to the worker; `forcePaused` (e.g. ?paused=1) wins. */
  apply(forcePaused: boolean): void {
    this.sim.setSpeed(speedOfLevel(this.speedLevel.value));
    if (forcePaused) this.paused.value = true;
    this.sim.setPaused(this.paused.value);
  }

  setSpeedLevel(level: number): void {
    const l = clampSpeedLevel(level);
    this.speedLevel.value = l;
    store(KEY_LEVEL, String(l));
    this.sim.setSpeed(speedOfLevel(l));
  }

  /** Map editor (PLAN 1.35): open, its settings and a started line's first point. */
  readonly showEditor = signal(false);
  readonly editor = signal<EditorState>({ tool: 'brush', layer: 'nation', nation: 0, terrain: 2, r: 4, mask: 'none', maskTerrain: 2, maskNation: 0, cityName: '', citySize: 2 });
  readonly lineStart = signal<[number, number] | null>(null);

  /** Settings panel (PLAN 1.39a). */
  readonly showSettings = signal(false);

  toggleSettings(): void {
    if (!this.showSettings.value) this.closeCentre('settings');
    this.showSettings.value = !this.showSettings.value;
  }

  /** Opening one top-centre panel (editor, charts, history, settings) closes the others. */
  private closeCentre(except: 'editor' | 'charts' | 'history' | 'settings'): void {
    if (except !== 'editor') this.showEditor.value = false;
    if (except !== 'charts') this.showCharts.value = false;
    if (except !== 'history') this.showHistory.value = false;
    if (except !== 'settings') this.showSettings.value = false;
  }

  toggleEditor(): void {
    if (!this.showEditor.value) this.closeCentre('editor');
    this.showEditor.value = !this.showEditor.value;
    this.lineStart.value = null;
    // Paint with the selected nation by default.
    if (this.showEditor.value && this.editor.value.nation === 0) this.editor.value = { ...this.editor.value, nation: this.selected.value, maskNation: this.selected.value };
  }

  setEditor(s: EditorState): void {
    if (s.tool !== this.editor.value.tool) this.lineStart.value = null;
    this.editor.value = s;
  }

  /**
   * A map click while the editor is open: paints (a line needs two clicks) or applies a scenario
   * tool at the clicked cell (`city` is the nearest city row, `province` the clicked province).
   */
  editorClick(x: number, y: number, city = 0, province = 0): boolean {
    if (!this.showEditor.value) return false;
    const s = this.editor.value;
    switch (s.tool) {
      case 'city':
        if (s.cityName.trim() !== '') this.command({ kind: 'spawnCity', x: x + 0.5, y: y + 0.5, name: s.cityName, size: s.citySize });
        return true;
      case 'removeCity':
        if (city !== 0) this.command({ kind: 'removeCity', city });
        return true;
      case 'capital':
        if (city !== 0 && s.nation !== 0) this.command({ kind: 'setCapital', nation: s.nation, city });
        return true;
      case 'core':
      case 'uncore':
        if (province !== 0 && s.nation !== 0) this.command({ kind: 'setCore', province, nation: s.nation, on: s.tool === 'core' });
        return true;
      default:
        break;
    }
    const cx = x + 0.5;
    const cy = y + 0.5;
    if (s.tool === 'line' && !this.lineStart.value) {
      this.lineStart.value = [cx, cy];
      return true;
    }
    const [x0, y0] = s.tool === 'line' ? this.lineStart.value! : [cx, cy];
    this.editPaint(s.tool as 'brush' | 'line' | 'bucket', x0, y0, cx, cy);
    this.lineStart.value = null;
    return true;
  }

  /** Paints with the editor's layer, value, radius and mask; `stroke` joins a dragged stroke. */
  private editPaint(tool: 'brush' | 'line' | 'bucket', x: number, y: number, x2: number, y2: number, stroke?: 'start' | 'more'): void {
    const s = this.editor.value;
    const mask = s.mask === 'none' ? null : { kind: s.mask, value: s.mask === 'terrain' ? s.maskTerrain : s.maskNation };
    this.command({ kind: 'editPaint', layer: s.layer, tool, x, y, x2, y2, r: s.r, value: s.layer === 'nation' ? s.nation : s.terrain, mask, ...(stroke ? { stroke } : {}) });
  }

  /**
   * Painting by dragging (PLAN 1.44): the tool that paints on a primary-button drag, or null.
   * While the editor is open that is its brush or its line (its other tools are click tools,
   * and the editor takes the map's clicks before God Mode does); otherwise the God Mode
   * territory brush, when a nation is selected to paint for (PLAN 1.44b). The map view asks
   * this, and the camera leaves that button to the tool.
   */
  dragTool(): 'brush' | 'line' | 'god' | null {
    if (this.showEditor.value) {
      const tool = this.editor.value.tool;
      return tool === 'brush' || tool === 'line' ? tool : null;
    }
    return this.godTool.value === 'brush' && this.selected.value !== 0 ? 'god' : null;
  }

  /** Where the drag is: its tool, and the last point (brushes) or the press (line), in world cells. */
  private drag: { tool: 'brush' | 'line' | 'god'; x: number; y: number } | null = null;

  /** A press at world (x, y): a brush stamps (the editor's opens a stroke); the line waits for the release. */
  dragStart(x: number, y: number): void {
    const tool = this.dragTool();
    if (!tool) return;
    this.drag = { tool, x, y };
    if (tool === 'brush') this.editPaint('brush', x, y, x, y, 'start');
    else if (tool === 'god') this.command({ kind: 'paintControl', nation: this.selected.value, x, y, r: BRUSH_RADIUS });
  }

  /** The pointer entered another cell: a brush paints the way there (the editor's as part of its stroke). */
  dragMove(x: number, y: number): void {
    const d = this.drag;
    if (!d || d.tool === 'line') return;
    if (d.tool === 'brush') this.editPaint('line', d.x, d.y, x, y, 'more');
    else this.command({ kind: 'paintControl', nation: this.selected.value, x: d.x, y: d.y, r: BRUSH_RADIUS, x2: x, y2: y });
    d.x = x;
    d.y = y;
  }

  /**
   * The release. A line dragged to another cell is painted from the press to the release;
   * released in the cell of the press, it is a click of the two-click line.
   */
  dragEnd(x: number, y: number): void {
    const d = this.drag;
    this.drag = null;
    if (d?.tool !== 'line') return;
    if (Math.floor(d.x) === Math.floor(x) && Math.floor(d.y) === Math.floor(y)) {
      this.editorClick(Math.floor(x), Math.floor(y));
      return;
    }
    this.editPaint('line', d.x, d.y, x, y);
    this.lineStart.value = null;
  }

  /** The drag was taken away (a second finger): what a brush painted stays, a line is not drawn. */
  dragCancel(): void {
    this.drag = null;
  }

  /** Statistics charts panel (PLAN 1.34b). */
  readonly showCharts = signal(false);

  toggleCharts(): void {
    if (!this.showCharts.value) this.closeCentre('charts');
    this.showCharts.value = !this.showCharts.value;
  }

  /** History log panel (PLAN 1.34a). */
  readonly showHistory = signal(false);

  toggleHistory(): void {
    if (!this.showHistory.value) this.closeCentre('history');
    this.showHistory.value = !this.showHistory.value;
  }

  toggleStats(): void {
    this.showStats.value = !this.showStats.value;
    store(KEY_SHOW_STATS, this.showStats.value ? '1' : '0');
  }

  setRankMetric(m: RankMetric): void {
    this.rankMetric.value = m;
    store(KEY_RANK_METRIC, m);
  }

  setMapMode(mode: MapMode): void {
    this.mapMode.value = mode;
    store(KEY_MAP_MODE, mode);
    this.onMapMode(mode);
  }

  /** Next map mode in MAP_MODES order (the bottom-bar button). */
  cycleMapMode(): void {
    const i = MAP_MODES.indexOf(this.mapMode.value);
    this.setMapMode(MAP_MODES[(i + 1) % MAP_MODES.length]!);
  }

  /** God Mode (PLAN 1.32b): the God tab in the nation panel and map tools. */
  readonly godMode = signal(false);
  /** Active God map tool and, for a breakthrough, its first point. */
  readonly godTool = signal<GodTool | null>(null);
  private battleStart: [number, number] | null = null;

  toggleGod(): void {
    this.godMode.value = !this.godMode.value;
    if (!this.godMode.value) this.setGodTool(null);
  }

  /** Why the sim did not carry out the last command sent from here (`Refusal`; 0 = it did; PLAN 2.17a). */
  readonly refusal = signal(0);

  /** Issues a God command, applied at once (also while paused). */
  command(cmd: Command): void {
    this.refusal.value = 0;
    this.sim.command(cmd, true);
  }

  setGodTool(tool: GodTool | null): void {
    this.godTool.value = this.godTool.value === tool ? null : tool;
    this.battleStart = null;
  }

  /**
   * A map click while a God tool is active (cell x, y; its province). Returns true when the
   * tool used the click (the map then does not select).
   */
  pick(x: number, y: number, province: number): boolean {
    const tool = this.godTool.value;
    const nation = this.selected.value;
    if (!tool) return false;
    if (tool === 'revolt') {
      if (province > 0) this.command({ kind: 'spawnRevolt', province });
      this.godTool.value = null;
    } else if (tool === 'battle') {
      if (!this.battleStart) {
        this.battleStart = [x, y];
        return true;
      }
      if (nation !== 0) this.command({ kind: 'forceBreakthrough', nation, x: this.battleStart[0], y: this.battleStart[1], toX: x, toY: y });
      this.battleStart = null;
      this.godTool.value = null;
    }
    // The territory brush paints through the drag path (`dragStart`, PLAN 1.44b) and stays
    // active. Its click arrives here only with no nation selected: nothing to paint for.
    return true;
  }

  togglePause(): void {
    this.paused.value = !this.paused.value;
    store(KEY_PAUSED, this.paused.value ? '1' : '0');
    this.sim.setPaused(this.paused.value);
  }

  /** Space = pause, `,` = slower, `.` = faster. Ignored while typing in a form field. */
  installKeys(target: Window): void {
    target.addEventListener('keydown', (e) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePause();
      } else if (e.code === 'Period') this.setSpeedLevel(this.speedLevel.value + 1);
      else if (e.code === 'Comma') this.setSpeedLevel(this.speedLevel.value - 1);
    });
  }
}
