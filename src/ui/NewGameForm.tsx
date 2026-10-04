import { useState } from 'preact/hooks';
import { t, type MessageKey } from './i18n';
import type { GameOptions } from '../shared/gameOptions';

export interface NewGameFormProps {
  /** The seed the field starts with. */
  seed: number;
  /** The options the form starts from. */
  options: GameOptions;
  /** Label of the start button. */
  startLabel: string;
  onStart: (seed: number, options: GameOptions) => void;
}

/** A seed for a game nobody chose one for (app side only: it reaches the sim as the chosen seed). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

/** `opts` with the CE mode `v` ('scenario' removes the override). */
function withCe(opts: GameOptions, v: string): GameOptions {
  const { ceMode: _old, ...rest } = opts;
  return v === 'scenario' ? rest : { ...rest, ceMode: v as NonNullable<GameOptions['ceMode']> };
}

/**
 * The seed (or a random one) and the new-game options of PLAN 1.39b1, with the button that starts
 * the game. Shared by the title screen (PLAN 1.43) and the settings panel.
 */
export function NewGameForm({ seed, options, startLabel, onStart }: NewGameFormProps) {
  const [next, setNext] = useState(String(seed));
  const [opts, setOpts] = useState<GameOptions>(options);
  const sel = (testid: string, value: string, values: readonly string[], key: (v: string) => MessageKey, set: (v: string) => void) => (
    <select data-testid={testid} value={value} onChange={(e) => set((e.currentTarget as HTMLSelectElement).value)}>
      {values.map((v) => (
        <option key={v} value={v}>
          {t(key(v))}
        </option>
      ))}
    </select>
  );
  const valid = /^\d{1,10}$/.test(next.trim()) && Number(next) <= 0xffffffff;
  return (
    <div class="new-game">
      <label class="form-row">
        <span class="form-name">{t('settings.seed')}</span>
        <input data-testid="settings-seed" inputMode="numeric" value={next} onInput={(e) => setNext((e.currentTarget as HTMLInputElement).value)} />
        <button type="button" class="god-btn" data-testid="settings-random-seed" onClick={() => setNext(String(randomSeed()))}>
          {t('settings.randomSeed')}
        </button>
      </label>
      <div class="panel-sub">{t('settings.options')}</div>
      <label class="form-row">
        <span class="form-name">{t('settings.looping')}</span>
        {sel('opt-looping', opts.loopingMap === false ? 'off' : 'on', ['on', 'off'], (v) => `settings.onOff.${v}` as MessageKey, (v) => setOpts({ ...opts, loopingMap: v === 'on' }))}
      </label>
      <label class="form-row">
        <span class="form-name">{t('settings.aggression')}</span>
        {sel('opt-aggression', opts.aggression ?? 'scenario', ['scenario', 'random'], (v) => `settings.choice.${v}` as MessageKey, (v) => setOpts({ ...opts, aggression: v as 'scenario' | 'random' }))}
      </label>
      <label class="form-row">
        <span class="form-name">{t('settings.traits')}</span>
        {sel('opt-traits', opts.traits ?? 'scenario', ['scenario', 'random'], (v) => `settings.choice.${v}` as MessageKey, (v) => setOpts({ ...opts, traits: v as 'scenario' | 'random' }))}
      </label>
      <label class="form-row">
        <span class="form-name">{t('settings.gold')}</span>
        {sel('opt-gold', opts.gold ?? 'scenario', ['scenario', 'random', 'equal'], (v) => `settings.choice.${v}` as MessageKey, (v) => setOpts({ ...opts, gold: v as 'scenario' | 'random' | 'equal' }))}
      </label>
      <label class="form-row">
        <span class="form-name">{t('settings.ce')}</span>
        {sel('opt-ce', opts.ceMode ?? 'scenario', ['scenario', 'dynamic', 'progressive', 'static', 'locked', 'random'], (v) => `settings.ce.${v}` as MessageKey, (v) => setOpts(withCe(opts, v)))}
      </label>
      <button type="button" class="start-btn" data-testid="settings-new-game" disabled={!valid} onClick={() => onStart(Number(next) >>> 0, opts)}>
        {startLabel}
      </button>
    </div>
  );
}
