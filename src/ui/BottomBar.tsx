import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
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
  /**
   * What Escape would cancel (a selection, an armed order or placing, a God tool), as a button
   * first in the bar: a touch screen has no Escape (the user's request of 2026-10-29). Null: none.
   */
  onCancel?: (() => void) | null;
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

/** Every speed's label, a line each: the room the speed's label keeps (ADR-763). */
function speedLabels(): string {
  return SPEED_LEVELS.map((l, i) => (l === 'max' ? t('bar.speedMax') : t('bar.speed', { n: i + 1 }))).join('\n');
}

/**
 * Bottom bar (PLAN 1.8), in the user's order (ADR-763): Cancel when there is something to cancel,
 * Pause/Resume, speed, God Mode, map, Statistics, History, Editor, the date, Settings.
 */
export function BottomBar({ date, speedLevel, paused, onTogglePause, onSpeed, mapMode, onMapMode, showStats, onToggleStats, godMode, onToggleGod, playing, showHistory, onToggleHistory, showEditor, onToggleEditor, showSettings, onToggleSettings, godTools, onCancel }: BottomBarProps) {
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
      {onCancel ? (
        <button type="button" class="bar-btn bar-cancel" data-testid="cancel-btn" title={t('bar.cancelHint')} onClick={onCancel}>
          {t('bar.cancel')}
        </button>
      ) : null}
      <button type="button" class="bar-btn bar-reserve" data-testid="pause-btn" data-reserve={paused ? t('bar.pause') : t('bar.resume')} aria-pressed={paused} onClick={onTogglePause}>
        {paused ? t('bar.resume') : t('bar.pause')}
      </button>
      <button type="button" class="bar-btn" data-testid="speed-down" aria-label={t('bar.speedDown')} disabled={speedLevel === 0} onClick={() => onSpeed(speedLevel - 1)}>
        −
      </button>
      <span class="bar-speed bar-reserve" data-testid="speed-label" data-level={speedLevel} data-reserve={speedLabels()}>
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
      {onToggleGod ? (
        <button type="button" class={godMode ? 'bar-btn bar-god active' : 'bar-btn bar-god'} data-testid="god-btn" aria-pressed={godMode} onClick={onToggleGod}>
          {t('bar.god')}
        </button>
      ) : null}
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
      {onToggleEditor ? (
        <button type="button" class="bar-btn" data-testid="editor-btn" aria-pressed={showEditor} onClick={onToggleEditor}>
          {t('bar.editor')}
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
      {onToggleSettings ? (
        <button type="button" class="bar-btn" data-testid="settings-btn" aria-pressed={showSettings} onClick={onToggleSettings}>
          {t('bar.settings')}
        </button>
      ) : null}
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
 *
 * The list is drawn in the UI layer, not in the bar (PLAN 7.159, critic run 19's R19-B1): on a
 * phone the bar scrolls sideways, and a list inside it was cut off by it, no option in reach. It
 * stands above the button, kept inside the view; a scroll of the bar or a resize closes it.
 */
function MapModeMenu({ mode, onMode }: { mode: MapMode; onMode: (mode: MapMode) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent): void => {
      const at = e.target as Node;
      if (!root.current?.contains(at) && !menu.current?.contains(at)) setOpen(false);
    };
    // Escape closes the list first, before the game's Escape (the selection, the panels).
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    // The list stands where the button was: a scroll that moves the button (the bar's, on a
    // phone), or a resize, closes it. A panel's own scroll leaves it open.
    const moved = (e: Event): void => {
      const at = e.target;
      if (at instanceof Node && btn.current && at.contains(btn.current)) setOpen(false);
    };
    const resized = (): void => setOpen(false);
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    window.addEventListener('scroll', moved, true);
    window.addEventListener('resize', resized);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('scroll', moved, true);
      window.removeEventListener('resize', resized);
    };
  }, [open]);
  // Above the button, its left edge at the button's, moved left as far as the view's edge needs.
  useLayoutEffect(() => {
    const b = btn.current;
    const m = menu.current;
    if (!open || !b || !m) return;
    const r = b.getBoundingClientRect();
    const edge = 4;
    m.style.bottom = `${window.innerHeight - r.top + 8}px`;
    m.style.maxHeight = `${Math.max(0, r.top - 8 - edge)}px`;
    m.style.left = `${Math.max(edge, Math.min(r.left, window.innerWidth - m.offsetWidth - edge))}px`;
  }, [open]);
  const host = typeof document === 'undefined' ? null : (document.getElementById('ui') ?? document.body);
  return (
    <span class="mapmode-wrap" ref={root}>
      <button ref={btn} type="button" class="bar-btn" data-testid="mapmode-btn" data-mode={mode} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {t('bar.mapMode', { mode: t(`mapMode.${mode}` as MessageKey) })}
      </button>
      {open && host
        ? createPortal(
            <div class="mapmode-menu" role="menu" data-testid="mapmode-menu" ref={menu}>
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
            </div>,
            host,
          )
        : null}
    </span>
  );
}
