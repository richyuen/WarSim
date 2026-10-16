import { useEffect, useState } from 'preact/hooks';
import { CHART_METRICS, seriesOf, topNations, type ChartMetric } from '../shared/statSeries';
import { t, type MessageKey } from './i18n';
import { displayName } from './NationPanel';

const WIDTH = 520;
const HEIGHT = 220;
const PAD = { l: 52, r: 8, t: 8, b: 20 };
const TOP = 5;
/** Gridlines of the value axis and dated ticks of the time axis (PLAN 7.4f12, the critic's N14). */
const Y_TICKS = 4;
const X_TICKS = 5;

/** The sample of `pts` nearest tick `tk`, or null (PLAN 7.4f12: the value under the cursor). */
export function sampleAt(pts: readonly (readonly [number, number])[], tk: number): readonly [number, number] | null {
  let best: readonly [number, number] | null = null;
  for (const p of pts) if (!best || Math.abs(p[0] - tk) < Math.abs(best[0] - tk)) best = p;
  return best;
}

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
 * in the nations' colours, with a legend. Gridlines at the quarters of the value axis and five
 * dates on the time axis; under the cursor, the month and each line's value then (PLAN 7.4f12).
 */
export function StatsChart({ load, refreshKey, nations, selected, labelOf, onClose }: StatsChartProps) {
  const [rows, setRows] = useState<Float32Array>(new Float32Array(0));
  const [metric, setMetric] = useState<ChartMetric>('land');
  /** The tick under the cursor, or null. */
  const [hoverTick, setHoverTick] = useState<number | null>(null);
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
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          class="chart-svg"
          data-testid="chart-svg"
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
            const x = ((e.clientX - r.left) / r.width) * WIDTH;
            setHoverTick(x < PAD.l || x > PAD.l + w ? null : t0 + ((x - PAD.l) / w) * (t1 - t0));
          }}
          onPointerLeave={() => setHoverTick(null)}
        >
          {Array.from({ length: Y_TICKS + 1 }, (_, i) => {
            const v = (vMax * i) / Y_TICKS;
            return (
              <g key={`y${i}`} data-testid="chart-ytick">
                <line x1={PAD.l} y1={sy(v)} x2={PAD.l + w} y2={sy(v)} class={i === 0 ? 'chart-axis' : 'chart-grid'} />
                <text x={PAD.l - 4} y={sy(v) + 3} class="chart-label" text-anchor="end">
                  {short(v)}
                </text>
              </g>
            );
          })}
          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + h} class="chart-axis" />
          {Array.from({ length: X_TICKS }, (_, i) => {
            const tk = t0 + ((t1 - t0) * i) / (X_TICKS - 1);
            return (
              <g key={`x${i}`} data-testid="chart-xtick">
                <line x1={sx(tk)} y1={PAD.t + h} x2={sx(tk)} y2={PAD.t + h + 3} class="chart-axis" />
                <text x={sx(tk)} y={HEIGHT - 4} class="chart-label" text-anchor={i === 0 ? 'start' : i === X_TICKS - 1 ? 'end' : 'middle'}>
                  {labelOf(tk)}
                </text>
              </g>
            );
          })}
          {hoverTick !== null ? <line x1={sx(hoverTick)} y1={PAD.t} x2={sx(hoverTick)} y2={PAD.t + h} class="chart-cursor" /> : null}
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
      {hoverTick !== null && lines.length > 0 ? (
        <div class="chart-hover" data-testid="chart-hover">
          <span class="chart-hover-date">{labelOf(sampleAt(lines[0]!.pts, hoverTick)?.[0] ?? hoverTick)}</span>
          {lines.map((l) => {
            const s = sampleAt(l.pts, hoverTick);
            return s ? (
              <span key={l.id} class="nation-chip" data-testid="chart-hover-value" data-nation={l.id} data-value={s[1]}>
                <span class="chip-swatch" style={{ background: hex(byId.get(l.id)?.color ?? 0x999999) }} />
                {Math.round(s[1]).toLocaleString('en-US')}
              </span>
            ) : null;
          })}
        </div>
      ) : null}
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
