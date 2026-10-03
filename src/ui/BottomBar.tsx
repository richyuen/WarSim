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
  /** Statistics ranking toggle (PLAN 1.31b); omitted where no stats exist. */
  showStats?: boolean;
  onToggleStats?: (() => void) | undefined;
  /** God Mode toggle (PLAN 1.32b); omitted where no stats exist. */
  godMode?: boolean;
  onToggleGod?: (() => void) | undefined;
  /** History log toggle (PLAN 1.34a). */
  showHistory?: boolean;
  onToggleHistory?: (() => void) | undefined;
  /** The nation the player controls and its selected formations (PLAN 1.33a). */
  playing?: { name: string; selected: number } | null;
}

/** Bottom bar (PLAN 1.8): date, pause and speed controls, AoC-style. */
export function BottomBar({ date, speedLevel, paused, onTogglePause, onSpeed, mapMode, onCycleMapMode, showStats, onToggleStats, godMode, onToggleGod, playing, showHistory, onToggleHistory }: BottomBarProps) {
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
      {onToggleStats ? (
        <button type="button" class="bar-btn" data-testid="stats-btn" aria-pressed={showStats} onClick={onToggleStats}>
          {t('bar.statistics')}
        </button>
      ) : null}
      {onToggleHistory ? (
        <button type="button" class="bar-btn" data-testid="history-btn" aria-pressed={showHistory} onClick={onToggleHistory}>
          {t('bar.history')}
        </button>
      ) : null}
      {onToggleGod ? (
        <button type="button" class={godMode ? 'bar-btn bar-god active' : 'bar-btn bar-god'} data-testid="god-btn" aria-pressed={godMode} onClick={onToggleGod}>
          {t('bar.god')}
        </button>
      ) : null}
      {playing ? (
        <span class="bar-playing" data-testid="player-label">
          {t('player.playing', { name: playing.name, n: playing.selected })}
        </span>
      ) : null}
      <span class="bar-date" data-testid="date-label">
        {t('date.format', { day: date.day, month: t(`month.${date.month}` as MessageKey), year: date.year })}
        {paused ? <span class="bar-paused"> · {t('bar.paused')}</span> : null}
      </span>
    </footer>
  );
}
