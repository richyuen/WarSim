/**
 * PLAN 7.32 (critic R9-B2): the bursts of headless runs (`critic/scripts/c9_headless.ts`'s JSON,
 * its `nukeLog` tolls), counted per world:
 * - `bursts`, and their tolls under 5,000 dead (`small`);
 * - `chainLinks`: a burst of the same striker on the same nation within CHAIN_DAYS of its last,
 *   with a smaller toll (the critic's 10,847 → 1,373 → 168 → 24);
 * - `nearEmpty`: a burst within NEAR_KM and NEAR_DAYS of an earlier burst of the same striker that
 *   found under EMPTY_DEAD dead ("no strike near a place where the last strike found almost nothing").
 *
 * Usage: npx tsx tools/diag/nukeChainCount.ts <dir> <prefix> (reads <dir>/<prefix><seed>.json)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { size1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { seaKm } from '../../src/sim/systems/navalCombat';
import { loadAssets1938 } from '../headless/assets';

const CHAIN_DAYS = 14;
const NEAR_KM = 300;
const NEAR_DAYS = 90;
const EMPTY_DEAD = 5000;
const SMALL = 5000;
const [dir, prefix] = process.argv.slice(2) as [string, string];
const SZ = size1938(undefined);
const w = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SZ.w) }).world;

type Toll = { tick: number; by: string; struck: string; dead: number; at: [number, number] };
const totals = { worlds: 0, withBursts: 0, bursts: 0, small: 0, chainLinks: 0, nearEmpty: 0 };
for (const f of readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')).sort()) {
  const d = JSON.parse(readFileSync(join(dir, f), 'utf8')) as { seed: number; nukeLog: ({ k: string } & Toll)[] };
  const tolls = d.nukeLog.filter((n) => n.k === 'toll').sort((a, b) => a.tick - b.tick);
  let chainLinks = 0;
  let nearEmpty = 0;
  const lines: string[] = [];
  tolls.forEach((t, i) => {
    const before = tolls.slice(0, i).filter((p) => p.by === t.by);
    const last = [...before].reverse().find((p) => p.struck === t.struck);
    const chained = !!last && t.tick - last.tick <= CHAIN_DAYS * 24 && t.dead < last.dead;
    const empty = before.find((p) => p.dead < EMPTY_DEAD && t.tick - p.tick <= NEAR_DAYS * 24 && seaKm(w, t.at[0], t.at[1], p.at[0], p.at[1]) <= NEAR_KM);
    if (chained) chainLinks++;
    if (empty) nearEmpty++;
    lines.push(`  y${(t.tick / 8760).toFixed(2)} ${t.by} -> ${t.struck} ${t.dead}${chained ? ' CHAIN' : ''}${empty ? ` NEAR-EMPTY(${empty.dead})` : ''}`);
  });
  const small = tolls.filter((t) => t.dead < SMALL).length;
  totals.worlds++;
  if (tolls.length > 0) totals.withBursts++;
  totals.bursts += tolls.length;
  totals.small += small;
  totals.chainLinks += chainLinks;
  totals.nearEmpty += nearEmpty;
  console.log(`${d.seed}: bursts ${tolls.length}, under ${SMALL} dead ${small}, chain links ${chainLinks}, near an empty burst ${nearEmpty}`);
  for (const l of lines) console.log(l);
}
console.log(`total: ${JSON.stringify(totals)}`);
