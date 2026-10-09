/**
 * `window.__warsim`: the automation surface for Playwright and the critic (SPEC §10).
 * It grows with the game (god commands, fps …).
 */
import type { Autosave } from './autosave';
import type { Hud } from './hud';
import type { MapView } from './MapView';
import type { PlayerControl } from './player';
import type { Settings } from './settings';
import type { SimClient } from './simClient';
import type { Sound } from './sound';

export interface WarsimTestApi {
  sim: SimClient;
  /** Null when the page was opened with ?view=0. */
  view: MapView | null;
  hud: Hud;
  /** PLAN 1.27: IndexedDB autosave (saveNow / read / restore). */
  autosave: Autosave;
  /** PLAN 1.33a: player control (null with ?view=0). */
  player: PlayerControl | null;
  /** PLAN 1.39a: UI and unit size. */
  settings: Settings;
  /** PLAN 3.12d: the cues asked for (`asked`) and given to the audio context (`sounded`). */
  sound: Sound;
}

declare global {
  interface Window {
    __warsim?: WarsimTestApi;
  }
}

export function installTestApi(api: WarsimTestApi): void {
  window.__warsim = api;
}
