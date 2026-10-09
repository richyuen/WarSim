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
  /** Settings toggle (PLAN 1.39a). */
  showSettings?: boolean;
  onToggleSettings?: (() => void) | undefined;
  /** Map editor toggle (PLAN 1.35). */
  showEditor?: boolean;
  onToggleEditor?: (() => void) | undefined;
  /** History log toggle (PLAN 1.34a). */
  showHistory?: boolean;
  onToggleHistory?: (() => void) | undefined;
  /** The nation the player controls and its selected formations (PLAN 1.33a). */
  playing?: { name: string; selected: number } | null;
}

/**
 * Every month's longest date of a year with "Paused", a line each: the room the date keeps, so
 * that the bar is as wide in any month, paused or not (PLAN 3.12Rh1).
 */
function widestDates(year: number): string {
  const lines: string[] = [];
  for (let month = 1; month <= 12; month++) lines.push(`${t('date.format', { day: 28, month: t(`month.${month}` as MessageKey), year })} · ${t('bar.paused')}`);
  return lines.join('\n');
}

/** Bottom bar (PLAN 1.8): date, pause and speed controls, AoC-style. */
export function BottomBar({ date, speedLevel, paused, onTogglePause, onSpeed, mapMode, onCycleMapMode, showStats, onToggleStats, godMode, onToggleGod, playing, showHistory, onToggleHistory, showEditor, onToggleEditor, showSettings, onToggleSettings }: BottomBarProps) {
  const isMax = SPEED_LEVELS[speedLevel] === 'max';
  return (
    <footer class="bottombar" data-testid="bottombar">
      <button type="button" class="bar-btn bar-reserve" data-testid="pause-btn" data-reserve={paused ? t('bar.pause') : t('bar.resume')} aria-pressed={paused} onClick={onTogglePause}>
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
      {onToggleSettings ? (
        <button type="button" class="bar-btn" data-testid="settings-btn" aria-pressed={showSettings} onClick={onToggleSettings}>
          {t('bar.settings')}
        </button>
      ) : null}
      {onToggleEditor ? (
        <button type="button" class="bar-btn" data-testid="editor-btn" aria-pressed={showEditor} onClick={onToggleEditor}>
          {t('bar.editor')}
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
      <span class="bar-date bar-reserve" data-testid="date-label" data-reserve={widestDates(date.year)}>
        {t('date.format', { day: date.day, month: t(`month.${date.month}` as MessageKey), year: date.year })}
        {paused ? <span class="bar-paused"> · {t('bar.paused')}</span> : null}
      </span>
    </footer>
  );
}
