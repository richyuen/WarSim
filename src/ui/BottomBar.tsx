import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { SimDate } from '../shared/calendar';
import { MAP_MODES, type MapMode } from '../shared/mapModes';
import { SPEED_LEVELS } from '../shared/speed';
import { t, type MessageKey } from './i18n';

export interface BottomBarProps {
  date: SimDate;
  mapMode: MapMode;
  /** A map mode picked from the map button's menu. */
  onMapMode: (mode: MapMode) => void;
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
  /** God Mode's map tools, a row of the bar's own while God Mode is on (PLAN 7.16b). */
  godTools?: ComponentChildren;
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
export function BottomBar({ date, speedLevel, paused, onTogglePause, onSpeed, mapMode, onMapMode, showStats, onToggleStats, godMode, onToggleGod, playing, showHistory, onToggleHistory, showEditor, onToggleEditor, showSettings, onToggleSettings, godTools }: BottomBarProps) {
  const isMax = SPEED_LEVELS[speedLevel] === 'max';
  // How far the bar's top is from the view's bottom, for what stands above it (PLAN 7.4f25): a
  // played nation's label that does not fit goes onto a second line.
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const root = document.documentElement;
    const put = (): void => root.style.setProperty('--bar-top', `${Math.ceil(window.innerHeight - el.getBoundingClientRect().top)}px`);
    put();
    const ro = new ResizeObserver(put);
    ro.observe(el);
    window.addEventListener('resize', put);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', put);
      root.style.removeProperty('--bar-top');
    };
  }, []);
  return (
    <footer class={godTools ? 'bottombar with-god' : 'bottombar'} data-testid="bottombar" ref={bar}>
      {godTools}
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
      <MapModeMenu mode={mapMode} onMode={onMapMode} />
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
        <span class="bar-playing" data-testid="player-label" title={t('player.playing', { name: playing.name, n: playing.selected })}>
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

/** The key of each map mode, by its place in MAP_MODES (`game.tsx`'s MODE_KEYS: 1 to 9, then 0). */
const modeKey = (i: number): string | null => (i < 10 ? String((i + 1) % 10) : null);

/**
 * The map button and its menu (the user's request of 2026-10-29, in place of a button that went
 * to the next mode): the button opens a list of every map mode above it, the current one ticked,
 * each with its number key; a pick switches to it and closes the list, as do Escape, the button
 * again and a press anywhere else.
 */
function MapModeMenu({ mode, onMode }: { mode: MapMode; onMode: (mode: MapMode) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent): void => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes the list first, before the game's Escape (the selection, the panels).
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  return (
    <span class="mapmode-wrap" ref={root}>
      <button type="button" class="bar-btn" data-testid="mapmode-btn" data-mode={mode} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('bar.mapMode', { mode: t(`mapMode.${mode}` as MessageKey) })}
      </button>
      {open ? (
        <div class="mapmode-menu" role="menu" data-testid="mapmode-menu">
          {MAP_MODES.map((m, i) => (
            <button
              type="button"
              key={m}
              role="menuitemradio"
              aria-checked={m === mode}
              class={m === mode ? 'mapmode-opt current' : 'mapmode-opt'}
              data-testid={`mapmode-opt-${m}`}
              onClick={() => {
                onMode(m);
                setOpen(false);
              }}
            >
              <span class="mapmode-tick">{m === mode ? '✓' : ''}</span>
              <span class="mapmode-name">{t(`mapMode.${m}` as MessageKey)}</span>
              {modeKey(i) !== null ? <kbd class="mapmode-key">{modeKey(i)}</kbd> : <span />}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
