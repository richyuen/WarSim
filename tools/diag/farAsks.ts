/**
 * PLAN 7.117: what bounds the marches from afar's orders in a plan, the far formations or the empty
 * sectors. From a saved state, for `days` days, every plan with far formations (`OP_PROBE.sectors`'
 * `empty`: the sectors with nobody and the far formations): per nation the plans, and those where the
 * far formations are fewer than the empty sectors (then each far formation on its day is asked, and
 * one taken out is an ask saved) or not (an empty sector left over goes to the next formation).
 *
 * Usage: npx tsx tools/diag/farAsks.ts <seed> <state.bin> [days = 20]
 */
import { readFileSync } from 'node:fs';
import { OP_PROBE } from '../../src/sim/ai/operational';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const days = Number(process.argv[4] ?? 20);
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(src)));
const by = new Map<number, { plans: number; farFewer: number; far: number; empties: number }>();
OP_PROBE.sectors = (x) => {
  const e = x.empty;
  if (!e || e.far <= 0) return;
  let r = by.get(x.nation);
  if (!r) by.set(x.nation, (r = { plans: 0, farFewer: 0, far: 0, empties: 0 }));
  r.plans++;
  r.far += e.far;
  r.empties += Math.max(0, e.empties);
  if (e.empties >= e.far) r.farFewer++;
};
for (let d = 0; d < days; d++)
  s.step(24, (w) => {
    w.out.events.length = 0;
    w.out.fires.length = 0;
  });
const rows = [...by.entries()].sort((a, b) => b[1].far - a[1].far).slice(0, 12);
let plans = 0;
let fewer = 0;
for (const [, r] of by) {
  plans += r.plans;
  fewer += r.farFewer;
}
console.log(`seed ${seed} ${src}, ${days} days: plans with far formations ${plans}, far fewer than (or as many as) the empty sectors ${fewer}`);
for (const [n, r] of rows) console.log(`  ${tag(n)}: plans ${r.plans}, far a plan ${(r.far / r.plans).toFixed(1)}, empty sectors a plan ${(r.empties / r.plans).toFixed(1)}, far fewer ${r.farFewer}`);
console.log('done:');
