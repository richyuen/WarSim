/**
 * PLAN 7.90f: a ferry turn's free army, where it can go aboard. From a saved state and a
 * `ferryTurns.ts` output (its first row's turns), stepped to the day of the turn `day`: for each
 * formation of that turn's free army (`island`), its cell, landmass, holder and strength, and the
 * six ports of the nation nearest it on its land (straight cells) with whether it may march to each
 * (as `marches` in `ai/invasion.ts` asks: `NO` refused). Read only.
 *
 * Usage: npx tsx tools/diag/ferryFree.ts <seed> <state.bin> <TAG> <turns.json> <day>
 */
import { readFileSync } from 'node:fs';
import type { FerryTurn } from '../../src/sim/ai/invasion';
import type { MobilityId } from '../../src/sim/nav/grid';
import { findRoute } from '../../src/sim/nav/provinceGraph';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { passageOf, snapTarget } from '../../src/sim/systems/movement';
import { navOf, portSeaOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const [seedS, bin, tag, turnsPath, dayS] = process.argv.slice(2);
const day = Number(dayS);
const rows = JSON.parse(readFileSync(turnsPath!, 'utf8')) as { turns: (FerryTurn & { day: number })[] }[];
const turn = rows[0]!.turns.find((t) => t.day === day);
if (!turn) throw new Error(`no ferry turn on day ${day} in ${turnsPath}`);
const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
s.load(new Uint8Array(readFileSync(bin!)));
const quiet = (ww: typeof s.world): void => {
  ww.out.events.length = 0;
  ww.out.fires.length = 0;
};
// The turn is taken in the day's step: stop at its start.
while (s.world.tick / 24 < day) s.step(24, quiet);
const w = s.world;
const W = w.cells.w;
const c = w.formations.cols;
const ctl = w.cells.controller;
const n = TAGS_1938.indexOf(tag!) + 1;
const nav = navOf(w);
const comp = nav.grid.component;
const water = portSeaOf(w);
const pass = passageOf(w, n);
const cellOf = (id: number): number => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
const steps = (a: number, b: number): number => {
  let dx = Math.abs((a % W) - (b % W));
  if (w.settings.loopingMap && dx > W / 2) dx = W - dx;
  return dx + Math.abs(Math.floor(a / W) - Math.floor(b / W));
};
console.log(`day ${w.tick / 24} ${tag}: free ${turn.island.length}`);
let men = 0;
for (const id of turn.island) {
  const k = cellOf(id);
  men += c.strength[id]!;
  const ports: [number, number][] = [];
  w.ports.forEach((p, i) => {
    if (water[i]! >= 0 && ctl[p.cell] === n && comp[p.cell] === comp[k]) ports.push([steps(p.cell, k), i]);
  });
  ports.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const rule = w.rules!.templates[c.template[id]!]!;
  const each = ports.slice(0, 6).map(([d, i]) => {
    const cell = w.ports[i]!.cell;
    const goal = snapTarget(w, k, cell % W, Math.floor(cell / W));
    const ok = goal >= 0 && findRoute(nav.grid, nav.graph, rule.mobility as MobilityId, k, goal, pass) !== null;
    return `${w.ports[i]!.name} ${d}${ok ? '' : ' NO'}`;
  });
  console.log(`${id} (${k % W},${Math.floor(k / W)}) land ${comp[k]} holder ${TAGS_1938[ctl[k]! - 1]} strength ${Math.round(c.strength[id]!)}; ports: ${each.join(', ') || 'none'}`);
}
console.log(`men ${Math.round(men)}`);
