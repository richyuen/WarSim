// Must pass: all user-facing text comes from t(); class names, ids and symbols are fine.
import { t } from './i18n';

export function Good() {
  return (
    <div class="panel" id="p1" title={t('app.title')}>
      {t('app.tagline')}
      <span>{'·'}</span>
      <span>{42}</span>
    </div>
  );
}
