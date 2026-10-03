/**
 * Statistics series helpers for charts (PLAN 1.34b), over the worker's flat f32 records
 * [tick, nation, land, income, gold, men, casualties] (STAT_STRIDE 7, src/sim/stats.ts).
 */
export const SERIES_STRIDE = 7;
export const CHART_METRICS = ['land', 'income', 'gold', 'men', 'casualties'] as const;
export type ChartMetric = (typeof CHART_METRICS)[number];
const COLUMN: Record<ChartMetric, number> = { land: 2, income: 3, gold: 4, men: 5, casualties: 6 };

/** [tick, value] points of `nation` for `metric`, in tick order. */
export function seriesOf(rows: ArrayLike<number>, nation: number, metric: ChartMetric): [number, number][] {
  const out: [number, number][] = [];
  const col = COLUMN[metric];
  for (let i = 0; i + SERIES_STRIDE <= rows.length; i += SERIES_STRIDE) if (rows[i + 1] === nation) out.push([rows[i]!, rows[i + col]!]);
  return out;
}

/** The `k` nations with the highest `metric` at the latest sample (ties by id). */
export function topNations(rows: ArrayLike<number>, metric: ChartMetric, k: number): number[] {
  let last = -1;
  for (let i = 0; i + SERIES_STRIDE <= rows.length; i += SERIES_STRIDE) last = Math.max(last, rows[i]!);
  const col = COLUMN[metric];
  const at: [number, number][] = [];
  for (let i = 0; i + SERIES_STRIDE <= rows.length; i += SERIES_STRIDE) if (rows[i] === last) at.push([rows[i + 1]!, rows[i + col]!]);
  return at
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, k)
    .map((x) => x[0]);
}
