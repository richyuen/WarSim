/**
 * PLAN 7.49d3: the transport groups each nation orders (new in `world.production`) over a run from
 * 1938, and its warships ordered, gold at the end and its least gold. The ferry's want (ADR-614)
 * holds while the island army outnumbers the room: this reads whether the orders stay one at a time
 * with warships between, and whether a nation goes into debt for them.
 *
 * Usage: npx tsx tools/diag/ferryOrders.ts <seed> <days>
 */
import { BUILD_MIX_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { Domain } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2] ?? 99);
const days = Number(process.argv[3] ?? 365);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const seen = new Set<number>();
const rows = new Map<number, { transports: number; warships: number; least: number }>();
const transport = BUILD_MIX_1938.fleets!.transport;
for (let d = 0; d < days; d++) {
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  w.production.forEach((p) => {
    if (seen.has(p)) return;
    seen.add(p);
    const t = w.production.cols.template[p]!;
    if (w.rules!.templates[t]?.domain !== Domain.sea) return;
    const n = w.production.cols.nation[p]!;
    const r = rows.get(n) ?? { transports: 0, warships: 0, least: Infinity };
    if (t === transport) r.transports++;
    else r.warships++;
    rows.set(n, r);
  });
  for (const [n, r] of rows) r.least = Math.min(r.least, w.nations.cols.gold[n]!);
}
for (const [n, r] of [...rows].sort((a, b) => b[1].transports - a[1].transports)) {
  console.log(`${tag(n)}: transports ${r.transports}, warships ${r.warships}, least gold ${Math.round(r.least)}, gold ${Math.round(w.nations.cols.gold[n]!)}`);
}
