import { BottomBar } from '../ui/BottomBar';
import { AIR_CONTESTED, AIR_CONTESTED_COLOR } from '../shared/mapModes';
import { MapLegend } from '../ui/MapLegend';
import { MapTooltip } from '../ui/MapTooltip';
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
import { NukeAlerts } from '../ui/NukeAlert';
import { GodToolbar } from '../ui/GodToolbar';
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
import { SEA_PAIR_MARGIN } from './battleView';

/** The least cells across the view a carrier strike's row shows (PLAN 7.35a, 7.84a): the struck ships and the bombs on them. */
export const STRIKE_VIEW_CELLS = 2.4;
/** Cells about the carrier's fleet and the fleet it strikes in its row's view (PLAN 7.84a): their counters stand beside their ships, and SEA_PAIR_MARGIN put the carrier's at the view's edge. */
export const STRIKE_MARGIN = 1.2;

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
  // The sea battles going on (PLAN 4.10b), each by its two sides' names: those with two fleets
  // within reach of a ship's weapon (PLAN 7.19b), then those a carrier's wings fight alone, by
  // the striker and the struck (PLAN 7.35a: they sank ships with no row), then those no weapon
  // reaches yet, its fleets closing (PLAN 7.41a: the critic found battles and no row).
  const all = hud.seaBattles.value;
  const seaBattles = [...all.filter((b) => b.pair !== null), ...all.filter((b) => b.pair === null && b.strike !== null), ...all.filter((b) => b.pair === null && b.strike === null && b.closing !== null)];
  const seaKey = (b: { x: number; y: number; a: number; b: number }): string => `${b.a}-${b.b}-${Math.round(b.x)}-${Math.round(b.y)}`;
  const nameOfSide = (n: number): string => displayName(byId.get(n)?.name ?? '?');
  const battleRows = seaBattles.map((b) => ({
    key: seaKey(b),
    kind: b.pair ? ('pair' as const) : b.strike ? ('strike' as const) : ('closing' as const),
    text: b.pair ? t('ticker.seaBattle', { a: nameOfSide(b.a), b: nameOfSide(b.b) }) : b.strike ? t('ticker.carrierStrike', { a: nameOfSide(b.strike.by), b: nameOfSide(b.strike.by === b.a ? b.b : b.a) }) : t('ticker.seaClosing', { a: nameOfSide(b.a), b: nameOfSide(b.b) }),
  }));
  // A carrier's strikes out of a sea battle (PLAN 7.154a; critic run 17: one ashore had no row), after the
  // battles' own strikes and before the fleets closing: by the carrier's nation and its target's.
  const raids = hud.carrierRaids.value;
  const raidKey = (r: { fleet: number }): string => `cv-${r.fleet}`;
  const raidRows = raids.map((r) => ({ key: raidKey(r), kind: 'raid' as const, text: t(r.ashore ? 'ticker.carrierStrikeAshore' : 'ticker.carrierStrike', { a: nameOfSide(r.by), b: nameOfSide(r.on) }) }));
  const firstClosing = battleRows.findIndex((r) => r.kind === 'closing');
  const seas = firstClosing < 0 ? [...battleRows, ...raidRows] : [...battleRows.slice(0, firstClosing), ...raidRows, ...battleRows.slice(firstClosing)];
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
        godTools={
          stats && hud.godMode.value ? (
            <GodToolbar
              tool={hud.godTool.value}
              onTool={(tl) => hud.setGodTool(tl)}
              spawnSize={hud.spawnSize.value}
              onSpawnSize={(v) => (hud.spawnSize.value = v)}
              thermonuclear={hud.nukeThermonuclear.value}
              onThermonuclear={(on) => (hud.nukeThermonuclear.value = on)}
              nationSelected={hud.selected.value !== 0}
            />
          ) : null
        }
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
            // A carrier's strike out of a battle (PLAN 7.154a): its fleet and its target, framed as a battle's strike.
            const r = raids.find((s) => raidKey(s) === key);
            if (r) {
              const k = r.both;
              hud.onShowSeaBattle(k.x, k.y, [Math.max(STRIKE_VIEW_CELLS, k.w + 2 * STRIKE_MARGIN), Math.max(STRIKE_VIEW_CELLS, k.h + 2 * STRIKE_MARGIN)]);
              return;
            }
            const b = seaBattles.find((s) => seaKey(s) === key);
            // The pair that fights (PLAN 7.10b): its nearest two fleets at war with each other and
            // SEA_PAIR_MARGIN cells about them, clear of the panels, near enough for their fire to
            // show. The box of all its fleets (PLAN 4.12a) was 24 cells across for seed 9043's
            // first battle: counters at 668 m/px, and no fire.
            if (b?.pair) hud.onShowSeaBattle(b.pair.x, b.pair.y, [b.pair.w + 2 * SEA_PAIR_MARGIN, b.pair.h + 2 * SEA_PAIR_MARGIN]);
            // A carrier's strike (PLAN 7.35a): the carrier's fleet and the fleet it strikes, with
            // the wing between them (PLAN 7.84a: the struck fleet alone left the carrier off the
            // screen, up to 250 km away), and no nearer than STRIKE_VIEW_CELLS across.
            else if (b?.strike) {
              const k = b.strike.both;
              hud.onShowSeaBattle(k.x, k.y, [Math.max(STRIKE_VIEW_CELLS, k.w + 2 * STRIKE_MARGIN), Math.max(STRIKE_VIEW_CELLS, k.h + 2 * STRIKE_MARGIN)]);
            }
            // Its fleets closing (PLAN 7.41a): its nearest two at war, both on the screen.
            else if (b?.closing) hud.onShowSeaBattle(b.closing.x, b.closing.y, [b.closing.w + 2 * SEA_PAIR_MARGIN, b.closing.h + 2 * SEA_PAIR_MARGIN]);
          }}
          onOrder={(seq) => {
            const n = orderNews.find((o) => o.seq === seq);
            hud.dismissOrderNews(seq);
            if (n) hud.onShowPlace(n.x, n.y);
          }}
        />
      ) : null}
      {stats && hud.nukeAlerts.value.length > 0 ? (
        <NukeAlerts alerts={hud.nukeAlerts.value} onGo={(r) => hud.onShowPlace(r.x, r.y)} onClose={(r) => (hud.nukeAlerts.value = hud.nukeAlerts.value.filter((a) => a.row.i !== r.i))} />
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
          sizes={SCENARIO_INFO[scenarioIdOf(base) ?? '1938'].sizes}
          defaultSize={SCENARIO_INFO[scenarioIdOf(base) ?? '1938'].defaultSize}
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
          templates={hud.templates.value}
          onWarheads={(nation, count) => hud.command({ kind: 'grantWarheads', nation, count })}
          refusal={hud.refusal.value}
          refusalBase={hud.refusalBase.value}
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
        <StatsRanking nations={stats.nations} lives={stats.lives} dead={stats.dead} metric={hud.rankMetric.value} selected={hud.selected.value} onMetric={(m) => hud.setRankMetric(m)} onSelect={(id) => hud.onSelectNation(id)} onCharts={() => hud.toggleCharts()} flagUrlOf={(id) => (view && flagVersion >= 0 ? view.flags.urlOf(id) : null)} />
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
          economy={hud.economy.value?.nation === nation.id ? hud.economy.value.parts : null}
          onEconomy={(n) => hud.watchEconomy(n)}
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
                  rules: stats.rules,
                  refusal: hud.refusal.value,
                  onCommand: (c) => hud.command(c),
                }
              : null
          }
        />
      ) : null}
      <MapTooltip hover={hud.hover} nameOf={(id) => byId.get(id)?.name ?? null} unrestOf={(p) => hud.sim.unrest?.[p] ?? null} />
      <MapLegend
        mode={hud.mapMode.value}
        groundShown={hud.groundShown.value}
        selected={hud.selected.value ? nameOf(hud.selected.value) : null}
        seaHolders={hud.seaHolders.value.map((h) => ({ name: displayName(byId.get(h.id)?.name ?? `#${h.id}`), color: byId.get(h.id)?.color ?? 0x777777, zones: h.zones }))}
        seaHover={hud.seaHover.value ? { name: hud.seaHover.value.name, holder: hud.seaHover.value.holder ? displayName(byId.get(hud.seaHover.value.holder)?.name ?? `#${hud.seaHover.value.holder}`) : null } : null}
        airHolders={hud.airHolders.value.map((h) => (h.id === AIR_CONTESTED ? { name: null, color: AIR_CONTESTED_COLOR, zones: h.zones } : { name: displayName(byId.get(h.id)?.name ?? `#${h.id}`), color: byId.get(h.id)?.color ?? 0x777777, zones: h.zones }))}
        airHover={hud.airHover.value ? { holder: hud.airHover.value.holder === AIR_CONTESTED ? 'contested' : hud.airHover.value.holder ? displayName(byId.get(hud.airHover.value.holder)?.name ?? `#${hud.airHover.value.holder}`) : null } : null}
      />
    </>
  );
}
