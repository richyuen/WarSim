import { effect, signal } from '@preact/signals';
import { render } from 'preact';
import type { Inspection, ScenarioId } from '../shared/protocol';
import { geometryOf, mapSizes, SCENARIO_INFO } from '../shared/scenarios';
import { App } from './App';
import { Autosave } from './autosave';
import { Hud } from './hud';
import { MapView } from './MapView';
import { PlayerControl } from './player';
import { loadFailedUrl, optionsFromUrl, withLooping } from './gameUrl';
import { importScenarioFile, readStagedScenario } from './scenarioFiles';
import { saveScreenshot, Settings } from './settings';
import { screenshotLabel } from './screenshotLabel';
import { SimClient } from './simClient';
import { Sound } from './sound';
import { newStrikes, nextAlerts } from '../shared/nukeAlert';
import type { Heard } from '../shared/sound';
import { installTestApi } from './testApi';
import { MAP_MODES } from '../shared/mapModes';

/**
 * Boots a game of `scenarioId` (the sim worker, the map view on `canvas`, the HUD in `uiRoot`).
 * URL options: ?seed=N (world seed), the new-game options of `gameUrl.ts`, ?paused=1 (start
 * paused), ?continue=1 (resume the autosave), ?load=scenario (start from the staged scenario
 * file), ?view=0 (no map view; tests that only drive the sim worker use it).
 */
/** The keys of the map modes, in the order of the button (PLAN 7.4f1). */
const MODE_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];

export async function startGame(canvas: HTMLCanvasElement, uiRoot: HTMLElement | null, params: URLSearchParams, scenarioId: ScenarioId): Promise<void> {
  // ?load=scenario: the scenario file chosen on the title screen waits in IndexedDB (PLAN 1.43b).
  // Without it there is no game to start, and the title screen says so.
  const wantsFile = params.get('load') === 'scenario';
  const staged = wantsFile ? await readStagedScenario().catch(() => undefined) : undefined;
  if (wantsFile && staged?.scenario !== scenarioId) {
    location.replace(loadFailedUrl());
    return;
  }
  // The seed the settings panel shows: the URL's, or a loaded world's own.
  const seed = signal(Number(params.get('seed') ?? 1938) >>> 0);
  const sim = new SimClient();
  const scenario = SCENARIO_INFO[scenarioId];
  // New-game options (PLAN 1.39b1); a non-looping map also renders without wrap copies.
  const options = optionsFromUrl(params);
  // At the size the options ask, one of its map's (PLAN 7.1b6); the scenario's own otherwise.
  // A scenario file at another size than its scenario's own starts the game at its size (PLAN 7.1b8).
  if (staged?.size !== undefined) options.size = staged.size;
  if (options.size !== undefined && !mapSizes(scenarioId).includes(options.size)) delete options.size;
  const sized = options.size === undefined ? scenario.geometry : geometryOf(scenarioId, options.size);
  const geometry = options.loopingMap === false ? { ...sized, wrapX: false } : sized;
  const view = params.get('view') === '0' ? null : new MapView(canvas, geometry, sim, scenario.nationTags, Number(params.get('maxTexture') ?? 0));
  const hud = new Hud(sim, scenario.startDay);
  let player: PlayerControl | null = null;
  hud.installKeys(window);
  if (view) {
    hud.onMapMode = (m) => view.setMapMode(m);
    view.onSelect = (id) => (hud.selected.value = id);
    hud.onSelectNation = (id) => view.select(id);
    view.onGroundShown = (shown) => (hud.groundShown.value = shown);
    view.onHover = (h) => (hud.hover.value = h);
    hud.onShowBattle = (x, y, span, fight) => view.showBattle(x, y, span, fight);
    hud.onShowSeaBattle = (x, y, span) => view.showSeaBattle(x, y, span);
    // A sea battle's view keeps its fleets clear of the panels at the view's sides (PLAN 4.12a).
    view.sidePanels = () => [...document.querySelectorAll('aside')].map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    hud.onShowPlace = (x, y) => view.showPlace(x, y);
    // The sea battles going on, for the ticker (PLAN 4.10b).
    view.onSeaBattles = (b) => (hud.seaBattles.value = b);
    view.onCarrierRaids = (r) => (hud.carrierRaids.value = r);
    // Sea control's legend (PLAN 4.10c): its holders, and the zone under the cursor.
    view.onSeaHolders = (h) => (hud.seaHolders.value = h);
    view.onSeaHover = (z) => (hud.seaHover.value = z);
    // Air superiority's legend (PLAN 5.10): its holders, and the zone under the cursor.
    view.onAirHolders = (h) => (hud.airHolders.value = h);
    view.onAirHover = (z) => (hud.airHover.value = z);
    // The formation whose panel is open is marked on the map (PLAN 2.14f3), however the panel
    // was closed: a click on ground, its button, the nation's chip, or the formation's end.
    effect(() => {
      view.pickedFormation = hud.formation.value;
    });
    // A formation's tag does not stand under the war banners or the bottom bar (PLAN 2.14f2):
    // each banner's own box, for they are a row in the middle and not a band across the view.
    // Nor under the page's panels (PLAN 7.4f21): the top bar, the legend, a nation's or a
    // formation's panel, the ranking, a top-centre panel and the ticker's rows.
    view.tagObstacles = () => [...document.querySelectorAll('.war-banner, .war-more, .bottombar, .topbar, .map-legend, .nation-panel, .stats-ranking, .history-panel, .ticker-row')].map((e) => {
      const r = e.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const p = new PlayerControl(hud, view);
    player = p;
    view.onPick = (x, y, sx, sy, shift) => {
      // God Mode's placing armed: the click is the place, on a formation too (no panel opens).
      if (p.placing.value !== null) return p.click(x, y, sx, sy, shift);
      if (hud.editorClick(x, y, view.cityNear(x, y), view.provinceAt(x, y)) || hud.pick(x, y, view.provinceAt(x, y), view.cityNear(x, y))) return true;
      // A formation under the click opens its panel (PLAN 2.14b), the player's own too (which
      // the click also selects for orders); a click anywhere else closes the panel, and goes on
      // to the player's order or to the nation of the ground.
      const formation = view.formationPick(sx, sy);
      hud.selectFormation(formation);
      return p.click(x, y, sx, sy, shift) || formation !== 0;
    };
    // A right-click on another nation's ground opens its menu for the player (declare war, peace,
    // alliance); a press of any button on the map or a wheel turn closes it.
    view.onContextClick = (nation, _sx, _sy, cx, cy) => p.openMenu(nation, cx, cy);
    // A selection box (Shift-drag; Ctrl+Shift-drag takes out; a long press's drag on a touch screen).
    view.onBoxSelect = (ids, remove) => p.boxSelect(ids, remove);
    // God Mode's placing is God Mode's: it goes with it, and with a God tool armed.
    effect(() => {
      if (!hud.godMode.value || hud.godTool.value !== null) p.stopPlacing();
    });
    canvas.addEventListener('pointerdown', () => p.closeMenu());
    canvas.addEventListener('wheel', () => p.closeMenu(), { passive: true });
    // The editor's brush and line paint on a left-drag (PLAN 1.44); the cursor says so.
    view.paint = { active: () => hud.dragTool() !== null, start: (x, y) => hud.dragStart(x, y), move: (x, y) => hud.dragMove(x, y), end: (x, y) => hud.dragEnd(x, y), cancel: () => hud.dragCancel() };
    effect(() => {
      canvas.style.cursor = hud.dragTool() ? 'crosshair' : '';
    });
    window.addEventListener('keydown', (e) => {
      const typing = (e.target as HTMLElement | null)?.closest('textarea, input:not([type=checkbox]):not([type=radio]):not([type=file])');
      // Escape (PLAN 7.4f1): the player's selection or armed order first, else the nearest panel.
      if (e.key === 'Escape') {
        if (p.menu.value !== null) p.closeMenu();
        else if (p.placing.value !== null) p.stopPlacing();
        else if (p.selectedCount.value > 0 || p.wingOrder.value !== null || p.dropArmed.value || p.followedWing.value !== null) p.clearSelection();
        else hud.escape();
      }
      // Ctrl+A: every formation of the nation played that a click orders, while playing one.
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.code === 'KeyA' && !typing && p.nation.value !== 0) {
        e.preventDefault();
        p.selectAll();
        return;
      }
      // The map modes on the number keys, 1 to 9 and 0 in the order of the button (PLAN 7.4f1).
      const mode = MODE_KEYS.indexOf(e.code);
      if (mode >= 0 && mode < MAP_MODES.length && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        hud.setMapMode(MAP_MODES[mode]!);
        e.preventDefault();
        return;
      }
      // Editor undo/redo: Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z, except while typing in a text field
      // (a focused dropdown or checkbox has no text to undo; review in PLAN 1.37a).
      if (!hud.showEditor.value || !(e.ctrlKey || e.metaKey) || typing) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) hud.command({ kind: 'editUndo' });
      else if (k === 'y' || (k === 'z' && e.shiftKey)) hud.command({ kind: 'editRedo' });
      else return;
      e.preventDefault();
    });
    view.setMapMode(hud.mapMode.value);
  }
  // What the settings panel's new-game form starts from and the autosave records: the URL's
  // options, with the number of nations a loaded world has (PLAN 2.16d).
  const setup = signal(options);
  const autosave = new Autosave(sim, scenarioId, () => ({ seed: seed.value, options: setup.value }));
  // Sound (PLAN 3.12d): the cue of what the ticker tells; a browser allows it after the first press.
  const sound = new Sound();
  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sound.unlock(), { capture: true });
  sim.onStats((m) => sound.onTicker(m.ticker, m.world, m.news));
  const settings = new Settings(view, sound);
  // The nuclear alert (PLAN 6.6a): each new strike's banner (PLAN 7.109a), and a pause when the
  // setting asks. The worker pauses itself on the strike's tick (PLAN 7.109a); the host follows.
  let seenStrikes: Heard | null = null;
  effect(() => sim.setNukePause(settings.nukePause.value));
  sim.onStats((m) => {
    const s = newStrikes(m.strikes, m.world, seenStrikes, m.news);
    const shown = seenStrikes && seenStrikes.world !== m.world ? [] : hud.nukeAlerts.value;
    seenStrikes = s.seen;
    // An alert goes after its days of the game and a few seconds (PLAN 7.25d).
    const next = nextAlerts(shown, s.rows, m.tick, performance.now());
    if (next !== hud.nukeAlerts.value) hud.nukeAlerts.value = next;
    if (s.struck && settings.nukePause.value && !hud.paused.value) hud.togglePause();
  });
  // F2 saves a screenshot of the map (PLAN 1.39a; AoC uses F11, which browsers keep for fullscreen).
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'F2' || !view) return;
    e.preventDefault();
    void saveScreenshot(view, screenshotLabel(hud));
  });
  installTestApi({ sim, view, hud, autosave, player, settings, sound });

  // Back to the title screen (PLAN 1.43): the game is autosaved first, so it can be continued.
  const toMenu = (): void => {
    void autosave
      .saveNow()
      .catch(() => {})
      .then(() => location.assign(location.pathname));
  };
  // A loaded world has its own seed and its own number of nations. A continued game keeps the
  // number of its URL (`keep`): that is the number it was started with, and the world's may have
  // changed since.
  const showWorld = async (keep: boolean): Promise<Inspection> => {
    const world = await sim.inspect();
    seed.value = world.seed;
    const range = scenario.nationsRange;
    if (range && !(keep && setup.value.nations !== undefined)) {
      const living = world.nations.filter((n) => n.living).length;
      setup.value = { ...setup.value, nations: Math.min(range.max, Math.max(range.min, living)) };
    }
    return world;
  };
  if (uiRoot) {
    render(
      <App hud={hud} player={player} view={view} base={scenarioId} settings={settings} seed={seed} options={setup} nameOf={(id) => view?.nationName(id) ?? null} onMenu={toMenu} onLoaded={() => void showWorld(false)} />,
      uiRoot,
    );
  }

  await sim.init({ scenario: scenarioId, seed: seed.value, options });
  // A loaded world replaces the new one: the staged scenario file, or with ?continue=1 the
  // autosave of this scenario (PLAN 1.27).
  let loaded = false;
  if (staged) {
    try {
      await importScenarioFile(sim, staged.bytes, scenarioId, geometry.w, geometry.h);
      loaded = true;
    } catch {
      location.replace(loadFailedUrl());
      return;
    }
  } else if (params.get('continue') === '1') {
    // A save that does not fit (from an older version) is refused whole by the sim and the
    // title screen says so; nothing starts, and the autosave is not overwritten (PLAN 7.149).
    let tick: number | null;
    try {
      tick = await autosave.restore();
    } catch (err) {
      console.warn(`Warism: the autosave could not be loaded: ${err instanceof Error ? err.message : String(err)}`);
      location.replace(loadFailedUrl('save'));
      return;
    }
    if (tick !== null) console.info(`Warism: resumed autosave at tick ${tick}`);
    loaded = tick !== null;
  }
  if (loaded) {
    // The loaded world has its own looping setting, and the map view was built from the URL
    // before it was there: when they differ, the URL is corrected and the game boots again.
    const world = await showWorld(!staged);
    const looping = world.settings.loopingMap && scenario.geometry.wrapX;
    if (looping !== geometry.wrapX) {
      location.replace(withLooping(params, looping));
      return;
    }
  }
  autosave.start(() => !hud.paused.value);
  // Persisted speed and pause (PLAN 1.8); ?paused=1 forces a paused start (tests).
  hud.apply(params.get('paused') === '1');
}
