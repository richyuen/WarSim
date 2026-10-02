import { render } from 'preact';
import type { ScenarioId } from '../shared/protocol';
import { SCENARIO_INFO } from '../shared/scenarios';
import { App } from './App';
import { Hud } from './hud';
import { MapView } from './MapView';
import { SimClient } from './simClient';
import { installTestApi } from './testApi';
import './style.css';

const canvas = document.getElementById('map');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('WarSim: #map canvas missing from index.html');
}

// URL options: ?scenario=toy|1938 (default toy until the 1938 HUD lands), ?seed=N (world seed),
// ?paused=1 (start paused), ?view=0 (no map view; tests that only drive the sim worker use it).
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1938) >>> 0;

const scenarioId: ScenarioId = params.get('scenario') === '1938' ? '1938' : 'toy';
const sim = new SimClient();
const scenario = SCENARIO_INFO[scenarioId];
const view = params.get('view') === '0' ? null : new MapView(canvas, scenario.geometry, sim);
const hud = new Hud(sim, scenario.startDay);
hud.installKeys(window);
installTestApi({ sim, view, hud });

const uiRoot = document.getElementById('ui');
if (uiRoot) render(<App hud={hud} />, uiRoot);

await sim.init({ scenario: scenarioId, seed });
// Persisted speed and pause (PLAN 1.8); ?paused=1 forces a paused start (tests).
hud.apply(params.get('paused') === '1');
