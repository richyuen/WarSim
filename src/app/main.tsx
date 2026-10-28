import { render } from 'preact';
import { sameStateFormat } from '../shared/saveFormat';
import { LISTED_SCENARIOS, SCENARIO_INFO, scenarioIdOf, scenarioPreviewPath } from '../shared/scenarios';
import { TitleScreen } from '../ui/TitleScreen';
import { readAutosave, type SaveRecord } from './autosave';
import { startGame } from './game';
import { continueUrl, newGameUrl, stagedScenarioUrl } from './gameUrl';
import { checkScenarioFile, stageScenarioFile } from './scenarioFiles';
import { applyUiScale } from './settings';
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import './style.css';

const canvas = document.getElementById('map');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('WarSim: #map canvas missing from index.html');
}
const uiRoot = document.getElementById('ui');

// A game is its URL: ?scenario=1938 (or toy, the test world) with the options `startGame` reads.
// Without a scenario, or with an unknown one, the page is the title screen (PLAN 1.43): no sim
// worker and no map, and starting or loading a game there navigates to the game's URL.
const params = new URLSearchParams(location.search);
const scenarioId = scenarioIdOf(params.get('scenario'));
if (scenarioId !== null) {
  await startGame(canvas, uiRoot, params, scenarioId);
} else {
  canvas.remove();
  applyUiScale();
  // The autosave the title screen offers; an autosave of a scenario this version lacks is not offered.
  let save: SaveRecord | undefined;
  const readSave = async () => {
    save = await readAutosave();
    const id = save ? scenarioIdOf(save.scenario) : null;
    if (!save || id === null) return null;
    return { info: SCENARIO_INFO[id], tick: save.tick, savedAt: save.savedAt, older: !sameStateFormat(save.format) };
  };
  if (uiRoot) {
    render(
      <TitleScreen
        scenarios={LISTED_SCENARIOS.map((id) => ({ id, info: SCENARIO_INFO[id] }))}
        previewUrl={(id) => new URL(scenarioPreviewPath(id), document.baseURI).href}
        onStart={(id, seed, options) => location.assign(newGameUrl(id, seed, options))}
        readSave={readSave}
        onContinue={() => {
          if (save) location.assign(continueUrl(save));
        }}
        checkScenarioFile={async (file) => {
          const { header, scenario } = await checkScenarioFile(new Uint8Array(await file.arrayBuffer()));
          return { name: header.name, scenario, startDay: SCENARIO_INFO[scenario].startDay, tick: header.tick };
        }}
        onScenarioFile={async (file) => location.assign(stagedScenarioUrl(await stageScenarioFile(new Uint8Array(await file.arrayBuffer()))))}
        loadFailed={params.get('failed') === 'scenario'}
        saveFailed={params.get('failed') === 'save'}
      />,
      uiRoot,
    );
  }
}
