import { useEffect, useState } from 'preact/hooks';
import { CHART_METRICS, seriesOf, topNations, type ChartMetric } from '../shared/statSeries';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

const WIDTH = 520;
const HEIGHT = 220;
const PAD = { l: 52, r: 8, t: 8, b: 20 };
const TOP = 5;

export interface StatsChartProps {
  load: () => Promise<Float32Array>;
  /** Changes when the sim advanced (refetch). */
  refreshKey: number;
  /** Nations (living and dead) with names and colours. */
  nations: { id: number; name: string; color: number }[];
  /** The selected nation is always charted. */
  selected: number;
  /** Month and year of a tick (x-axis labels). */
  labelOf: (tick: number) => string;
  onClose: () => void;
}

const hex = (c: number): string => `#${c.toString(16).padStart(6, '0')}`;
const short = (v: number): string => (Math.abs(v) >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : Math.abs(v) >= 1e3 ? `${(v / 1e3).toFixed(0)}k` : v.toFixed(0));

/**
 * Statistics charts (PLAN 1.34b): one metric (land, income, treasury, army men, casualties) over
 * the monthly samples, for the top 5 nations at the latest sample plus the selected one. SVG lines
 * in the nations' colours, with a legend.
 */
export function StatsChart({ load, refreshKey, nations, selected, labelOf, onClose }: StatsChartProps) {
  const [rows, setRows] = useState<Float32Array>(new Float32Array(0));
  const [metric, setMetric] = useState<ChartMetric>('land');
  useEffect(() => {
    let live = true;
    void load().then((r) => live && setRows(r));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  const ids = topNations(rows, metric, TOP);
  if (selected !== 0 && !ids.includes(selected)) ids.push(selected);
  const lines = ids.map((id) => ({ id, pts: seriesOf(rows, id, metric) })).filter((l) => l.pts.length > 0);
  let t0 = Infinity;
  let t1 = -Infinity;
  let vMax = 0;
  for (const l of lines) {
    for (const [tk, v] of l.pts) {
      t0 = Math.min(t0, tk);
      t1 = Math.max(t1, tk);
      vMax = Math.max(vMax, v);
    }
  }
  const w = WIDTH - PAD.l - PAD.r;
  const h = HEIGHT - PAD.t - PAD.b;
  const sx = (tk: number): number => PAD.l + (t1 > t0 ? ((tk - t0) / (t1 - t0)) * w : w / 2);
  const sy = (v: number): number => PAD.t + h - (vMax > 0 ? (v / vMax) * h : 0);
  const byId = new Map(nations.map((n) => [n.id, n]));
  return (
    <aside class="history-panel stats-chart" data-testid="stats-chart" data-metric={metric}>
      <header class="ranking-head">
        <span>{t('chart.title')}</span>
        <select data-testid="chart-metric" value={metric} onChange={(e) => setMetric((e.currentTarget as HTMLSelectElement).value as ChartMetric)}>
          {CHART_METRICS.map((m) => (
            <option key={m} value={m}>
              {t(`chart.${m}` as MessageKey)}
            </option>
          ))}
        </select>
        <button type="button" class="panel-close" data-testid="chart-close" aria-label={t('panel.close')} onClick={onClose}>
          ×
        </button>
      </header>
      {lines.length === 0 || t1 <= t0 ? (
        <div class="panel-note" data-testid="chart-empty">
          {t('chart.empty')}
        </div>
      ) : (
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} class="chart-svg" data-testid="chart-svg">
          <line x1={PAD.l} y1={PAD.t + h} x2={PAD.l + w} y2={PAD.t + h} class="chart-axis" />
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + h} class="chart-axis" />
          <text x={PAD.l - 4} y={PAD.t + 8} class="chart-label" text-anchor="end">
            {short(vMax)}
          </text>
          <text x={PAD.l - 4} y={PAD.t + h} class="chart-label" text-anchor="end">
            0
          </text>
          <text x={PAD.l} y={HEIGHT - 4} class="chart-label">
            {labelOf(t0)}
          </text>
          <text x={PAD.l + w} y={HEIGHT - 4} class="chart-label" text-anchor="end">
            {labelOf(t1)}
          </text>
          {lines.map((l) => (
            <polyline
              key={l.id}
              data-testid="chart-line"
              data-nation={l.id}
              data-points={l.pts.length}
              class={l.id === selected ? 'chart-line selected' : 'chart-line'}
              stroke={hex(byId.get(l.id)?.color ?? 0x999999)}
              points={l.pts.map(([tk, v]) => `${sx(tk).toFixed(1)},${sy(v).toFixed(1)}`).join(' ')}
            />
          ))}
        </svg>
      )}
      <div class="chips chart-legend">
        {lines.map((l) => (
          <span key={l.id} class="nation-chip" data-testid="chart-legend">
            <span class="chip-swatch" style={{ background: hex(byId.get(l.id)?.color ?? 0x999999) }} />
            {byId.has(l.id) ? displayName(byId.get(l.id)!.name) : `#${l.id}`}
          </span>
        ))}
      </div>
    </aside>
  );
}
