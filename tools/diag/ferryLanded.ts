/**
 * PLAN 7.49d1's follow: where the ferried formations land and what becomes of them. From each saved
 * state, for `days` days: each formation that goes aboard (`FormationEmbarked`) and lands
 * (`FormationLanded`) on a landmass with a front cell of its nation's (one it holds beside a cell
 * of a nation at war with it), the straight cells from its landing to the nearest such cell; then
 * daily, whether it is engaged, and on the last day its cells from that front.
 *
 * Usage: npx tsx tools/diag/ferryLanded.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { EventKind } from '../../src/shared/events';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, src] = a.split(':');
  return { seed: Number(seed), src: src! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const rows: unknown[] = [];
let all = { landed: 0, onFrontLand: 0, engagedEver: 0, within60: 0, within60Last: 0 };
for (const { seed, src } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  s.load(new Uint8Array(readFileSync(src)));
  const c = w.formations.cols;
  const { w: cw, h: ch } = w.cells;
  const comp = navOf(w).grid.component;
  const nb: number[] = [];
  /** The front cells each nation holds itself. */
  const fronts = (): Map<number, number[]> => {
    const m = new Map<number, number[]>();
    const ctl = w.cells.controller;
    for (const k of frontierOf(w)) {
      const a = ctl[k]!;
      if (a === 0) continue;
      for (const q of neighbours4(k, cw, ch, w.settings.loopingMap, nb)) {
        const b = ctl[q]!;
        if (b !== 0 && b !== a && w.wars.atWar(a, b)) {
          (m.get(a) ?? m.set(a, []).get(a)!).push(k);
          break;
        }
      }
    }
    return m;
  };
  /** Straight cells from formation `id` to the nearest front cell of its nation on its land; -1 for none. */
  const toFront = (fr: Map<number, number[]>, id: number): number => {
    const at = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
    let best = -1;
    for (const k of fr.get(c.nation[id]!) ?? []) {
      if (comp[k] !== comp[at]) continue;
      let dx = Math.abs((k % cw) - (at % cw));
      if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
      const d = Math.hypot(dx, Math.floor(k / cw) - Math.floor(at / cw));
      if (best < 0 || d < best) best = d;
    }
    return best;
  };
  const boarded = new Set<number>();
  const landed = new Map<number, { nation: string; day: number; port: string; cellsToFront: number; engagedDays: number; lastCells: number; alive: boolean }>();
  for (let d = 1; d <= days; d++) {
    const got: number[] = [];
    s.step(24, (ww) => {
      const ev = ww.out.events;
      for (let i = 0; i < ev.length; i += 6) {
        if (ev[i + 1] === EventKind.FormationEmbarked) boarded.add(ev[i + 2]!);
        if (ev[i + 1] === EventKind.FormationLanded && boarded.has(ev[i + 2]!)) got.push(ev[i + 2]!);
      }
      ww.out.events.length = 0;
      ww.out.fires.length = 0;
    });
    const fr = fronts();
    for (const id of got) {
      if (!w.formations.has(id)) continue;
      const at = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
      const p = w.ports.find((q) => Math.abs((q.cell % cw) - (at % cw)) <= 8 && Math.abs(Math.floor(q.cell / cw) - Math.floor(at / cw)) <= 8);
      landed.set(id, { nation: tag(c.nation[id]!), day: d, port: p?.name ?? '?', cellsToFront: Math.round(toFront(fr, id)), engagedDays: 0, lastCells: -1, alive: true });
    }
    for (const [id, l] of landed) {
      if (!w.formations.has(id)) {
        l.alive = false;
        continue;
      }
      if (c.engaged[id] === 1) l.engagedDays++;
      if (d === days) l.lastCells = Math.round(toFront(fr, id));
    }
  }
  const list = [...landed.values()];
  const row = {
    seed,
    src,
    landed: list.length,
    onFrontLand: list.filter((l) => l.cellsToFront >= 0).length,
    engagedEver: list.filter((l) => l.engagedDays > 0).length,
    within60: list.filter((l) => l.cellsToFront >= 0 && l.cellsToFront <= 60).length,
    within60Last: list.filter((l) => l.lastCells >= 0 && l.lastCells <= 60).length,
    list,
  };
  all = { landed: all.landed + row.landed, onFrontLand: all.onFrontLand + row.onFrontLand, engagedEver: all.engagedEver + row.engagedEver, within60: all.within60 + row.within60, within60Last: all.within60Last + row.within60Last };
  rows.push(row);
  const by = new Map<string, number>();
  for (const l of list) by.set(`${l.nation}@${l.port}(${l.cellsToFront})`, (by.get(`${l.nation}@${l.port}(${l.cellsToFront})`) ?? 0) + 1);
  console.log(`${seed} ${src}: landed ${row.landed}, on a front's land ${row.onFrontLand}, within 60 cells of the front at landing ${row.within60}, on day ${days} ${row.within60Last}, engaged ever ${row.engagedEver}; ${[...by].map(([k, v]) => `${k}×${v}`).join(' ')}`);
}
writeFileSync(out, JSON.stringify({ all, rows }, null, 1));
console.log(`done: ${cases.length} -> ${out}; ${JSON.stringify(all)}`);
