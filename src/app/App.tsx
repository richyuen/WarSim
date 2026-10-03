import { BottomBar } from '../ui/BottomBar';
import { MapLegend } from '../ui/MapLegend';
import { TopBar } from '../ui/TopBar';
import type { Hud } from './hud';

export function App({ hud, nameOf }: { hud: Hud; nameOf: (id: number) => string | null }) {
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
      <MapLegend mode={hud.mapMode.value} selected={hud.selected.value ? nameOf(hud.selected.value) : null} />
    </>
  );
}
