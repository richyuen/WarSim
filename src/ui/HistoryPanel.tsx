import { useEffect, useState } from 'preact/hooks';
import { dateOfTick } from '../shared/calendar';
import { filterHistory, HISTORY_ROLES, kindName, NO_FILTER, toCsv, toExport, type HistoryFilter, type HistoryRow } from '../shared/history';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

const SHOWN = 400;

export interface HistoryPanelProps {
  /** Fetches the log from the worker. */
  load: () => Promise<HistoryRow[]>;
  /** Changes when the sim advanced (refetch while open). */
  refreshKey: number;
  startDay: number;
  /** Nations for the nation filter (living and dead). */
  nations: { id: number; name: string }[];
  onClose: () => void;
}

/** The rendered sentence of a row (i18n `history.<Kind>` with {a} and {b}). */
export function historyText(r: HistoryRow): string {
  const [ra, rb] = HISTORY_ROLES[r.kind] ?? ['number', 'number'];
  const part = (role: string, v: number, name: string): string => (role === 'battle' ? `#${v}` : role === 'number' ? String(v) : name ? displayName(name) : t('history.nobody'));
  return t(`history.${kindName(r.kind)}` as MessageKey, { a: part(ra, r.a, r.an), b: part(rb, r.b, r.bn) });
}

function download(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * History log (PLAN 1.34a): every historic event, newest first, filterable by type, nation and
 * years; the filtered rows export to CSV or JSON. Refetched from the worker while open.
 */
export function HistoryPanel({ load, refreshKey, startDay, nations, onClose }: HistoryPanelProps) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [f, setF] = useState<HistoryFilter>(NO_FILTER);
  useEffect(() => {
    let live = true;
    void load().then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  const kinds = [...new Set(rows.map((r) => r.kind))].sort((a, b) => a - b);
  const shown = filterHistory(rows, f, startDay);
  const exported = () => toExport(shown, startDay, displayName, historyText);
  const num = (v: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  const sorted = [...nations].sort((a, b) => displayName(a.name).localeCompare(displayName(b.name)));
  return (
    <aside class="history-panel" data-testid="history-panel">
      <header class="ranking-head">
        <span>{t('history.title')}</span>
        <button type="button" class="panel-close" data-testid="history-close" aria-label={t('panel.close')} onClick={onClose}>
          ×
        </button>
      </header>
      <div class="god-row history-filters">
        <select data-testid="history-kind" value={f.kind ?? ''} onChange={(e) => setF({ ...f, kind: num((e.currentTarget as HTMLSelectElement).value) })}>
          <option value="">{t('history.allTypes')}</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {t(`history.type.${kindName(k)}` as MessageKey)}
            </option>
          ))}
        </select>
        <select data-testid="history-nation" value={f.nation ?? ''} onChange={(e) => setF({ ...f, nation: num((e.currentTarget as HTMLSelectElement).value) })}>
          <option value="">{t('history.allNations')}</option>
          {sorted.map((n) => (
            <option key={n.id} value={n.id}>
              {displayName(n.name)}
            </option>
          ))}
        </select>
        <input data-testid="history-from" type="number" placeholder={t('history.from')} value={f.fromYear ?? ''} onInput={(e) => setF({ ...f, fromYear: num((e.currentTarget as HTMLInputElement).value) })} />
        <input data-testid="history-to" type="number" placeholder={t('history.to')} value={f.toYear ?? ''} onInput={(e) => setF({ ...f, toYear: num((e.currentTarget as HTMLInputElement).value) })} />
      </div>
      <div class="god-row">
        <span class="god-war-name" data-testid="history-count">
          {t('history.count', { n: shown.length, total: rows.length })}
        </span>
        <button type="button" class="god-btn" data-testid="history-csv" onClick={() => download('warsim-history.csv', 'text/csv', toCsv(exported()))}>
          {t('history.exportCsv')}
        </button>
        <button type="button" class="god-btn" data-testid="history-json" onClick={() => download('warsim-history.json', 'application/json', JSON.stringify(exported(), null, 2))}>
          {t('history.exportJson')}
        </button>
      </div>
      <ol class="history-list">
        {shown
          .slice(-SHOWN)
          .reverse()
          .map((r, i) => {
            const d = dateOfTick(startDay, r.tick);
            return (
              <li key={`${r.tick}:${i}`} data-testid="history-row" data-kind={r.kind}>
                <span class="history-date">{t('date.format', { day: d.day, month: t(`month.${d.month}` as MessageKey), year: d.year })}</span> {historyText(r)}
              </li>
            );
          })}
      </ol>
    </aside>
  );
}
