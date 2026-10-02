/**
 * `window.__warsim`: the automation surface for Playwright and the critic (SPEC §10).
 * It grows with the game (god commands, fps …).
 */
import type { MapView } from './MapView';
import type { SimClient } from './simClient';

export interface WarsimTestApi {
  sim: SimClient;
  /** Null when the page was opened with ?view=0. */
  view: MapView | null;
}

declare global {
  interface Window {
    __warsim?: WarsimTestApi;
  }
}

export function installTestApi(api: WarsimTestApi): void {
  window.__warsim = api;
}
