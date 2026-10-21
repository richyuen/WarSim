/**
 * PLAN 7.49: which wars could have land contact. From a saved state, daily for `days` days, per war
 * running: each side's land formations (of its living nations, on land, not aboard) and men, those
 * within DEPLOY_RANGE_CELLS (this map's) of the war's front (the cells of one side beside a cell of
 * the other, `frontierOf`), the front's cells, and the war's engaged land formations (`engaged`,
 * of a nation of the war). A war is "armed" on a day when each side has at least ARMED formations
 * within the range of its front. Per save: the means over the days, worldwide (engaged formations,
 * wars, armed wars, engaged in armed wars), and the wars by their mean.
 *
 * Usage: npx tsx tools/diag/warSides.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { loadAssets1938 } from '../headless/assets';

const ARMED = 5;
const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin] = a.split(':');
  return { seed: Number(seed), bin: bin! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
type WarDay = { a: number; d: number; aNear: number; dNear: number; front: number; engaged: number; gap: number[]; gapStill: number[] };
/** Bins of the gap to the nearest enemy formation, cells of the map's default size: up to 1.5 (contact), 3, 6, 15, beyond. */
const GAPS = [1.5, 3, 6, 15];
const result: unknown[] = [];
for (const { seed, bin } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  if (bin !== '1938') s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const { w: cw, h: ch } = w.cells;
  const range = w.atSize(DEPLOY_RANGE_CELLS);
  const bs = Math.max(1, Math.ceil(range));
  const bw = Math.ceil(cw / bs);
  const byWar = new Map<number, { name: string; days: WarDay[] }>();
  const world: { engaged: number; wars: number; armed: number; engagedArmed: number; landAtWar: number }[] = [];
  for (let d = 0; d < days; d++) {
    s.step(24, quiet);
    const c = w.formations.cols;
    const nat = w.nations.cols;
    const frontier = frontierOf(w);
    const ctl = w.cells.controller;
    const nb: number[] = [];
    const land: number[] = [];
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.isWing(id) && !w.offLand(id)) land.push(id);
    });
    const fighting = w.wars.nations();
    const day = { engaged: 0, wars: 0, armed: 0, engagedArmed: 0, landAtWar: 0 };
    for (const id of land) {
      if (!fighting.has(c.nation[id]!)) continue;
      day.landAtWar++;
      if (c.engaged[id] === 1) day.engaged++;
    }
    for (const war of w.wars.list) {
      day.wars++;
      const A = new Set(war.sides[0].filter((n) => nat.living[n] === 1));
      const D = new Set(war.sides[1].filter((n) => nat.living[n] === 1));
      // The front's cells, bucketed by the range.
      const buckets = new Map<number, number[]>();
      let front = 0;
      for (const cell of frontier) {
        const h = ctl[cell]!;
        const mine = A.has(h) ? D : D.has(h) ? A : null;
        if (!mine) continue;
        let touches = false;
        for (const k of neighbours4(cell, cw, ch, w.settings.loopingMap, nb)) if (mine.has(ctl[k]!)) touches = true;
        if (!touches) continue;
        front++;
        const key = Math.floor(Math.floor(cell / cw) / bs) * bw + Math.floor((cell % cw) / bs);
        let b = buckets.get(key);
        if (!b) buckets.set(key, (b = []));
        b.push(cell);
      }
      const near = (x: number, y: number): boolean => {
        const bx = Math.floor(x / bs);
        const by = Math.floor(y / bs);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            let kx = bx + dx;
            if (kx < 0 || kx >= bw) {
              if (!w.settings.loopingMap) continue;
              kx = (kx + bw) % bw;
            }
            const b = buckets.get((by + dy) * bw + kx);
            if (!b) continue;
            for (const cell of b) {
              let ddx = Math.abs((cell % cw) + 0.5 - x);
              if (w.settings.loopingMap && ddx > cw / 2) ddx = cw - ddx;
              if (Math.max(ddx, Math.abs(Math.floor(cell / cw) + 0.5 - y)) <= range) return true;
            }
          }
        return false;
      };
      const wd: WarDay = { a: 0, d: 0, aNear: 0, dNear: 0, front, engaged: 0, gap: [0, 0, 0, 0, 0], gapStill: [0, 0, 0, 0, 0] };
      const sideOf = (n: number): number => (A.has(n) ? 0 : D.has(n) ? 1 : -1);
      const ofWar = land.filter((id) => sideOf(c.nation[id]!) >= 0);
      for (const id of land) {
        const n = c.nation[id]!;
        const side = A.has(n) ? 0 : D.has(n) ? 1 : -1;
        if (side < 0) continue;
        if (side === 0) wd.a++;
        else wd.d++;
        if (c.engaged[id] === 1) wd.engaged++;
        if (front > 0 && near(c.x[id]!, c.y[id]!)) {
          if (side === 0) wd.aNear++;
          else wd.dNear++;
          // The gap to the nearest formation of the other side, in cells of the default size.
          let g = Infinity;
          for (const o of ofWar) {
            if (sideOf(c.nation[o]!) === side) continue;
            let dx = Math.abs(c.x[o]! - c.x[id]!);
            if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
            g = Math.min(g, Math.hypot(dx, c.y[o]! - c.y[id]!) / w.sizeScale);
          }
          let bin = GAPS.findIndex((b) => g <= b);
          if (bin < 0) bin = GAPS.length;
          wd.gap[bin]!++;
          if (c.moving[id] !== 1) wd.gapStill[bin]!++;
        }
      }
      const armed = wd.aNear >= ARMED && wd.dNear >= ARMED;
      if (armed) {
        day.armed++;
        day.engagedArmed += wd.engaged;
      }
      let rec = byWar.get(war.id);
      if (!rec) byWar.set(war.id, (rec = { name: `${war.id} ${tag(war.sides[0][0]!)}–${tag(war.sides[1][0]!)}`, days: [] }));
      rec.days.push(wd);
    }
    world.push(day);
  }
  const mean = (a: number[]): number => (a.length ? Math.round((a.reduce((k, x) => k + x, 0) / a.length) * 10) / 10 : 0);
  const wars = [...byWar.values()].map((r) => ({
    war: r.name,
    days: r.days.length,
    a: mean(r.days.map((x) => x.a)),
    d: mean(r.days.map((x) => x.d)),
    aNear: mean(r.days.map((x) => x.aNear)),
    dNear: mean(r.days.map((x) => x.dNear)),
    front: mean(r.days.map((x) => x.front)),
    engaged: mean(r.days.map((x) => x.engaged)),
    armedDays: r.days.filter((x) => x.aNear >= ARMED && x.dNear >= ARMED).length,
    gap: [0, 1, 2, 3, 4].map((i) => mean(r.days.map((x) => x.gap[i]!))),
    gapStill: [0, 1, 2, 3, 4].map((i) => mean(r.days.map((x) => x.gapStill[i]!))),
  }));
  wars.sort((x, y) => y.a + y.d - (x.a + x.d));
  const row = {
    seed,
    bin,
    day: Math.floor(w.tick / 24),
    engaged: mean(world.map((x) => x.engaged)),
    landAtWar: mean(world.map((x) => x.landAtWar)),
    wars: mean(world.map((x) => x.wars)),
    armed: mean(world.map((x) => x.armed)),
    engagedArmed: mean(world.map((x) => x.engagedArmed)),
    topWars: wars.slice(0, 8),
  };
  result.push(row);
  process.stderr.write(`${seed} ${bin}: engaged ${row.engaged}, wars ${row.wars}, armed ${row.armed}, engaged in armed ${row.engagedArmed}\n`);
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`done: ${result.length} saves -> ${out}`);
