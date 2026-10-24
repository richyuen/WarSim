import { useEffect, useRef } from 'preact/hooks';
import type { TickerRow } from '../shared/history';
import type { ShownAlert } from '../shared/nukeAlert';
import { historyText } from './historyText';
import { t } from './i18n';

/**
 * The nuclear alert banners (PLAN 6.6a): one a strike (PLAN 7.109a: of two strikes a day apart only
 * the second had one), oldest on top, each in the history's sentence, with a button that takes the
 * camera there and one that closes it. Each stays until closed, or its strike is three days of the
 * game old (PLAN 7.25d, `alertExpired`). The stack's bottom, from the view's top, is
 * `--alert-bottom`: the panels of the centre stand below it, not under it (PLAN 7.25d: it covered
 * the headers of History and Charts, the critic's run 8).
 */
export function NukeAlerts({ alerts, onGo, onClose }: { alerts: readonly ShownAlert[]; onGo: (row: TickerRow) => void; onClose: (row: TickerRow) => void }) {
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
    <div class="nuke-alerts" data-testid="nuke-alerts" ref={box}>
      {alerts.map((a) => (
        <NukeAlert key={a.row.i} row={a.row} onGo={() => onGo(a.row)} onClose={() => onClose(a.row)} />
      ))}
    </div>
  );
}

function NukeAlert({ row, onGo, onClose }: { row: TickerRow; onGo: () => void; onClose: () => void }) {
  return (
    <div class="nuke-alert" data-testid="nuke-alert" role="alert">
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
