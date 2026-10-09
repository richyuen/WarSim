/**
 * Player settings (PLAN 1.39a), persisted in localStorage: UI size (the root font size; the UI
 * is laid out in rem), unit size (formation markers), and the sound's volume and mute
 * (PLAN 3.12d). Speed and pause persist in the HUD (PLAN 1.8). Screenshots: F2 or the settings panel saves the map, with names and flags, as PNG.
 */
import { signal } from '@preact/signals';
import type { MapView } from './MapView';
import type { Sound } from './sound';

export const UI_SCALES = [0.85, 1, 1.15, 1.3] as const;
/**
 * The narrowest view the game is laid out for, in rem: the bottom bar's one line at its widest
 * map mode (62.98 rem in English) and 0.5 rem each side (PLAN 3.12Rh4, ADR-220).
 */
export const LEAST_VIEW_REM = 64;
export const UNIT_SCALES = [0.5, 0.75, 1, 1.5, 2] as const;
const KEY_UI = 'warsim.uiScale';
export const VOLUMES = [0.25, 0.5, 0.75, 1] as const;
const KEY_UNIT = 'warsim.unitScale';
const KEY_VOLUME = 'warsim.volume';
const KEY_MUTED = 'warsim.muted';

function load(key: string, allowed: readonly number[], fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function loadFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function store(key: string, v: number | string): void {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* storage unavailable: the setting just does not persist */
  }
}

/** The UI sizes a view of this width is laid out for; the smallest where it is narrower than every one's. */
export function offeredUiScales(viewWidth: number): readonly number[] {
  const fit = UI_SCALES.filter((s) => LEAST_VIEW_REM * 16 * s <= viewWidth);
  return fit.length > 0 ? fit : [UI_SCALES[0]];
}

/** The size in use: the largest offered that is no larger than the one chosen. */
export function appliedUiScale(chosen: number, viewWidth: number): number {
  const offered = offeredUiScales(viewWidth);
  return offered.filter((s) => s <= chosen).at(-1) ?? offered[0]!;
}

/** The persisted UI size where no game runs (the title screen, PLAN 1.43). */
export function applyUiScale(): void {
  document.documentElement.style.fontSize = `${16 * load(KEY_UI, UI_SCALES, 1)}px`;
}

export class Settings {
  /** The size chosen: kept when the view is too narrow for it, and in use again in a wider one. */
  readonly uiScale = signal(load(KEY_UI, UI_SCALES, 1));
  /** The sizes the view is wide enough for, and the one in use (PLAN 3.12Rh4). */
  readonly uiOffered = signal(offeredUiScales(window.innerWidth));
  readonly uiApplied = signal(appliedUiScale(this.uiScale.value, window.innerWidth));
  readonly unitScale = signal(load(KEY_UNIT, UNIT_SCALES, 1));
  readonly volume = signal(load(KEY_VOLUME, VOLUMES, 0.5));
  readonly muted = signal(loadFlag(KEY_MUTED));

  constructor(
    private readonly view: MapView | null,
    private readonly sound: Sound | null = null,
  ) {
    this.apply();
    window.addEventListener('resize', () => this.apply());
  }

  setUiScale(v: number): void {
    this.uiScale.value = v;
    store(KEY_UI, v);
    this.apply();
  }

  setUnitScale(v: number): void {
    this.unitScale.value = v;
    store(KEY_UNIT, v);
    this.apply();
  }

  /** The volume, and a cue at it: the player hears what was chosen. */
  setVolume(v: number): void {
    this.volume.value = v;
    store(KEY_VOLUME, v);
    this.apply();
    this.sound?.play('peace');
  }

  setMuted(v: boolean): void {
    this.muted.value = v;
    store(KEY_MUTED, v ? '1' : '0');
    this.apply();
  }

  private apply(): void {
    this.uiOffered.value = offeredUiScales(window.innerWidth);
    this.uiApplied.value = appliedUiScale(this.uiScale.value, window.innerWidth);
    document.documentElement.style.fontSize = `${16 * this.uiApplied.value}px`;
    if (this.sound) {
      this.sound.volume = this.volume.value;
      this.sound.muted = this.muted.value;
    }
    if (this.view) {
      this.view.unitScale = this.unitScale.value;
      this.view.requestDraw();
    }
  }
}

/**
 * The map as a PNG: the WebGL map and its overlays (city and nation names, flags) composed at
 * device resolution. Draws first, in the same task, so the WebGL buffer is still valid.
 */
export function captureMap(view: MapView): Promise<Blob> {
  view.draw();
  const map = document.getElementById('map') as HTMLCanvasElement;
  const out = document.createElement('canvas');
  out.width = map.width;
  out.height = map.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(map, 0, 0);
  for (const o of document.querySelectorAll<HTMLCanvasElement>('canvas.map-labels')) ctx.drawImage(o, 0, 0, out.width, out.height);
  return new Promise((resolve, reject) => out.toBlob((b) => (b ? resolve(b) : reject(new Error('screenshot failed'))), 'image/png'));
}

export async function saveScreenshot(view: MapView, dateLabel: string): Promise<void> {
  const blob = await captureMap(view);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `warsim-${dateLabel}.png`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
