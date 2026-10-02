import type { SimDate } from '../shared/calendar';
import type { MapMode } from '../shared/mapModes';
import { SPEED_LEVELS } from '../shared/speed';
import { t, type MessageKey } from './i18n';

export interface BottomBarProps {
  date: SimDate;
  mapMode: MapMode;
  onCycleMapMode: () => void;
  speedLevel: number;
  paused: boolean;
  onTogglePause: () => void;
  onSpeed: (level: number) => void;
}

/** Bottom bar (PLAN 1.8): date, pause and speed controls, AoC-style. */
export function BottomBar({ date, speedLevel, paused, onTogglePause, onSpeed, mapMode, onCycleMapMode }: BottomBarProps) {
  const isMax = SPEED_LEVELS[speedLevel] === 'max';
  return (
    <footer class="bottombar" data-testid="bottombar">
      <button type="button" class="bar-btn" data-testid="pause-btn" aria-pressed={paused} onClick={onTogglePause}>
        {paused ? t('bar.resume') : t('bar.pause')}
      </button>
      <button type="button" class="bar-btn" data-testid="speed-down" aria-label={t('bar.speedDown')} disabled={speedLevel === 0} onClick={() => onSpeed(speedLevel - 1)}>
        −
      </button>
      <span class="bar-speed" data-testid="speed-label" data-level={speedLevel}>
        {isMax ? t('bar.speedMax') : t('bar.speed', { n: speedLevel + 1 })}
      </span>
      <button
        type="button"
        class="bar-btn"
        data-testid="speed-up"
        aria-label={t('bar.speedUp')}
        disabled={speedLevel === SPEED_LEVELS.length - 1}
        onClick={() => onSpeed(speedLevel + 1)}
      >
        +
      </button>
      <button type="button" class="bar-btn" data-testid="mapmode-btn" data-mode={mapMode} onClick={onCycleMapMode}>
        {t('bar.mapMode', { mode: t(`mapMode.${mapMode}` as MessageKey) })}
      </button>
      <span class="bar-date" data-testid="date-label">
        {t('date.format', { day: date.day, month: t(`month.${date.month}` as MessageKey), year: date.year })}
        {paused ? <span class="bar-paused"> · {t('bar.paused')}</span> : null}
      </span>
    </footer>
  );
}
