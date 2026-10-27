/**
 * PLAN 7.138: how far apart the two sides' land armies stand. From a saved state (or 1938 after
 * `skip` days), per war with land formations on both sides: for each formation (not a fleet, a wing
 * or aboard) its straight-line distance in cells to the nearest formation of the other side on the
 * same landmass (the nav grid's component), bucketed (< 3, 12, 30, 60, 120, farther, none on its
 * landmass); and what it does (engaged, retreat, march on an enemy cell, march to an own cell, stand).
 *
 * Usage: npx tsx tools/diag/warGaps.ts <out.json> <days> <seed:state.bin|seed:1938:skipDays> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin, skip] = a.split(':');
  return { seed: Number(seed), bin: bin!, skip: Number(skip ?? 0) };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const EDGES = [3, 12, 30, 60, 120];
const res: unknown[] = [];
for (const k of cases) {
  const s = new Sim({ scenario: '1938', seed: k.seed, assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  if (k.bin !== '1938') s.load(new Uint8Array(readFileSync(k.bin)));
  for (let d = 0; d < k.skip; d++) s.step(24, (ww) => ((ww.out.events.length = 0), (ww.out.fires.length = 0)));
  const sum = { gap: new Array(EDGES.length + 2).fill(0) as number[], doing: {} as Record<string, number> };
  const perWar: unknown[] = [];
  for (let day = 0; day < days; day++) {
    if (day > 0) s.step(24, (ww) => ((ww.out.events.length = 0), (ww.out.fires.length = 0)));
    const comp = navOf(w).grid.component;
    const W = w.cells.w;
    const loop = w.settings.loopingMap;
    const ctl = w.cells.controller;
    const c = w.formations.cols;
    const land: number[] = [];
    w.formations.forEach((id) => {
      if (!w.isFleet(id) && !w.isWing(id) && !w.embarked.has(id) && !w.offLand(id)) land.push(id);
    });
    const cellOf = (id: number) => Math.floor(c.y[id]!) * W + Math.floor(c.x[id]!);
    for (const war of w.wars.list) {
      const A = land.filter((id) => war.sides[0].includes(c.nation[id]!));
      const B = land.filter((id) => war.sides[1].includes(c.nation[id]!));
      if (A.length === 0 || B.length === 0) continue;
      const gap = new Array(EDGES.length + 2).fill(0) as number[];
      const doing: Record<string, number> = {};
      for (const [mine, theirs, side] of [[A, B, 0], [B, A, 1]] as const) {
        const foes = new Set(war.sides[1 - side]);
        for (const id of mine) {
          const cc = comp[cellOf(id)];
          let best = Infinity;
          for (const j of theirs) {
            if (comp[cellOf(j)] !== cc) continue;
            let dx = Math.abs(c.x[id]! - c.x[j]!);
            if (loop && dx > W / 2) dx = W - dx;
            const dy = c.y[id]! - c.y[j]!;
            best = Math.min(best, Math.hypot(dx, dy));
          }
          const b = best === Infinity ? EDGES.length + 1 : EDGES.findIndex((e) => best < e);
          const bi = b < 0 ? EDGES.length : b;
          gap[bi]!++;
          sum.gap[bi]!++;
          let what = 'stand';
          if (c.engaged[id]) what = 'engaged';
          else if (c.retreat[id]! > 0) what = 'retreat';
          else if (c.moving[id] === 1) what = foes.has(ctl[c.targetCell[id]!]!) ? 'attack' : 'march';
          const key = `${bi}:${what}`;
          doing[key] = (doing[key] ?? 0) + 1;
          sum.doing[key] = (sum.doing[key] ?? 0) + 1;
        }
      }
      if (day === 0) perWar.push({ id: war.id, a: war.sides[0].slice(0, 6).map(tag).join(' '), b: war.sides[1].slice(0, 6).map(tag).join(' '), af: A.length, bf: B.length, gap, doing });
    }
  }
  res.push({ seed: k.seed, bin: k.bin, skip: k.skip, sum, perWar });
  const tot = sum.gap.reduce((a, b) => a + b, 0);
  process.stdout.write(`${k.seed} ${k.bin}:${k.skip} gaps <3,12,30,60,120,more,none: ${sum.gap.map((g) => (g / tot).toFixed(3)).join(' ')} (n ${tot})\n`);
  const keys = Object.keys(sum.doing).sort();
  process.stdout.write(`  doing ${keys.map((x) => `${x}=${sum.doing[x]}`).join(' ')}\n`);
}
writeFileSync(out, JSON.stringify(res, null, 1));
