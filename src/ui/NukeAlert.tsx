import { useEffect, useRef } from 'preact/hooks';
import type { TickerRow } from '../shared/history';
import { historyText } from './historyText';
import { t } from './i18n';

/**
 * The nuclear alert banner (PLAN 6.6a): the last strike, in the history's sentence, with a button
 * that takes the camera there and one that closes it. It stays until closed, another comes, or
 * its strike is three days of the game old (PLAN 7.25d, `alertExpired`). Its bottom, from the view's
 * top, is `--alert-bottom`: the panels of the centre stand below it, not under it (PLAN 7.25d: it
 * covered the headers of History and Charts, the critic's run 8).
 */
export function NukeAlert({ row, onGo, onClose }: { row: TickerRow; onGo: () => void; onClose: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const root = document.documentElement;
    const put = (): void => root.style.setProperty('--alert-bottom', `${Math.ceil(el.getBoundingClientRect().bottom)}px`);
    put();
    const ro = new ResizeObserver(put);
    ro.observe(el);
    window.addEventListener('resize', put);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', put);
      root.style.removeProperty('--alert-bottom');
    };
  }, []);
  return (
    <div class="nuke-alert" data-testid="nuke-alert" role="alert" ref={box}>
      <span class="nuke-icon" aria-hidden="true">
        {'☢'}
      </span>
      <span class="nuke-text" data-testid="nuke-alert-text">
        {historyText(row)}
      </span>
      <button type="button" class="god-btn" data-testid="nuke-goto" onClick={onGo}>
        {t('nuke.goTo')}
      </button>
      <button type="button" class="nuke-close" data-testid="nuke-close" aria-label={t('nuke.close')} onClick={onClose}>
        {'×'}
      </button>
    </div>
  );
}
