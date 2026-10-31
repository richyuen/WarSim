import { dateOfTick } from '../shared/calendar';
import { kindName, type TickerRow } from '../shared/history';
import { t, type MessageKey } from './i18n';
import { historyText } from './historyText';
import { mergeSeaRows } from './seaRows';

const TICKER_SHORT = 2;

/**
 * The ticker (PLAN 3.12c): the major events (war, peace, a capital taken, a nation's death or
 * return) as they happen, bottom left above the bar, the newest last. The rows are the
 * worker's, read from the history log: the view's event queue drops records at Max speed. A
 * click on a row flies the camera to its place. A live region: a screen reader is told a new row.
 * `short` (a panel stands above it on the left): the last TICKER_SHORT rows only, each of two
 * lines at most (PLAN 3.12Rh): the panel leaves the room of two rows of two lines, and a long
 * name would put a third over the panel's foot.
 * Below the events, what became of the player's orders of formations (PLAN 4.9c): a click flies
 * to the formation and forgets the row.
 * `compact` (a phone's width; the user's choice of 2026-10-29, ADR-760): two rows in all, each of
 * two lines at most: the newest event, and the player's last order's news, else the first sea
 * battle, else the event before it.
 */
export function Ticker({
  rows,
  short,
  compact = false,
  startDay,
  onPlace,
  orders = [],
  onOrder = () => {},
  seas = [],
  onSea = () => {},
}: {
  rows: TickerRow[];
  short: boolean;
  /** A phone's width: two rows in all. */
  compact?: boolean;
  startDay: number;
  onPlace: (x: number, y: number) => void;
  /** What became of the player's orders (PLAN 4.9c), after the events: beside a panel the last only. */
  orders?: { seq: number; kind: string; text: string }[];
  onOrder?: (seq: number) => void;
  /** The sea battles going on (PLAN 4.10b), before the orders: beside a panel the first only. */
  /** `kind`: two fleets within reach (`pair`), a carrier's strike in a battle, one out of a battle (`raid`, PLAN 7.154a), or its fleets closing (PLAN 7.41a); its tooltip says what the click shows. */
  seas?: { key: string; text: string; kind?: 'pair' | 'strike' | 'raid' | 'closing' }[];
  onSea?: (key: string) => void;
}) {
  // What is shown: all; beside a panel the last events, a sea battle and an order; on a phone two rows.
  // Sea rows of the same words are one, with how many (PLAN 7.167).
  const merged = mergeSeaRows(seas);
  const lastOrder = orders.slice(-1);
  const phoneSea = lastOrder.length === 0 ? merged.slice(0, 1) : [];
  const [evs, ss, os] = compact
    ? [rows.slice(lastOrder.length + phoneSea.length > 0 ? -1 : -TICKER_SHORT), phoneSea, lastOrder]
    : short
      ? [rows.slice(-TICKER_SHORT), merged.slice(0, 1), lastOrder]
      : [rows, merged, orders];
  return (
    <div class={compact ? 'ticker short compact' : short ? 'ticker short' : 'ticker'} data-testid="ticker" role="log" aria-live="polite" aria-label={t('ticker.title')}>
      <ol>
        {evs.map((r) => {
          const d = dateOfTick(startDay, r.tick);
          return (
            <li key={r.i}>
              <button type="button" class="ticker-row" data-testid="ticker-row" data-kind={r.kind} data-kind-name={kindName(r.kind)} title={t('ticker.toPlace')} onClick={() => onPlace(r.x, r.y)}>
                <span class="ticker-line">
                  <span class="ticker-date">{t('date.format', { day: d.day, month: t(`month.${d.month}` as MessageKey), year: d.year })}</span> {historyText(r)}
                </span>
              </button>
            </li>
          );
        })}
        {ss.map((b) => (
          <li key={`sea-${b.key}`}>
            <button type="button" class="ticker-row sea-battle" data-testid={b.kind === 'raid' ? 'carrier-raid-row' : 'sea-battle-row'} data-sea={b.kind} title={t(b.kind === 'strike' ? 'ticker.toCarrierStrike' : b.kind === 'raid' ? 'ticker.toCarrierRaid' : b.kind === 'closing' ? 'ticker.toSeaClosing' : 'ticker.toSeaBattle')} onClick={() => onSea(b.key)}>
              <span class="ticker-line">
                {'⚓'} {b.text}
                {b.count > 1 ? <span class="ticker-count"> {t('ticker.times', { n: b.count })}</span> : null}
              </span>
            </button>
          </li>
        ))}
        {os.map((o) => (
          <li key={`order-${o.seq}`}>
            <button type="button" class="ticker-row order-news" data-testid="order-news" data-order={o.kind} title={t('order.toFormation')} onClick={() => onOrder(o.seq)}>
              <span class="ticker-line">{o.text}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
