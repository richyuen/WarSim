/**
 * PLAN 7.104a: why the land formations of nations at war late are not in contact. From a saved
 * state, after one day (`s.step(24)`), per warring pair of living nations (a, b), each side's land
 * formations on land (not fleets or wings, not aboard), their men, the share under 500 men, and
 * the nearest a–b pair's distance (cells); and per land formation of a nation at war, the distance
 * to its nearest enemy land formation, binned (contact 1.5, 4, 12, 30, 60, beyond, none of an
 * enemy on its landmass), split by whether it marches on an enemy cell, holds, or stands.
 * Per pair also whether either side has no land formation at all (an unarmed war).
 *
 * Usage: npx tsx tools/diag/contactGap.ts <out.json> <seed:state.bin | seed:1938@days> [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { SIZE_1938, TAGS_1938 } from '../../src/sim/scenario1938';
import { Sim } from '../../src/sim/sim';
import { navOf } from '../../src/sim/world';
import { loadAssets1938 } from '../headless/assets';

const BINS = [1.5, 4, 12, 30, 60, Infinity] as const;
const out = process.argv[2]!;
const tag = (n: number): string => TAGS_1938[n - 1] ?? `#${n}`;
const rows: unknown[] = [];
for (const a of process.argv.slice(3)) {
  const [seedS, src] = a.split(':');
  const s = new Sim({ scenario: '1938', seed: Number(seedS), assets: loadAssets1938(SIZE_1938.w) });
  const w = s.world;
  const quiet = (ww: typeof w): void => {
    ww.out.events.length = 0;
    ww.out.fires.length = 0;
  };
  if (src!.startsWith('1938@')) for (let d = Number(src!.slice(5)); d > 0; d--) s.step(24, quiet);
  else s.load(new Uint8Array(readFileSync(src!)));
  s.step(24, quiet);
  const c = w.formations.cols;
  const nat = w.nations.cols;
  const cw = w.cells.w;
  const loop = w.settings.loopingMap;
  const comp = navOf(w).grid.component;
  const ctl = w.cells.controller;
  const scale = w.atSize(1);
  const land: { id: number; n: number; x: number; y: number; m: number; land: number }[] = [];
  w.formations.forEach((id) => {
    if (w.isFleet(id) || w.isWing(id) || w.offLand(id)) return;
    const n = c.nation[id]!;
    if (nat.living[n] !== 1) return;
    land.push({ id, n, x: c.x[id]!, y: c.y[id]!, m: c.strength[id]!, land: comp[Math.floor(c.y[id]!) * cw + Math.floor(c.x[id]!)]! });
  });
  const dist = (p: { x: number; y: number }, q: { x: number; y: number }): number => {
    let dx = Math.abs(p.x - q.x);
    if (loop && dx > cw / 2) dx = cw - dx;
    return Math.hypot(dx, p.y - q.y) / scale;
  };
  const fighting = [...w.wars.nations()].filter((n) => nat.living[n] === 1);
  const fset = new Set(fighting);
  // Per formation: nearest enemy.
  const kinds = ['attack', 'hold', 'stand'] as const;
  const bins: Record<string, number[]> = Object.fromEntries(kinds.map((k) => [k, [0, 0, 0, 0, 0, 0, 0]]));
  for (const f of land) {
    if (!fset.has(f.n)) continue;
    let best = Infinity;
    let anyOnLand = false;
    for (const g of land) {
      if (!w.wars.atWar(f.n, g.n)) continue;
      if (g.land === f.land) anyOnLand = true;
      const d = dist(f, g);
      if (d < best) best = d;
    }
    const k = c.moving[f.id] === 1 ? (w.wars.atWar(f.n, ctl[c.targetCell[f.id]!]!) ? 'attack' : 'hold') : 'stand';
    const i = !anyOnLand ? 6 : BINS.findIndex((b) => best <= b);
    bins[k]![i]!++;
  }
  // Per pair.
  const pairs: unknown[] = [];
  let unarmed = 0;
  let pairsN = 0;
  for (let i = 0; i < fighting.length; i++)
    for (let j = i + 1; j < fighting.length; j++) {
      const p = fighting[i]!;
      const q = fighting[j]!;
      if (!w.wars.atWar(p, q)) continue;
      pairsN++;
      const A = land.filter((f) => f.n === p);
      const B = land.filter((f) => f.n === q);
      if (A.length === 0 || B.length === 0) unarmed++;
      let near = Infinity;
      for (const f of A) for (const g of B) near = Math.min(near, dist(f, g));
      const men = (L: typeof A): number => L.reduce((t, f) => t + f.m, 0);
      pairs.push({
        a: tag(p), b: tag(q), na: A.length, nb: B.length, menA: men(A), menB: men(B),
        hollowA: A.filter((f) => f.m < 500).length, hollowB: B.filter((f) => f.m < 500).length,
        nearest: Number.isFinite(near) ? Math.round(near * 10) / 10 : null,
      });
    }
  const row = { seed: Number(seedS), src, day: Math.floor(w.tick / 24), pairs: pairsN, unarmed, bins, binEdges: [...BINS.map(String), 'noneOnLand'], list: pairs };
  rows.push(row);
  process.stderr.write(`${seedS} ${src}: pairs ${pairsN} unarmed ${unarmed} bins ${JSON.stringify(bins)}\n`);
}
writeFileSync(out, JSON.stringify(rows, null, 1));
console.log(`done: ${rows.length} -> ${out}`);
