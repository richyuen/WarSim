import { BottomBar } from '../ui/BottomBar';
import { TopBar } from '../ui/TopBar';
import type { Hud } from './hud';

export function App({ hud }: { hud: Hud }) {
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
    </>
  );
}
