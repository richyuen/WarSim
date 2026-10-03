import { BottomBar } from '../ui/BottomBar';
import { MapLegend } from '../ui/MapLegend';
import { NationPanel } from '../ui/NationPanel';
import { StatsRanking } from '../ui/StatsRanking';
import { WarBanners } from '../ui/WarBanners';
import { TopBar } from '../ui/TopBar';
import type { Hud } from './hud';

export function App({ hud, nameOf }: { hud: Hud; nameOf: (id: number) => string | null }) {
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
      />
      {stats ? <WarBanners wars={stats.wars} byId={byId} onSelect={(id) => hud.onSelectNation(id)} /> : null}
      {stats && hud.showStats.value ? (
        <StatsRanking nations={stats.nations} metric={hud.rankMetric.value} selected={hud.selected.value} onMetric={(m) => hud.setRankMetric(m)} onSelect={(id) => hud.onSelectNation(id)} />
      ) : null}
      {nation ? (
        <NationPanel
          nation={nation}
          byId={byId}
          onSelect={(id) => hud.onSelectNation(id)}
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
