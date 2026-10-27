/**
 * PLAN 7.138: whether a nation's land army stands in the province group (`Passage.group`, the
 * provinces it may walk joined by neighbours) of its own front. For each nation at war with a land
 * front: its front cells (its land cells next to an enemy's) by group, and its free land formations
 * by group, those in a group with no front cell of its own counted with the landmass they share
 * with a front cell, and the holders that close the way (those of the cells next to the group's
 * edge on that landmass, by cells).
 *
 * Usage: npx tsx tools/diag/groupSplit.ts <seed> <state.bin|1938> <out.json>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { passageOf } from '../../src/sim/systems/movement';
import { navOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seedArg, bin, out] = process.argv.slice(2);
const s = new Sim({ scenario: '1938', seed: Number(seedArg), assets: loadAssets1938(SIZE_1938.w) });
const w = s.world;
const quiet = (ww: World): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
if (bin === '1938') for (let d = 0; d < 60; d++) s.step(24, quiet);
else s.load(new Uint8Array(readFileSync(bin!)));
s.step(12, quiet);
const tag = (n: number): string => TAGS_1938[n - 1] ?? w.names.get(n) ?? `#${n}`;
const nav = navOf(w);
const land = nav.grid.component;
const nodeOf = nav.graph.nodeOf;
const { w: W, h, controller } = w.cells;
const nb: number[] = [];
const c = w.formations.cols;
const rows: unknown[] = [];
const fighting = w.wars.nations();
let totFree = 0;
let totNoFront = 0;
let totNoFrontSameLand = 0;
for (const n of [...fighting].sort((a, b) => a - b)) {
  const pass = passageOf(w, n);
  const group = pass.group!;
  const gOf = (cell: number): number => (nodeOf[cell] !== 0 && pass.ok[pass.holder[cell]!] === 1 ? group[nodeOf[cell]!]! : -1);
  const frontGroups = new Map<number, number>();
  const frontLands = new Set<number>();
  for (let cell = 0; cell < W * h; cell++) {
    if (controller[cell] !== n || land[cell] === 0) continue;
    let hostile = false;
    for (const q of neighbours4(cell, W, h, w.settings.loopingMap, nb)) if (controller[q] !== 0 && controller[q] !== n && w.wars.atWar(n, controller[q]!)) hostile = true;
    if (!hostile) continue;
    const g = gOf(cell);
    frontGroups.set(g, (frontGroups.get(g) ?? 0) + 1);
    frontLands.add(land[cell]!);
  }
  if (frontGroups.size === 0) continue;
  let free = 0;
  let noFront = 0;
  let noFrontSameLand = 0;
  const groups = new Map<number, number>();
  w.formations.forEach((id) => {
    if (c.nation[id] !== n || w.isFleet(id) || w.isWing(id) || w.embarked.has(id) || w.offLand(id)) return;
    if (c.engaged[id] === 1 || c.retreat[id] !== 0 || c.home[id] !== 0) return;
    free++;
    const cell = Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
    const g = gOf(cell);
    groups.set(g, (groups.get(g) ?? 0) + 1);
    if (frontGroups.has(g)) return;
    noFront++;
    if (frontLands.has(land[cell]!)) noFrontSameLand++;
  });
  totFree += free;
  totNoFront += noFront;
  totNoFrontSameLand += noFrontSameLand;
  if (free >= 5) rows.push({ nation: tag(n), free, noFront, noFrontSameLand, frontGroups: Object.fromEntries(frontGroups), armyGroups: Object.fromEntries(groups) });
}
const summary = { totFree, totNoFront, totNoFrontSameLand };
process.stderr.write(JSON.stringify(summary) + '\n');
for (const r of rows) process.stderr.write(JSON.stringify(r) + '\n');
writeFileSync(out!, JSON.stringify({ summary, rows }, null, 1));
