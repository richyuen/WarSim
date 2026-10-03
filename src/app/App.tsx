import { BottomBar } from '../ui/BottomBar';
import { MapLegend } from '../ui/MapLegend';
import { HistoryPanel } from '../ui/HistoryPanel';
import { StatsChart } from '../ui/StatsChart';
import { dateOfTick } from '../shared/calendar';
import { t, type MessageKey } from '../ui/i18n';
import { NationPanel } from '../ui/NationPanel';
import { StatsRanking } from '../ui/StatsRanking';
import { WarBanners } from '../ui/WarBanners';
import { TopBar } from '../ui/TopBar';
import type { Hud } from './hud';
import type { PlayerControl } from './player';

export function App({ hud, player, nameOf }: { hud: Hud; player: PlayerControl | null; nameOf: (id: number) => string | null }) {
  const stats = hud.stats.value;
  const byId = new Map((stats?.nations ?? []).map((n) => [n.id, n]));
  const nation = byId.get(hud.selected.value) ?? null;
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
        playing={player && player.nation.value !== 0 ? { name: nameOf(player.nation.value) ?? `#${player.nation.value}`, selected: player.selectedCount.value } : null}
      />
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
      {stats ? <WarBanners wars={stats.wars} byId={byId} onSelect={(id) => hud.onSelectNation(id)} /> : null}
      {stats && hud.showStats.value ? (
        <StatsRanking nations={stats.nations} metric={hud.rankMetric.value} selected={hud.selected.value} onMetric={(m) => hud.setRankMetric(m)} onSelect={(id) => hud.onSelectNation(id)} onCharts={() => hud.toggleCharts()} />
      ) : null}
      {nation ? (
        <NationPanel
          nation={nation}
          byId={byId}
          onSelect={(id) => hud.onSelectNation(id)}
          actions={
            player && stats && player.nation.value === nation.id
              ? { nations: stats.nations, wars: stats.wars, templates: hud.templates.value, day: Math.floor(hud.tick.value / 24), onCommand: (c) => hud.command(c) }
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
                  tool: hud.godTool.value,
                  onCommand: (c) => hud.command(c),
                  onTool: (tl) => hud.setGodTool(tl),
                }
              : null
          }
        />
      ) : null}
      <MapLegend mode={hud.mapMode.value} selected={hud.selected.value ? nameOf(hud.selected.value) : null} />
    </>
  );
}
