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
import type { SimClient } from './simClient';

const KEY_LEVEL = 'warsim.speedLevel';
const KEY_PAUSED = 'warsim.paused';
const KEY_MAP_MODE = 'warsim.mapMode';

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
  /** Speed and pause as last reported by the worker (snapshots), for tests and diagnostics. */
  readonly worker = signal<{ speed: number | 'max'; paused: boolean } | null>(null);

  constructor(
    private readonly sim: SimClient,
    readonly startDay: number,
  ) {
    const lvl = load(KEY_LEVEL);
    this.speedLevel.value = lvl === null ? DEFAULT_SPEED_LEVEL : clampSpeedLevel(Number(lvl));
    this.paused.value = load(KEY_PAUSED) === '1';
    const mode = load(KEY_MAP_MODE);
    this.mapMode.value = (MAP_MODES as readonly string[]).includes(mode ?? '') ? (mode as MapMode) : 'political';
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
