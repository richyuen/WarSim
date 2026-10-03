/**
 * Player settings (PLAN 1.39a), persisted in localStorage: UI size (the root font size; the UI
 * is laid out in rem) and unit size (formation markers). Speed and pause persist in the HUD
 * (PLAN 1.8). Screenshots: F2 or the settings panel saves the map, with names and flags, as PNG.
 */
import { signal } from '@preact/signals';
import type { MapView } from './MapView';

export const UI_SCALES = [0.85, 1, 1.15, 1.3] as const;
export const UNIT_SCALES = [0.5, 0.75, 1, 1.5, 2] as const;
const KEY_UI = 'warsim.uiScale';
const KEY_UNIT = 'warsim.unitScale';

function load(key: string, allowed: readonly number[], fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, v: number): void {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* storage unavailable: the setting just does not persist */
  }
}

export class Settings {
  readonly uiScale = signal(load(KEY_UI, UI_SCALES, 1));
  readonly unitScale = signal(load(KEY_UNIT, UNIT_SCALES, 1));

  constructor(private readonly view: MapView | null) {
    this.apply();
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

  private apply(): void {
    document.documentElement.style.fontSize = `${16 * this.uiScale.value}px`;
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
