import { BottomBar } from '../ui/BottomBar';
import { MapLegend } from '../ui/MapLegend';
import { NationPanel } from '../ui/NationPanel';
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
      />
      {nation ? <NationPanel nation={nation} byId={byId} onSelect={(id) => hud.onSelectNation(id)} /> : null}
      <MapLegend mode={hud.mapMode.value} selected={hud.selected.value ? nameOf(hud.selected.value) : null} />
    </>
  );
}
