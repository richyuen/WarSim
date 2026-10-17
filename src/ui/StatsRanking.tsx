import type { NationLife, NationStat } from '../shared/protocol';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';
import { isLifeMetric, LIFE_METRICS, lifeValue, RANK_METRICS, rankLives, rankNations, rankValue, type RankList } from '../shared/ranking';

/** A row of the list: a nation of the present's lists, or a life, living or dead (PLAN 7.4f28). */
interface Row {
  id: number;
  name: string;
  color: number;
  value: number;
  living: boolean;
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const ROWS = 15;

/**
 * Right-hand Statistics ranking (PLAN 1.31b): metric dropdown, top 15, rows select nations.
 * As AoC's Statistics panel (PLAN 7.4c, ADR-442): each row has the nation's flag and a bar in its
 * colour under its name and value, as long as its value is of the first row's. The lists of a life
 * (PLAN 7.4f28) have the dead in them, marked with a dagger and dimmed, as AoC's lists mark them.
 */
export function StatsRanking({
  nations,
  lives = [],
  dead = [],
  metric,
  selected,
  onMetric,
  onSelect,
  onCharts,
  flagUrlOf,
}: {
  nations: NationStat[];
  /** Every nation's life (PLAN 7.4f28), and the dead's names and colours. */
  lives?: NationLife[];
  dead?: { id: number; name: string; color: number }[];
  metric: RankList;
  selected: number;
  onMetric: (m: RankList) => void;
  onSelect: (id: number) => void;
  /** Opens the charts (PLAN 1.34b). */
  onCharts?: () => void;
  /** A nation's flag as an image URL (PLAN 7.4c); none: its colour's swatch. */
  flagUrlOf?: (id: number) => string | null;
}) {
  let rows: Row[];
  if (isLifeMetric(metric)) {
    const who = new Map<number, { name: string; color: number }>();
    for (const n of nations) who.set(n.id, n);
    for (const d of dead) who.set(d.id, d);
    rows = rankLives(lives.filter((l) => who.has(l.id)), metric)
      .slice(0, ROWS)
      .map((l) => ({ id: l.id, name: who.get(l.id)!.name, color: who.get(l.id)!.color, value: lifeValue(l, metric), living: l.living }));
  } else rows = rankNations(nations, metric).slice(0, ROWS).map((n) => ({ id: n.id, name: n.name, color: n.color, value: rankValue(n, metric), living: true }));
  const v = (r: Row): number => r.value;
  // Years alive to a tenth; the rest whole.
  const shown = (x: number): string => (metric === 'age' ? x.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : Math.round(x).toLocaleString('en-US'));
  const top = Math.max(0, ...rows.map(v));
  return (
    <aside class="stats-ranking" data-testid="stats-ranking" data-metric={metric}>
      <header class="ranking-head">
        <span>{t('stats.title')}</span>
        <select data-testid="rank-metric" aria-label={t('stats.metric')} value={metric} onChange={(e) => onMetric((e.currentTarget as HTMLSelectElement).value as RankList)}>
          {/* The present's lists, then a life's (PLAN 7.4f28), each under its heading. */}
          {[RANK_METRICS, LIFE_METRICS].map((group, g) => (
            <optgroup key={g} label={t(g === 0 ? 'stats.now' : 'stats.lifetime')}>
              {group.map((m) => (
                <option key={m} value={m}>
                  {t(`stats.${m}` as MessageKey)}
                </option>
              ))}
            </optgroup>
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
          const url = n.living ? (flagUrlOf?.(n.id) ?? null) : null;
          const share = top > 0 ? Math.max(0, Math.min(1, v(n) / top)) : 0;
          return (
            <li key={n.id} class={`rank-row${n.id === selected ? ' selected' : ''}${n.living ? '' : ' rank-dead'}`} data-testid="rank-row" data-nation={n.id} data-value={v(n)} data-dead={n.living ? undefined : '1'} onClick={() => (n.living ? onSelect(n.id) : undefined)}>
              <span class="rank-pos">{i + 1}.</span>
              {url ? <img class="rank-flag" data-testid="rank-flag" src={url} alt="" width={21} height={14} /> : <span class="chip-swatch" style={{ background: hex(n.color) }} />}
              <span class="rank-bar" data-testid="rank-bar" data-share={share.toFixed(4)} style={{ background: `linear-gradient(to right, ${hex(n.color)}d9 ${(share * 100).toFixed(2)}%, rgba(255, 255, 255, 0.05) ${(share * 100).toFixed(2)}%)` }}>
                <span class="rank-name">
                  {displayName(n.name)}
                  {n.living ? null : <span class="rank-dagger" title={t('stats.dead')} data-testid="rank-dead"> †</span>}
                </span>
                <span class="rank-value">{shown(v(n))}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
