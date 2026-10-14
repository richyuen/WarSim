import type { TickerRow } from '../shared/history';
import { historyText } from './historyText';
import { t } from './i18n';

/**
 * The nuclear alert banner (PLAN 6.6a): the last strike, in the history's sentence, with a button
 * that takes the camera there and one that closes it. It stays until closed or another comes.
 */
export function NukeAlert({ row, onGo, onClose }: { row: TickerRow; onGo: () => void; onClose: () => void }) {
  return (
    <div class="nuke-alert" data-testid="nuke-alert" role="alert">
      <span class="nuke-icon" aria-hidden="true">
        {'\u2622'}
      </span>
      <span class="nuke-text" data-testid="nuke-alert-text">
        {historyText(row)}
      </span>
      <button type="button" class="god-btn" data-testid="nuke-goto" onClick={onGo}>
        {t('nuke.goTo')}
      </button>
      <button type="button" class="nuke-close" data-testid="nuke-close" aria-label={t('nuke.close')} onClick={onClose}>
        {'\u00d7'}
      </button>
    </div>
  );
}
