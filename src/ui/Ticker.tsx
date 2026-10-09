import { dateOfTick } from '../shared/calendar';
import { kindName, type TickerRow } from '../shared/history';
import { t, type MessageKey } from './i18n';
import { historyText } from './historyText';

const TICKER_SHORT = 2;

/**
 * The ticker (PLAN 3.12c): the major events (war, peace, a capital taken, a nation's death or
 * return) as they happen, bottom left above the bar, the newest last. The rows are the
 * worker's, read from the history log: the view's event queue drops records at Max speed. A
 * click on a row flies the camera to its place. A live region: a screen reader is told a new row.
 * `short` (a panel stands above it on the left): the last TICKER_SHORT rows only.
 */
export function Ticker({ rows, short, startDay, onPlace }: { rows: TickerRow[]; short: boolean; startDay: number; onPlace: (x: number, y: number) => void }) {
  return (
    <div class="ticker" data-testid="ticker" role="log" aria-live="polite" aria-label={t('ticker.title')}>
      <ol>
        {(short ? rows.slice(-TICKER_SHORT) : rows).map((r) => {
          const d = dateOfTick(startDay, r.tick);
          return (
            <li key={r.i}>
              <button type="button" class="ticker-row" data-testid="ticker-row" data-kind={r.kind} data-kind-name={kindName(r.kind)} title={t('ticker.toPlace')} onClick={() => onPlace(r.x, r.y)}>
                <span class="ticker-date">{t('date.format', { day: d.day, month: t(`month.${d.month}` as MessageKey), year: d.year })}</span> {historyText(r)}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
