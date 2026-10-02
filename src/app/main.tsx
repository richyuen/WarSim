import { render } from 'preact';
import { SCENARIO_GEOMETRY } from '../shared/scenarios';
import { App } from './App';
import { MapView } from './MapView';
import { SimClient } from './simClient';
import { installTestApi } from './testApi';
import './style.css';

const canvas = document.getElementById('map');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('WarSim: #map canvas missing from index.html');
}

const uiRoot = document.getElementById('ui');
if (uiRoot) render(<App />, uiRoot);

// URL options: ?seed=N (world seed), ?paused=1 (start paused), ?view=0 (no map view; tests that
// only drive the sim worker use it to avoid rendering cost).
const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') ?? 1938) >>> 0;

const sim = new SimClient();
const view = params.get('view') === '0' ? null : new MapView(canvas, SCENARIO_GEOMETRY.toy, sim);
installTestApi({ sim, view });

await sim.init({ scenario: 'toy', seed });
sim.setSpeed(12);
if (params.get('paused') !== '1') sim.setPaused(false);
