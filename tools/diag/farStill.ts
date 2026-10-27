/**
 * PLAN 7.138: the land formations of a nation that holds front cells of a war with a front of at
 * least 100 cells, on the landmass of its side's front cells, more than 60 cells from that front
 * and standing still. Hour 12 of each day: why they stand (home, a far march's wait, an order
 * refused, the nearest of its nation's sectors), and how far the front is.
 *
 * Usage: npx tsx tools/diag/farStill.ts <seed> <state.bin> <days> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seedArg, bin, daysArg, out] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedArg), assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
if (bin === '1938') for (let d = 0; d < 60; d++) s.step(24, (ww) => { ww.out.events.length = 0; ww.out.fires.length = 0; });
else s.load(new Uint8Array(readFileSync(bin!)));
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
const { w: W, h } = w.cells;
const dist = new Uint16Array(W * h);
/** Steps to the nearest frontier cell of the nation (any war), BFS over all cells. */
function toFront(src: readonly number[]): void {
  dist.fill(65535);
  const nb: number[] = [];
  let q = src.slice();
  for (const c of q) dist[c] = 0;
  for (let k = 1; q.length > 0 && k < 2000; k++) {
    const next: number[] = [];
    for (const c of q) for (const n of neighbours4(c, W, h, w.settings.loopingMap, nb)) if (dist[n] === 65535) {
      dist[n] = k;
      next.push(n);
    }
    q = next;
  }
}
const tally = new Map<string, number>();
const add = (k: string): void => void tally.set(k, (tally.get(k) ?? 0) + 1);
const samples: unknown[] = [];
const days = Number(daysArg);
for (let d = 0; d < days; d++) {
  s.step(12, quiet);
  const c = w.formations.cols;
  const land = navOf(w).grid.component;
  // The nation's own frontier cells (any hostile neighbour), by nation.
  const byNation = new Map<number, number[]>();
  for (const fc of frontierOf(w)) {
    const o = w.cells.controller[fc]!;
    if (o === 0) continue;
    let l = byNation.get(o);
    if (!l) byNation.set(o, (l = []));
    l.push(fc);
  }
  const nations = new Map<number, number[]>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
    const n = c.nation[id]!;
    if (!byNation.has(n) || !w.wars.nations().has(n)) return;
    let l = nations.get(n);
    if (!l) nations.set(n, (l = []));
    l.push(id);
  });
  for (const [n, ids] of nations) {
    const fr = byNation.get(n)!;
    toFront(fr);
    const lands = new Set(fr.map((x) => land[x]!));
    for (const id of ids) {
      const cell = Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
      const dd = dist[cell]!;
      add(`all`);
      if (dd > DEPLOY_RANGE_CELLS) add('far');
      else continue;
      if (!lands.has(land[cell]!)) {
        add('far: other landmass');
        continue;
      }
      if (c.moving[id] === 1) {
        add('far: moving');
        continue;
      }
      add('far still');
      const why = c.home[id] !== 0 ? 'home' : c.engaged[id] === 1 ? 'engaged' : c.retreat[id] !== 0 ? 'retreat' : (w.farWait.get(id) ?? -1) >= Math.floor(w.tick / 24) ? 'farWait' : w.refusedOrders.has(id) ? 'refused' : 'none';
      add(`far still: ${why}`);
      const band = dd <= 120 ? '60-120' : dd <= 250 ? '120-250' : dd <= 500 ? '250-500' : '>500';
      add(`far still band ${band}`);
      if (samples.length < 60 && d === days - 1) samples.push({ id, nation: tag(n), men: c.strength[id], dist: dd, why, farWait: w.farWait.get(id), tick: w.tick });
    }
  }
  s.step(12, quiet);
}
const o = Object.fromEntries([...tally].sort().map(([k, v]) => [k, Math.round((v / days) * 10) / 10]));
process.stderr.write(JSON.stringify(o, null, 1) + '\n');
writeFileSync(out!, JSON.stringify({ tally: o, samples }, null, 1));
