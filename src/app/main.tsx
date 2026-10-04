import { render } from 'preact';
import { LISTED_SCENARIOS, SCENARIO_INFO, scenarioIdOf } from '../shared/scenarios';
import { TitleScreen } from '../ui/TitleScreen';
import { startGame } from './game';
import { newGameUrl } from './gameUrl';
import { applyUiScale } from './settings';
import './style.css';

const canvas = document.getElementById('map');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('WarSim: #map canvas missing from index.html');
}
const uiRoot = document.getElementById('ui');

// A game is its URL: ?scenario=1938 (or toy, the test world) with the options `startGame` reads.
// Without a scenario, or with an unknown one, the page is the title screen (PLAN 1.43): no sim
// worker and no map, and starting a game there navigates to the game's URL.
const params = new URLSearchParams(location.search);
const scenarioId = scenarioIdOf(params.get('scenario'));
if (scenarioId !== null) {
  await startGame(canvas, uiRoot, params, scenarioId);
} else {
  canvas.remove();
  applyUiScale();
  if (uiRoot) {
    render(<TitleScreen scenarios={LISTED_SCENARIOS.map((id) => ({ id, info: SCENARIO_INFO[id] }))} onStart={(id, seed, options) => location.assign(newGameUrl(id, seed, options))} />, uiRoot);
  }
}
