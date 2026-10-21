/**
 * PLAN 7.49's measure: what holds each land formation of a nation at war. From a saved state, on
 * the day after it (`s.step(24)`, then a second day for the march), each land formation of a
 * living nation at war, in the first of these states:
 * - engaged (`engaged`);
 * - retreat (`retreat`), home (`home`), aboard (`offLand`);
 * - attack / hold / elsewhere: on the march (`moving`), its target held by an enemy of its nation,
 *   by its nation or its side, or by another; "stalled" too when it moved under a tenth of a cell
 *   in the day after;
 * - noFront: its nation has no front cell in any of its wars (`frontierOf`'s cells held by it or a
 *   nation on its side, beside an enemy of it that the holder fights too: the operational AI's);
 * - island: it stands on a landmass (`navOf(...).grid.component`) with none of those cells;
 * - near: standing, within DEPLOY_RANGE_CELLS (this map's) of one on its landmass (a reserve, a
 *   hold reached, or a class that reaches none of the sectors);
 * - far: standing, beyond it.
 * Also the day's flips (cells whose controller changed to an enemy of the holder before): those
 * with a formation of the old holder or its side within WALK_CELLS (cells of the default size) of
 * the cell, and those with none (a walk-in).
 *
 * Usage: npx tsx tools/diag/landStates.ts <out.json> <seed:state.bin | seed:1938@days> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const WALK_CELLS = 6;
const STATES = ['engaged', 'retreat', 'home', 'aboard', 'attack', 'hold', 'elsewhere', 'noFront', 'island', 'near', 'far'] as const;
type State = (typeof STATES)[number];
const out = process.argv[2]!;
const cases = process.argv.slice(3).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const rows: unknown[] = [];
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  if (src.startsWith('1938@')) for (let d = Number(src.slice(5)); d > 0; d--) s.step(24, quiet);
  else s.load(new Uint8Array(readFileSync(src)));
  s.step(24, quiet);
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const { w: cw, h: ch, controller: ctl } = w.cells;
  const loop = w.settings.loopingMap;
  const comp = navOf(w).grid.component;
  const range = w.atSize(DEPLOY_RANGE_CELLS);
  const bs = Math.max(1, Math.ceil(range));
  const bw = Math.ceil(cw / bs);
  const fighting = [...w.wars.nations()].filter((n) => nat.living[n] === 1);
  const nb: number[] = [];
  const frontier = [...frontierOf(w)];
  // Each nation's front cells, bucketed by the range, and the landmasses they are on.
  const fronts = new Map<number, { buckets: Map<number, number[]>; lands: Set<number>; cells: number }>();
  for (const n of fighting) {
    const buckets = new Map<number, number[]>();
    const lands = new Set<number>();
    let cells = 0;
    for (const cell of frontier) {
      const h = ctl[cell]!;
      if (h !== n && !w.wars.sameSide(h, n)) continue;
      let on = false;
      for (const k of neighbours4(cell, cw, ch, loop, nb)) {
        const e = ctl[k]!;
        if (w.wars.atWar(n, e) && (h === n || w.wars.atWar(h, e))) on = true;
      }
      if (!on) continue;
      cells++;
      lands.add(comp[cell]!);
      const key = Math.floor(Math.floor(cell / cw) / bs) * bw + Math.floor((cell % cw) / bs);
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = []));
      b.push(cell);
    }
    fronts.set(n, { buckets, lands, cells });
  }
  const nearFront = (n: number, x: number, y: number, land: number): boolean => {
    const fr = fronts.get(n)!;
    const bx = Math.floor(x / bs);
    const by = Math.floor(y / bs);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        let kx = bx + dx;
        if (kx < 0 || kx >= bw) {
          if (!loop) continue;
          kx = (kx + bw) % bw;
        }
        for (const cell of fr.buckets.get((by + dy) * bw + kx) ?? []) {
          if (comp[cell] !== land) continue;
          let ddx = Math.abs((cell % cw) + 0.5 - x);
          if (loop && ddx > cw / 2) ddx = cw - ddx;
          if (Math.max(ddx, Math.abs(Math.floor(cell / cw) + 0.5 - y)) <= range) return true;
        }
      }
    return false;
  };
  const fset = new Set(fighting);
  const state = new Map<number, State>();
  const pos = new Map<number, [number, number]>();
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id)) return;
    const n = c.nation[id]!;
    if (!fset.has(n)) return;
    const x = c.x[id]!;
    const y = c.y[id]!;
    pos.set(id, [x, y]);
    let st: State;
    if (w.offLand(id)) st = 'aboard';
    else if (c.engaged[id] === 1) st = 'engaged';
    else if (c.retreat[id] !== 0) st = 'retreat';
    else if (c.home[id] !== 0) st = 'home';
    else if (c.moving[id] === 1) {
      const h = ctl[c.targetCell[id]!]!;
      st = w.wars.atWar(n, h) ? 'attack' : h === n || w.wars.sameSide(n, h) ? 'hold' : 'elsewhere';
    } else {
      const fr = fronts.get(n)!;
      const land = comp[Math.floor(y) * cw + Math.floor(x)]!;
      st = fr.cells === 0 ? 'noFront' : !fr.lands.has(land) ? 'island' : nearFront(n, x, y, land) ? 'near' : 'far';
    }
    state.set(id, st);
  });
  // The second day: the marches' progress and the flips.
  const before = ctl.slice();
  s.step(24, quiet);
  const counts: Record<string, number> = Object.fromEntries(STATES.map((k) => [k, 0]));
  let stalled = 0;
  let marching = 0;
  for (const [id, st] of state) {
    counts[st]!++;
    if ((st === 'attack' || st === 'hold' || st === 'elsewhere') && w.formations.has(id)) {
      marching++;
      const [x, y] = pos.get(id)!;
      if (Math.hypot(c.x[id]! - x, c.y[id]! - y) < 0.1 * w.sizeScale) stalled++;
    }
  }
  // Flips: by whether a formation of the old holder's side stood within WALK_CELLS.
  const walk = w.atSize(WALK_CELLS);
  const landNow: { id: number; n: number; x: number; y: number }[] = [];
  w.formations.forEach((id) => {
    if (!w.isFleet(id) && !w.isWing(id) && !w.offLand(id)) landNow.push({ id, n: c.nation[id]!, x: c.x[id]!, y: c.y[id]! });
  });
  let flips = 0;
  let walkIns = 0;
  for (let cell = 0; cell < ctl.length; cell++) {
    const was = before[cell]!;
    const now = ctl[cell]!;
    if (was === now || was === 0 || now === 0 || !w.wars.atWar(was, now)) continue;
    flips++;
    const x = (cell % cw) + 0.5;
    const y = Math.floor(cell / cw) + 0.5;
    let held = false;
    for (const f of landNow) {
      if (f.n !== was && !w.wars.sameSide(f.n, was)) continue;
      let dx = Math.abs(f.x - x);
      if (loop && dx > cw / 2) dx = cw - dx;
      if (Math.hypot(dx, f.y - y) <= walk) {
        held = true;
        break;
      }
    }
    if (!held) walkIns++;
  }
  // The largest piles of standing formations (island, far, near, noFront) by nation and cell.
  const piles = new Map<string, number>();
  for (const [id, st] of state) {
    if (st !== 'island' && st !== 'far' && st !== 'near' && st !== 'noFront') continue;
    const [x, y] = pos.get(id)!;
    const k = `${tag(c.nation[id] ?? 0)} ${st} ${Math.floor(x)},${Math.floor(y)}`;
    piles.set(k, (piles.get(k) ?? 0) + 1);
  }
  const row = {
    seed,
    src,
    day: Math.floor(w.tick / 24),
    formations: state.size,
    states: counts,
    marching,
    stalled,
    flips,
    walkIns,
    nationsAtWar: fighting.length,
    noFrontNations: fighting.filter((n) => fronts.get(n)!.cells === 0).length,
    piles: [...piles.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  };
  rows.push(row);
  process.stderr.write(`${seed} ${src}: ${JSON.stringify(counts)} stalled ${stalled}/${marching} flips ${flips} walk-ins ${walkIns}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
