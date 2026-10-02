/**
 * `window.__warsim`: the automation surface for Playwright and the critic (SPEC §10).
 * It grows with the game (camera, god commands, fps …); PLAN 0.12 exposes the sim client.
 */
import type { SimClient } from './simClient';

export interface WarsimTestApi {
  sim: SimClient;
}

declare global {
  interface Window {
    __warsim?: WarsimTestApi;
  }
}

export function installTestApi(api: WarsimTestApi): void {
  window.__warsim = api;
}
