/**
 * PLAN 7.79a: the piles of a nation at war. From a saved state, daily for `days` days: the land
 * formations of living nations at war (on land, not aboard) grouped by nation and the cell they
 * stand on; a group of `MIN` or more is a pile. Per pile: the days it was seen, whether its
 * formations are on the march or engaged, its distance in cells to the nation's nearest own front
 * cell (`frontierOf`, a cell of the nation beside an enemy's), and whether that front is on its
 * landmass (`world.cells.land` of the cells).
 *
 * Usage: npx tsx tools/diag/piles.ts <out.json> <days> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { neighbours4 } from '../../src/sim/nav/grid';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { frontierOf } from '../../src/sim/systems/territory';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const MIN = 30;
const out = process.argv[2]!;
const days = Number(process.argv[3]);
const cases = process.argv.slice(4).map((a) => {
  const [seed, bin] = a.split(':');
  return { seed: Number(seed), bin: bin! };
});
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const result: unknown[] = [];
for (const { seed, bin } of cases) {
  const s = new Sim({ scenario: '1938', seed, assets: loadAssets1938(SIZE_1938.w) });
  s.load(new Uint8Array(readFileSync(bin)));
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  const { w: cw, h: ch } = w.cells;
  const land = navOf(w).grid.component;
  const piles = new Map<string, { nation: string; cell: number; days: number; most: number; moving: number; engaged: number; frontGap: number; frontOnLand: boolean; wars: string[] }>();
  const nb: number[] = [];
  for (let d = 0; d < days; d++) {
    s.step(24, quiet);
    const c = w.formations.cols;
    const fighting = w.wars.nations();
    const groups = new Map<string, number[]>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      const n = c.nation[id]!;
      if (!fighting.has(n) || w.nations.cols.living[n] !== 1) return;
      const cell = Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!);
      const k = `${n}:${cell}`;
      let g = groups.get(k);
      if (!g) groups.set(k, (g = []));
      g.push(id);
    });
    const frontier = frontierOf(w);
    const ctl = w.cells.controller;
    for (const [k, ids] of groups) {
      if (ids.length < MIN) continue;
      const [ns, cs] = k.split(':');
      const n = Number(ns);
      const cell = Number(cs);
      let gap = Infinity;
      let onLand = false;
      for (const fc of frontier) {
        if (ctl[fc] !== n) continue;
        let enemyNext = false;
        for (const m of neighbours4(fc, cw, ch, w.settings.loopingMap, nb)) if (w.wars.atWar(n, ctl[m]!)) enemyNext = true;
        if (!enemyNext) continue;
        let dx = Math.abs((fc % cw) - (cell % cw));
        if (w.settings.loopingMap && dx > cw / 2) dx = cw - dx;
        const g = Math.hypot(dx, Math.floor(fc / cw) - Math.floor(cell / cw)) / w.sizeScale;
        if (g < gap) {
          gap = g;
          onLand = land[fc] === land[cell];
        }
      }
      let p = piles.get(k);
      if (!p) {
        const wars = w.wars.list.filter((x) => x.sides[0].includes(n) || x.sides[1].includes(n)).map((x) => `${tag(x.sides[0][0]!)}–${tag(x.sides[1][0]!)}`);
        piles.set(k, (p = { nation: tag(n), cell, days: 0, most: 0, moving: 0, engaged: 0, frontGap: Math.round(gap), frontOnLand: onLand, wars }));
      }
      p.days++;
      p.most = Math.max(p.most, ids.length);
      p.moving = Math.max(p.moving, ids.filter((id) => c.moving[id] === 1).length);
      p.engaged = Math.max(p.engaged, ids.filter((id) => c.engaged[id] === 1).length);
    }
  }
  const list = [...piles.values()].sort((a, b) => b.days - a.days || b.most - a.most);
  result.push({ seed, bin, days, piles: list, longPiles: list.filter((p) => p.days >= Math.min(30, days)).length });
  process.stderr.write(`${seed} ${bin}: ${list.length} piles, ${list.filter((p) => p.days >= Math.min(30, days)).length} long\n`);
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(`done: ${result.length} saves -> ${out}`);
