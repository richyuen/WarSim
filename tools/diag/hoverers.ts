/**
 * PLAN 7.116b's measure: the land formations of nations at war that stand or move 1.5–12 cells
 * from an enemy land formation on their landmass and are not in contact (not engaged, not on the
 * retreat). From a saved state (or from 1938 after `@days`), daily for `days` days (after each
 * day's 24 hours): each such formation by what it does (`attack`: moving to an enemy's cell;
 * `march`: moving to a cell of its side; `stand`: not moving, on a front cell (`front`, a cell
 * touching an enemy's) or behind it), its nearest enemy's distance (4, 8, 12), what that enemy
 * does (the same, and `engaged`, `retreat`), the straight distance of its target cell from that
 * enemy (whether the order aims at it: within 2 cells).
 *
 * Usage: npx tsx tools/diag/hoverers.ts <out.json> <days> <seed:state.bin | seed:1938@days> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 10);
const rows: unknown[] = [];
const inc = (o: Record<string, number>, k: string, by = 1): void => {
  o[k] = (o[k] ?? 0) + by;
};
for (const a of process.argv.slice(4)) {
  const [seedS, src] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  if (src!.startsWith('1938@')) for (let d = Number(src!.slice(5)); d > 0; d--) s.step(24, quiet);
  else s.load(new Uint8Array(readFileSync(src!)));
  const what: Record<string, number> = {};
  const byDist: Record<string, number> = {};
  const foe: Record<string, number> = {};
  const aim: Record<string, number> = {};
  const standFoe: Record<string, number> = {};
  let n = 0;
  let free = 0;
  let engaged = 0;
  const nb: number[] = [];
  for (let d = 0; d < days; d++) {
    s.step(24, quiet);
    const c = w.formations.cols;
    const nat = w.nations.cols;
    const cw = w.cells.w;
    const ch = w.cells.h;
    const loop = w.settings.loopingMap;
    const comp = navOf(w).grid.component;
    const ctl = w.cells.controller;
    const scale = w.atSize(1);
    const atWar = w.wars.nations();
    type F = { id: number; n: number; x: number; y: number; land: number };
    const all: F[] = [];
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      const k = c.nation[id]!;
      if (nat.living[k] !== 1 || !atWar.has(k)) return;
      all.push({ id, n: k, x: c.x[id]!, y: c.y[id]!, land: comp[Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!)]! });
    });
    const dxy = (ax: number, ay: number, bx: number, by: number): number => {
      let dx = Math.abs(ax - bx);
      if (loop && dx > cw / 2) dx = cw - dx;
      return Math.hypot(dx, ay - by) / scale;
    };
    const doing = (id: number): string => {
      if (c.engaged[id] === 1) return 'engaged';
      if (c.retreat[id]! > 0) return 'retreat';
      if (c.moving[id] !== 1) return 'stand';
      return w.wars.atWar(c.nation[id]!, ctl[c.targetCell[id]!]!) ? 'attack' : 'march';
    };
    for (const f of all) {
      if (c.engaged[f.id] === 1) {
        engaged++;
        continue;
      }
      if (c.retreat[f.id]! > 0) continue;
      free++;
      let best: F | null = null;
      let bd = Infinity;
      for (const g of all)
        if (g.land === f.land && w.wars.atWar(f.n, g.n)) {
          const dd = dxy(f.x, f.y, g.x, g.y);
          if (dd < bd) {
            bd = dd;
            best = g;
          }
        }
      if (!best || bd <= 1.5 || bd > 12) continue;
      n++;
      let k = doing(f.id);
      if (k === 'stand') {
        const here = Math.floor(f.y) * cw + Math.floor(f.x);
        neighbours4(here, cw, ch, loop, nb);
        k = nb.some((m) => w.wars.atWar(f.n, ctl[m]!)) ? 'standFront' : 'standBehind';
        inc(standFoe, `${k}:${doing(best.id)}`);
      }
      inc(what, k);
      inc(byDist, bd <= 4 ? '4' : bd <= 8 ? '8' : '12');
      inc(foe, doing(best.id));
      if (c.moving[f.id] === 1) {
        const t = c.targetCell[f.id]!;
        const td = dxy((t % cw) + 0.5, Math.floor(t / cw) + 0.5, best.x, best.y);
        inc(aim, `${k}:${td <= 2 ? 'atFoe' : td < bd ? 'toward' : 'away'}`);
      }
    }
  }
  const per = (o: Record<string, number>): Record<string, number> => Object.fromEntries(Object.entries(o).sort().map(([k, v]) => [k, Math.round((v / days) * 10) / 10]));
  const row = {
    seed: Number(seedS), src, day: Math.floor(w.tick / 24), days,
    hoverersADay: Math.round((n / days) * 10) / 10, freeADay: Math.round(free / days), engagedADay: Math.round((engaged / days) * 10) / 10,
    doing: per(what), nearest: per(byDist), foeDoing: per(foe), standFoe: per(standFoe), aim: per(aim),
  };
  rows.push(row);
  process.stderr.write(`${JSON.stringify(row)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
