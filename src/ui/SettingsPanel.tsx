import { useState } from 'preact/hooks';
import { t } from './i18n';

export interface SettingsPanelProps {
  uiScale: number;
  unitScale: number;
  uiScales: readonly number[];
  unitScales: readonly number[];
  seed: number;
  onUiScale: (v: number) => void;
  onUnitScale: (v: number) => void;
  onScreenshot: () => void;
  /** Starts a new game of this scenario with `seed`. */
  onNewGame: (seed: number) => void;
  onClose: () => void;
}

/**
 * Settings (PLAN 1.39a): UI size, unit size, screenshot (also F2), and the seed with a new game
 * (or a random seed). Speed and pause persist on their own (bottom bar).
 */
export function SettingsPanel({ uiScale, unitScale, uiScales, unitScales, seed, onUiScale, onUnitScale, onScreenshot, onNewGame, onClose }: SettingsPanelProps) {
  const [next, setNext] = useState(String(seed));
  const valid = /^\d{1,10}$/.test(next.trim()) && Number(next) <= 0xffffffff;
  const pct = (v: number): string => `${Math.round(v * 100)}%`;
  return (
    <aside class="history-panel settings-panel" data-testid="settings-panel">
      <header class="ranking-head">
        <span>{t('settings.title')}</span>
        <button type="button" class="panel-close" data-testid="settings-close" aria-label={t('panel.close')} onClick={onClose}>
          ×
        </button>
      </header>
      <label class="god-row">
        <span class="god-war-name">{t('settings.uiSize')}</span>
        <select data-testid="settings-ui-scale" value={uiScale} onChange={(e) => onUiScale(Number((e.currentTarget as HTMLSelectElement).value))}>
          {uiScales.map((v) => (
            <option key={v} value={v}>
              {pct(v)}
            </option>
          ))}
        </select>
      </label>
      <label class="god-row">
        <span class="god-war-name">{t('settings.unitSize')}</span>
        <select data-testid="settings-unit-scale" value={unitScale} onChange={(e) => onUnitScale(Number((e.currentTarget as HTMLSelectElement).value))}>
          {unitScales.map((v) => (
            <option key={v} value={v}>
              {pct(v)}
            </option>
          ))}
        </select>
      </label>
      <div class="god-row">
        <button type="button" class="god-btn" data-testid="settings-screenshot" onClick={onScreenshot}>
          {t('settings.screenshot')}
        </button>
      </div>
      <div class="panel-sub">{t('settings.seed')}</div>
      <div class="god-row">
        <span class="god-war-name" data-testid="settings-current-seed">
          {t('settings.currentSeed', { seed })}
        </span>
      </div>
      <div class="god-row">
        <input data-testid="settings-seed" inputMode="numeric" value={next} onInput={(e) => setNext((e.currentTarget as HTMLInputElement).value)} aria-label={t('settings.seed')} />
        <button type="button" class="god-btn" data-testid="settings-random-seed" onClick={() => setNext(String(Math.floor(Math.random() * 0xffffffff)))}>
          {t('settings.randomSeed')}
        </button>
        <button type="button" class="god-btn" data-testid="settings-new-game" disabled={!valid} onClick={() => onNewGame(Number(next) >>> 0)}>
          {t('settings.newGame')}
        </button>
      </div>
    </aside>
  );
}
