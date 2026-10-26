/**
 * PLAN 7.128b's measure: what the wars late are, one row per war on sampled days. From a saved
 * state, every `every` days for `days` days (after the day's 24 hours), per war running: its age,
 * whether it has a land front (`warsWithFront`) and `War.frontless`, its sides' land formations on
 * land (not fleets, wings or aboard) and how many of them are engaged, the nearest pair of
 * opposing formations on one landmass (cells of the map's default size), and each side's
 * formations within DEPLOY_RANGE_CELLS of a cell of the frontier against the other side.
 *
 * Usage: npx tsx tools/diag/lateWarFronts.ts <out.json> <days> <every> <seed:state.bin> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { warsWithFront } from '../../src/sim/systems/warFront';
import { frontierOf } from '../../src/sim/systems/territory';
import { DEPLOY_RANGE_CELLS } from '../../src/sim/ai/operational';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const out = process.argv[2]!;
const days = Number(process.argv[3] ?? 30);
const every = Number(process.argv[4] ?? 5);
const rows: unknown[] = [];
for (const a of process.argv.slice(5)) {
  const [seedS, src] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  s.load(new Uint8Array(readFileSync(src!)));
  for (let d = 1; d <= days; d++) {
    s.step(24, quiet);
    if (d % every !== 0) continue;
    const c = w.formations.cols;
    const nat = w.nations.cols;
    const cw = w.cells.w;
    const loop = w.settings.loopingMap;
    const comp = navOf(w).grid.component;
    const scale = w.atSize(1);
    const fronts = warsWithFront(w);
    const frontier = frontierOf(w);
    const controller = w.cells.controller;
    type F = { x: number; y: number; land: number; eng: boolean; n: number };
    const byNation = new Map<number, F[]>();
    w.formations.forEach((id) => {
      if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
      const n = c.nation[id]!;
      if (nat.living[n] !== 1) return;
      const f: F = {
        x: c.x[id]!, y: c.y[id]!, n,
        land: comp[Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!)]!,
        eng: c.engaged[id] === 1,
      };
      let l = byNation.get(n);
      if (!l) byNation.set(n, (l = []));
      l.push(f);
    });
    const dx = (ax: number, bx: number): number => {
      let v = Math.abs(ax - bx);
      if (loop && v > cw / 2) v = cw - v;
      return v;
    };
    const dist = (p: { x: number; y: number }, q: { x: number; y: number }): number =>
      Math.hypot(dx(p.x, q.x), p.y - q.y) / scale;
    for (const war of w.wars.list) {
      const sideN = (k: 0 | 1): number[] => war.sides[k].filter((n) => nat.living[n] === 1);
      const sA = sideN(0);
      const sB = sideN(1);
      const A = sA.flatMap((n) => byNation.get(n) ?? []);
      const B = sB.flatMap((n) => byNation.get(n) ?? []);
      let near = Infinity;
      for (const f of A) for (const g of B) if (f.land === g.land) near = Math.min(near, dist(f, g));
      // Frontier cells of each side against the other.
      const setA = new Set(sA);
      const setB = new Set(sB);
      const frA: { x: number; y: number }[] = [];
      const frB: { x: number; y: number }[] = [];
      for (const cell of frontier) {
        const k = controller[cell]!;
        const p = { x: (cell % cw) + 0.5, y: Math.floor(cell / cw) + 0.5 };
        if (setA.has(k)) frA.push(p);
        else if (setB.has(k)) frB.push(p);
      }
      const within = (L: F[], fr: { x: number; y: number }[]): number => {
        let k = 0;
        for (const f of L) {
          for (const p of fr) if (dist(f, p) <= DEPLOY_RANGE_CELLS) {
            k++;
            break;
          }
        }
        return k;
      };
      rows.push({
        seed: Number(seedS), day: Math.floor(w.tick / 24), war: war.id,
        age: Math.floor(w.tick / 24) - Math.floor(war.startTick / 24),
        front: fronts.has(war.id), frontless: war.frontless ?? 0,
        sideA: sA, sideB: sB,
        formsA: A.length, formsB: B.length,
        engA: A.filter((f) => f.eng).length, engB: B.filter((f) => f.eng).length,
        nearest: Number.isFinite(near) ? Math.round(near * 10) / 10 : null,
        frontierA: frA.length, frontierB: frB.length,
        nearFrontA: within(A, frA), nearFrontB: within(B, frB),
      });
    }
  }
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
