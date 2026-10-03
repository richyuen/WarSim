import type { NationStat } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';
import { RANK_METRICS, rankNations, rankValue, type RankMetric } from '../shared/ranking';

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const ROWS = 15;

/** Right-hand Statistics ranking (PLAN 1.31b): metric dropdown, top 15, rows select nations. */
export function StatsRanking({
  nations,
  metric,
  selected,
  onMetric,
  onSelect,
  onCharts,
}: {
  nations: NationStat[];
  metric: RankMetric;
  selected: number;
  onMetric: (m: RankMetric) => void;
  onSelect: (id: number) => void;
  /** Opens the charts (PLAN 1.34b). */
  onCharts?: () => void;
}) {
  const v = (n: NationStat): number => rankValue(n, metric);
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
        {rankNations(nations, metric)
          .slice(0, ROWS)
          .map((n, i) => (
            <li key={n.id} class={n.id === selected ? 'rank-row selected' : 'rank-row'} data-testid="rank-row" data-nation={n.id} data-value={v(n)} onClick={() => onSelect(n.id)}>
              <span class="rank-pos">{i + 1}.</span>
              <span class="chip-swatch" style={{ background: hex(n.color) }} />
              <span class="rank-name">{displayName(n.name)}</span>
              <span class="rank-value">{Math.round(v(n)).toLocaleString('en-US')}</span>
            </li>
          ))}
      </ul>
    </aside>
  );
}
