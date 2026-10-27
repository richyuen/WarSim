/**
 * PLAN 7.130, from a save: the top seven by controlled cells at each year's end, each with its days
 * at war that year, aggression, overlord and the enemies it fought; and the top five as a set, with
 * the longest run of the same set (the critic's stasis, `critic/scripts/c15_cmp.py`).
 *
 * Usage: npx tsx tools/diag/stasisFrom.ts <save.bin> <years> [out.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const bin = process.argv[2]!;
const years = Number(process.argv[3] ?? 10);
const out = process.argv[4];
const s = new Sim({ scenario: '1938', seed: 1, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin)));
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const rows: { top5: string[]; line: string }[] = [];
for (let y = 1; y <= years; y++) {
  const warDays = new Map<number, number>();
  const foes = new Map<number, Set<number>>();
  for (let d = 0; d < 365; d++) {
    s.step(24, (ww) => {
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    for (const war of w.wars.list) {
      for (let side = 0; side < 2; side++) {
        for (const n of war.sides[side]!) {
          warDays.set(n, (warDays.get(n) ?? 0) + 1);
          const set = foes.get(n) ?? new Set<number>();
          for (const m of war.sides[1 - side]!) set.add(m);
          foes.set(n, set);
        }
      }
    }
  }
  const held = new Map<number, number>();
  const ctl = w.cells.controller;
  for (let i = 0; i < ctl.length; i++) if (ctl[i] !== 0) held.set(ctl[i]!, (held.get(ctl[i]!) ?? 0) + 1);
  const ranked = [...held].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 7);
  const nc = w.nations.cols;
  const line = ranked
    .map(([n, c]) => {
      const f = [...(foes.get(n) ?? [])].map(tag).slice(0, 4).join(',');
      const ol = nc.overlord[n]! ? `<${tag(nc.overlord[n]!)}` : '';
      return `${tag(n)}${ol} ${c} w${warDays.get(n) ?? 0} a${nc.aggression[n]}${f ? ` [${f}]` : ''}`;
    })
    .join(' | ');
  rows.push({ top5: ranked.slice(0, 5).map(([n]) => tag(n)), line });
  console.log(`y+${y}: ${line}`);
}
let run = 1;
let best = 1;
for (let i = 1; i < rows.length; i++) {
  const a = [...rows[i]!.top5].sort().join();
  const b = [...rows[i - 1]!.top5].sort().join();
  run = a === b ? run + 1 : 1;
  best = Math.max(best, run);
}
console.log(`done: ${bin} longest same five ${best} of ${years} years`);
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
