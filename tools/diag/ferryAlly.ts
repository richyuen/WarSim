/**
 * PLAN 7.49d2's trace: what holds the island formations of nations with no port of their own on a
 * landmass of their front (`islandArmies.ts`'s `noOwnPort`). From each saved state, after one day
 * (as `islandArmies.ts` reads day 1), each such formation is put under the first of:
 * - `noOwnFront`: its nation holds no front cell itself (its land front is an ally's alone): the
 *   ferry (`planFerry`) takes a nation with front cells of its own;
 * - `noTransports`: its nation has no transport group with room;
 * - `notAtPort`: its transport groups, none standing at a port of its own (`transportsAtPort`'s test);
 * - `noAllyPort`: no port of a nation fighting beside it (`sameSide`, with water) on a land of its
 *   own front cells;
 * - `allyPort`: one there (the ferry may take it, the sea's tests aside).
 * Per class, the formations and the nations (with their counts).
 *
 * Usage: npx tsx tools/diag/ferryAlly.ts <out.json> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { transportRoom } from '../../src/sim/systems/amphibious';
import { AT_PORT_CELLS } from '../../src/sim/systems/navalCombat';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf, portSeaOf, seaRangeOf, type World } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const cases = process.argv.slice(3).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const CLASSES = ['noOwnFront', 'noTransports', 'notAtPort', 'noAllyPort', 'allyPort'] as const;
type Cls = (typeof CLASSES)[number];
const near = (world: World, a: number, b: number, r: number): boolean => {
  const ww = world.cells.w;
  let dx = Math.abs((a % ww) - (b % ww));
  if (world.settings.loopingMap && dx > ww / 2) dx = ww - dx;
  return dx <= r && Math.abs(Math.floor(a / ww) - Math.floor(b / ww)) <= r;
};

const totals: Record<Cls, number> = Object.fromEntries(CLASSES.map((k) => [k, 0])) as Record<Cls, number>;
const rows: unknown[] = [];
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  s.load(new Uint8Array(readFileSync(src)));
  s.step(24, (ww) => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  });
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const cw = w.cells.w;
  const comp = navOf(w).grid.component;
  const ctl = w.cells.controller;
  const water = portSeaOf(w);
  const cellOf = (id: number): number => Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
  // Fronts as islandArmies.ts reads them: lands of the front (an ally's cells too) and its own front cells' lands.
  const lands = new Map<number, Set<number>>();
  const own = new Map<number, Set<number>>();
  for (const n of w.wars.nations()) {
    if (nat.living[n] !== 1) continue;
    lands.set(n, new Set());
    own.set(n, new Set());
  }
  const nb: number[] = [];
  for (const cell of frontierOf(w)) {
    const h = ctl[cell]!;
    for (const [n, fl] of lands) {
      if (h !== n && !w.wars.sameSide(h, n)) continue;
      let on = false;
      for (const k of neighbours4(cell, w.cells.w, w.cells.h, w.settings.loopingMap, nb)) {
        const e = ctl[k]!;
        if (w.wars.atWar(n, e) && (h === n || w.wars.atWar(h, e))) on = true;
      }
      if (!on) continue;
      fl.add(comp[cell]!);
      if (h === n) own.get(n)!.add(comp[cell]!);
    }
  }
  const cls = new Map<number, Cls | null>();
  const classOf = (n: number): Cls | null => {
    const o = own.get(n)!;
    const ported = w.ports.some((p, i) => water[i]! >= 0 && ctl[p.cell] === n && o.has(comp[p.cell]!));
    if (ported) return null;
    if (o.size === 0) return 'noOwnFront';
    const groups: number[] = [];
    w.formations.forEach((id) => {
      if (w.isFleet(id) && c.nation[id] === n && transportRoom(w, id) > 0) groups.push(id);
    });
    if (groups.length === 0) return 'noTransports';
    const atPort = groups.some((id) => c.moving[id] !== 1 && c.engaged[id] !== 1 && seaRangeOf(w, id) === undefined && w.ports.some((p, k) => water[k]! >= 0 && ctl[p.cell] === n && near(w, cellOf(id), water[k]!, w.atSize(AT_PORT_CELLS))));
    if (!atPort) return 'notAtPort';
    const ally = w.ports.some((p, i) => water[i]! >= 0 && ctl[p.cell] !== 0 && w.wars.sameSide(n, ctl[p.cell]!) && o.has(comp[p.cell]!));
    return ally ? 'allyPort' : 'noAllyPort';
  };
  const per: Record<Cls, Record<string, number>> = Object.fromEntries(CLASSES.map((k) => [k, {}])) as Record<Cls, Record<string, number>>;
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id)) return;
    const n = c.nation[id]!;
    const fl = lands.get(n);
    if (!fl || fl.size === 0) return;
    if (w.offLand(id) || c.engaged[id] === 1 || c.retreat[id] !== 0 || c.home[id] !== 0 || c.moving[id] === 1) return;
    if (fl.has(comp[cellOf(id)]!)) return;
    if (!cls.has(n)) cls.set(n, classOf(n));
    const k = cls.get(n);
    if (!k) return;
    totals[k]++;
    per[k][tag(n)] = (per[k][tag(n)] ?? 0) + 1;
  });
  rows.push({ seed, src, per });
  process.stderr.write(`${seed} ${src}: ${CLASSES.map((k) => `${k} ${JSON.stringify(per[k])}`).join('; ')}\n`);
}
writeFileSync(out, JSON.stringify({ totals, rows }, null, 1));
console.log(`done: ${rows.length} -> ${out}; ${JSON.stringify(totals)}`);
