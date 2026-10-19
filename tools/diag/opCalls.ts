/**
 * PLAN 7.30: the operational AI's long calls taken apart. From a saved state (`npm run sim --
 * --save`), for `days` days: every plan (`planNation`) timed by its parts (`OP_PROBE`), with its
 * sizes, and the system's calls (`Sim.profile`). Prints, over all plans and over those of
 * SLOW ms or more: the ms by part, by nation, the plan's sizes against its ms, and the walks of
 * `joinWide` (`joinWalks`) a day. Writes the plans of SLOW ms or more and the sums to `out`.
 *
 * Usage: npx tsx tools/diag/opCalls.ts <seed> <state file> [days = 60] [out = .cache/730/opCalls_<seed>.json]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Sim } from '../../src/sim/sim';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { assets1938 } from '../../tests/helpers/earth';
import { OP_PROBE, type AskTimes, type PlanTimes } from '../../src/sim/ai/operational';
import { joinWalks } from '../../src/sim/nav/provinceGraph';
import { navOf } from '../../src/sim/world';
import { atAnyPort } from '../../src/sim/systems/amphibious';

const seed = Number(process.argv[2]);
const from = process.argv[3]!;
const days = Number(process.argv[4] ?? 60);
const out = process.argv[5] ?? `.cache/730/opCalls_${seed}.json`;
/** A plan of this many ms or more is a long one. */
const SLOW = 5;
const PARTS = ['sectors', 'nearFar', 'passage', 'classes', 'reserveThreat', 'allot', 'fromAfar', 'orders'];

const s = new Sim({ scenario: '1938', seed, assets: assets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(from)));
const w = s.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const prof = s.profile(() => performance.now());
const opIndex = prof.names.indexOf('operationalAi');
const plans: PlanTimes[] = [];
OP_PROBE.now = () => performance.now();
OP_PROBE.plan = (p) => plans.push(p);
const mixedFlips: number[] = [];
const asks: (AskTimes & { nation: number; tick: number; same: string })[] = [];
OP_PROBE.ask = (a) => {
  // Why the refusal kept for it (`askMove`) did not answer: none kept, another cell stood on or
  // asked, or the ground (holders open, a flip between open and closed, a march or a port).
  const was = a.was;
  let same = !was ? 'none kept' : was.from !== a.from ? 'moved' : was.to !== a.to && !was.long.includes(a.to) ? 'other cell' : '';
  if (was && same === '') {
    // `askMove`'s other tests, in its order.
    const comp = navOf(w).grid.component;
    const kept = !w.embarked.has(a.id) && comp[a.from] !== 0 && (comp[a.from] === comp[a.to] || !atAnyPort(w, a.from));
    const okSame = was.ok.length === a.pass.ok.length && was.ok.every((v, i) => v === a.pass.ok[i]);
    let mixed = 0;
    for (let k = Math.max(0, was.flips - w.flipLogBase); k < w.flipLog.length; k++) {
      const fromHolder = Math.floor(w.flipLog[k]! / 65536);
      if (a.pass.ok[fromHolder] !== a.pass.ok[w.flipLog[k]! - fromHolder * 65536]) mixed++;
    }
    same = !kept ? 'not kept (port, other land)' : was.template !== w.formations.cols.template[a.id] ? 'template' : was.grid !== navOf(w).grid ? 'grid' : was.flips < w.flipLogBase ? 'log rolled over' : !okSame ? 'holders open' : mixed > 0 ? 'mixed flips' : '?';
    if (same === 'mixed flips') mixedFlips.push(mixed);
  }
  asks.push({ ...a, nation: w.formations.cols.nation[a.id]!, tick: w.tick, same });
};
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const walksAt = (): number => joinWalks(navOf(w).grid);
const walks0 = walksAt();
const startDay = Math.floor(w.tick / 24);
for (let d = 0; d < days; d++) s.step(24, quiet);
const walks = walksAt() - walks0;
delete OP_PROBE.now;
delete OP_PROBE.plan;
delete OP_PROBE.ask;

const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
const total = (p: PlanTimes): number => sum(p.parts);
const fmt = (x: number, d = 1): string => x.toFixed(d);
const sysMs = prof.ms[opIndex]!;
const planMs = sum(plans.map(total));
console.log(`seed ${seed} from day ${startDay}, ${days} days: operationalAi ${fmt(sysMs)} ms (${fmt(sysMs / (days * 24), 3)} a tick), longest call ${fmt(prof.max[opIndex]!)}; plans ${plans.length}, ${fmt(planMs)} ms; outside the plans ${fmt(sysMs - planMs)} ms; joinWide walks ${walks} (${fmt(walks / days, 2)} a day)`);

const report = (title: string, ps: PlanTimes[]): Record<string, unknown> => {
  const ms = sum(ps.map(total));
  const byPart = PARTS.map((name, i) => [name, sum(ps.map((p) => p.parts[i] ?? 0))] as const);
  console.log(`\n== ${title}: ${ps.length} plans, ${fmt(ms)} ms (mean ${fmt(ms / Math.max(1, ps.length), 2)})`);
  console.log('  by part:', byPart.map(([n, v]) => `${n} ${fmt(v)} (${fmt((100 * v) / Math.max(ms, 1e-9))} %)`).join(', '));
  const asks = sum(ps.map((p) => p.asks));
  const askMs = sum(ps.map((p) => p.askMs));
  const joins = sum(ps.map((p) => p.joins));
  const joinMs = sum(ps.map((p) => p.joinMs));
  const grounds = sum(ps.map((p) => p.grounds));
  const groundMs = sum(ps.map((p) => p.groundMs));
  console.log(`  askMove ${asks} calls ${fmt(askMs)} ms (${fmt(askMs / Math.max(1, asks), 3)} each); wideJoined ${joins} calls ${fmt(joinMs)} ms; groundOf ${grounds} calls ${fmt(groundMs)} ms (${fmt(groundMs / Math.max(1, grounds), 3)} each)`);
  const byNation = new Map<number, { n: number; ms: number; max: number; sectors: number; mine: number }>();
  for (const p of ps) {
    const e = byNation.get(p.nation) ?? { n: 0, ms: 0, max: 0, sectors: 0, mine: 0 };
    const t = total(p);
    e.n++;
    e.ms += t;
    e.max = Math.max(e.max, t);
    e.sectors += p.sectors;
    e.mine += p.mine;
    byNation.set(p.nation, e);
  }
  const top = [...byNation].sort((a, b) => b[1].ms - a[1].ms).slice(0, 10);
  console.log('  by nation (plans, ms, mean, longest, mean sectors, mean free formations):');
  for (const [n, e] of top) console.log(`    ${tag(n).padEnd(4)} ${String(e.n).padStart(4)} ${fmt(e.ms).padStart(8)} ${fmt(e.ms / e.n, 2).padStart(7)} ${fmt(e.max).padStart(7)} ${fmt(e.sectors / e.n).padStart(6)} ${fmt(e.mine / e.n).padStart(6)}`);
  // The plan's ms by the size of its front (sectors), in bands.
  const bands = [0, 25, 50, 100, 200, 400, Infinity];
  console.log('  by sectors (band: plans, mean ms, mean free, mean classes, mean asks, mean ask ms, mean grounds, mean ground ms):');
  for (let b = 0; b < bands.length - 1; b++) {
    const q = ps.filter((p) => p.sectors >= bands[b]! && p.sectors < bands[b + 1]!);
    if (q.length === 0) continue;
    const m = (f: (p: PlanTimes) => number): string => fmt(sum(q.map(f)) / q.length, 2);
    console.log(`    ${bands[b]}–${bands[b + 1]}: ${q.length} ${m(total)} ${m((p) => p.mine)} ${m((p) => p.classes)} ${m((p) => p.asks)} ${m((p) => p.askMs)} ${m((p) => p.grounds)} ${m((p) => p.groundMs)}`);
  }
  return { plans: ps.length, ms, byPart: Object.fromEntries(byPart), asks, askMs, joins, joinMs, grounds, groundMs, byNation: Object.fromEntries(top.map(([n, e]) => [tag(n), e])) };
};
const all = report('all plans', plans);
const slow = plans.filter((p) => total(p) >= SLOW);
const long = report(`plans of ${SLOW} ms or more`, slow);
const longest = plans
  .slice()
  .sort((a, b) => total(b) - total(a))
  .slice(0, 15);
console.log('\n== the longest plans (nation, day, ms, parts…, sectors, free, near, far, classes, asks/ms, joins/ms, grounds/ms):');
for (const p of longest)
  console.log(`  ${tag(p.nation).padEnd(4)} d${Math.floor(p.tick / 24)} ${fmt(total(p)).padStart(6)} [${p.parts.map((x) => fmt(x)).join(' ')}] s${p.sectors} f${p.mine} n${p.near} far${p.far} c${p.classes} ask ${p.asks}/${fmt(p.askMs)} join ${p.joins}/${fmt(p.joinMs)} gr ${p.grounds}/${fmt(p.groundMs)}`);
// The asks: by answer, by where they came from, and why a kept refusal did not answer them.
const { w: cw } = w.cells;
const cellGap = (a: number, b: number): number => {
  let dx = Math.abs((a % cw) - (b % cw));
  if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
  return Math.max(dx, Math.abs(Math.floor(a / cw) - Math.floor(b / cw)));
};
const askTable = new Map<string, { n: number; ms: number; gap: number }>();
for (const a of asks) {
  const k = `${a.afar ? 'afar' : 'orders'} ${a.answer.padEnd(7)} ${a.searched ? 'searched' : 'kept    '} ${a.same}`;
  const e = askTable.get(k) ?? { n: 0, ms: 0, gap: 0 };
  e.n++;
  e.ms += a.ms;
  e.gap += cellGap(a.from, a.to);
  askTable.set(k, e);
}
console.log('\n== the asks (from, answer, searched or answered by a kept refusal, the old rule reading of the kept refusal: calls, ms, ms each, mean cells apart):');
for (const [k, e] of [...askTable].sort((a, b) => b[1].ms - a[1].ms)) console.log(`  ${k.padEnd(56)} ${String(e.n).padStart(6)} ${fmt(e.ms).padStart(9)} ${fmt(e.ms / e.n, 2).padStart(7)} ${fmt(e.gap / e.n).padStart(6)}`);
// The same formation asked for the same cell again: how many times, and the ms of the repeats.
const seen = new Map<string, number>();
let repeats = 0;
let repeatMs = 0;
for (const a of asks) {
  const k = `${a.id}:${a.from}:${a.to}:${a.answer}`;
  const n = seen.get(k) ?? 0;
  if (n > 0) {
    repeats++;
    repeatMs += a.ms;
  }
  seen.set(k, n + 1);
}
if (mixedFlips.length > 0) console.log(`  mixed flips since the refusal, where they undid it: median ${mixedFlips.sort((a, b) => a - b)[mixedFlips.length >> 1]}, least ${mixedFlips[0]}`);
console.log(`  asked again from the same cell for the same cell with the same answer: ${repeats} calls, ${fmt(repeatMs)} ms`);
writeFileSync(out, JSON.stringify({ seed, from, startDay, days, sysMs, longestCall: prof.max[opIndex], walks, all, long, asks: [...askTable].map(([k, e]) => ({ k, ...e })), repeats, repeatMs, slowPlans: slow.map((p) => ({ ...p, nation: tag(p.nation), ms: total(p) })) }, null, 1));
console.log(`\n→ ${out}`);
