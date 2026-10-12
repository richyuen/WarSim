/**
 * `npx tsx tools/diag/fronts.ts [--seed 1] [--years 10]`
 *
 * The wars with no front (PLAN 4.6a), read from a headless 1938 run. Each day at its start,
 * for each war: whether it has a front, a cell held by a member of one side beside a cell held
 * by a member of the other (4-neighbours, as the frontier set: `frontierOf`). At its end (or
 * the run's), a war is told by its sides' leaders, its days, its days with a front, and how it
 * ended: `peace` (its members live), `death` (a side's members all dead), `on` (at the run's
 * end). The totals: wars, wars with no front on any day, wars with a front on under a tenth
 * of their days, and how each kind ended.
 *
 * And the contacts that stand (PLAN 4.1d1): each day, the land formations in a fight
 * (`engaged`) that have stood on one cell for 14 days or more; the most on a day and the mean.
 */
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { loadAssets1938 } from '../headless/assets';
import { TICKS_PER_YEAR } from '../headless/runner';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1]! : fallback;
}

const seed = Number(arg('seed', '1'));
const years = Number(arg('years', '10'));
const sim = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
const world = sim.world;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;

interface Seen {
  name: string;
  start: number;
  days: number;
  front: number;
  sides: [number[], number[]];
  end: string;
}
const seen = new Map<number, Seen>();
const done: Seen[] = [];
/** Per formation: the cell it stands on and the day it came there. */
const stood = new Map<number, [number, number]>();
let standMost = 0;
let standSum = 0;
let days = 0;

function day(): void {
  const d = world.tick / 24;
  const { w, h, controller } = world.cells;
  const wrap = world.settings.loopingMap;
  // The pairs of nations that face each other over a frontier cell today.
  const facing = new Set<number>();
  for (const c of frontierOf(world)) {
    const a = controller[c]!;
    const x = c % w;
    const y = Math.floor(c / w);
    const ns = [x > 0 || wrap ? y * w + ((x - 1 + w) % w) : -1, x < w - 1 || wrap ? y * w + ((x + 1) % w) : -1, y > 0 ? c - w : -1, y < h - 1 ? c + w : -1];
    for (const k of ns) {
      if (k < 0) continue;
      const b = controller[k]!;
      if (b !== 0 && b !== a) facing.add(a * 0x10000 + b);
    }
  }
  const now = new Set<number>();
  for (const war of world.wars.list) {
    now.add(war.id);
    let s = seen.get(war.id);
    if (!s) seen.set(war.id, (s = { name: `${tag(war.sides[0][0]!)}–${tag(war.sides[1][0]!)}`, start: d, days: 0, front: 0, sides: [[], []], end: 'on' }));
    s.sides = [[...war.sides[0]], [...war.sides[1]]];
    s.days++;
    let front = false;
    for (const a of war.sides[0]) for (const b of war.sides[1]) if (facing.has(a * 0x10000 + b)) front = true;
    if (front) s.front++;
  }
  for (const [id, s] of seen) {
    if (now.has(id)) continue;
    const living = (side: number[]): boolean => side.some((n) => world.nations.has(n) && world.nations.cols.living[n] === 1);
    s.end = living(s.sides[0]) && living(s.sides[1]) ? 'peace' : 'death';
    done.push(s);
    seen.delete(id);
  }
  // Contacts that stand.
  const f = world.formations.cols;
  let standing = 0;
  const live = new Set<number>();
  world.formations.forEach((id) => {
    if (world.afloat(id)) return;
    live.add(id);
    const cell = Math.floor(f.y[id]!) * w + Math.floor(f.x[id]!);
    const was = stood.get(id);
    if (!was || was[0] !== cell) stood.set(id, [cell, d]);
    else if (f.engaged[id] === 1 && d - was[1] >= 14) standing++;
  });
  for (const id of stood.keys()) if (!live.has(id)) stood.delete(id);
  standMost = Math.max(standMost, standing);
  standSum += standing;
  days++;
}

for (let t = 0; t < years * TICKS_PER_YEAR; t += 24) {
  sim.step(24);
  day();
}
const all = [...done, ...seen.values()];
const pct = (s: Seen): number => (s.days > 0 ? s.front / s.days : 0);
for (const s of all.sort((a, b) => a.start - b.start)) {
  if (pct(s) >= 0.1) continue;
  console.log(`  ${s.name.padEnd(9)} day ${String(s.start).padStart(4)}, ${String(s.days).padStart(4)} days, a front on ${String(s.front).padStart(4)}, ${s.end}; sides ${s.sides[0].map(tag).join(',')} / ${s.sides[1].map(tag).join(',')}`);
}
const tally = (list: Seen[]): string => {
  const by = { peace: 0, death: 0, on: 0 };
  for (const s of list) by[s.end as keyof typeof by]++;
  return `${list.length} (peace ${by.peace}, death ${by.death}, on ${by.on}; mean ${list.length ? Math.round(list.reduce((a, s) => a + s.days, 0) / list.length) : 0} days)`;
};
console.log(`seed ${seed}, ${years} years: wars ${tally(all)}`);
console.log(`  no front on any day: ${tally(all.filter((s) => s.front === 0))}`);
console.log(`  a front on under a tenth of their days: ${tally(all.filter((s) => pct(s) < 0.1))}`);
console.log(`  a front on a tenth or more: ${tally(all.filter((s) => pct(s) >= 0.1))}`);
console.log(`  contacts standing 14 days or more: at most ${standMost} formations on a day, ${(standSum / Math.max(1, days)).toFixed(1)} on a mean day`);
