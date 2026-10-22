/**
 * PLAN 7.81b: the moving capital. Every `CapitalCaptured` and `CapitalMoved`, from 1938 (`seed:run:Y`,
 * Y years, as `npm run sim` steps) or from a saved state (`seed:state.bin:D`, D days). Per world:
 * captures, moves (to a city, to a field capital), the most captures of one nation within 30 days and
 * the cases of three or more. Per move: its kind (after a capture the same hour, a field capital, or
 * other: given away, rebels), the gap in cells from the new capital to the nearest cell held by a
 * nation at war with its own (`enemyGap`), and the days it stood before the next move (`stood`).
 * Copied into a worktree to read another commit (it reads the Sim API only).
 *
 * Usage: npx tsx tools/diag/capitalChurn.ts <seed:run:Y | seed:state.bin:D>...   (OUT env: a json file)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { size1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { laneOf, navOf, type World } from '../../src/sim/world';
import { neighbours4 } from '../../src/sim/nav/grid';
import { loadAssets1938 } from '../headless/assets';

const DAY = 24;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const assets = loadAssets1938(size1938(undefined).w);

type Move = { n: number; nation: string; day: number; kind: 'capture' | 'field' | 'other'; city: number; size: number; enemyGap: number; bestCity: number; bestCityMost: number; bestCell: number; held: number; stood: number };
type Capture = { loser: number; capturer: number; day: number };

/** Cells from the nearest cell held by a nation at war with `n` (4-neighbour steps over land and sea). */
function enemyDistance(w: World, n: number): Int32Array {
  const { w: cw, h: ch, controller } = w.cells;
  const dist = new Int32Array(controller.length).fill(-1);
  const queue = new Int32Array(controller.length);
  let tail = 0;
  for (let c = 0; c < controller.length; c++) {
    const k = controller[c]!;
    if (k !== 0 && k !== n && w.wars.atWar(n, k)) {
      dist[c] = 0;
      queue[tail++] = c;
    }
  }
  const nb: number[] = [];
  for (let head = 0; head < tail; head++) {
    const c = queue[head]!;
    for (const m of neighbours4(c, cw, ch, w.settings.loopingMap, nb)) {
      if (dist[m] !== -1) continue;
      dist[m] = dist[c]! + 1;
      queue[tail++] = m;
    }
  }
  return dist;
}

const rows: unknown[] = [];
for (const arg of process.argv.slice(2)) {
  const [seedS, src, spanS] = arg.split(':');
  const seed = Number(seedS);
  const sim = new Sim({ scenario: '1938', seed, assets });
  const world = sim.world;
  let hours: number;
  if (src === 'run') {
    if (world.ports.length > 0 && world.seaSeeds.length > 0) laneOf(world);
    hours = Number(spanS) * 365 * DAY;
  } else {
    sim.load(new Uint8Array(readFileSync(src!)));
    hours = Number(spanS) * DAY;
  }
  const t0 = world.tick;
  const moves: Move[] = [];
  const caps: Capture[] = [];
  const last = new Map<number, Move>();
  const read = (w: World): void => {
    const ev = w.out.events;
    const day = Math.floor((w.tick - t0) / DAY);
    const capturedNow = new Set<number>();
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] === EventKind.CapitalCaptured) {
        caps.push({ loser: ev[i + 2]!, capturer: ev[i + 3]!, day });
        capturedNow.add(ev[i + 2]!);
      }
    }
    for (let i = 0; i < ev.length; i += 6) {
      if (ev[i + 1] !== EventKind.CapitalMoved) continue;
      const n = ev[i + 2]!;
      const city = ev[i + 3]!;
      const { w: cw, owner, controller } = w.cells;
      const dist = enemyDistance(w, n);
      const comp = navOf(w).grid.component;
      const gap = (c: number): number => (dist[c]! < 0 ? 9999 : dist[c]!);
      // The land it holds most of (ADR-620's), the best city there and anywhere, the best held cell.
      const count = new Map<number, number>();
      let held = 0;
      let bestCell = -1;
      for (let c = 0; c < owner.length; c++) {
        if (controller[c] !== n) continue;
        held++;
        if (gap(c) > bestCell) bestCell = gap(c);
        if (owner[c] === n && comp[c] !== 0) count.set(comp[c]!, (count.get(comp[c]!) ?? 0) + 1);
      }
      let most = -1;
      let mostCells = 0;
      for (const [l, k] of count) if (k > mostCells || (k === mostCells && l < most)) [most, mostCells] = [l, k];
      let bestCity = -1;
      let bestCityMost = -1;
      const cc = w.cities.cols;
      w.cities.forEach((id) => {
        const cell = cc.cell[id]!;
        if (owner[cell] !== n || controller[cell] !== n || (cc.capitalOf[id] !== 0 && cc.capitalOf[id] !== n)) return;
        bestCity = Math.max(bestCity, gap(cell));
        if (comp[cell] === most) bestCityMost = Math.max(bestCityMost, gap(cell));
      });
      const x = Math.floor(ev[i + 4]!);
      const y = Math.floor(ev[i + 5]!);
      const m: Move = {
        n,
        nation: tag(n),
        day,
        kind: capturedNow.has(n) ? 'capture' : city === 0 ? 'field' : 'other',
        city,
        size: city !== 0 ? cc.size[city]! : 0,
        enemyGap: gap(city !== 0 ? cc.cell[city]! : y * cw + x),
        bestCity,
        bestCityMost,
        bestCell,
        held,
        stood: -1,
      };
      const prev = last.get(n);
      if (prev) prev.stood = day - prev.day;
      last.set(n, m);
      moves.push(m);
    }
    ev.length = 0;
    w.out.fires.length = 0;
  };
  while (world.tick - t0 < hours) sim.step(1, read);
  // The most captures of one nation within 30 days, and the cases of three or more.
  const byLoser = new Map<number, number[]>();
  for (const c of caps) {
    const l = byLoser.get(c.loser) ?? [];
    l.push(c.day);
    byLoser.set(c.loser, l);
  }
  let most30 = 0;
  const thrice: string[] = [];
  for (const [n, days] of byLoser) {
    for (let i = 0; i < days.length; i++) {
      let j = i;
      while (j + 1 < days.length && days[j + 1]! - days[i]! < 30) j++;
      const k = j - i + 1;
      if (k > most30) most30 = k;
      if (k >= 3) {
        thrice.push(`${tag(n)} d${days.slice(i, j + 1).join(',')}`);
        i = j; // the next window starts after this one
      }
    }
  }
  const kinds = { capture: 0, field: 0, other: 0 };
  for (const m of moves) kinds[m.kind]++;
  const quick = moves.filter((m) => m.stood >= 0 && m.stood < 30);
  const row = {
    seed,
    src,
    span: spanS,
    captures: caps.length,
    moves: moves.length,
    kinds,
    most30,
    thrice: [...new Set(thrice)].slice(0, 20),
    movedAgainIn30: quick.length,
    movedAgainIn30ByKind: { capture: quick.filter((m) => m.kind === 'capture').length, field: quick.filter((m) => m.kind === 'field').length, other: quick.filter((m) => m.kind === 'other').length },
    medianGapCapture: median(moves.filter((m) => m.kind === 'capture').map((m) => m.enemyGap)),
    medianGapField: median(moves.filter((m) => m.kind === 'field').map((m) => m.enemyGap)),
    saferPassed: {
      capture: moves.filter((m) => m.kind === 'capture' && m.city !== 0 && m.bestCityMost > m.enemyGap + 5).length,
      captureCities: moves.filter((m) => m.kind === 'capture' && m.city !== 0).length,
      field: moves.filter((m) => m.city === 0 && m.bestCell > m.enemyGap + 5).length,
      fieldAll: moves.filter((m) => m.city === 0).length,
    },
    topMovers: [...countBy(moves.map((m) => m.nation))].sort((a, b) => b[1] - a[1]).slice(0, 5),
    moveList: process.env.LIST ? moves : undefined,
  };
  rows.push(row);
  console.log(JSON.stringify({ ...row, moveList: undefined }));
}
function median(a: number[]): number {
  if (a.length === 0) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
}
function countBy(a: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of a) m.set(x, (m.get(x) ?? 0) + 1);
  return m;
}
if (process.env.OUT) writeFileSync(process.env.OUT, JSON.stringify(rows, null, 1));
process.stderr.write('done:\n');
