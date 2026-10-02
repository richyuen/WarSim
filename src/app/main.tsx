import { render } from 'preact';
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

// URL options: ?seed=N (world seed), ?paused=1 (start paused), ?view=0 (no map view; tests that
// only drive the sim worker use it to avoid rendering cost).
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1938) >>> 0;

const sim = new SimClient();
const scenario = SCENARIO_INFO.toy;
const view = params.get('view') === '0' ? null : new MapView(canvas, scenario.geometry, sim);
const hud = new Hud(sim, scenario.startDay);
hud.installKeys(window);
installTestApi({ sim, view, hud });

const uiRoot = document.getElementById('ui');
if (uiRoot) render(<App hud={hud} />, uiRoot);

await sim.init({ scenario: 'toy', seed });
// Persisted speed and pause (PLAN 1.8); ?paused=1 forces a paused start (tests).
hud.apply(params.get('paused') === '1');
