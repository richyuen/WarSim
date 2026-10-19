/**
 * PLAN 7.30c: why `joinWide` is walked again, and whether the walk changed its answer. From a saved
 * state (`npm run sim -- --save`), for `days` days: each walk (`JOIN_PROBE`) by the set of open
 * holders it is of (`Passage.ok`), set against the last walk of the same set: why that answer was
 * not kept (none yet; `open` or `shut` changed; a flip between an open and a closed holder), the
 * flips since it by the class of their cell's node (mixed: open and closed ground; clear; shut;
 * none) and way, and whether the groups the walk joined (its partition of the nodes, the numbers
 * aside) are those of the last. Also the walks of one tick and how many of them repeat another's
 * partition, and the land cells of no node.
 *
 * Usage: npx tsx tools/diag/joinWalks.ts <seed> <state file> [days = 60] [out = .cache/730/joinWalks_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { JOIN_PROBE } from '../../src/sim/nav/provinceGraph';
import { navOf } from '../../src/sim/world';

const seed = Number(process.argv[2]);
const from = process.argv[3]!;
const days = Number(process.argv[4] ?? 60);
const out = process.argv[5] ?? `.cache/730/joinWalks_${seed}.json`;

const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(from)));
const w = s.world;
const { grid, graph } = navOf(w);

let noNode = 0;
for (let c = 0; c < grid.component.length; c++) if (grid.component[c] !== 0 && graph.nodeOf[c] === 0) noNode++;
let noNodeFlips = 0;

/** By node, the least node of its class (0 for a node in none): the partition without the numbers. */
const canon = (joined: Int32Array): Int32Array => {
  const least = new Map<number, number>();
  const c = new Int32Array(joined.length);
  for (let a = 1; a < joined.length; a++) {
    const j = joined[a]!;
    if (j === 0) continue;
    let m = least.get(j);
    if (m === undefined) least.set(j, (m = a));
    c[a] = m;
  }
  return c;
};
const same = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
const hashOf = (a: Int32Array): string => {
  let h = 2166136261;
  for (let i = 0; i < a.length; i++) h = Math.imul(h ^ a[i]!, 16777619);
  return (h >>> 0).toString(16);
};

interface Last { canon: Int32Array; open: Uint8Array; shut: Uint8Array; flips: number; tick: number }
const last = new Map<string, Last>();
interface Walk { tick: number; key: number; why: string; changed: boolean | null; flips: Record<string, number> }
const walks: Walk[] = [];
const keyIds = new Map<string, number>();
const byTick = new Map<number, string[]>();
JOIN_PROBE.walk = (pass, joined) => {
  const key = pass.ok.join('');
  if (!keyIds.has(key)) keyIds.set(key, keyIds.size);
  const now = w.flipLogBase + w.flipLog.length;
  const c = canon(joined);
  const open = pass.open!;
  const shut = pass.shut!;
  const prev = last.get(key);
  const flips: Record<string, number> = {};
  let why: string;
  let changed: boolean | null = null;
  if (!prev) why = 'first';
  else {
    changed = !same(prev.canon, c);
    if (!same(prev.open, open) || !same(prev.shut, shut)) why = 'open or shut';
    else if (prev.flips < w.flipLogBase) why = 'log rolled';
    else {
      why = 'flips';
      for (let k = prev.flips - w.flipLogBase; k < w.flipLog.length; k++) {
        const f = Math.floor(w.flipLog[k]! / 65536);
        const t = w.flipLog[k]! - f * 65536;
        if (pass.ok[f] === pass.ok[t]) continue;
        const node = graph.nodeOf[w.flipCells[k]!]!;
        const cls = node === 0 ? 'none' : open[node] === 1 && shut[node] === 1 ? 'mixed' : open[node] === 1 ? 'clear' : 'shut';
        if (node === 0) noNodeFlips++;
        const name = `${cls} ${pass.ok[f] === 1 ? 'open>closed' : 'closed>open'}`;
        flips[name] = (flips[name] ?? 0) + 1;
      }
    }
  }
  last.set(key, { canon: c, open: open.slice(), shut: shut.slice(), flips: now, tick: w.tick });
  walks.push({ tick: w.tick, key: keyIds.get(key)!, why, changed, flips });
  const t = byTick.get(w.tick) ?? [];
  t.push(hashOf(c));
  byTick.set(w.tick, t);
};
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const startDay = Math.floor(w.tick / 24);
for (let d = 0; d < days; d++) s.step(24, quiet);
delete JOIN_PROBE.walk;

const tally = new Map<string, { walks: number; changed: number; same: number }>();
const flipTally = new Map<string, { walks: number; changed: number; flips: number }>();
for (const x of walks) {
  const t = tally.get(x.why) ?? { walks: 0, changed: 0, same: 0 };
  t.walks++;
  if (x.changed === true) t.changed++;
  if (x.changed === false) t.same++;
  tally.set(x.why, t);
  if (x.why !== 'flips') continue;
  // A walk after flips by the classes its flips were of.
  const classes = Object.keys(x.flips).sort().join(' + ') || '(none)';
  const f = flipTally.get(classes) ?? { walks: 0, changed: 0, flips: 0 };
  f.walks++;
  if (x.changed) f.changed++;
  f.flips += Object.values(x.flips).reduce((a, b) => a + b, 0);
  flipTally.set(classes, f);
}
let multi = 0;
let multiWalks = 0;
let repeats = 0;
for (const hs of byTick.values()) {
  if (hs.length < 2) continue;
  multi++;
  multiWalks += hs.length;
  repeats += hs.length - new Set(hs).size;
}
console.log(`seed ${seed} from day ${startDay}, ${days} days: ${walks.length} walks (${(walks.length / days).toFixed(2)} a day) of ${keyIds.size} sets of open holders; land cells of no node ${noNode}, their flips ${noNodeFlips}`);
console.log('why walked again | walks | partition changed | same');
for (const [why, t] of tally) console.log(`${why} | ${t.walks} | ${t.changed} | ${t.same}`);
console.log('after flips, by the classes of the flips | walks | changed | flips');
for (const [k, f] of [...flipTally].sort((a, b) => b[1].walks - a[1].walks)) console.log(`${k} | ${f.walks} | ${f.changed} | ${f.flips}`);
console.log(`ticks with 2+ walks: ${multi} (${multiWalks} walks), of them repeating another walk's partition in the tick: ${repeats}`);
writeFileSync(out, JSON.stringify({ seed, startDay, days, noNode, noNodeFlips, tally: Object.fromEntries(tally), flipTally: Object.fromEntries(flipTally), multi, multiWalks, repeats, walks }, null, 1));
