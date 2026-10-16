import type { NationStat } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';
import { RANK_METRICS, rankNations, rankValue, type RankMetric } from '../shared/ranking';

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const ROWS = 15;

/**
 * Right-hand Statistics ranking (PLAN 1.31b): metric dropdown, top 15, rows select nations.
 * As AoC's Statistics panel (PLAN 7.4c, ADR-442): each row has the nation's flag and a bar in its
 * colour under its name and value, as long as its value is of the first row's.
 */
export function StatsRanking({
  nations,
  metric,
  selected,
  onMetric,
  onSelect,
  onCharts,
  flagUrlOf,
}: {
  nations: NationStat[];
  metric: RankMetric;
  selected: number;
  onMetric: (m: RankMetric) => void;
  onSelect: (id: number) => void;
  /** Opens the charts (PLAN 1.34b). */
  onCharts?: () => void;
  /** A nation's flag as an image URL (PLAN 7.4c); none: its colour's swatch. */
  flagUrlOf?: (id: number) => string | null;
}) {
  const v = (n: NationStat): number => rankValue(n, metric);
  const rows = rankNations(nations, metric).slice(0, ROWS);
  const top = Math.max(0, ...rows.map(v));
  return (
    <aside class="stats-ranking" data-testid="stats-ranking" data-metric={metric}>
      <header class="ranking-head">
        <span>{t('stats.title')}</span>
        <select data-testid="rank-metric" aria-label={t('stats.metric')} value={metric} onChange={(e) => onMetric((e.currentTarget as HTMLSelectElement).value as RankMetric)}>
          {RANK_METRICS.map((m) => (
            <option key={m} value={m}>
              {t(`stats.${m}` as MessageKey)}
            </option>
          ))}
        </select>
        {onCharts ? (
          <button type="button" class="god-btn" data-testid="ranking-charts" onClick={onCharts}>
            {t('stats.charts')}
          </button>
        ) : null}
      </header>
      <ul class="ranking-list">
        {rows.map((n, i) => {
          const url = flagUrlOf?.(n.id) ?? null;
          const share = top > 0 ? Math.max(0, Math.min(1, v(n) / top)) : 0;
          return (
            <li key={n.id} class={n.id === selected ? 'rank-row selected' : 'rank-row'} data-testid="rank-row" data-nation={n.id} data-value={v(n)} onClick={() => onSelect(n.id)}>
              <span class="rank-pos">{i + 1}.</span>
              {url ? <img class="rank-flag" data-testid="rank-flag" src={url} alt="" width={21} height={14} /> : <span class="chip-swatch" style={{ background: hex(n.color) }} />}
              <span class="rank-bar" data-testid="rank-bar" data-share={share.toFixed(4)} style={{ background: `linear-gradient(to right, ${hex(n.color)}d9 ${(share * 100).toFixed(2)}%, rgba(255, 255, 255, 0.05) ${(share * 100).toFixed(2)}%)` }}>
                <span class="rank-name">{displayName(n.name)}</span>
                <span class="rank-value">{Math.round(v(n)).toLocaleString('en-US')}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
