import { t } from './i18n';
import { NewGameForm } from './NewGameForm';
import type { GameOptions } from '../shared/gameOptions';

export interface SettingsPanelProps {
  uiScale: number;
  unitScale: number;
  uiScales: readonly number[];
  /** The sizes the view is wide enough for (PLAN 3.12Rh4); `uiScale` is the one in use. */
  uiOffered: readonly number[];
  unitScales: readonly number[];
  volume: number;
  volumes: readonly number[];
  muted: boolean;
  seed: number;
  /** This game's options (the new-game form starts from them). */
  options: GameOptions;
  /** This scenario lets the player say how many nations a new game has (the random world). */
  nationsRange?: { min: number; max: number; default: number } | undefined;
  onUiScale: (v: number) => void;
  onUnitScale: (v: number) => void;
  onVolume: (v: number) => void;
  onMuted: (v: boolean) => void;
  onScreenshot: () => void;
  /** Starts a new game of this scenario with `seed` and new-game options (PLAN 1.39b1). */
  onNewGame: (seed: number, options: GameOptions) => void;
  /** Saves the game and leaves for the title screen (PLAN 1.43). */
  onMenu: () => void;
  onClose: () => void;
}

/**
 * Settings (PLAN 1.39a): UI size, unit size, the sound's volume and mute (PLAN 3.12d),
 * screenshot (also F2), the way back to the title screen, and the seed with a new game (or a
 * random seed). Speed and pause persist on their own
 * (bottom bar).
 */
export function SettingsPanel({ uiScale, unitScale, uiScales, uiOffered, unitScales, volume, volumes, muted, seed, options, nationsRange, onUiScale, onUnitScale, onVolume, onMuted, onScreenshot, onNewGame, onMenu, onClose }: SettingsPanelProps) {
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  return (
    <aside class="history-panel settings-panel" data-testid="settings-panel">
      <header class="ranking-head">
        <span>{t('settings.title')}</span>
        <button type="button" class="panel-close" data-testid="settings-close" aria-label={t('panel.close')} onClick={onClose}>
          ×
        </button>
      </header>
      <label class="form-row">
        <span class="form-name">{t('settings.uiSize')}</span>
        <select data-testid="settings-ui-scale" value={uiScale} onChange={(e) => onUiScale(Number((e.currentTarget as HTMLSelectElement).value))}>
          {uiScales.map((v) => (
            <option key={v} value={v} disabled={!uiOffered.includes(v)}>
              {pct(v)}
            </option>
          ))}
        </select>
      </label>
      <label class="form-row">
        <span class="form-name">{t('settings.unitSize')}</span>
        <select data-testid="settings-unit-scale" value={unitScale} onChange={(e) => onUnitScale(Number((e.currentTarget as HTMLSelectElement).value))}>
          {unitScales.map((v) => (
            <option key={v} value={v}>
              {pct(v)}
            </option>
          ))}
        </select>
      </label>
      <label class="form-row">
        <span class="form-name">{t('settings.volume')}</span>
        <select data-testid="settings-volume" value={volume} disabled={muted} onChange={(e) => onVolume(Number((e.currentTarget as HTMLSelectElement).value))}>
          {volumes.map((v) => (
            <option key={v} value={v}>
              {pct(v)}
            </option>
          ))}
        </select>
      </label>
      <label class="form-row">
        <span class="form-name">{t('settings.mute')}</span>
        <input type="checkbox" data-testid="settings-mute" checked={muted} onChange={(e) => onMuted((e.currentTarget as HTMLInputElement).checked)} />
      </label>
      <div class="form-row">
        <button type="button" class="god-btn" data-testid="settings-screenshot" onClick={onScreenshot}>
          {t('settings.screenshot')}
        </button>
        <button type="button" class="god-btn" data-testid="settings-menu" onClick={onMenu}>
          {t('settings.menu')}
        </button>
      </div>
      <div class="panel-sub">{t('settings.newGame')}</div>
      <div class="form-row">
        <span class="form-name" data-testid="settings-current-seed">
          {t('settings.currentSeed', { seed })}
        </span>
      </div>
      <NewGameForm seed={seed} options={options} nationsRange={nationsRange} startLabel={t('settings.newGame')} onStart={onNewGame} />
    </aside>
  );
}
