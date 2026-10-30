import { t } from './i18n';

/**
 * Top bar: the title and tagline (PLAN 0.21). The language picker is gone (the user's request,
 * ADR-763): the release build offers English alone; a tester's pseudo-locale is the stored
 * `warsim.locale` (`src/ui/i18n`).
 */
export function TopBar() {
  return (
    <header class="topbar" data-testid="topbar">
      <span class="topbar-title" data-testid="app-title">
        {t('app.title')}
      </span>
      <span class="topbar-tagline">{t('app.tagline')}</span>
    </header>
  );
}
