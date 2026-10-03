import { render } from 'preact';
import type { ScenarioId } from '../shared/protocol';
import { SCENARIO_INFO } from '../shared/scenarios';
import { App } from './App';
import { Autosave } from './autosave';
import { Hud } from './hud';
import { MapView } from './MapView';
import { PlayerControl } from './player';
import { SimClient } from './simClient';
import { installTestApi } from './testApi';
import './style.css';

const canvas = document.getElementById('map');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('WarSim: #map canvas missing from index.html');
}

// URL options: ?scenario=toy|1938 (default toy until the 1938 HUD lands), ?seed=N (world seed),
// ?paused=1 (start paused), ?continue=1 (resume the autosave), ?view=0 (no map view; tests that only drive the sim worker use it).
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1938) >>> 0;

const scenarioId: ScenarioId = params.get('scenario') === '1938' ? '1938' : 'toy';
const sim = new SimClient();
const scenario = SCENARIO_INFO[scenarioId];
const view = params.get('view') === '0' ? null : new MapView(canvas, scenario.geometry, sim);
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
installTestApi({ sim, view, hud, autosave, player });

const uiRoot = document.getElementById('ui');
if (uiRoot) render(<App hud={hud} player={player} view={view} base={scenarioId} nameOf={(id) => view?.nationName(id) ?? null} />, uiRoot);

await sim.init({ scenario: scenarioId, seed });
// ?continue=1 resumes the autosave of this scenario (PLAN 1.27).
if (params.get('continue') === '1') {
  const tick = await autosave.restore().catch(() => null);
  if (tick !== null) console.info(`WarSim: resumed autosave at tick ${tick}`);
}
autosave.start(() => !hud.paused.value);
// Persisted speed and pause (PLAN 1.8); ?paused=1 forces a paused start (tests).
hud.apply(params.get('paused') === '1');
