import { LOCALES, locale, setLocale, t, type Locale, type MessageKey } from './i18n';

/** Top bar: title and language picker (PLAN 0.21). Grows into the AoC-style bottom bar later. */
export function TopBar() {
  return (
    <header class="topbar" data-testid="topbar">
      <span class="topbar-title" data-testid="app-title">
        {t('app.title')}
      </span>
      <span class="topbar-tagline">{t('app.tagline')}</span>
      <label class="topbar-locale">
        <span data-testid="locale-label">{t('settings.language')}</span>
        <select
          data-testid="locale-select"
          aria-label={t('settings.language')}
          value={locale.value}
          onChange={(e) => setLocale((e.currentTarget as HTMLSelectElement).value as Locale)}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {t(`locale.${l}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
    </header>
  );
}
