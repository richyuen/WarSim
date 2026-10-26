/**
 * PLAN 7.128a: hollow land formations (under 500 men and under their template's) and contact, daily at
 * hour 12 over the first `days`: land formations (not fleet, wing or embarked, as the critic counts),
 * the hollow among them, the engaged, the hollow engaged, and the land formations' men in all. On a
 * commit before ADR-701's fold it shows what the fold takes away.
 *
 * Usage: npx tsx tools/diag/hollowContact.ts <seed> <days> <out.json>
 */
import { writeFileSync } from 'node:fs';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import type { World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const days = Number(process.argv[3] ?? 365);
const out = process.argv[4] ?? `.cache/hollowContact_${seed}.json`;
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(size1938(undefined).w) });
const w = sim.world;
const clear = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const rows: { day: number; land: number; hollow: number; engaged: number; hollowEngaged: number; men: number }[] = [];
const sum = { land: 0, hollow: 0, engaged: 0, hollowEngaged: 0, men: 0 };
for (let d = 0; d < days; d++) {
  sim.step(12, clear);
  const c = w.formations.cols;
  const r = { day: d, land: 0, hollow: 0, engaged: 0, hollowEngaged: 0, men: 0 };
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id)) return;
    const rule = w.rules?.templates[c.template[id]!];
    r.land++;
    r.men += c.strength[id]!;
    const hollow = !!rule && rule.manpower > 0 && c.strength[id]! < Math.min(500, rule.manpower);
    if (hollow) r.hollow++;
    if (c.engaged[id]) {
      r.engaged++;
      if (hollow) r.hollowEngaged++;
    }
  });
  rows.push(r);
  for (const k of Object.keys(sum) as (keyof typeof sum)[]) sum[k] += r[k];
  sim.step(12, clear);
}
const mean = Object.fromEntries(Object.entries(sum).map(([k, v]) => [k, +(v / days).toFixed(2)]));
writeFileSync(out, JSON.stringify({ seed, days, mean, rows }, null, 1));
process.stderr.write(`done: ${seed} ${JSON.stringify(mean)}\n`);
