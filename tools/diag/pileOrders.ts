/**
 * PLAN 7.79a: why a nation's pile far from its front is not sent there. From a saved state, for
 * `days` days, each plan of nation TAG (`OP_PROBE`): its sectors, those with no formation allotted,
 * its formations near and far, and the asks of the marches from afar (`afar`) with their answers;
 * and, for the formations standing on cell CELL at the start, the asks of any kind.
 *
 * Usage: npx tsx tools/diag/pileOrders.ts <seed:state.bin> <TAG> <cell> <days> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { OP_PROBE, type AskTimes, type PlanTimes, type SectorsSeen } from '../../src/sim/ai/operational';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { loadAssets1938 } from '../headless/assets';

const [seed, bin] = process.argv[2]!.split(':');
const who = TAGS_1938.indexOf(process.argv[3]!) + 1;
const cell = Number(process.argv[4]);
const days = Number(process.argv[5]);
const out = process.argv[6]!;
const s = new Sim({ scenario: '1938', seed: Number(seed), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const w = s.world;
const c = w.formations.cols;
const cw = w.cells.w;
const pile = new Set<number>();
w.formations.forEach((id) => {
  if (c.nation[id] === who && !w.isFleet(id) && !w.isWing(id) && Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!) === cell) pile.add(id);
});
let tick = 0;
const plans: { day: number; sectors: number; empty: number; threatened: number; near: number; far: number; mine: number; afarAsks: Record<string, number>; pileAsks: Record<string, number>; why?: SectorsSeen['empty'] }[] = [];
let cur: (typeof plans)[number] | undefined;
OP_PROBE.now = () => 0;
OP_PROBE.plan = (p: PlanTimes) => {
  if (p.nation !== who) return;
  if (cur) {
    cur.near = p.near;
    cur.far = p.far;
    cur.mine = p.mine;
  }
};
OP_PROBE.sectors = (p: SectorsSeen) => {
  if (p.nation !== who) return;
  cur = { day: Math.floor(p.tick / 24), sectors: p.sectors.length, empty: p.sectors.filter((x) => x.n === 0).length, threatened: p.sectors.filter((x) => x.threat > 0).length, near: 0, far: 0, mine: 0, afarAsks: {}, pileAsks: {}, why: p.empty };
  plans.push(cur);
};
OP_PROBE.ask = (a: AskTimes) => {
  if (c.nation[a.id] !== who || !cur) return;
  if (a.afar) cur.afarAsks[a.answer] = (cur.afarAsks[a.answer] ?? 0) + 1;
  if (pile.has(a.id)) cur.pileAsks[a.answer] = (cur.pileAsks[a.answer] ?? 0) + 1;
};
const quiet = (ww: typeof w): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
for (let d = 0; d < days; d++) {
  s.step(24, quiet);
  tick = w.tick;
}
const still = [...pile].filter((id) => w.formations.has(id) && Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!) === cell).length;
writeFileSync(out, JSON.stringify({ seed, bin, tag: process.argv[3], cell, days, tick, pile: pile.size, stillThere: still, plans }, null, 1));
console.log(`done: pile ${pile.size}, still there ${still}, plans ${plans.length} -> ${out}`);
