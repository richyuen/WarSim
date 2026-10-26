/**
 * PLAN 7.124: the operational AI's orders refused after a search, taken apart. From a saved state, for
 * `days` days, every ask (`askMove`, `OP_PROBE.ask`) that searched and was not 'ok', by: its answer
 * ('refused', 'long'); the ground it starts on (open to the formation by its passage, or closed: then the
 * search is not held to a corridor and walks all it reaches); a corridor's refusal (PLAN 7.30b) or not;
 * the target's holder open or closed; and why the refusal kept did not answer it (none kept, moved, another
 * cell, a flip between open and closed, …). Per bucket the asks and their ms, and the straight cells apart.
 *
 * Usage: npx tsx tools/diag/asksWhy.ts <seed> <state.bin> [days = 30]   (EXAMPLES=n: print the first n slow ones)
 */
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { OP_PROBE } from '../../src/sim/ai/operational';
import { navOf } from '../../src/sim/world';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const seed = Number(process.argv[2]);
const src = process.argv[3]!;
const days = Number(process.argv[4] ?? 30);
const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(src)));
const w = s.world;
const W = w.cells.w;
const nc = w.nations.cols;
const tag = (n: number): string => ((nc.origin[n] ?? 0) === 0 ? (TAGS_1938[n - 1] ?? `#${n}`) : `f${n}`);
type Row = { n: number; ms: number; apart: number };
const rows = new Map<string, Row>();
const byNation = new Map<string, Row>();
const add = (m: Map<string, Row>, k: string, ms: number, apart: number): void => {
  const r = m.get(k) ?? { n: 0, ms: 0, apart: 0 };
  r.n++;
  r.ms += ms;
  r.apart += apart;
  m.set(k, r);
};
const examples: string[] = [];
let all = 0;
let allMs = 0;
OP_PROBE.now = () => performance.now();
OP_PROBE.ask = (a) => {
  all++;
  allMs += a.ms;
  if (a.answer === 'ok' || !a.searched) return;
  const p = a.pass;
  const startOpen = p.ok[p.holder[a.from]!] === 1 ? 'open' : 'closed';
  const toOpen = p.ok[p.holder[a.to]!] === 1 ? 'open' : 'closed';
  const was = a.was;
  let why = 'none kept';
  if (was) {
    if (was.from !== a.from) why = 'moved';
    else if (was.to !== a.to && !was.long.includes(a.to)) why = 'other cell';
    else if (was.template !== w.formations.cols.template[a.id]) why = 'template';
    else if (was.ok.length !== p.ok.length || !was.ok.every((v, i) => v === p.ok[i])) why = 'holders open';
    else why = 'flips';
  }
  const corridor = was?.corridor !== undefined ? 'corr' : '';
  // A corridor's refusal that did not hold (`corridorHolds`): which of its tests.
  if (corridor && why === 'flips') {
    const read = was!.corridor!;
    const same = (x: Uint8Array | undefined, y: Uint8Array | undefined): boolean => x === y || (x !== undefined && y !== undefined && x.length === y.length && x.every((v, i) => v === y[i]));
    const nodeOf = navOf(w).graph.nodeOf;
    let opened = 0;
    if (was!.since >= w.flipLogBase)
      for (let k = was!.since - w.flipLogBase; k < w.flipLog.length; k++) {
        const fh = Math.floor(w.flipLog[k]! / 65536);
        if (p.ok[fh] !== 1 && p.ok[w.flipLog[k]! - fh * 65536] === 1 && read.on[nodeOf[w.flipCells[k]!]!] === 1) opened++;
      }
    why = was!.since < w.flipLogBase ? 'flips: log rolled over' : !same(read.open, p.open) ? `flips: open nodes changed (${diff(read.open, p.open)})` : !same(read.shut, p.shut) ? `flips: shut nodes changed${onCorr(read, p.shut)}` : opened > 0 ? 'flips: a corridor cell opened' : 'flips: ?';
  }
  const apart = Math.max(Math.abs((a.from % W) - (a.to % W)), Math.abs(Math.floor(a.from / W) - Math.floor(a.to / W)));
  add(rows, `${a.answer} start ${startOpen} to ${toOpen} ${why}${corridor ? ' (kept a corridor)' : ''}`, a.ms, apart);
  add(byNation, tag(w.formations.cols.nation[a.id]!), a.ms, apart);
  if (process.env.EXAMPLES && a.ms > 3 && (!process.env.WHY || why.startsWith(process.env.WHY)) && examples.length < Number(process.env.EXAMPLES)) {
    const g = navOf(w).graph;
    const xy = (c: number): string => `(${c % W},${Math.floor(c / W)})`;
    examples.push(`  ${tag(w.formations.cols.nation[a.id]!)} f${a.id} ${xy(a.from)} node ${g.nodeOf[a.from]} held ${tag(p.holder[a.from]!)} -> ${xy(a.to)} node ${g.nodeOf[a.to]} held ${tag(p.holder[a.to]!)}, component ${navOf(w).grid.component[a.from]}/${navOf(w).grid.component[a.to]}, ${why}, ${a.ms.toFixed(1)} ms, day ${Math.floor(w.tick / 24)}`);
  }
};
for (let d = 0; d < days; d++)
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
function diff(a: Uint8Array | undefined, b: Uint8Array | undefined): string {
  if (!a || !b) return 'none';
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n > 3 ? 'many' : String(n);
}
/** Whether a node that changed its shut is in the corridor. */
function onCorr(read: { on: Uint8Array; shut: Uint8Array }, shut: Uint8Array | undefined): string {
  if (!shut) return '';
  let inside = 0;
  for (let i = 0; i < shut.length; i++) if (shut[i] !== read.shut[i] && read.on[i] === 1) inside++;
  return inside > 0 ? ' in the corridor' : ' outside the corridor';
}
const show = (m: Map<string, Row>, k: number): string[] =>
  [...m]
    .sort((x, y) => y[1].ms - x[1].ms)
    .slice(0, k)
    .map(([key, r]) => `  ${key}: ${r.n} asks, ${r.ms.toFixed(0)} ms (${(r.ms / r.n).toFixed(2)} each), ${(r.apart / r.n).toFixed(0)} cells apart`);
console.log(`seed ${seed} ${src}, ${days} days: asks ${all}, ${allMs.toFixed(0)} ms`);
console.log(show(rows, 14).join('\n'));
console.log('by nation:');
console.log(show(byNation, 8).join('\n'));
if (examples.length > 0) console.log(['examples:', ...examples].join('\n'));
console.log('done:');
