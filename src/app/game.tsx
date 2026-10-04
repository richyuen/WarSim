import { render } from 'preact';
import type { ScenarioId } from '../shared/protocol';
import { SCENARIO_INFO } from '../shared/scenarios';
import { App } from './App';
import { Autosave } from './autosave';
import { Hud } from './hud';
import { MapView } from './MapView';
import { PlayerControl } from './player';
import { optionsFromUrl } from './gameUrl';
import { saveScreenshot, Settings } from './settings';
import { screenshotLabel } from './screenshotLabel';
import { SimClient } from './simClient';
import { installTestApi } from './testApi';

/**
 * Boots a game of `scenarioId` (the sim worker, the map view on `canvas`, the HUD in `uiRoot`).
 * URL options: ?seed=N (world seed), the new-game options of `gameUrl.ts`, ?paused=1 (start
 * paused), ?continue=1 (resume the autosave), ?view=0 (no map view; tests that only drive the sim
 * worker use it).
 */
export async function startGame(canvas: HTMLCanvasElement, uiRoot: HTMLElement | null, params: URLSearchParams, scenarioId: ScenarioId): Promise<void> {
  const seed = Number(params.get('seed') ?? 1938) >>> 0;
  const sim = new SimClient();
  const scenario = SCENARIO_INFO[scenarioId];
  // New-game options (PLAN 1.39b1); a non-looping map also renders without wrap copies.
  const options = optionsFromUrl(params);
  const geometry = options.loopingMap === false ? { ...scenario.geometry, wrapX: false } : scenario.geometry;
  const view = params.get('view') === '0' ? null : new MapView(canvas, geometry, sim);
  const hud = new Hud(sim, scenario.startDay);
  let player: PlayerControl | null = null;
  hud.installKeys(window);
  if (view) {
    hud.onMapMode = (m) => view.setMapMode(m);
    view.onSelect = (id) => (hud.selected.value = id);
    hud.onSelectNation = (id) => view.select(id);
    const p = new PlayerControl(hud, view);
    player = p;
    view.onPick = (x, y, sx, sy, shift) => hud.editorClick(x, y, view.cityNear(x, y), view.provinceAt(x, y)) || hud.pick(x, y, view.provinceAt(x, y)) || p.click(x, y, sx, sy, shift);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') p.clearSelection();
      // Editor undo/redo: Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z, except while typing in a text field
      // (a focused dropdown or checkbox has no text to undo; review in PLAN 1.37a).
      const typing = (e.target as HTMLElement | null)?.closest('textarea, input:not([type=checkbox]):not([type=radio]):not([type=file])');
      if (!hud.showEditor.value || !(e.ctrlKey || e.metaKey) || typing) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) hud.command({ kind: 'editUndo' });
      else if (k === 'y' || (k === 'z' && e.shiftKey)) hud.command({ kind: 'editRedo' });
      else return;
      e.preventDefault();
    });
    view.setMapMode(hud.mapMode.value);
  }
  const autosave = new Autosave(sim, scenarioId);
  const settings = new Settings(view);
  // F2 saves a screenshot of the map (PLAN 1.39a; AoC uses F11, which browsers keep for fullscreen).
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F2' || !view) return;
    e.preventDefault();
    void saveScreenshot(view, screenshotLabel(hud));
  });
  installTestApi({ sim, view, hud, autosave, player, settings });

  // Back to the title screen (PLAN 1.43): the game is autosaved first, so it can be continued.
  const toMenu = (): void => {
    void autosave
      .saveNow()
      .catch(() => {})
      .then(() => location.assign(location.pathname));
  };
  if (uiRoot) {
    render(<App hud={hud} player={player} view={view} base={scenarioId} settings={settings} seed={seed} options={options} nameOf={(id) => view?.nationName(id) ?? null} onMenu={toMenu} />, uiRoot);
  }

  await sim.init({ scenario: scenarioId, seed, options });
  // ?continue=1 resumes the autosave of this scenario (PLAN 1.27).
  if (params.get('continue') === '1') {
    const tick = await autosave.restore().catch(() => null);
    if (tick !== null) console.info(`WarSim: resumed autosave at tick ${tick}`);
  }
  autosave.start(() => !hud.paused.value);
  // Persisted speed and pause (PLAN 1.8); ?paused=1 forces a paused start (tests).
  hud.apply(params.get('paused') === '1');
}
