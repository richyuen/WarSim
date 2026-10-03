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
import type { TemplateInfo } from '../shared/protocol';
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
    sim.onMapLayers((m) => (this.templates.value = m.templates));
    this.showStats.value = load(KEY_SHOW_STATS) !== '0';
    const metric = load(KEY_RANK_METRIC);
    if ((RANK_METRICS as readonly string[]).includes(metric ?? '')) this.rankMetric.value = metric as RankMetric;
    sim.onSnapshotReceived((s) => {
      this.tick.value = s.tick;
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

  /** Issues a God command, applied at once (also while paused). */
  command(cmd: Command): void {
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
    } else if (nation !== 0) {
      this.command({ kind: 'paintControl', nation, x, y, r: BRUSH_RADIUS }); // brush stays active
    }
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
