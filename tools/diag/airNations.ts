/**
 * PLAN 7.113's per-nation read: whose wings the air forces are. From 1938, at the start and after
 * `years` years, each living nation with wings: its wings, its income (`monthlyAccounts` gross), its
 * air force's upkeep as a share of that income, and the same share at the 1938 start (for nations of
 * the scenario's table; none for one founded later). Sorted by wings, the largest first.
 *
 * Usage: npx tsx tools/diag/airNations.ts <seed> [years = 20] [out = .cache/airNations_<seed>.json]
 */
import { writeFileSync } from 'node:fs';
import { ECONOMY_TABLES_1938, SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';
import { monthlyAccounts, UPKEEP_SCALE } from '../../src/sim/systems/economy';
import type { World } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const years = Number(process.argv[3] ?? 20);
const out = process.argv[4] ?? `.cache/airNations_${seed}.json`;
const T = ECONOMY_TABLES_1938;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });

type Row = { nation: number; tag: string; wings: number; income: number; share: number };
function read(w: World): Row[] {
  const acc = monthlyAccounts(w, T);
  const c = w.formations.cols;
  const air = new Map<number, { wings: number; upkeep: number }>();
  w.formations.forEach((id) => {
    if (!w.isWing(id) || w.nations.cols.living[c.nation[id]!] !== 1) return;
    const t = c.template[id]!;
    const a = air.get(c.nation[id]!) ?? { wings: 0, upkeep: 0 };
    a.wings++;
    a.upkeep += (UPKEEP_SCALE * T.templateUpkeep[t]! * c.strength[id]!) / T.templateStrength[t]!;
    air.set(c.nation[id]!, a);
  });
  return [...air]
    .map(([n, a]) => ({ nation: n, tag: TAGS_1938[n - 1] ?? `#${n}`, wings: a.wings, income: Math.round(acc.gross[n] ?? 0), share: +(a.upkeep / Math.max(1, acc.gross[n] ?? 0)).toFixed(4) }))
    .sort((a, b) => b.wings - a.wings || a.nation - b.nation);
}

const start = read(s.world);
for (let d = 0; d < 365 * years; d++) s.step(24, (w) => {
  w.out.events.length = 0;
  w.out.fires.length = 0;
});
const end = read(s.world);
const at1938 = new Map(start.map((r) => [r.nation, r]));
writeFileSync(out, JSON.stringify({ seed, years, start, end }, null, 1));
for (const r of end.slice(0, 15)) {
  const o = at1938.get(r.nation);
  console.log(`${r.tag.padEnd(5)} wings ${String(r.wings).padStart(3)} (1938 ${o ? String(o.wings).padStart(3) : '  -'}), income ${String(r.income).padStart(5)}, air/income ${r.share.toFixed(3)} (1938 ${o ? o.share.toFixed(3) : '  -  '})`);
}
console.log(`done: ${seed} wings ${end.reduce((t, r) => t + r.wings, 0)} (1938 ${start.reduce((t, r) => t + r.wings, 0)})`);
