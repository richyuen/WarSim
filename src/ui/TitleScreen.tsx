import { useEffect, useState } from 'preact/hooks';
import { dateOfTick } from '../shared/calendar';
import type { GameOptions } from '../shared/gameOptions';
import type { ScenarioId } from '../shared/protocol';
import type { ScenarioInfo } from '../shared/scenarios';
import { t, type MessageKey } from './i18n';
import { NewGameForm, randomSeed } from './NewGameForm';
import { LocalePicker } from './TopBar';

/** What the title screen shows of a saved game. */
export interface SavedGame {
  /** Its scenario (which may be one that is not on the list). */
  info: ScenarioInfo;
  tick: number;
  /** Wall-clock time of the save (ms since the epoch). */
  savedAt: number;
}

export interface TitleScreenProps {
  /** The scenarios on offer, in list order (at least one). */
  scenarios: readonly { id: ScenarioId; info: ScenarioInfo }[];
  /** Starts a new game of scenario `id` with `seed` and the new-game options. */
  onStart: (id: ScenarioId, seed: number, options: GameOptions) => void;
  /** The saved game to offer as Continue, if there is one (PLAN 1.43b). */
  readSave: () => Promise<SavedGame | null>;
  onContinue: () => void;
  /** Starts the game of a scenario file; rejects with a readable error when the file does not fit. */
  onScenarioFile: (file: File) => Promise<void>;
  /** A scenario file could not be loaded after this screen was left for its game. */
  loadFailed: boolean;
}

/**
 * The title screen (PLAN 1.43): what `/` opens. On the left the saved game, the scenario list and
 * the scenario file loader; on the right the chosen scenario with its new-game form. No world runs
 * behind it.
 */
export function TitleScreen({ scenarios, onStart, readSave, onContinue, onScenarioFile, loadFailed }: TitleScreenProps) {
  const [chosen, setChosen] = useState<ScenarioId>(scenarios[0]!.id);
  // A new seed per visit, so two games started without touching the field differ.
  const [seed] = useState(randomSeed);
  // undefined while the store is being read.
  const [save, setSave] = useState<SavedGame | null | undefined>(undefined);
  // The error of the last file chosen here, or of the one a game could not load (`loadFailed`).
  const [fileError, setFileError] = useState<string | null>(null);
  const [failed, setFailed] = useState(loadFailed);
  useEffect(() => {
    void readSave()
      .then(setSave)
      .catch(() => setSave(null));
  }, []);
  const dateAt = (startDay: number, tick: number): string => {
    const d = dateOfTick(startDay, tick);
    return t('date.format', { day: d.day, month: t(`month.${d.month}` as MessageKey), year: d.year });
  };
  const info = scenarios.find((s) => s.id === chosen)!.info;
  return (
    <main class="title-screen" data-testid="title-screen" data-save={save === undefined ? 'reading' : save ? 'found' : 'none'}>
      <header class="title-head">
        <div>
          <h1 class="title-name" data-testid="app-title">
            {t('app.title')}
          </h1>
          <p class="title-tagline">{t('app.tagline')}</p>
        </div>
        <LocalePicker />
      </header>
      <div class="title-body">
        <div class="title-column">
          {save ? (
            <section class="title-card" data-testid="title-save">
              <h2 class="title-sub">{t('title.savedGame')}</h2>
              <div class="title-scenario-name">{t(save.info.nameKey as MessageKey)}</div>
              <div data-testid="title-save-date">{dateAt(save.info.startDay, save.tick)}</div>
              <div class="title-scenario-date">{t('title.savedAt', { time: new Date(save.savedAt).toLocaleString() })}</div>
              <button type="button" class="start-btn" data-testid="title-continue" onClick={onContinue}>
                {t('title.continue')}
              </button>
            </section>
          ) : null}
          <section class="title-card title-list">
            <h2 class="title-sub">{t('title.scenarios')}</h2>
            <ul>
              {scenarios.map((s) => (
                <li key={s.id}>
                  <button type="button" class={`title-scenario${s.id === chosen ? ' active' : ''}`} data-testid={`title-scenario-${s.id}`} aria-pressed={s.id === chosen} onClick={() => setChosen(s.id)}>
                    <span class="title-scenario-name">{t(s.info.nameKey as MessageKey)}</span>
                    <span class="title-scenario-date">{dateAt(s.info.startDay, 0)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section class="title-card">
            <h2 class="title-sub">{t('scenario.file')}</h2>
            <p class="title-desc">{t('title.fileHint')}</p>
            <input
              class="title-file"
              data-testid="title-scenario-file"
              type="file"
              accept=".warsim-scenario"
              aria-label={t('scenario.import')}
              onChange={(e) => {
                const input = e.currentTarget as HTMLInputElement;
                const file = input.files?.[0];
                input.value = '';
                if (!file) return;
                setFileError(null);
                setFailed(false);
                void onScenarioFile(file).catch((err: unknown) => setFileError(t('scenario.failed', { error: err instanceof Error ? err.message : String(err) })));
              }}
            />
            {fileError !== null || failed ? (
              <div class="panel-warn" data-testid="title-file-error">
                {fileError ?? t('title.loadFailed')}
              </div>
            ) : null}
          </section>
        </div>
        <section class="title-card title-detail" data-testid="title-detail">
          <h2 class="title-sub" data-testid="title-chosen">
            {t(info.nameKey as MessageKey)}
          </h2>
          <p class="title-desc">{t(info.descKey as MessageKey)}</p>
          <div class="form-row">
            <span class="form-name">{t('title.startDate')}</span>
            <span data-testid="title-start-date">{dateAt(info.startDay, 0)}</span>
          </div>
          <div class="form-row">
            <span class="form-name">{t('title.map')}</span>
            <span>{t(info.mapNameKey as MessageKey)}</span>
          </div>
          <NewGameForm key={chosen} seed={seed} options={{}} startLabel={t('title.start')} onStart={(s, o) => onStart(chosen, s, o)} />
        </section>
      </div>
    </main>
  );
}
