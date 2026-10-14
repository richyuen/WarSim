import { BottomBar } from '../ui/BottomBar';
import { AIR_CONTESTED, AIR_CONTESTED_COLOR } from '../shared/mapModes';
import { MapLegend } from '../ui/MapLegend';
import { FormationPanel } from '../ui/FormationPanel';
import { HistoryPanel } from '../ui/HistoryPanel';
import { StatsChart } from '../ui/StatsChart';
import { EditorPanel } from '../ui/EditorPanel';
import { dateOfTick } from '../shared/calendar';
import { displayName, t, type MessageKey } from '../ui/i18n';
import { NationPanel } from '../ui/NationPanel';
import { StatsRanking } from '../ui/StatsRanking';
import { WarBanners } from '../ui/WarBanners';
import { Ticker } from '../ui/Ticker';
import { NukeAlert } from '../ui/NukeAlert';
import { orderNewsText } from '../ui/orderNewsText';
import { TopBar } from '../ui/TopBar';
import type { Hud } from './hud';
import type { PlayerControl } from './player';
import type { MapView } from './MapView';
import { saveScreenshot, UI_SCALES, UNIT_SCALES, VOLUMES, type Settings } from './settings';
import { SettingsPanel } from '../ui/SettingsPanel';
import { screenshotLabel } from './screenshotLabel';
import { newGameUrl } from './gameUrl';
import type { GameOptions } from '../shared/gameOptions';
import { SCENARIO_INFO, scenarioIdOf } from '../shared/scenarios';
import { downloadBytes, exportScenarioFile, importScenarioFile, scenarioFileName } from './scenarioFiles';
import { useEffect, useState } from 'preact/hooks';
import type { ReadonlySignal } from '@preact/signals';
import { encodeRuns } from '../shared/mapImport';
import { imageToRuns, NATION_MAX_DIST, TERRAIN_MAX_DIST } from './importImage';

export function App({
  hud,
  player,
  view,
  base,
  settings,
  seed,
  options,
  nameOf,
  onMenu,
  onLoaded,
}: {
  hud: Hud;
  player: PlayerControl | null;
  view: MapView | null;
  base: string;
  settings: Settings;
  /** The world's seed: the URL's, or a loaded world's own. */
  seed: ReadonlySignal<number>;
  /** The game's new-game options: the URL's, with the number of nations a loaded world has. */
  options: ReadonlySignal<GameOptions>;
  nameOf: (id: number) => string | null;
  /** Leaves the game for the title screen (PLAN 1.43). */
  onMenu: () => void;
  /** A scenario file was loaded into the running game (its world has its own seed). */
  onLoaded: () => void;
}) {
  const [scenarioStatus, setScenarioStatus] = useState('');
  // Re-render when custom flags change (the flag store is outside the signals).
  const [flagVersion, setFlagVersion] = useState(0);
  useEffect(() => hud.sim.onFlags(() => setFlagVersion((v) => v + 1)), []);
  const stats = hud.stats.value;
  const byId = new Map((stats?.nations ?? []).map((n) => [n.id, n]));
  const nation = byId.get(hud.selected.value) ?? null;
  // The formation panel (PLAN 2.14b) stands in the nation panel's place while a formation is picked.
  const formationTitle = view && hud.formation.value !== 0 ? view.formationTitle(hud.formation.value) : null;
  // What became of the player's orders (PLAN 4.9c), in words, with the formation's name as its tag has it.
  const orderNews = hud.orderNews.value;
  // A wing at its base is not drawn (PLAN 5.1d): it is named by its template (PLAN 5.8v3).
  const wingName = (id: number): string | undefined => {
    const wing = stats?.wings.find((w) => w.id === id);
    const key = wing ? hud.templates.value[wing.template]?.nameKey : undefined;
    return key ? t(key as MessageKey) : undefined;
  };
  const orderName = (id: number): string => (view ? view.formationTitle(id)?.name : undefined) ?? wingName(id) ?? t('order.aFormation');
  const orders = orderNews.map((n) => ({ seq: n.seq, kind: n.kind, text: orderNewsText(n, orderName(n.id)) }));
  // The sea battles going on (PLAN 4.10b), each by its two sides' names.
  const seaBattles = hud.seaBattles.value;
  const seaKey = (b: { x: number; y: number; a: number; b: number }): string => `${b.a}-${b.b}-${Math.round(b.x)}-${Math.round(b.y)}`;
  const seas = seaBattles.map((b) => ({ key: seaKey(b), text: t('ticker.seaBattle', { a: displayName(byId.get(b.a)?.name ?? '?'), b: displayName(byId.get(b.b)?.name ?? '?') }) }));
  const lastOrder = formationTitle ? orderNews.filter((n) => n.id === hud.formation.value).at(-1) : undefined;
  return (
    <>
      <TopBar />
      <BottomBar
        date={hud.date()}
        speedLevel={hud.speedLevel.value}
        paused={hud.paused.value}
        onTogglePause={() => hud.togglePause()}
        onSpeed={(l) => hud.setSpeedLevel(l)}
        mapMode={hud.mapMode.value}
        onCycleMapMode={() => hud.cycleMapMode()}
        showStats={hud.showStats.value}
        onToggleStats={stats ? () => hud.toggleStats() : undefined}
        godMode={hud.godMode.value}
        onToggleGod={stats ? () => hud.toggleGod() : undefined}
        showHistory={hud.showHistory.value}
        onToggleHistory={stats ? () => hud.toggleHistory() : undefined}
        showSettings={hud.showSettings.value}
        onToggleSettings={() => hud.toggleSettings()}
        showEditor={hud.showEditor.value}
        onToggleEditor={stats ? () => hud.toggleEditor() : undefined}
        playing={player && player.nation.value !== 0 ? { name: nameOf(player.nation.value) ?? `#${player.nation.value}`, selected: player.selectedCount.value } : null}
      />
      {/* Before the panels of the centre, which are drawn over a row of banners that reaches them (PLAN 3.12Rh5). */}
      {stats ? (
        <Ticker
          rows={stats.ticker}
          short={formationTitle !== null || nation !== null}
          startDay={hud.startDay}
          onPlace={(x, y) => hud.onShowPlace(x, y)}
          orders={orders}
          seas={seas}
          onSea={(key) => {
            const b = seaBattles.find((s) => seaKey(s) === key);
            // A view of both sides' fleets (PLAN 4.12a): their box and a cell around it, clear of
            // the panels; out to T1 for a battle at a carrier's reach.
            if (b) hud.onShowSeaBattle(b.cx, b.cy, [b.span[0] + 2, b.span[1] + 2]);
          }}
          onOrder={(seq) => {
            const n = orderNews.find((o) => o.seq === seq);
            hud.dismissOrderNews(seq);
            if (n) hud.onShowPlace(n.x, n.y);
          }}
        />
      ) : null}
      {stats && hud.nukeAlert.value ? (
        <NukeAlert
          row={hud.nukeAlert.value}
          onGo={() => {
            const r = hud.nukeAlert.value;
            if (r) hud.onShowPlace(r.x, r.y);
          }}
          onClose={() => (hud.nukeAlert.value = null)}
        />
      ) : null}
      {stats ? <WarBanners wars={stats.wars} byId={byId} onSelect={(id) => hud.onSelectNation(id)} onBattle={(war) => hud.toBattle(war)} /> : null}
      {hud.showSettings.value ? (
        <SettingsPanel
          uiScale={settings.uiApplied.value}
          unitScale={settings.unitScale.value}
          uiScales={UI_SCALES}
          uiOffered={settings.uiOffered.value}
          unitScales={UNIT_SCALES}
          seed={seed.value}
          options={options.value}
          nationsRange={SCENARIO_INFO[scenarioIdOf(base) ?? '1938'].nationsRange}
          onUiScale={(v) => settings.setUiScale(v)}
          onUnitScale={(v) => settings.setUnitScale(v)}
          volume={settings.volume.value}
          volumes={VOLUMES}
          muted={settings.muted.value}
          onVolume={(v) => settings.setVolume(v)}
          onMuted={(v) => settings.setMuted(v)}
          nukePause={settings.nukePause.value}
          onNukePause={(v) => settings.setNukePause(v)}
          onScreenshot={() => {
            if (view) void saveScreenshot(view, screenshotLabel(hud));
          }}
          onNewGame={(s, o) => location.assign(newGameUrl(base, s, o))}
          onMenu={onMenu}
          onClose={() => hud.toggleSettings()}
        />
      ) : null}
      {stats && hud.showEditor.value ? (
        <EditorPanel
          state={hud.editor.value}
          nations={stats.nations}
          dead={stats.dead}
          undo={stats.edits.undo}
          redo={stats.edits.redo}
          lineStarted={hud.lineStart.value !== null}
          onChange={(s) => hud.setEditor(s)}
          onUndo={() => hud.command({ kind: 'editUndo' })}
          onRedo={() => hud.command({ kind: 'editRedo' })}
          onClose={() => hud.toggleEditor()}
          onGold={(nation, value) => hud.command({ kind: 'setGold', nation, value })}
          onAnnex={(annexer, target) => hud.command({ kind: 'annexNation', annexer, target })}
          flagOf={(n) => view?.flags.pixelsOf(n) ?? new Uint32Array(36 * 24)}
          onFlag={(nation, px) => hud.command({ kind: 'setFlag', nation, runs: px ? encodeRuns(px) : [] })}
          scenarioStatus={scenarioStatus}
          onExportScenario={(name) => {
            const geo = hud.sim.mapLayers?.terrain;
            if (!geo) return;
            void exportScenarioFile(hud.sim, name, base, geo.w, geo.h)
              .then(({ file, header }) => {
                downloadBytes(file, scenarioFileName(header.name));
                setScenarioStatus(t('scenario.exported', { name: header.name }));
              })
              .catch((e: unknown) => setScenarioStatus(t('scenario.exportFailed', { error: e instanceof Error ? e.message : String(e) })));
          }}
          onImportScenario={(file) => {
            const geo = hud.sim.mapLayers?.terrain;
            if (!geo) return;
            void file
              .arrayBuffer()
              .then((buf) => importScenarioFile(hud.sim, new Uint8Array(buf), base, geo.w, geo.h))
              .then((h) => {
                setScenarioStatus(t('scenario.loaded', { name: h.name }));
                onLoaded();
              })
              .catch((e: unknown) => setScenarioStatus(t('scenario.failed', { error: e instanceof Error ? e.message : String(e) })));
          }}
          onImport={(file, layer) => {
            const geo = hud.sim.mapLayers?.terrain;
            if (!geo) return;
            const palette =
              layer === 'terrain'
                ? (hud.sim.mapLayers?.terrainColors ?? []).map((rgb, value) => ({ rgb, value }))
                : stats.nations.map((n) => ({ rgb: n.color, value: n.id }));
            void imageToRuns(file, geo.w, geo.h, palette, layer === 'terrain' ? TERRAIN_MAX_DIST : NATION_MAX_DIST, 0).then((runs) => hud.command({ kind: 'importLayer', layer, runs }));
          }}
        />
      ) : null}
      {stats && hud.showCharts.value ? (
        <StatsChart
          load={() => hud.sim.statSeries()}
          refreshKey={stats.tick}
          nations={[...stats.nations.map((n) => ({ id: n.id, name: n.name, color: n.color })), ...stats.dead]}
          selected={hud.selected.value}
          labelOf={(tk) => {
            const d = dateOfTick(hud.startDay, tk);
            return t('chart.monthYear', { month: t(`month.${d.month}` as MessageKey), year: d.year });
          }}
          onClose={() => hud.toggleCharts()}
        />
      ) : null}
      {stats && hud.showHistory.value ? (
        <HistoryPanel
          load={() => hud.sim.history()}
          refreshKey={stats.tick}
          startDay={hud.startDay}
          nations={[...stats.nations.map((n) => ({ id: n.id, name: n.name })), ...stats.dead]}
          onClose={() => hud.toggleHistory()}
        />
      ) : null}
      {stats && hud.showStats.value && !hud.showEditor.value ? (
        <StatsRanking nations={stats.nations} metric={hud.rankMetric.value} selected={hud.selected.value} onMetric={(m) => hud.setRankMetric(m)} onSelect={(id) => hud.onSelectNation(id)} onCharts={() => hud.toggleCharts()} />
      ) : null}
      {formationTitle ? (
        <FormationPanel
          info={hud.formationInfo.value}
          name={formationTitle.name}
          kind={formationTitle.kind}
          nation={byId.get(formationTitle.nation) ?? null}
          flagUrl={view && flagVersion >= 0 ? view.flags.urlOf(formationTitle.nation) : null}
          onNation={(id) => {
            hud.selectFormation(0);
            hud.onSelectNation(id);
          }}
          onFight={() => hud.toFight()}
          onClose={() => hud.selectFormation(0)}
          notice={lastOrder ? orderNewsText(lastOrder, formationTitle.name) : null}
        />
      ) : nation ? (
        <NationPanel
          nation={nation}
          byId={byId}
          techs={hud.techs.value}
          flagUrl={view && flagVersion >= 0 ? view.flags.urlOf(nation.id) : null}
          onSelect={(id) => hud.onSelectNation(id)}
          actions={
            player && stats && player.nation.value === nation.id
              ? {
                  nations: stats.nations,
                  wars: stats.wars,
                  templates: hud.templates.value,
                  day: Math.floor(hud.tick.value / 24),
                  onCommand: (c) => hud.command(c),
                  wings: stats.wings,
                  wingOrder: player.wingOrder.value,
                  onArmWing: (wing, kind) => player.armWing(wing, kind),
                  selected: player.selectedCount.value,
                  dropArmed: player.dropArmed.value,
                  onArmDrop: () => player.armDrop(),
                }
              : null
          }
          control={
            player
              ? {
                  controlled: player.nation.value === nation.id,
                  onTake: () => player.take(nation.id),
                  onRelease: () => player.release(),
                }
              : null
          }
          god={
            stats && hud.godMode.value
              ? {
                  nations: stats.nations,
                  wars: stats.wars,
                  dead: stats.dead,
                  aiEnabled: stats.aiEnabled,
                  nukesEnabled: stats.nukesEnabled,
                  tool: hud.godTool.value,
                  refusal: hud.refusal.value,
                  onCommand: (c) => hud.command(c),
                  onTool: (tl) => hud.setGodTool(tl),
                }
              : null
          }
        />
      ) : null}
      <MapLegend
        mode={hud.mapMode.value}
        selected={hud.selected.value ? nameOf(hud.selected.value) : null}
        seaHolders={hud.seaHolders.value.map((h) => ({ name: displayName(byId.get(h.id)?.name ?? `#${h.id}`), color: byId.get(h.id)?.color ?? 0x777777, zones: h.zones }))}
        seaHover={hud.seaHover.value ? { name: hud.seaHover.value.name, holder: hud.seaHover.value.holder ? displayName(byId.get(hud.seaHover.value.holder)?.name ?? `#${hud.seaHover.value.holder}`) : null } : null}
        airHolders={hud.airHolders.value.map((h) => (h.id === AIR_CONTESTED ? { name: null, color: AIR_CONTESTED_COLOR, zones: h.zones } : { name: displayName(byId.get(h.id)?.name ?? `#${h.id}`), color: byId.get(h.id)?.color ?? 0x777777, zones: h.zones }))}
        airHover={hud.airHover.value ? { holder: hud.airHover.value.holder === AIR_CONTESTED ? 'contested' : hud.airHover.value.holder ? displayName(byId.get(hud.airHover.value.holder)?.name ?? `#${hud.airHover.value.holder}`) : null } : null}
      />
    </>
  );
}
