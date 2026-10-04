import { useState } from 'preact/hooks';
import { dateOfTick } from '../shared/calendar';
import type { GameOptions } from '../shared/gameOptions';
import type { ScenarioId } from '../shared/protocol';
import type { ScenarioInfo } from '../shared/scenarios';
import { t, type MessageKey } from './i18n';
import { NewGameForm, randomSeed } from './NewGameForm';
import { LocalePicker } from './TopBar';

export interface TitleScreenProps {
  /** The scenarios on offer, in list order (at least one). */
  scenarios: readonly { id: ScenarioId; info: ScenarioInfo }[];
  /** Starts a new game of scenario `id` with `seed` and the new-game options. */
  onStart: (id: ScenarioId, seed: number, options: GameOptions) => void;
}

/**
 * The title screen (PLAN 1.43): what `/` opens. The scenario list on the left, the chosen
 * scenario with its new-game form on the right. No world runs behind it.
 */
export function TitleScreen({ scenarios, onStart }: TitleScreenProps) {
  const [chosen, setChosen] = useState<ScenarioId>(scenarios[0]!.id);
  // A new seed per visit, so two games started without touching the field differ.
  const [seed] = useState(randomSeed);
  const startDate = (info: ScenarioInfo): string => {
    const d = dateOfTick(info.startDay, 0);
    return t('date.format', { day: d.day, month: t(`month.${d.month}` as MessageKey), year: d.year });
  };
  const info = scenarios.find((s) => s.id === chosen)!.info;
  return (
    <main class="title-screen" data-testid="title-screen">
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
        <section class="title-card title-list">
          <h2 class="title-sub">{t('title.scenarios')}</h2>
          <ul>
            {scenarios.map((s) => (
              <li key={s.id}>
                <button type="button" class={`title-scenario${s.id === chosen ? ' active' : ''}`} data-testid={`title-scenario-${s.id}`} aria-pressed={s.id === chosen} onClick={() => setChosen(s.id)}>
                  <span class="title-scenario-name">{t(s.info.nameKey as MessageKey)}</span>
                  <span class="title-scenario-date">{startDate(s.info)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        <section class="title-card title-detail" data-testid="title-detail">
          <h2 class="title-sub" data-testid="title-chosen">
            {t(info.nameKey as MessageKey)}
          </h2>
          <p class="title-desc">{t(info.descKey as MessageKey)}</p>
          <div class="form-row">
            <span class="form-name">{t('title.startDate')}</span>
            <span data-testid="title-start-date">{startDate(info)}</span>
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
